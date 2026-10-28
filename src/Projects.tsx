import { useEffect, useRef, useState, type ReactNode } from 'react'
import { logError } from './lib/errorlog.ts'
import { fmtShort, today } from './lib/dates.ts'
import type { Task } from './lib/types.ts'
import { lockRegistered, lockSupported, lockUnlock } from './lib/privateData.ts'
import {
  findJobAddress, indeedUrl, joraUrl, linkedinUrl, mapsUrl, shareKey, updateJob, loadJobs, loadProject, refreshJobs, routineStreak, saveProject, saveSearch, seekUrl, setJobStatus, tickId,
  type Job, type JobSearch, type JobStatus, type Owner, type PKind, type ProjItem,
} from './lib/projectData.ts'

const IDLE_MS = 2 * 60 * 1000
type Push = (title: string) => string

export function Projects({ tasks, onPush }: { tasks: Task[]; onPush: Push }) {
  const [unlocked, setUnlocked] = useState(false)
  const [msg, setMsg] = useState('')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!unlocked) return
    const arm = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setUnlocked(false), IDLE_MS) }
    arm()
    const ev = ['pointerdown', 'keydown']
    ev.forEach(e => window.addEventListener(e, arm))
    return () => { window.clearTimeout(timer.current); ev.forEach(e => window.removeEventListener(e, arm)) }
  }, [unlocked])
  const go = async () => { setMsg(''); try { await lockUnlock(); setUnlocked(true) } catch { setMsg('Face ID did not match. Try again.') } }
  if (unlocked) return <Inside onLock={() => setUnlocked(false)} tasks={tasks} onPush={onPush} />
  const registered = lockRegistered()
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 520, maxWidth: '100%', padding: 36, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 34, fontWeight: 600 }}>Personal projects</div>
        <div className="muted" style={{ fontSize: 17, lineHeight: 1.5 }}>Chi's routines and business ideas, Michael's job board.</div>
        {!lockSupported() && <div style={{ fontSize: 15 }}>This browser does not support Face ID passkeys. Open the app from the Home Screen icon in Safari.</div>}
        {lockSupported() && registered && <button className="btn" onClick={go}>Smile to unlock</button>}
        {lockSupported() && !registered && <div className="muted" style={{ fontSize: 15 }}>Face ID is not set up on this device yet. Settings → Face ID.</div>}
        {msg && <div style={{ fontSize: 15 }}>{msg}</div>}
      </div>
    </div>
  )
}

/** Tab row, same as the other tabs: main tabs use the theme colour; the smaller tabs inside a section (inner) are blue. */
const Pills = <K extends string>({ value, set, opts, inner = false }: { value: K; set: (k: K) => void; opts: [K, string][]; inner?: boolean }) => (
  <div className={'sub-tabs' + (inner ? ' seg-inner' : '')} style={{ display: 'flex', gap: 4, padding: 4, background: inner ? undefined : 'var(--ground)', borderRadius: 999, overflowX: 'auto', maxWidth: '100%' }}>
    {opts.map(([k, l]) => <button key={k} className={inner && value === k ? 'on' : undefined} aria-pressed={value === k} onClick={() => set(k)} style={inner ? undefined : { flex: 'none', whiteSpace: 'nowrap', height: 40, padding: '0 18px', borderRadius: 999, border: 'none', fontWeight: 600, fontSize: 15, background: value === k ? 'var(--accent)' : 'transparent', color: value === k ? 'var(--on-accent)' : 'var(--ink)' }}>{l}</button>)}
  </div>
)
const Tick = ({ on, label, onClick, size = 30 }: { on: boolean; label: string; onClick: () => void; size?: number }) => (
  <button className={'circle' + (on ? ' done' : '')} aria-label={label} aria-pressed={on} style={{ width: size, height: size }} onClick={onClick}>
    {on && <svg width={size * .45} height={size * .45} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>}
  </button>
)
const RM = ({ onClick, label }: { onClick: () => void; label: string }) => <button className="btn small outline" aria-label={label} style={{ height: 32, fontSize: 13, padding: '0 12px' }} onClick={onClick}>Remove</button>

