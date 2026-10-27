// Finds a saved job's company address on Google Maps (through SerpApi) and stores it on the job.
// Called by the app when a job is saved or its company name is changed. Reuses an address already found for the same company.
import { findAddress, userOk } from './_jobshare.js'

export default async function handler(req, res) {
  const url = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, ''), anon = process.env.VITE_SUPABASE_ANON_KEY
  const svc = process.env.SUPABASE_SERVICE_KEY, serp = process.env.SERPAPI_KEY
  if (!(await userOk(req, url, anon))) { res.status(401).json({ error: 'Please sign in.' }); return }
  if (!svc || !serp) { res.status(500).json({ error: 'Add SERPAPI_KEY and SUPABASE_SERVICE_KEY in Vercel, then redeploy.' }); return }
  const db = (path, init = {}) => fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  const id = String((req.body && req.body.id) || req.query?.id || '')
  const jr = await db(`jobs?id=eq.${encodeURIComponent(id)}&select=id,company,place`)
  const job = jr.ok ? (await jr.json())[0] : null
  if (!job) { res.status(404).json({ error: 'Job not found.' }); return }
  if (!job.company) { res.status(200).json({ address: '' }); return }
  const c = await db(`jobs?company=ilike.${encodeURIComponent(job.company)}&address=neq.&select=address&limit=1`)
  const address = (c.ok ? (await c.json())[0]?.address : '') || await findAddress(job.company, job.place, serp)
  if (address) await db(`jobs?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ address }) })
  res.status(200).json({ address })
}
