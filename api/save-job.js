// The iPad "Save to job board" Share button (an Apple Shortcut) sends the job link here.
// It puts the job in Michael's Saved list with its link, and looks up the company's address when it knows the company.
// The Shortcut calls: POST /api/save-job?key=<the key from Projects → Michael → Edit → iPad Share button>
// with a form field "shared" holding whatever the Share menu gave it (a link, or text with a link in it).
import { findAddress, linkKey, MEL_DAY, pageTitle, parseShared, siteOf, splitTitle } from './_jobshare.js'

const say = (res, code, text) => { res.status(code).setHeader('Content-Type', 'text/plain; charset=utf-8'); res.send(text) }

export default async function handler(req, res) {
  const url = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, ''), svc = process.env.SUPABASE_SERVICE_KEY, serp = process.env.SERPAPI_KEY
  if (!url || !svc) { say(res, 500, 'The job board is not set up yet (SUPABASE_SERVICE_KEY is missing in Vercel).'); return }
  const db = (path, init = {}) => fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json', ...(init.headers || {}) } })

  const key = String(req.query?.key || '')
  const kr = await db('app_keys?id=eq.job_share&select=value')
  const stored = kr.ok ? (await kr.json())[0]?.value : ''
  if (!stored || !key || key !== stored) { say(res, 401, 'This Share button is not linked to your job board. Copy a fresh link from Projects → Michael → Edit.'); return }

  let b = req.body
  if (b === undefined) { try { let t = ''; for await (const c of req) t += c; b = t } catch { b = '' } }
  const raw = typeof b === 'string' ? b : b && typeof b === 'object' ? (b.shared ?? b.url ?? b.text ?? JSON.stringify(b)) : (req.query?.shared || '')
  let got = parseShared(Array.isArray(raw) ? raw.join(' ') : typeof raw === 'object' ? JSON.stringify(raw) : String(raw || ''))
  if (!got.url && req.query?.shared) got = parseShared(String(req.query.shared))
  if (!got.url) { say(res, 400, 'No link came through. Share the job ad itself (the Share button on the ad).'); return }

  let { title, company, place } = got
  if (!title) { const t = splitTitle(await pageTitle(got.url)); title = t.title; company = company || t.company; place = place || t.place }
  const site = siteOf(got.url)
  if (!title) title = `${site || 'Job'} ad (tap to open)`
  const id = linkKey(got.url)

  // already on the board? just move it to Saved
  const ex = await db(`jobs?id=eq.${encodeURIComponent(id)}&select=id,company,address`)
  const old = ex.ok ? (await ex.json())[0] : null
  if (old) {
    await db(`jobs?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'saved' }) })
    say(res, 200, `Already on the board, now in Saved: ${title}`); return
  }
  let address = ''
  if (company) {
    const c = await db(`jobs?company=ilike.${encodeURIComponent(company)}&address=neq.&select=address&limit=1`)
    address = (c.ok ? (await c.json())[0]?.address : '') || await findAddress(company, place, serp)
  }
  const row = { id, title, company, place, pay: '', url: got.url, posted: null, search: 'shared', kind: `via ${site} · shared from iPad`, first_seen: MEL_DAY(), status: 'saved', address }
  const ins = await db('jobs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) })
  if (!ins.ok) { say(res, 502, 'Could not save: ' + (await ins.text()).slice(0, 200)); return }
  say(res, 200, `Saved to the job board: ${title}${company ? ' at ' + company : ''}`)
}
