// Shared helpers for saving a job someone shared from the iPad, and for finding a company's address.
// (Files starting with "_" are not their own web address on Vercel.)

const clean = s => String(s || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&apos;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()

/** Text that is really a web address (so it is never used as a job title). */
export const looksLikeLink = s => /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*$/i.test(String(s || '').trim())

/** The link and whatever title text came with a share. */
export function parseShared(text) {
  const t = String(text || '')
  // a full link, or a bare one like "seek.com.au/job/12345" (the Seek app sometimes shares it without https://)
  const full = (t.match(/https?:\/\/[^\s<>"']+/) || [])[0]
  const bare = full ? '' : (t.match(/(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com\.au|com|net\.au|au)\/[^\s<>"']+/i) || [])[0]
  const url = (full || (bare ? 'https://' + bare : '')).replace(/[).,]+$/, '')
  let rest = clean(t.replace(full || bare || url, ' '))
    .replace(/^check out this job at (.+?):\s*(.+)$/i, '$2 at $1')
    .replace(/^(check out this job( on (seek|linkedin|indeed))?|i found this job( on (seek|linkedin|indeed))?|job:|have a look at this job)[:!.\-–\s]*/i, '')
    .replace(/[-–|]\s*(seek|linkedin|indeed)\s*$/i, '').trim()
  if (/^https?:/i.test(rest) || looksLikeLink(rest)) rest = ''
  return { url, ...splitTitle(rest) }
}

/** "Videographer at Bright Studio" / "Bright Studio hiring Videographer in Melbourne | LinkedIn" / "Videographer Job in Richmond VIC - SEEK" */
export function splitTitle(raw) {
  let s = clean(raw).replace(/\s*[-–|]\s*(seek|linkedin|indeed(\.com)?)\s*$/i, '').trim()
  let company = '', place = ''
  let m = s.match(/^([^|]+?)\s*\|\s*([^|]+?)$/)
  if (m && !/ hiring /i.test(s)) return { title: m[1].trim(), company: m[2].trim(), place: '' }
  m = s.match(/^(.+?) hiring (.+?)(?: in (.+))?$/i)
  if (m) return { title: m[2].trim(), company: m[1].trim(), place: (m[3] || '').trim() }
  m = s.match(/^(.+?) job in (.+)$/i)
  if (m) { s = m[1].trim(); place = m[2].trim() }
  m = s.match(/^(.+?) (?:at|@) (.+)$/i)
  if (m) { s = m[1].trim(); company = m[2].trim() }
  return { title: s, company, place }
}

export function siteOf(url) {
  const h = (() => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } })()
  if (/seek\./.test(h)) return 'Seek'
  if (/linkedin\./.test(h)) return 'LinkedIn'
  if (/indeed\./.test(h)) return 'Indeed'
  if (/jora\./.test(h)) return 'Jora'
  return h
}

/** Stable id for a shared link, ignoring tracking bits after "?" (Seek and Indeed keep the job number in the path or jk=). */
export function linkKey(url) {
  let u = url
  try { const x = new URL(url); const jk = x.searchParams.get('jk') || x.searchParams.get('currentJobId'); u = x.hostname.replace(/^www\./, '').replace(/^seek\.com\.au$/, 'au.seek.com') + x.pathname.replace(/\/$/, '') + (jk ? '#' + jk : '') } catch { /* keep */ }
  let h = 2166136261
  for (const c of u.toLowerCase()) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0 }
  return 'link-' + h.toString(36)
}

/** Best effort: read the page's own title (like a link preview). Many job sites block this; then we keep what was shared. */
export async function pageTitle(url) {
  try {
    const ctl = AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined
    const r = await fetch(url, { signal: ctl, headers: { 'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', Accept: 'text/html' } })
    if (!r.ok) return ''
    const html = (await r.text()).slice(0, 200000)
    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
    const tt = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    return clean(og?.[1] || tt?.[1] || '')
  } catch { return '' }
}

const WORK = { FULL_TIME: 'Full time', PART_TIME: 'Part time', CASUAL: 'Casual', CONTRACT_TEMP: 'Contract', CONTRACT: 'Contract', CONTRACTOR: 'Contract', TEMPORARY: 'Temporary', INTERN: 'Internship', INTERNSHIP: 'Internship', VOLUNTEER: 'Volunteer', PER_DIEM: 'Casual' }
const workLabel = v => [].concat(v || []).map(x => WORK[String(x).toUpperCase().replace(/[\s-]+/g, '_')] || clean(String(x)).replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())).filter(Boolean).join(', ')
const melDay = iso => { try { return iso ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne' }).format(new Date(iso)) : '' } catch { return '' } }

/** Pull the job details out of an ad page's HTML (sent by the iPad, which can open the ad).
 *  Seek: the page's own job data and its labelled fields. LinkedIn, Indeed and most others: JSON-LD JobPosting.
 *  Returns title, company, place, pay, work (Full time / Part time / Casual / Contract), deadline and posted (YYYY-MM-DD). */
export function parsePage(html) {
  const out = { title: '', company: '', place: '', pay: '', work: '', deadline: '', posted: '' }
  if (!html) return out
  const h = String(html)
  const unq = v => clean(String(v).replace(/\\u002F/gi, '/').replace(/\\u0026/gi, '&').replace(/\\"/g, '"'))
  const auto = name => { const m = h.match(new RegExp(`data-automation=["']${name}["'][^>]*>([\\s\\S]{0,600}?)</(?:h1|h2|span|div|a|p)>`)); return m ? clean(m[1]) : '' }
  // JSON-LD JobPosting (LinkedIn, Indeed, company sites)
  for (const m of h.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1].trim())
      const jp = [].concat(j['@graph'] || j).find(x => x && /JobPosting/i.test(String(x['@type'])))
      if (!jp) continue
      out.title = clean(jp.title)
      out.company = clean(jp.hiringOrganization?.name || '')
      const loc = [].concat(jp.jobLocation || [])[0]?.address
      out.place = clean(loc ? [loc.addressLocality, loc.addressRegion].filter(Boolean).join(', ') : '')
      const bs = jp.baseSalary?.value
      if (bs && (bs.minValue || bs.maxValue || bs.value)) out.pay = [bs.minValue || bs.value, bs.maxValue].filter(Boolean).map(n => '$' + Math.round(n).toLocaleString('en-AU')).join(' – ') + (bs.unitText && /hour/i.test(bs.unitText) ? ' an hour' : '')
      out.work = workLabel(jp.employmentType)
      out.deadline = melDay(jp.validThrough)
      out.posted = melDay(jp.datePosted)
      break
    } catch { /* not JSON */ }
  }
  // Seek's labelled fields and its job data
  out.title = out.title || auto('job-detail-title')
  out.company = out.company || unq((h.match(/"advertiser":\{"__typename":"Advertiser","id":"[^"]*","name":"([^"]{1,140})"/) || h.match(/"advertiser"\s*:\s*\{[^{}]*?"name"\s*:\s*"([^"]{2,140})"/) || h.match(/"(?:advertiserName|companyName|hiringOrganizationName)"\s*:\s*"([^"]{2,140})"/) || [])[1] || '') || auto('advertiser-name')
  out.place = out.place || auto('job-detail-location')
  out.pay = out.pay || auto('job-detail-salary') || unq((h.match(/"salary":\{"__typename":"JobSalary"[^{}]*?"label":"([^"]{2,120})"/) || [])[1] || '')
  out.work = out.work || auto('job-detail-work-type') || workLabel(((h.match(/"workTypes":\{[^{}]*?"label":\[([^\]]*)\]/) || [])[1] || '').match(/[A-Z_]+/g))
  out.deadline = out.deadline || melDay((h.match(/"expiresAt":\{[^{}]*?"dateTimeUtc":"([^"]+)"/) || [])[1])
  out.posted = out.posted || melDay((h.match(/"listedAt":\{[^{}]*?"dateTimeUtc":"([^"]+)"/) || [])[1])
  if (!out.title) {
    const og = h.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || h.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
    const tt = h.match(/<title[^>]*>([^<]+)<\/title>/i)
    const t = splitTitle(og ? og[1] : tt ? tt[1] : '')
    out.title = t.title; out.company = out.company || t.company; out.place = out.place || t.place
  }
  return out
}

/** The iPad sends the page base64-encoded (so nothing is lost on the way); plain HTML or text also works. */
export function decodePage(v) {
  const s = String(v || '').trim()
  if (!s) return ''
  if (/^[A-Za-z0-9+/=\s]+$/.test(s) && s.length > 100) { try { return Buffer.from(s.replace(/\s+/g, ''), 'base64').toString('utf8') } catch { /* not base64 */ } }
  return s
}

/** Backup: ask Google (through SerpApi) what it knows about this exact ad link. One search. */
export async function googleDetails(url, serpKey) {
  if (!url || !serpKey) return { title: '', company: '', place: '' }
  const q = new URLSearchParams({ engine: 'google', q: url.split('?')[0], hl: 'en', gl: 'au', google_domain: 'google.com.au', num: '5', api_key: serpKey })
  try {
    const r = await fetch(`https://serpapi.com/search.json?${q}`)
    if (!r.ok) return { title: '', company: '', place: '' }
    const j = await r.json()
    const id = (url.match(/\/job\/(\d+)/) || [])[1]
    const hit = (j.organic_results || []).find(o => (id ? String(o.link).includes(id) : true)) || (j.organic_results || [])[0]
    if (!hit) return { title: '', company: '', place: '' }
    const t = splitTitle(hit.title || '')
    if (!t.company) { const m = String(hit.snippet || '').match(/^([A-Z][\w&'.\- ]{1,60}?) (?:is (?:seeking|looking|hiring)|are (?:seeking|looking|hiring))/); if (m) t.company = clean(m[1]) }
    return t
  } catch { return { title: '', company: '', place: '' } }
}

/** Pages that are a sign-in wall or a block, not the ad (LinkedIn returns these to apps). */
export const isBlockedPage = html => !html || html.length < 4000 || /authwall|status code 999|Join LinkedIn|Sign in to view/i.test(String(html).slice(0, 6000))

/** Find the same job in Google's job listings (through SerpApi) to fill in salary, work type, location and posted date.
 *  Used when the ad page could not be read (LinkedIn blocks it). One search; only a result from the same company is used. */
export async function googleJobDetails(title, company, serpKey, now = new Date()) {
  const none = { pay: '', work: '', place: '', posted: '', company: '' }
  if (!title || !serpKey) return none
  const q = new URLSearchParams({ engine: 'google_jobs', q: [title, company].filter(Boolean).join(' '), hl: 'en', gl: 'au', google_domain: 'google.com.au', location: 'Australia', api_key: serpKey })
  try {
    const r = await fetch(`https://serpapi.com/search.json?${q}`)
    if (!r.ok) return none
    const j = await r.json()
    const n = v => clean(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const list = j.jobs_results || []
    const hit = list.find(x => company && (n(x.company_name).includes(n(company)) || n(company).includes(n(x.company_name))) && (n(x.title).includes(n(title).split(' ')[0]) || n(title).includes(n(x.title).split(' ')[0])))
      || (!company ? list.find(x => n(x.title) === n(title)) : null)
    if (!hit) return none
    const de = hit.detected_extensions || {}
    const m = String(de.posted_at || '').toLowerCase().match(/(\d+|an?|one)\+?\s*(minute|hour|day|week|month)s?\s*ago/)
    const days = m ? ({ minute: 0, hour: 0, day: 1, week: 7, month: 30 }[m[2]] * (/^\d+$/.test(m[1]) ? Number(m[1]) : 1)) : null
    return {
      pay: clean(de.salary || ''), work: workLabel(String(de.schedule_type || '').split(/,|\band\b/).map(x => x.trim()).filter(Boolean)), place: clean(hit.location || ''),
      posted: days === null ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne' }).format(new Date(now.getTime() - days * 86400000)),
      company: clean(hit.company_name || ''),
    }
  } catch { return none }
}

/** The company's address from Google Maps (through SerpApi). One search; returns '' when nothing clear is found. */
export async function findAddress(company, near, serpKey) {
  if (!company || !serpKey) return ''
  const q = new URLSearchParams({ engine: 'google_maps', type: 'search', q: `${company} ${near || 'Melbourne'}`, hl: 'en', gl: 'au', google_domain: 'google.com.au', ll: '@-37.8136,144.9631,11z', api_key: serpKey })
  try {
    const r = await fetch(`https://serpapi.com/search.json?${q}`)
    if (!r.ok) return ''
    const j = await r.json()
    const p = j.place_results || (j.local_results || [])[0]
    return clean(p?.address || '')
  } catch { return '' }
}

export async function userOk(req, url, anon) {
  const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!tok || !url || !anon) return false
  const r = await fetch(url + '/auth/v1/user', { headers: { apikey: anon, Authorization: 'Bearer ' + tok } })
  return r.ok
}

export const MEL_DAY = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne' }).format(d)