type Sub = 'skincare' | 'body' | 'diet' | 'mmo'
function Inside({ onLock, tasks, onPush }: { onLock: () => void; tasks: Task[]; onPush: Push }) {
  const [who, setWho] = useState<Owner>('chi')
  const [sub, setSub] = useState<Sub>('skincare')
  const [edit, setEdit] = useState(false)
  const [items, setItems] = useState<ProjItem[]>([])
  const [err, setErr] = useState('')
  const ref = useRef(items); ref.current = items
  useEffect(() => { loadProject().then(setItems).catch(e => { logError('Projects: loading', e); setErr('Could not load. Has 015_projects.sql been run?') }) }, [])
  const upsert = (it: ProjItem) => {
    const cur = ref.current; const next = cur.some(x => x.id === it.id) ? cur.map(x => (x.id === it.id ? it : x)) : [...cur, it]
    setItems(next); saveProject(next, { upsert: it }).catch(e => { logError('Projects: saving', e); setErr('Could not save. Has 015_projects.sql been run?') })
  }
  const remove = (id: string) => { const next = ref.current.filter(x => x.id !== id); setItems(next); saveProject(next, { remove: id }).catch(e => { logError('Projects: removing', e); setErr('Could not remove.') }) }
  const add = (kind: PKind, f: Partial<ProjItem>) => {
    const same = ref.current.filter(x => x.kind === kind && x.cat === (f.cat ?? ''))
    upsert({ id: `${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, owner: 'chi', kind, title: '', sub: '', cat: '', num1: 0, day: null, sort: (Math.max(0, ...same.map(x => x.sort)) + 1), ...f })
  }
  const ops = { items, edit, add, upsert, remove }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="mc-head" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 36, fontWeight: 600 }}>Projects</div>
        <Pills value={who} set={setWho} opts={[['chi', 'Chi'], ['michael', 'Michael']]} />
        <div style={{ flex: 1 }} />
        <button className="btn small outline" onClick={() => setEdit(!edit)}>{edit ? 'Done editing' : 'Edit'}</button>
        <button className="btn small" onClick={onLock}>Lock</button>
      </div>
      {who === 'chi' && <Pills inner value={sub} set={setSub} opts={[['skincare', 'Skincare'], ['body', 'Body'], ['diet', 'Diet'], ['mmo', 'MMO']]} />}
      {err && <div style={{ fontSize: 14 }}>{err} <button className="btn small outline" style={{ height: 32 }} onClick={() => setErr('')}>OK</button></div>}
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        {who === 'chi' && sub === 'skincare' && <div className="proj-cols"><Routine {...ops} cat="skin-am" title="Morning skincare" hint="e.g. Cleanser, Vitamin C, Sunscreen" /><Routine {...ops} cat="skin-pm" title="Evening skincare" hint="e.g. Double cleanse, Retinol, Moisturiser" /></div>}
        {who === 'chi' && sub === 'body' && <Routine {...ops} cat="body" title="Body routine" hint="e.g. 30 min walk, Pilates, Stretch" detail="When or how much, e.g. Mon/Wed/Fri" />}
        {who === 'chi' && sub === 'diet' && <Routine {...ops} cat="diet" title="Diet routine" hint="e.g. Protein breakfast, 2L water, No snacks after 8pm" detail="Note, e.g. 7:30am" />}
        {who === 'chi' && sub === 'mmo' && <Mmo {...ops} tasks={tasks} onPush={onPush} />}
        {who === 'michael' && <JobBoard edit={edit} />}
      </div>
    </div>
  )
}

interface Ops { items: ProjItem[]; edit: boolean; add: (k: PKind, f: Partial<ProjItem>) => void; upsert: (i: ProjItem) => void; remove: (id: string) => void }

function Routine({ items, edit, add, upsert, remove, cat, title, hint, detail = 'Note (optional)' }: Ops & { cat: string; title: string; hint: string; detail?: string }) {
  const t = today()
  const [name, setName] = useState(''); const [note, setNote] = useState('')
  const steps = items.filter(x => x.kind === 'step' && x.cat === cat).sort((a, b) => a.sort - b.sort)
  const ticks = items.filter(x => x.kind === 'tick' && x.cat === cat)
  const doneToday = (s: ProjItem) => ticks.some(x => x.title === s.id && x.day === t)
  const n = steps.filter(doneToday).length
  const streak = routineStreak(steps, ticks, t)
  const toggle = (s: ProjItem) => { const id = tickId(s.id, t); if (doneToday(s)) remove(id); else upsert({ id, owner: 'chi', kind: 'tick', title: s.id, sub: '', cat, num1: 1, day: t, sort: 0 }) }
  const pct = steps.length ? Math.round((n / steps.length) * 100) : 0
  return (
    <div className="card" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{title}</div>
          <div className="muted" style={{ fontSize: 14 }}>{steps.length ? `${n} of ${steps.length} done today` : 'No steps yet'}</div>
        </div>
        {streak > 0 && <div style={{ textAlign: 'right' }}><div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>{streak}</div><div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>day streak</div></div>}
      </div>
      {steps.length > 0 && <div style={{ height: 8, borderRadius: 8, background: 'var(--faint)' }}><div style={{ height: 8, borderRadius: 8, width: `${pct}%`, background: 'var(--accent)', transition: 'width .3s' }} /></div>}
      <div>
        {steps.map(s => {
          const on = doneToday(s)
          return (
            <div key={s.id} className="row" style={{ minHeight: 50 }}>
              <Tick on={on} label={on ? `Untick ${s.title}` : `Tick ${s.title}`} onClick={() => toggle(s)} />
              {edit ? (
                <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                  <input type="text" aria-label="Step" defaultValue={s.title} onBlur={e => { const v = e.target.value.trim(); if (v && v !== s.title) upsert({ ...s, title: v }) }} style={{ flex: 2, minWidth: 0, height: 40 }} />
                  <input type="text" aria-label="Note" placeholder="Note" defaultValue={s.sub} onBlur={e => { const v = e.target.value.trim(); if (v !== s.sub) upsert({ ...s, sub: v }) }} style={{ flex: 1, minWidth: 0, height: 40 }} />
                </div>
              ) : (
                <div style={{ flex: 1, minWidth: 0 }} onClick={() => toggle(s)}>
                  <div style={{ fontSize: 17, fontWeight: 500, ...(on ? { color: 'var(--muted)', textDecoration: 'line-through' } : {}) }}>{s.title}</div>
                  {s.sub && <div className="muted" style={{ fontSize: 13 }}>{s.sub}</div>}
                </div>
              )}
              {edit && <RM label={`Remove ${s.title}`} onClick={() => { ticks.filter(x => x.title === s.id).forEach(x => remove(x.id)); remove(s.id) }} />}
            </div>
          )
        })}
      </div>
      {(edit || steps.length === 0) && (
        <form style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }} onSubmit={e => { e.preventDefault(); if (name.trim()) { add('step', { cat, title: name.trim(), sub: note.trim() }); setName(''); setNote('') } }}>
          <input type="text" placeholder={hint} value={name} onChange={e => setName(e.target.value)} style={{ flex: '2 1 220px', minWidth: 0, height: 44 }} />
          <input type="text" placeholder={detail} value={note} onChange={e => setNote(e.target.value)} style={{ flex: '1 1 140px', minWidth: 0, height: 44 }} />
          <button className="btn small" type="submit">Add step</button>
        </form>
      )}
    </div>
  )
}

function Mmo({ items, edit, add, upsert, remove, tasks, onPush }: Ops & { tasks: Task[]; onPush: Push }) {
  const [idea, setIdea] = useState(''); const [why, setWhy] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const ideas = items.filter(x => x.kind === 'idea').sort((a, b) => a.sort - b.sort)
  const homeTask = (it: ProjItem) => (it.sub.startsWith('task:') ? tasks.find(t => t.id === it.sub.slice(5)) : undefined)
  const isDone = (it: ProjItem) => it.num1 === 1 || !!homeTask(it)?.done_at
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {ideas.length === 0 && <div className="card muted" style={{ padding: 22, fontSize: 16, lineHeight: 1.5 }}>Add your first business idea below. Each idea gets its own goals (what success looks like) and tasks (the next things to do). Tap "+ To do" on a task to put it on the home To do list.</div>}
      {ideas.map(i => {
        const goals = items.filter(x => x.kind === 'goal' && x.cat === i.id).sort((a, b) => a.sort - b.sort)
        const tks = items.filter(x => x.kind === 'task' && x.cat === i.id).sort((a, b) => a.sort - b.sort)
        const all = [...goals, ...tks]; const done = all.filter(isDone).length
        const pct = all.length ? Math.round((done / all.length) * 100) : 0
        const isOpen = open === i.id || edit
        const row = (it: ProjItem) => {
          const d = isDone(it); const ht = homeTask(it)
          return (
            <div key={it.id} className="row" style={{ minHeight: 44, gap: 10 }}>
              <Tick size={24} on={d} label={d ? `Mark ${it.title} not done` : `Mark ${it.title} done`} onClick={() => upsert({ ...it, num1: d ? 0 : 1 })} />
              {edit ? <input type="text" aria-label="Name" defaultValue={it.title} onBlur={e => { const v = e.target.value.trim(); if (v && v !== it.title) upsert({ ...it, title: v }) }} style={{ flex: 1, minWidth: 0, height: 38 }} />
                : <div style={{ flex: 1, fontSize: 16, ...(d ? { textDecoration: 'line-through', color: 'var(--muted)' } : {}) }}>{it.title}</div>}
              {!edit && it.kind === 'task' && !d && (ht && !ht.done_at ? <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>In To do</span>
                : <button className="btn small outline" style={{ height: 30, fontSize: 12, padding: '0 10px' }} onClick={() => { const id = onPush(it.title); upsert({ ...it, sub: 'task:' + id }) }}>+ To do</button>)}
              {edit && <RM label={`Remove ${it.title}`} onClick={() => remove(it.id)} />}
            </div>
          )
        }
        const adder = (kind: 'goal' | 'task', ph: string) => {
          const k = `${i.id}:${kind}`; const v = drafts[k] ?? ''
          return (
            <form style={{ display: 'flex', gap: 6, marginTop: 6 }} onSubmit={e => { e.preventDefault(); if (v.trim()) { add(kind, { cat: i.id, title: v.trim() }); setDrafts({ ...drafts, [k]: '' }) } }}>
              <input type="text" placeholder={ph} value={v} onChange={e => setDrafts({ ...drafts, [k]: e.target.value })} style={{ flex: 1, minWidth: 0, height: 38, fontSize: 15, padding: '0 12px', borderRadius: 12 }} />
              <button className="btn small" type="submit" style={{ height: 38, fontSize: 13, padding: '0 14px' }}>Add</button>
            </form>
          )
        }
        return (
          <div key={i.id} className="card" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: edit ? 'default' : 'pointer' }} onClick={() => { if (!edit) setOpen(isOpen ? null : i.id) }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {edit ? <>
                  <input type="text" aria-label="Idea name" defaultValue={i.title} onBlur={e => { const v = e.target.value.trim(); if (v && v !== i.title) upsert({ ...i, title: v }) }} style={{ width: '100%', marginBottom: 6 }} />
                  <input type="text" aria-label="Idea description" placeholder="One line about the idea" defaultValue={i.sub} onBlur={e => { const v = e.target.value.trim(); if (v !== i.sub) upsert({ ...i, sub: v }) }} style={{ width: '100%' }} />
                </> : <>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>{i.title}</div>
                  {i.sub && <div className="muted" style={{ fontSize: 15 }}>{i.sub}</div>}
                </>}
                {!edit && <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{goals.length} {goals.length === 1 ? 'goal' : 'goals'} · {tks.filter(x => !isDone(x)).length} to do</div>}
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)' }}>{pct}%</div>
            </div>
            <div style={{ height: 10, borderRadius: 10, background: 'var(--faint)' }}><div style={{ height: 10, borderRadius: 10, width: `${pct}%`, background: 'var(--accent)' }} /></div>
            {isOpen && (
              <div className="proj-cols" style={{ marginTop: 4 }}>
                <div><div className="muted" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5 }}>GOALS</div>{goals.map(row)}{adder('goal', 'A goal, e.g. First 10 paying clients')}</div>
                <div><div className="muted" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5 }}>TASKS</div>{tks.filter(x => !isDone(x)).map(row)}{tks.filter(isDone).map(row)}{adder('task', 'A task, e.g. Register ABN')}</div>
              </div>
            )}
            {!isOpen && <button onClick={() => setOpen(i.id)} style={{ alignSelf: 'flex-end', border: 'none', background: 'none', padding: 0, fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>Open</button>}
            {edit && <div><RM label={`Remove ${i.title}`} onClick={() => { if (confirm(`Remove "${i.title}" with its goals and tasks?`)) { all.forEach(x => remove(x.id)); remove(i.id) } }} /></div>}
          </div>
        )
      })}
      <form className="card" style={{ display: 'flex', gap: 8, padding: 16, flexWrap: 'wrap' }} onSubmit={e => { e.preventDefault(); if (idea.trim()) { add('idea', { title: idea.trim(), sub: why.trim() }); setIdea(''); setWhy('') } }}>
        <input type="text" placeholder="New business idea" value={idea} onChange={e => setIdea(e.target.value)} style={{ flex: '1 1 200px', minWidth: 0 }} />
        <input type="text" placeholder="One line about it (optional)" value={why} onChange={e => setWhy(e.target.value)} style={{ flex: '2 1 260px', minWidth: 0 }} />
        <button className="btn small" type="submit">Add idea</button>
      </form>
    </div>
  )
}

type JobView = 'new' | 'saved' | 'applied'
function JobBoard({ edit }: { edit: boolean }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [searches, setSearches] = useState<JobSearch[]>([])
  const [ran, setRan] = useState<{ ran_at: string; found: number; note: string } | null>(null)
  const [view, setView] = useState<JobView>('new')
  const [only, setOnly] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [what, setWhat] = useState(''); const [place, setPlace] = useState('Melbourne')
  const reload = () => loadJobs().then(r => { setJobs(r.jobs); setSearches(r.searches); setRan(r.ran) }).catch(e => { logError('Jobs: loading', e); setMsg('Could not load jobs. Has 015_projects.sql been run?') })
  useEffect(() => {
    reload()
    // a job saved from Seek with the Share button shows up as soon as you come back to the app
    const back = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', back); window.addEventListener('focus', back)
    const t = window.setInterval(reload, 60000)
    return () => { document.removeEventListener('visibilitychange', back); window.removeEventListener('focus', back); window.clearInterval(t) }
  }, [])
  const patch = (id: string, f: Partial<Job>) => setJobs(js => js.map(x => (x.id === id ? { ...x, ...f } : x)).filter(x => x.status !== 'hidden'))
  const [finding, setFinding] = useState('')
  const lookUp = (id: string) => { setFinding(id); return findJobAddress(id).then(f => { if (Object.keys(f).length) patch(id, f); else setMsg('Google had no more details for that ad. Tap Edit to type the company.') }).catch(e => { logError('Jobs: finding details', e); setMsg(String((e as Error).message || e)) }).finally(() => setFinding('')) }
  const mark = (j: Job, status: JobStatus) => {
    patch(j.id, { status })
    setJobStatus(j.id, status).then(() => { if (status === 'saved' && j.company && !j.address) lookUp(j.id) }).catch(e => { logError('Jobs: saving', e); setMsg('Could not save.') })
  }
  const rename = (j: Job, f: { title?: string; company?: string }) => {
    patch(j.id, { ...f, ...(f.company !== undefined ? { address: '' } : {}) })
    updateJob(j.id, { ...f, ...(f.company !== undefined ? { address: '' } : {}) }).then(() => { if (f.company) lookUp(j.id) }).catch(e => { logError('Jobs: saving', e); setMsg('Could not save.') })
  }
  const refresh = async () => {
    setBusy(true); setMsg('')
    try { const n = await refreshJobs(); await reload(); setMsg(`Checked just now: ${n} ads found.`) } catch (e) { setMsg(String((e as Error).message || e)) } finally { setBusy(false) }
  }
  const addSearch = () => { if (!what.trim()) return; const s = { id: 's-' + Date.now().toString(36), what: what.trim(), place: place.trim(), sort: Math.max(0, ...searches.map(x => x.sort)) + 1 }; const next = [...searches, s]; setSearches(next); saveSearch(s, next).catch(() => setMsg('Could not save the search.')); setWhat('') }
  const updSearch = (s: JobSearch) => { const next = searches.map(x => (x.id === s.id ? s : x)); setSearches(next); saveSearch(s, next).catch(() => setMsg('Could not save the search.')) }
  const delSearch = (s: JobSearch) => { const next = searches.filter(x => x.id !== s.id); setSearches(next); saveSearch({ remove: s.id }, next).catch(() => setMsg('Could not remove the search.')) }
  const t = today()
  const shown = jobs.filter(j => j.status === view && (!only || j.search === only))
  const count = (v: JobView) => jobs.filter(j => j.status === v).length
  const age = (d: string | null) => { if (!d) return ''; const n = Math.round((new Date(t).getTime() - new Date(d).getTime()) / 86400000); return n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : n < 7 ? `${n} days ago` : fmtShort(d) }
  const ranText = ran ? `Last checked ${new Date(ran.ran_at).toLocaleString('en-AU', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).toLowerCase()} · checks daily at 7pm` : 'Checks Google job search (Seek, LinkedIn, Indeed and more) every day at 7pm'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card" style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 22, fontWeight: 600 }}>Job board</div>
          <div className="muted" style={{ fontSize: 14 }}>{ranText}</div>
          {ran?.note && <div style={{ fontSize: 13, color: 'var(--late)' }}>{ran.note}</div>}
        </div>
        <Pills inner value={view} set={setView} opts={[['new', `New ${count('new') || ''}`.trim()], ['saved', `Saved ${count('saved') || ''}`.trim()], ['applied', `Applied ${count('applied') || ''}`.trim()]]} />
        <button className="btn small outline" disabled={busy} onClick={refresh}>{busy ? 'Checking…' : 'Check now'}</button>
      </div>
      {msg && <div style={{ fontSize: 14 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setOnly('')} className="chip" aria-pressed={!only}>All</button>
        {searches.map(s => <button key={s.id} onClick={() => setOnly(only === s.what ? '' : s.what)} className="chip" aria-pressed={only === s.what}>{s.what}</button>)}
        {jobs.some(j => j.search === 'shared') && <button onClick={() => setOnly(only === 'shared' ? '' : 'shared')} className="chip" aria-pressed={only === 'shared'} style={{ textTransform: 'none' }}>Shared from iPad</button>}
      </div>

      {edit && (
        <div className="card" style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Searches</div>
          <div className="muted" style={{ fontSize: 13 }}>What to look for each evening. Leave the place empty to search all of Australia.</div>
          {searches.map(s => (
            <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="text" aria-label="Job title or keywords" defaultValue={s.what} onBlur={e => { const v = e.target.value.trim(); if (v && v !== s.what) updSearch({ ...s, what: v }) }} style={{ flex: 2, minWidth: 0, height: 40 }} />
              <input type="text" aria-label="Place" defaultValue={s.place} onBlur={e => { const v = e.target.value.trim(); if (v !== s.place) updSearch({ ...s, place: v }) }} style={{ flex: 1, minWidth: 0, height: 40 }} />
              <RM label={`Remove ${s.what}`} onClick={() => delSearch(s)} />
            </div>
          ))}
          <form style={{ display: 'flex', gap: 8 }} onSubmit={e => { e.preventDefault(); addSearch() }}>
            <input type="text" placeholder="e.g. video editor" value={what} onChange={e => setWhat(e.target.value)} style={{ flex: 2, minWidth: 0, height: 40 }} />
            <input type="text" placeholder="Place" value={place} onChange={e => setPlace(e.target.value)} style={{ flex: 1, minWidth: 0, height: 40 }} />
            <button className="btn small" type="submit">Add</button>
          </form>
        </div>
      )}

      {edit && <ShareSetup />}

      {shown.length === 0 && <div className="card muted" style={{ padding: 22, fontSize: 16, lineHeight: 1.5 }}>
        {view === 'new' ? (jobs.length ? 'No new ads here. Tomorrow at 7pm brings more.' : 'No ads yet. They arrive each evening at 7pm, or tap "Check now".') : view === 'saved' ? 'Tap Save on an ad to keep it here.' : 'Tap Applied on an ad once you send an application.'}
      </div>}
      {shown.map(j => (
        <div key={j.id} className="card job" style={{ padding: '14px 20px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          {edit && view !== 'new' ? (
            <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input type="text" aria-label="Job title" defaultValue={j.title} onBlur={e => { const v = e.target.value.trim(); if (v && v !== j.title) rename(j, { title: v }) }} style={{ height: 40 }} />
              <input type="text" aria-label="Company" placeholder="Company (used to find the address)" defaultValue={j.company} onBlur={e => { const v = e.target.value.trim(); if (v !== j.company) rename(j, { company: v }) }} style={{ height: 40 }} />
            </div>
          ) : (
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <a href={j.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
              <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.25 }}>{j.title}</div>
              <div className="muted" style={{ fontSize: 14, marginTop: 2 }}>{[j.company, j.place].filter(Boolean).join(' · ')}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6, fontSize: 13, fontWeight: 600 }}>
                {j.pay && <span style={{ color: 'var(--accent)' }}>{j.pay}</span>}
                {j.kind && <span className="muted">{j.kind}</span>}
                <span className="muted">{j.posted ? age(j.posted) : j.search === 'shared' ? `Saved ${age(j.first_seen).toLowerCase()}` : ''}</span>
              </div>
            </a>
            {j.address ? (
              <a href={mapsUrl(j.address)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 14, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>{j.address}
              </a>
            ) : view !== 'new' && (j.company
              ? <button onClick={() => lookUp(j.id)} style={{ marginTop: 6, border: 'none', background: 'none', padding: 0, fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Find {j.company}'s address</button>
              : <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn small outline" style={{ height: 34, fontSize: 13 }} disabled={finding === j.id} onClick={() => lookUp(j.id)}>{finding === j.id ? 'Looking…' : 'Find details'}</button>
                  <span className="muted" style={{ fontSize: 13 }}>or tap Edit to type the company</span>
                </div>)}
            <div><a href={j.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 4, fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>Open the ad ↗</a></div>
          </div>
          )}
          <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
            {view === 'new' && <><button className="btn small" style={{ height: 38 }} onClick={() => mark(j, 'saved')}>Save</button><button className="btn small outline" style={{ height: 38 }} onClick={() => mark(j, 'hidden')}>Not for me</button></>}
            {view === 'saved' && <><button className="btn small" style={{ height: 38 }} onClick={() => mark(j, 'applied')}>Applied</button><button className="btn small outline" style={{ height: 38 }} onClick={() => mark(j, 'new')}>Unsave</button></>}
            {view === 'applied' && <button className="btn small outline" style={{ height: 38 }} onClick={() => mark(j, 'saved')}>Move back</button>}
          </div>
        </div>
      ))}

      <div className="card" style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Search the job sites directly</div>
        <div className="muted" style={{ fontSize: 13 }}>Found one you like? Tap Share on the ad, then "Save to job board".</div>
        {searches.map(s => <div key={s.id} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ width: 170, fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>{s.what}</span>
          {([['Seek', seekUrl(s)], ['LinkedIn', linkedinUrl(s)], ['Indeed', indeedUrl(s)], ['Jora', joraUrl(s)]] as const).map(([n, u]) => <a key={n} className="btn small outline" style={{ height: 38, fontSize: 13 }} href={u} target="_blank" rel="noopener noreferrer">{n}</a>)}
        </div>)}
      </div>
    </div>
  )
}

/** Edit mode: how to add "Save to job board" to the iPad's Share menu (an Apple Shortcut). */
function ShareSetup() {
  const [key, setKey] = useState('')
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => { shareKey().then(setKey).catch(e => { logError('Jobs: share key', e); setErr('Could not load the Share button key. Has 016_job_share.sql been run?') }) }, [])
  const link = key ? `${location.origin}/api/save-job?key=${key}` : ''
  const copy = () => { navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) }).catch(() => setErr('Could not copy. Press and hold the link to copy it.')) }
  const step = (n: number, body: ReactNode) => <li style={{ display: 'flex', gap: 10, fontSize: 15, lineHeight: 1.45 }}><b style={{ flex: 'none', width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{n}</b><span>{body}</span></li>
  return (
    <div className="card" style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>iPad Share button: "Save to job board"</div>
      <div className="muted" style={{ fontSize: 14 }}>Set this up once on the iPad. Then on any ad in Seek, LinkedIn, Indeed or Safari, tap Share → Save to job board, and it lands in Saved with its link.</div>
      {err && <div style={{ fontSize: 14, color: 'var(--late)' }}>{err}</div>}
      {link && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <code style={{ flex: '1 1 300px', minWidth: 0, padding: '10px 12px', borderRadius: 12, background: 'var(--faint)', border: '1px solid var(--border)', fontSize: 13, wordBreak: 'break-all', userSelect: 'all' }}>{link}</code>
        <button className="btn small" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
      </div>}
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {step(1, <>Tap <b>Copy link</b> above.</>)}
        {step(2, <>Open the <b>Shortcuts</b> app → <b>+</b> → name it <b>Save to job board</b>.</>)}
        {step(3, <>Add <b>Get Contents of URL</b> and set its URL to <b>Shortcut Input</b>. (The iPad opens the ad so the board can read the title, company and pay.)</>)}
        {step(4, <>Add <b>Base64 Encode</b>. It uses <b>Contents of URL</b> from step 3. Tap the arrow and set Line Breaks to <b>None</b>.</>)}
        {step(5, <>Add a second <b>Get Contents of URL</b>. Paste the copied link as its URL. Tap the arrow: Method <b>POST</b>, Request Body <b>JSON</b>. Add a <b>Text</b> field named <b>shared</b> = <b>Shortcut Input</b>, and a <b>Text</b> field named <b>page</b> = <b>Base64 Encoded</b>.</>)}
        {step(6, <>Add <b>Show Notification</b> and set it to <b>Contents of URL</b> (from step 5), so you see "Saved to the job board".</>)}
        {step(7, <>Tap <b>ⓘ</b> (Details) → turn on <b>Show in Share Sheet</b>, and allow <b>URLs</b>, <b>Text</b> and <b>Safari web pages</b>.</>)}
        {step(8, <>Test it: open any Seek ad → Share → <b>Save to job board</b>. The first time, tap <b>Allow</b> each time it asks.</>)}
      </ol>
      <div><button className="btn small outline" style={{ height: 36, fontSize: 13 }} onClick={() => { if (confirm('Make a new link? The old Share button stops working until you paste the new link into the Shortcut.')) shareKey(true).then(setKey).catch(() => setErr('Could not make a new link.')) }}>Make a new link</button></div>
    </div>
  )
}
