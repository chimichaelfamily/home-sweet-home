// The iPad "Save to job board" Share button (an Apple Shortcut) sends the job link here.
// It puts the job in Michael's Saved list with its link, and looks up the company's address when it knows the company.
// The Shortcut calls: POST /api/save-job?key=<the key from Projects → Michael → Edit → iPad Share button>
// with a form field "shared" holding whatever the Share menu gave it (a link, or text with a link in it).
import { decodePage, findAddress, googleDetails, linkKey, MEL_DAY, pageTitle, parsePage, parseShared, siteOf, splitTitle } from './_jobshare.js'

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

  // 1) what came with the share, 2) the ad page the iPad opened and sent, 3) the page from here, 4) Google
  let { title, company, place } = got
  let pay = ''
  const pg = parsePage(decodePage(b && typeof b === 'object' ? b.page : ''))
  title = title || pg.title; company = company || pg.company; place = place || pg.place; pay = pg.pay
  if (!title || !company) { const t = splitTitle(await pageTitle(got.url)); title = title || t.title; company = company || t.company; place = place || t.place }
  if (!title) { const g = await googleDetails(got.url, serp); title = g.title; company = company || g.company; place = place || g.place }
  const site = siteOf(got.url)
  const placeholder = `${site || 'Job'} ad (tap to open)`
  if (!title) title = placeholder
  const id = linkKey(got.url)

  let address = ''
  const lookUp = async () => {
    if (!company) return ''
    const c = await db(`jobs?company=ilike.${encodeURIComponent(company)}&address=neq.&select=address&limit=1`)
    return (c.ok ? (await c.json())[0]?.address : '') || await findAddress(company, place, serp)
  }

  // already on the board? move it to Saved and fill in anything it was missing
  const ex = await db(`jobs?id=eq.${encodeURIComponent(id)}&select=id,title,company,place,pay,address`)
  const old = ex.ok ? (await ex.json())[0] : null
  if (old) {
    const f = { status: 'saved' }
    if (title !== placeholder && (!old.title || / ad \(tap to open\)$/.test(old.title))) f.title = title
    if (company && !old.company) f.company = company
    if (place && !old.place) f.place = place
    if (pay && !old.pay) f.pay = pay
    if (!old.address && (f.company || old.company)) { company = f.company || old.company; address = await lookUp(); if (address) f.address = address }
    await db(`jobs?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(f) })
    say(res, 200, `Already on the board, now in Saved: ${f.title || old.title}`); return
  }
  address = await lookUp()
  const row = { id, title, company, place, pay, url: got.url, posted: null, search: 'shared', kind: `via ${site} · shared from iPad`, first_seen: MEL_DAY(), status: 'saved', address }
  const ins = await db('jobs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) })
  if (!ins.ok) { say(res, 502, 'Could not save: ' + (await ins.text()).slice(0, 200)); return }
  say(res, 200, `Saved to the job board: ${title}${company ? ' at ' + company : ''}`)
}
