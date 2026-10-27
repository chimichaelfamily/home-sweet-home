// Collects job ads for Michael's job board.
// Main source: Google's job search (the jobs panel that gathers ads from Seek, LinkedIn, Indeed and company sites),
// read through SerpApi's free plan (about 250 searches a month; we use 1 per saved search per evening).
// Optional extra: Adzuna, only while ADZUNA_APP_ID / ADZUNA_APP_KEY are set and its calls last. Errors there never stop the run.
// Vercel Cron calls this twice each evening (see vercel.json); only the call in the 7pm hour Melbourne time runs, so it is
// 7pm all year round. The app's "Check now" button calls it too.
// Vercel environment variables: SERPAPI_KEY, SUPABASE_SERVICE_KEY (plus VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY);
// optional ADZUNA_APP_ID, ADZUNA_APP_KEY.

const MEL_HOUR = () => Number(new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', hour: 'numeric', hourCycle: 'h23' }).format(new Date()))
const MEL_DAY = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne' }).format(d)

const clean = s => String(s || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()
const norm = s => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
/** The same ad found on two sites (or twice) gets the same id, so it shows once. */
export function jobKey(title, company) {
  let h = 2166136261
  for (const c of `${norm(title)}|${norm(company)}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0 }
  return 'j-' + h.toString(36)
}
const k = n => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`)

// ---- Adzuna ----
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
export function adzunaRow(r, search) {
  const title = clean(r.title), company = clean(r.company?.display_name)
  return { id: jobKey(title, company), title, company, place: clean(r.location?.display_name), pay: payOf(r), url: r.redirect_url, posted: r.created ? MEL_DAY(new Date(r.created)) : null, search, kind: [kindOf(r), 'via Adzuna'].filter(Boolean).join(' · ') }
}

// ---- Google jobs (SerpApi) ----
/** "3 days ago", "an hour ago", "1 week ago" → a date. */
export function postedFrom(text, now = new Date()) {
  const m = String(text || '').toLowerCase().match(/(\d+|an?|one)\+?\s*(minute|hour|day|week|month)s?\s*ago/)
  if (!m) return null
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : 1
  const days = { minute: 0, hour: 0, day: n, week: n * 7, month: n * 30 }[m[2]]
  return MEL_DAY(new Date(now.getTime() - days * 86400000))
}
export function serpRow(r, search, now = new Date()) {
  const title = clean(r.title), company = clean(r.company_name)
  const de = r.detected_extensions || {}
  const apply = (r.apply_options || []).find(a => a && a.link)
  const via = clean(r.via || apply?.title || '').replace(/^via\s+/i, '')
  const url = apply?.link || r.share_link
  if (!title || !url) return null
  return { id: jobKey(title, company), title, company, place: clean(r.location), pay: clean(de.salary || ''), url, posted: postedFrom(de.posted_at, now), search, kind: [clean(de.schedule_type || ''), via && `via ${via}`].filter(Boolean).join(' · ') }
}

const CITIES = { melbourne: 'Melbourne, Victoria, Australia', sydney: 'Sydney, New South Wales, Australia', brisbane: 'Brisbane, Queensland, Australia', perth: 'Perth, Western Australia, Australia', adelaide: 'Adelaide, South Australia, Australia', canberra: 'Canberra, Australian Capital Territory, Australia', hobart: 'Hobart, Tasmania, Australia', geelong: 'Geelong, Victoria, Australia' }
export const placeName = p => CITIES[p.trim().toLowerCase()] || (/australia/i.test(p) ? p.trim() : `${p.trim()}, Australia`)

async function isHousehold(req, url, anon) {
  const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!tok || !url || !anon) return false
  const r = await fetch(url + '/auth/v1/user', { headers: { apikey: anon, Authorization: 'Bearer ' + tok } })
  return r.ok
}

export default async function handler(req, res) {
  const url = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, ''), anon = process.env.VITE_SUPABASE_ANON_KEY
  const svc = process.env.SUPABASE_SERVICE_KEY, serp = process.env.SERPAPI_KEY
  const azId = process.env.ADZUNA_APP_ID, azKey = process.env.ADZUNA_APP_KEY
  const slot = req.query?.slot
  const fromCron = !!slot && (/vercel-cron/i.test(req.headers['user-agent'] || '') || (process.env.CRON_SECRET && req.headers.authorization === 'Bearer ' + process.env.CRON_SECRET))
  if (!fromCron) {
    if (!(await isHousehold(req, url, anon))) { res.status(401).json({ error: 'Please sign in.' }); return }
  } else if (MEL_HOUR() !== 19) { res.status(200).json({ ok: true, skipped: 'not 7pm in Melbourne' }); return }

  const missing = [!url && 'VITE_SUPABASE_URL', !svc && 'SUPABASE_SERVICE_KEY', !serp && !(azId && azKey) && 'SERPAPI_KEY'].filter(Boolean)
  if (missing.length) { res.status(500).json({ error: `Add ${missing.join(', ')} in Vercel → Settings → Environment Variables, then redeploy.` }); return }

  const db = (path, init = {}) => fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  const notes = []
  const rows = new Map()
  const put = r => { if (r && r.url && !rows.has(r.id)) rows.set(r.id, r) }
  try {
    const sr = await db('job_searches?select=what,place&order=sort')
    if (!sr.ok) throw new Error('Could not read the searches. Has 015_projects.sql been run? ' + (await sr.text()))
    const searches = await sr.json()

    // Google jobs via SerpApi: check the free allowance first (this check is free), then one search per saved search.
    if (serp) {
      let left = Infinity
      try { const a = await (await fetch(`https://serpapi.com/account.json?api_key=${encodeURIComponent(serp)}`)).json(); if (typeof a.total_searches_left === 'number') left = a.total_searches_left; else if (typeof a.plan_searches_left === 'number') left = a.plan_searches_left } catch { /* carry on */ }
      if (left < searches.length) notes.push(`Google job search: only ${left === Infinity ? 0 : left} free searches left this month, so it waits until the 1st.`)
      else {
        for (const s of searches) {
          const q = new URLSearchParams({ engine: 'google_jobs', q: s.what, hl: 'en', gl: 'au', google_domain: 'google.com.au', api_key: serp })
          if (s.place?.trim()) q.set('location', placeName(s.place))
          const r = await fetch(`https://serpapi.com/search.json?${q}`)
          const j = await r.json().catch(() => ({}))
          if (!r.ok) {
            // an unknown place name: try again with the place in the search words instead
            if (s.place?.trim() && /location/i.test(j.error || '')) {
              q.delete('location'); q.set('q', `${s.what} ${s.place.trim()}`)
              const r2 = await fetch(`https://serpapi.com/search.json?${q}`); const j2 = await r2.json().catch(() => ({}))
              if (r2.ok) { for (const x of j2.jobs_results || []) put(serpRow(x, s.what)); continue }
            }
            notes.push(`Google job search: ${j.error || r.status}`); break
          }
          for (const x of j.jobs_results || []) put(serpRow(x, s.what))
        }
      }
    }

    // Adzuna (optional extra while its calls last)
    if (azId && azKey) {
      for (const s of searches) {
        const q = new URLSearchParams({ app_id: azId, app_key: azKey, results_per_page: '50', max_days_old: '21', sort_by: 'date', what: s.what, 'content-type': 'application/json' })
        if (s.place?.trim()) q.set('where', s.place.trim())
        const r = await fetch(`https://api.adzuna.com/v1/api/jobs/au/search/1?${q}`).catch(() => null)
        if (!r || !r.ok) { notes.push(`Adzuna stopped (${r ? r.status : 'no answer'}); its free test calls may be used up. Google job search carries on.`); break }
        const j = await r.json().catch(() => ({}))
        for (const x of j.results || []) put(adzunaRow(x, s.what))
      }
    }

    const list = [...rows.values()]
    if (list.length) {
      // ignore-duplicates keeps ads already saved, applied or hidden exactly as they are
      const ins = await db('jobs?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(list) })
      if (!ins.ok) throw new Error('Could not save jobs: ' + (await ins.text()))
    }
    const cutoff = MEL_DAY(new Date(Date.now() - 30 * 86400000))
    await db(`jobs?status=in.(new,hidden)&first_seen=lt.${cutoff}`, { method: 'DELETE' })
    await db('job_runs?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: 1, ran_at: new Date().toISOString(), found: list.length, note: notes.join(' ').slice(0, 300) }) })
    res.status(200).json({ ok: true, found: list.length, notes })
  } catch (e) {
    await db('job_runs?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: 1, ran_at: new Date().toISOString(), found: 0, note: String(e.message || e).slice(0, 300) }) }).catch(() => {})
    res.status(502).json({ error: String(e.message || e) })
  }
}
