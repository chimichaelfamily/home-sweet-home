// Collects job ads for Michael's job board from Adzuna (a job search site that gathers ads from across Australia).
// Vercel Cron calls this twice each evening (see vercel.json); only the call that lands in the 7pm hour Melbourne time runs,
// so it is 7pm all year, through daylight saving changes. The app's "Refresh now" button can also call it.
// Needs these Vercel environment variables: ADZUNA_APP_ID, ADZUNA_APP_KEY, SUPABASE_SERVICE_KEY (plus VITE_SUPABASE_URL).

const MEL_HOUR = () => Number(new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', hour: 'numeric', hourCycle: 'h23' }).format(new Date()))
const MEL_DAY = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne' }).format(d)

const clean = s => String(s || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()
const k = n => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`)
export function payOf(r) {
  if (String(r.salary_is_predicted) === '1') return ''
  const lo = Number(r.salary_min) || 0, hi = Number(r.salary_max) || 0
  if (!lo && !hi) return ''
  if (lo && hi && Math.round(lo) !== Math.round(hi)) return `${k(lo)} – ${k(hi)}`
  return k(lo || hi)
}
export function kindOf(r) {
  const t = { full_time: 'Full time', part_time: 'Part time' }[r.contract_time] || ''
  const c = { contract: 'Contract', permanent: 'Permanent' }[r.contract_type] || ''
  return [t, c].filter(Boolean).join(' · ')
}
export function toRow(r, search) {
  return {
    id: 'adzuna-' + r.id,
    title: clean(r.title),
    company: clean(r.company?.display_name),
    place: clean(r.location?.display_name),
    pay: payOf(r),
    url: r.redirect_url,
    posted: r.created ? MEL_DAY(new Date(r.created)) : null,
    search,
    kind: kindOf(r),
  }
}

async function isHousehold(req, url, anon) {
  const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!tok) return false
  if (process.env.CRON_SECRET && tok === process.env.CRON_SECRET) return 'cron'
  const r = await fetch(url + '/auth/v1/user', { headers: { apikey: anon, Authorization: 'Bearer ' + tok } })
  return r.ok ? 'app' : false
}

export default async function handler(req, res) {
  const url = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, ''), anon = process.env.VITE_SUPABASE_ANON_KEY
  const svc = process.env.SUPABASE_SERVICE_KEY, id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY
  const slot = req.query?.slot
  const fromCron = !!slot && (/vercel-cron/i.test(req.headers['user-agent'] || '') || (process.env.CRON_SECRET && req.headers.authorization === 'Bearer ' + process.env.CRON_SECRET))
  if (!fromCron) {
    if (!url || !anon || !(await isHousehold(req, url, anon))) { res.status(401).json({ error: 'Please sign in.' }); return }
  } else if (MEL_HOUR() !== 19) { res.status(200).json({ ok: true, skipped: 'not 7pm in Melbourne' }); return }

  const missing = [!url && 'VITE_SUPABASE_URL', !svc && 'SUPABASE_SERVICE_KEY', !id && 'ADZUNA_APP_ID', !key && 'ADZUNA_APP_KEY'].filter(Boolean)
  if (missing.length) { res.status(500).json({ error: `Add ${missing.join(', ')} in Vercel → Settings → Environment Variables, then redeploy.` }); return }

  const db = (path, init = {}) => fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  try {
    const sr = await db('job_searches?select=what,place&order=sort')
    if (!sr.ok) throw new Error('Could not read the searches. Has 015_projects.sql been run? ' + (await sr.text()))
    const searches = await sr.json()
    const rows = new Map()
    for (const s of searches) {
      const q = new URLSearchParams({ app_id: id, app_key: key, results_per_page: '50', max_days_old: '21', sort_by: 'date', what: s.what, 'content-type': 'application/json' })
      if (s.place?.trim()) q.set('where', s.place.trim())
      const r = await fetch(`https://api.adzuna.com/v1/api/jobs/au/search/1?${q}`)
      if (!r.ok) throw new Error(`Adzuna said ${r.status} for "${s.what}". ${r.status === 401 ? 'Check ADZUNA_APP_ID and ADZUNA_APP_KEY.' : ''}`)
      const j = await r.json()
      for (const x of j.results || []) if (x.redirect_url && !rows.has('adzuna-' + x.id)) rows.set('adzuna-' + x.id, toRow(x, s.what))
    }
    const list = [...rows.values()]
    if (list.length) {
      // ignore-duplicates keeps ads already saved, applied or hidden exactly as they are
      const ins = await db('jobs?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(list) })
      if (!ins.ok) throw new Error('Could not save jobs: ' + (await ins.text()))
    }
    const cutoff = MEL_DAY(new Date(Date.now() - 30 * 86400000))
    await db(`jobs?status=in.(new,hidden)&first_seen=lt.${cutoff}`, { method: 'DELETE' })
    await db('job_runs?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: 1, ran_at: new Date().toISOString(), found: list.length, note: '' }) })
    res.status(200).json({ ok: true, found: list.length })
  } catch (e) {
    await db('job_runs?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: 1, ran_at: new Date().toISOString(), found: 0, note: String(e.message || e).slice(0, 300) }) }).catch(() => {})
    res.status(502).json({ error: String(e.message || e) })
  }
}
