// Shared helpers for saving a job someone shared from the iPad, and for finding a company's address.
// (Files starting with "_" are not their own web address on Vercel.)

const clean = s => String(s || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&apos;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()

/** The link and whatever title text came with a share. */
export function parseShared(text) {
  const t = String(text || '')
  const url = (t.match(/https?:\/\/[^\s<>"']+/) || [])[0]?.replace(/[).,]+$/, '') || ''
  let rest = clean(t.replace(url, ' '))
    .replace(/^(check out this job( on (seek|linkedin|indeed))?|i found this job( on (seek|linkedin|indeed))?|job:|have a look at this job)[:!.\-–\s]*/i, '')
    .replace(/[-–|]\s*(seek|linkedin|indeed)\s*$/i, '').trim()
  if (/^https?:/i.test(rest)) rest = ''
  return { url, ...splitTitle(rest) }
}

/** "Videographer at Bright Studio" / "Bright Studio hiring Videographer in Melbourne | LinkedIn" / "Videographer Job in Richmond VIC - SEEK" */
export function splitTitle(raw) {
  let s = clean(raw).replace(/\s*[-–|]\s*(seek|linkedin|indeed(\.com)?)\s*$/i, '').trim()
  let company = '', place = ''
  let m = s.match(/^(.+?) hiring (.+?)(?: in (.+))?$/i)
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
  try { const x = new URL(url); const jk = x.searchParams.get('jk') || x.searchParams.get('currentJobId'); u = x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/$/, '') + (jk ? '#' + jk : '') } catch { /* keep */ }
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

/** Pull the job title, company, place and pay out of an ad page's HTML (sent by the iPad, which can open the ad).
 *  Uses the page's job data (JSON-LD JobPosting) when present, then common patterns, then the page title. */
export function parsePage(html) {
  const out = { title: '', company: '', place: '', pay: '' }
  if (!html) return out
  const h = String(html)
  for (const m of h.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1].trim())
      const list = [].concat(j['@graph'] || j)
      const jp = list.find(x => x && /JobPosting/i.test(String(x['@type'])))
      if (jp) {
        out.title = clean(jp.title)
        out.company = clean(jp.hiringOrganization?.name || '')
        const loc = [].concat(jp.jobLocation || [])[0]?.address
        out.place = clean(loc ? [loc.addressLocality, loc.addressRegion].filter(Boolean).join(', ') : '')
        const bs = jp.baseSalary?.value
        if (bs && (bs.minValue || bs.maxValue)) out.pay = [bs.minValue, bs.maxValue].filter(Boolean).map(n => '$' + Math.round(n).toLocaleString('en-AU')).join(' – ')
        break
      }
    } catch { /* not JSON */ }
  }
  const unq = v => clean(String(v).replace(/\\u0026/g, '&').replace(/\\"/g, '"'))
  if (!out.company) {
    const m = h.match(/"advertiser"\s*:\s*\{[^{}]*?"(?:name|description)"\s*:\s*"([^"]{2,120})"/) || h.match(/"(?:advertiserName|companyName|hiringOrganizationName)"\s*:\s*"([^"]{2,120})"/) || h.match(/data-automation=["']advertiser-name["'][^>]*>([^<]{2,120})</)
    if (m) out.company = unq(m[1])
  }
  if (!out.place) { const m = h.match(/data-automation=["']job-detail-location["'][^>]*>([^<]{2,120})</); if (m) out.place = unq(m[1]) }
  if (!out.title) {
    const m = h.match(/data-automation=["']job-detail-title["'][^>]*>([^<]{2,160})</)
    const og = h.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || h.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
    const tt = h.match(/<title[^>]*>([^<]+)<\/title>/i)
    const t = splitTitle(m ? m[1] : og ? og[1] : tt ? tt[1] : '')
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
