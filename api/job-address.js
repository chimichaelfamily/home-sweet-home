// Finds a saved job's company address on Google Maps (through SerpApi) and stores it on the job.
// Called by the app when a job is saved or its company name is changed. Reuses an address already found for the same company.
import { findAddress, googleDetails, userOk } from './_jobshare.js'

export default async function handler(req, res) {
  const url = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, ''), anon = process.env.VITE_SUPABASE_ANON_KEY
  const svc = process.env.SUPABASE_SERVICE_KEY, serp = process.env.SERPAPI_KEY
  if (!(await userOk(req, url, anon))) { res.status(401).json({ error: 'Please sign in.' }); return }
  if (!svc || !serp) { res.status(500).json({ error: 'Add SERPAPI_KEY and SUPABASE_SERVICE_KEY in Vercel, then redeploy.' }); return }
  const db = (path, init = {}) => fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  const id = String((req.body && req.body.id) || req.query?.id || '')
  const jr = await db(`jobs?id=eq.${encodeURIComponent(id)}&select=id,title,company,place,url`)
  const job = jr.ok ? (await jr.json())[0] : null
  if (!job) { res.status(404).json({ error: 'Job not found.' }); return }
  // a job shared without details: ask Google about the ad link first (one search)
  const f = {}
  if (!job.company || / ad \(tap to open\)$/.test(job.title)) {
    const g = await googleDetails(job.url, serp)
    if (g.title && / ad \(tap to open\)$/.test(job.title)) f.title = g.title
    if (g.company && !job.company) f.company = g.company
    if (g.place && !job.place) f.place = g.place
  }
  const company = f.company || job.company, place = f.place || job.place
  let address = ''
  if (company) {
    const c = await db(`jobs?company=ilike.${encodeURIComponent(company)}&address=neq.&select=address&limit=1`)
    address = (c.ok ? (await c.json())[0]?.address : '') || await findAddress(company, place, serp)
    if (address) f.address = address
  }
  if (Object.keys(f).length) await db(`jobs?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(f) })
  res.status(200).json({ address, ...f })
}
