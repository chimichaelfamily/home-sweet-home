import { supabase } from './backend.ts'

export type Owner = 'chi' | 'michael'
export type PKind = 'step' | 'tick' | 'idea' | 'goal' | 'task'
export interface ProjItem { id: string; owner: Owner; kind: PKind; title: string; sub: string; cat: string; num1: number; day: string | null; sort: number }
export type JobStatus = 'new' | 'saved' | 'applied' | 'hidden'
export interface Job { id: string; title: string; company: string; place: string; pay: string; url: string; posted: string | null; search: string; kind: string; first_seen: string; status: JobStatus; address?: string; deadline?: string | null }
export interface JobSearch { id: string; what: string; place: string; sort: number }

const KEY = 'home-sweet-home.projects.v1'
const local = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) || '') as T } catch { return d } }
const keep = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }

export async function loadProject(): Promise<ProjItem[]> {
  if (!supabase) return local<ProjItem[]>(KEY, [])
  const { data, error } = await supabase.from('project_items').select('*').order('sort')
  if (error) throw error
  return (data ?? []).map(r => ({ ...r, num1: Number(r.num1) })) as ProjItem[]
}
export async function saveProject(all: ProjItem[], op: { upsert?: ProjItem; remove?: string }) {
  if (!supabase) { keep(KEY, all); return }
  if (op.upsert) { const { error } = await supabase.from('project_items').upsert(op.upsert, { onConflict: 'id' }); if (error) throw error }
  if (op.remove) { const { error } = await supabase.from('project_items').delete().eq('id', op.remove); if (error) throw error }
}

export { tickId, routineStreak } from './routines.ts'

// ---- jobs ----
const JKEY = 'home-sweet-home.jobs.v1', SKEY = 'home-sweet-home.jobsearches.v1'
export const DEFAULT_SEARCHES: JobSearch[] = [
  { id: 's-video', what: 'videographer', place: 'Melbourne', sort: 1 },
  { id: 's-photo', what: 'photographer', place: 'Melbourne', sort: 2 },
  { id: 's-social', what: 'social media marketing', place: 'Melbourne', sort: 3 },
]
export async function loadJobs(): Promise<{ jobs: Job[]; searches: JobSearch[]; ran: { ran_at: string; found: number; note: string } | null }> {
  if (!supabase) return { jobs: local<Job[]>(JKEY, []), searches: local<JobSearch[]>(SKEY, DEFAULT_SEARCHES), ran: null }
  const [j, s, r] = await Promise.all([
    supabase.from('jobs').select('*').neq('status', 'hidden').order('posted', { ascending: false, nullsFirst: false }).limit(400),
    supabase.from('job_searches').select('*').order('sort'),
    supabase.from('job_runs').select('*').eq('id', 1).maybeSingle(),
  ])
  if (j.error) throw j.error
  if (s.error) throw s.error
  return { jobs: (j.data ?? []) as Job[], searches: (s.data ?? []) as JobSearch[], ran: (r.data as { ran_at: string; found: number; note: string } | null) ?? null }
}
export async function setJobStatus(id: string, status: JobStatus) {
  if (!supabase) { keep(JKEY, local<Job[]>(JKEY, []).map(j => (j.id === id ? { ...j, status } : j))); return }
  const { error } = await supabase.from('jobs').update({ status }).eq('id', id); if (error) throw error
}
export async function saveSearch(s: JobSearch | { remove: string }, all: JobSearch[]) {
  if (!supabase) { keep(SKEY, all); return }
  if ('remove' in s) { const { error } = await supabase.from('job_searches').delete().eq('id', s.remove); if (error) throw error; return }
  const { error } = await supabase.from('job_searches').upsert(s, { onConflict: 'id' }); if (error) throw error
}
/** Ask the server to collect jobs right now (same as the 7pm run). */
export async function refreshJobs(): Promise<number> {
  const tok = supabase ? (await supabase.auth.getSession()).data.session?.access_token : ''
  const r = await fetch('/api/jobs', { method: 'POST', headers: { Authorization: 'Bearer ' + (tok || '') } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Could not refresh (${r.status}).`)
  return j.found ?? 0
}
export const seekUrl = (s: JobSearch) => `https://www.seek.com.au/jobs?keywords=${encodeURIComponent(s.what.trim())}${s.place.trim() ? `&where=${encodeURIComponent(s.place.trim())}` : ''}&sortmode=ListedDate`
export const linkedinUrl = (s: JobSearch) => `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(s.what)}&location=${encodeURIComponent(s.place.trim() ? `${s.place.trim()}, Victoria, Australia` : 'Australia')}&sortBy=DD`

export const indeedUrl = (s: JobSearch) => `https://au.indeed.com/jobs?q=${encodeURIComponent(s.what.trim())}${s.place.trim() ? `&l=${encodeURIComponent(s.place.trim())}` : ''}&sort=date`
export const joraUrl = (s: JobSearch) => `https://au.jora.com/j?q=${encodeURIComponent(s.what.trim())}${s.place.trim() ? `&l=${encodeURIComponent(s.place.trim())}` : ''}&st=date`
export const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

/** Change a job's title or company (e.g. when a shared ad came through without them). */
export async function updateJob(id: string, f: Partial<Pick<Job, 'title' | 'company' | 'address' | 'pay' | 'place' | 'kind' | 'deadline'>>) {
  if (!supabase) { keep(JKEY, local<Job[]>(JKEY, []).map(j => (j.id === id ? { ...j, ...f } : j))); return }
  const { error } = await supabase.from('jobs').update(f).eq('id', id); if (error) throw error
}
/** Fill in a saved job's missing details (title, company, place) from Google, then find the company's address. */
export async function findJobAddress(id: string): Promise<Partial<Pick<Job, 'title' | 'company' | 'place' | 'address'>>> {
  if (!supabase) return {}
  const tok = (await supabase.auth.getSession()).data.session?.access_token || ''
  const r = await fetch('/api/job-address', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Could not look up the details (${r.status}).`)
  const { address, title, company, place } = j as Record<string, string | undefined>
  return Object.fromEntries(Object.entries({ address, title, company, place }).filter(([, v]) => v)) as Partial<Job>
}
/** The private key inside the iPad Share button's link. Made once, kept in the database. */
export async function shareKey(renew = false): Promise<string> {
  const make = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), b => b.toString(16).padStart(2, '0')).join('')
  if (!supabase) return 'demo-key'
  if (!renew) {
    const { data, error } = await supabase.from('app_keys').select('value').eq('id', 'job_share').maybeSingle()
    if (error) throw error
    if (data?.value) return data.value as string
  }
  const value = make()
  const { error } = await supabase.from('app_keys').upsert({ id: 'job_share', value }, { onConflict: 'id' }); if (error) throw error
  return value
}
