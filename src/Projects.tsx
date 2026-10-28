import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { logError } from './lib/errorlog.ts'
import { Face } from './Face.tsx'
import { addDays, fmtShort, today } from './lib/dates.ts'
import { dayIndex, daysLabel, DONE_STAGE, nextStageId, onDay, parseStages, stageOf, toggleDay, WEEK, type Stage } from './lib/routines.ts'
import type { Task } from './lib/types.ts'
import { lockRegistered, lockSupported, lockUnlock } from './lib/privateData.ts'
import {
  findJobAddress, indeedUrl, joraUrl, linkedinUrl, mapsUrl, shareKey, updateJob, loadJobs, loadProject, refreshJobs, routineStreak, saveProject, saveSearch, seekUrl, setJobStatus, tickId,
  type Job, type JobSearch, type JobStatus, type Owner, type PKind, type ProjItem,
} from './lib/projectData.ts'

const IDLE_MS = 2 * 60 * 1000
type Push = (title: string) => string

/** Projects opens straight away. Only Chi's MMO (business ideas) is behind Face ID, and it locks again after 2 minutes without a tap. */
export function Projects({ tasks, onPush }: { tasks: Task[]; onPush: Push }) {
  return <Inside tasks={tasks} onPush={onPush} />
}

function useMmoLock() {
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
  const unlock = async () => { setMsg(''); try { await lockUnlock(); setUnlocked(true) } catch { setMsg('Face ID did not match. Try again.') } }
  return { unlocked, unlock, lock: () => setUnlocked(false), msg }
}

function MmoLocked({ onUnlock, msg }: { onUnlock: () => void; msg: string }) {
  const registered = lockRegistered()
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 30 }}>
      <div className="card" style={{ width: 520, maxWidth: '100%', padding: 36, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 30, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>NEW YORK CITY
        </div>
        <div className="muted" style={{ fontSize: 17, lineHeight: 1.5 }}>Business ideas, goals and tasks.</div>
        {!lockSupported() && <div style={{ fontSize: 15 }}>This browser does not support Face ID passkeys. Open the app from the Home Screen icon in Safari.</div>}
        {lockSupported() && registered && <button className="btn" onClick={onUnlock}>Smile to unlock</button>}
        {lockSupported() && !registered && <div className="muted" style={{ fontSize: 15 }}>Face ID is not set up on this device yet. Settings → Face ID.</div>}
        {msg && <div style={{ fontSize: 15 }}>{msg}</div>}
      </div>
    </div>
  )
}

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
function Inside({ tasks, onPush }: { tasks: Task[]; onPush: Push }) {
  const mmo = useMmoLock()
  const [who, setWho] = useState<Owner>('chi')
  const [sub, setSub] = useState<Sub>('skincare')
  const [edit, setEdit] = useState(false)
  const [items, setItems] = useState<ProjItem[]>([])
  const [err, setErr] = useState('')
  const ref = useRef(items); ref.current = items
  useEffect(() => { loadProject().then(setItems).catch(e => { logError('Projects: loading', e); setErr('Could not load. Has 015_projects.sql been run?') }) }, [])
  const upsert = (it: ProjItem) => {
    const cur = ref.current; const next = cur.some(x => x.id === it.id) ? cur.map(x => (x.id === it.id ? it : x)) : [...cur, it]
    ref.current = next; setItems(next); saveProject(next, { upsert: it }).catch(e => { logError('Projects: saving', e); setErr('Could not save. Has 015_projects.sql been run?') })
  }
  const remove = (id: string) => { const next = ref.current.filter(x => x.id !== id); ref.current = next; setItems(next); saveProject(next, { remove: id }).catch(e => { logError('Projects: removing', e); setErr('Could not remove.') }) }
  const add = (kind: PKind, f: Partial<ProjItem>) => {
    const same = ref.current.filter(x => x.kind === kind && x.cat === (f.cat ?? ''))
    upsert({ id: `${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, owner: 'chi', kind, title: '', sub: '', cat: '', num1: 0, day: null, sort: (Math.max(0, ...same.map(x => x.sort)) + 1), ...f })
  }
  const ops = { items, edit, add, upsert, remove }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="mc-head" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 36, fontWeight: 600 }}>Projects</div>
        <div role="group" aria-label="Whose projects" style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--ground)', borderRadius: 999 }}>
          {([['chi', 'linh', 'Chi'], ['michael', 'michael', 'Michael']] as const).map(([k, face, name]) => (
            <button key={k} aria-label={`${name}'s projects`} aria-pressed={who === k} onClick={() => setWho(k)} style={{ padding: 3, borderRadius: 999, border: 'none', background: who === k ? 'var(--card)' : 'transparent', opacity: who === k ? 1 : .5, boxShadow: who === k ? '0 1px 6px rgba(0,0,0,.2)' : 'none' }}><Face who={face} size={40} /></button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {!(who === 'chi' && sub === 'mmo' && !mmo.unlocked) && <button className="btn small outline" onClick={() => setEdit(!edit)}>{edit ? 'Done editing' : 'Edit'}</button>}
        {mmo.unlocked && who === 'chi' && <button className="btn small" onClick={mmo.lock}>Lock</button>}
      </div>
      {who === 'chi' && <Pills inner value={sub} set={setSub} opts={[['skincare', 'Skincare'], ['body', 'Body'], ['diet', 'Diet'], ['mmo', 'NEW YORK CITY']]} />}
      {err && <div style={{ fontSize: 14 }}>{err} <button className="btn small outline" style={{ height: 32 }} onClick={() => setErr('')}>OK</button></div>}
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        {who === 'chi' && sub === 'skincare' && <><WeekPlan {...ops} cat="skin-am" title="Morning skincare" hint="e.g. Vitamin C serum" detail="Note, e.g. 2 drops" /><WeekPlan {...ops} cat="skin-pm" title="Evening skincare" hint="e.g. Retinol" detail="Note, e.g. pea-size, skip if irritated" /></>}
        {who === 'chi' && sub === 'body' && <WeekPlan {...ops} cat="body" title="Body plan" hint="e.g. Upper body" detail="Exercises, e.g. push-ups, rows, plank" />}
        {who === 'chi' && sub === 'diet' && <CleanDays {...ops} />}
        {who === 'chi' && sub === 'mmo' && (mmo.unlocked ? <Kanban {...ops} tasks={tasks} onPush={onPush} /> : <MmoLocked onUnlock={mmo.unlock} msg={mmo.msg} />)}
        {who === 'michael' && <JobBoard edit={edit} />}
      </div>
    </div>
  )
}

interface Ops { items: ProjItem[]; edit: boolean; add: (k: PKind, f: Partial<ProjItem>) => void; upsert: (i: ProjItem) => void; remove: (id: string) => void }

const DIET_STARTERS = ['No sugar', 'No snacks', 'No oily food', 'No fast food']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Diet: "clean days". Each rule (no sugar, no snacks…) gets a tick each day you kept it, a streak, and a month view. */
function CleanDays({ items, edit, add, upsert, remove }: Ops) {
  const t = today()
  const [name, setName] = useState('')
  const [month, setMonth] = useState(t.slice(0, 7))
  const rules = items.filter(x => x.kind === 'step' && x.cat === 'diet').sort((a, b) => a.sort - b.sort)
  const ticks = items.filter(x => x.kind === 'tick' && x.cat === 'diet')
  const kept = (r: ProjItem, d: string) => ticks.some(x => x.title === r.id && x.day === d)
  const flip = (r: ProjItem, d: string) => { const id = tickId(r.id, d); if (kept(r, d)) remove(id); else upsert({ id, owner: 'chi', kind: 'tick', title: r.id, sub: '', cat: 'diet', num1: 1, day: d, sort: 0 }) }
  const n = rules.filter(r => kept(r, t)).length
  const [y, m] = month.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  const dates = Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
  const counted = dates.filter(d => d <= t)
  const shift = (k: number) => { const d = new Date(y, m - 1 + k, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
  const allKept = rules.length > 0 && n === rules.length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 600 }}>Today's clean day</div>
            {!rules.length && <div className="muted" style={{ fontSize: 14 }}>Add the things you are cutting out.</div>}
          </div>
        </div>
        {rules.length > 0 && <div className="clean-grid">
          {rules.map(r => {
            const on = kept(r, t)
            const st = routineStreak([r], ticks.filter(x => x.title === r.id), t)
            return (
              <div key={r.id} className={'clean-rule' + (on ? ' on' : '')}>
                {edit ? (
                  <>
                    <input type="text" aria-label="Rule" defaultValue={r.title} onBlur={e => { const v = e.target.value.trim(); if (v && v !== r.title) upsert({ ...r, title: v }) }} style={{ flex: 1, minWidth: 0, height: 40 }} />
                    <RM label={`Remove ${r.title}`} onClick={() => { ticks.filter(x => x.title === r.id).forEach(x => remove(x.id)); remove(r.id) }} />
                  </>
                ) : (
                  <button className="clean-btn" aria-pressed={on} onClick={() => flip(r, t)}>
                    <span className={'circle' + (on ? ' done' : '')} aria-hidden="true" style={{ width: 34, height: 34 }}>{on && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>}</span>
                    <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <span style={{ display: 'block', fontSize: 17, fontWeight: 700 }}>{r.title}</span>
                      <span className="muted" style={{ display: 'block', fontSize: 13 }}>{on ? 'Kept today' : 'Not ticked yet'}</span>
                    </span>
                    {st > 0 && <span style={{ textAlign: 'right' }}><span style={{ display: 'block', fontSize: 22, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{st}</span><span className="muted" style={{ fontSize: 11, fontWeight: 600 }}>{st === 1 ? 'day' : 'days'}</span></span>}
                  </button>
                )}
              </div>
            )
          })}
        </div>}
        {(edit || rules.length === 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DIET_STARTERS.some(x => !rules.some(r => r.title.toLowerCase() === x.toLowerCase())) && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: 13 }}>Quick add:</span>
              {DIET_STARTERS.filter(x => !rules.some(r => r.title.toLowerCase() === x.toLowerCase())).map(x => <button key={x} className="chip" style={{ textTransform: 'none' }} onClick={() => add('step', { cat: 'diet', title: x })}>+ {x}</button>)}
            </div>}
            <form style={{ display: 'flex', gap: 8 }} onSubmit={e => { e.preventDefault(); if (name.trim()) { add('step', { cat: 'diet', title: name.trim() }); setName('') } }}>
              <input type="text" placeholder="Something else to cut, e.g. No bubble tea" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1, minWidth: 0, height: 44 }} />
              <button className="btn small" type="submit">Add</button>
            </form>
          </div>
        )}
      </div>

      {rules.length > 0 && (
        <div className="card" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 600, flex: 1 }}>{MONTHS[m - 1]} {y}</div>
            <button className="kb-mini" aria-label="Previous month" onClick={() => shift(-1)}>‹</button>
            <button className="kb-mini" aria-label="Next month" disabled={month >= t.slice(0, 7)} onClick={() => shift(1)}>›</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="clean-month">
              <thead><tr><th />{dates.map(d => <th key={d} className={d === t ? 'today' : ''}>{Number(d.slice(8))}</th>)}<th style={{ textAlign: 'right' }}>Kept</th></tr></thead>
              <tbody>
                {rules.map(r => {
                  const k = counted.filter(d => kept(r, d)).length
                  return (
                    <tr key={r.id}>
                      <td className="cm-name">{r.title}</td>
                      {dates.map(d => d > t
                        ? <td key={d}><span className="cm-cell future" /></td>
                        : <td key={d} className={d === t ? 'today' : ''}><button className={'cm-cell' + (kept(r, d) ? ' on' : '')} aria-pressed={kept(r, d)} aria-label={`${r.title}, ${Number(d.slice(8))} ${MONTHS[m - 1]}`} onClick={() => flip(r, d)} /></td>)}
                      <td className="cm-sum">{counted.length ? `${k}/${counted.length}` : '–'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/** Skincare / body plan: each step chooses its days; Monday-to-Sunday columns; tick today's column. */
function WeekPlan({ items, edit, add, upsert, remove, cat, title, hint, detail }: Ops & { cat: string; title: string; hint: string; detail: string }) {
  const t = today()
  const ti = dayIndex(t)
  const mon = addDays(t, -ti)
  const week = WEEK.map((d, i) => ({ d, i, ymd: addDays(mon, i) }))
  const [name, setName] = useState(''); const [note, setNote] = useState(''); const [mask, setMask] = useState(127)
  const steps = items.filter(x => x.kind === 'step' && x.cat === cat).sort((a, b) => a.sort - b.sort)
  const ticks = items.filter(x => x.kind === 'tick' && x.cat === cat)
  const done = (s: ProjItem, ymd: string) => ticks.some(x => x.title === s.id && x.day === ymd)
  const toggle = (s: ProjItem) => { const id = tickId(s.id, t); if (done(s, t)) remove(id); else upsert({ id, owner: 'chi', kind: 'tick', title: s.id, sub: '', cat, num1: 1, day: t, sort: 0 }) }
  const todays = steps.filter(s => onDay(s, t))
  const n = todays.filter(s => done(s, t)).length
  const streak = routineStreak(steps, ticks, t)
  const cell = 58
  return (
    <div className="card" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{title}</div>
          <div className="muted" style={{ fontSize: 14 }}>{!steps.length ? 'No steps yet' : todays.length ? `Today: ${n} of ${todays.length} done` : 'Nothing planned today'}</div>
        </div>
        {streak > 0 && <div style={{ textAlign: 'right' }}><div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>{streak}</div><div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>day streak</div></div>}
      </div>
      {steps.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="week-plan" style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}><span className="muted" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2 }}>STEP</span></th>
                {week.map(w => <th key={w.d} className={w.i === ti ? 'today' : ''} style={{ width: cell }}><div style={{ fontSize: 13, fontWeight: 700 }}>{w.i === ti ? 'Today' : w.d}</div><div className="muted" style={{ fontSize: 11 }}>{fmtShort(w.ymd)}</div></th>)}
                {edit && <th style={{ width: 90 }} />}
              </tr>
            </thead>
            <tbody>
              {steps.map(s => (
                <tr key={s.id}>
                  <td>
                    {edit ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <input type="text" aria-label="Step" defaultValue={s.title} onBlur={e => { const v = e.target.value.trim(); if (v && v !== s.title) upsert({ ...s, title: v }) }} style={{ height: 36, fontSize: 15 }} />
                        <input type="text" aria-label="Note" placeholder="Note" defaultValue={s.sub} onBlur={e => { const v = e.target.value.trim(); if (v !== s.sub) upsert({ ...s, sub: v }) }} style={{ height: 32, fontSize: 13 }} />
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 18, fontWeight: 600 }}>{s.title}</div>
                        <div className="muted" style={{ fontSize: 13 }}>{[daysLabel(s.num1), s.sub].filter(Boolean).join(' · ')}</div>
                      </>
                    )}
                  </td>
                  {week.map(w => {
                    const planned = onDay(s, w.ymd)
                    if (edit) return <td key={w.d} className={w.i === ti ? 'today' : ''}><button className={'wp-day' + (planned ? ' on' : '')} aria-pressed={planned} aria-label={`${s.title} on ${w.d}`} onClick={() => upsert({ ...s, num1: toggleDay(s.num1, w.i) })}>{planned ? '✓' : ''}</button></td>
                    if (!planned) return <td key={w.d} className={w.i === ti ? 'today' : ''}><span className="wp-off" aria-label="Not planned">–</span></td>
                    if (w.i === ti) return <td key={w.d} className="today"><Tick size={34} on={done(s, t)} label={done(s, t) ? `Untick ${s.title}` : `Tick ${s.title}`} onClick={() => toggle(s)} /></td>
                    const past = w.i < ti, got = done(s, w.ymd)
                    return <td key={w.d}><span className={'wp-dot' + (got ? ' got' : past ? ' missed' : '')} aria-label={got ? 'Done' : past ? 'Missed' : 'Planned'} /></td>
                  })}
                  {edit && <td><RM label={`Remove ${s.title}`} onClick={() => { ticks.filter(x => x.title === s.id).forEach(x => remove(x.id)); remove(s.id) }} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(edit || steps.length === 0) && (
        <form style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }} onSubmit={e => { e.preventDefault(); if (name.trim()) { add('step', { cat, title: name.trim(), sub: note.trim(), num1: mask === 127 ? 0 : mask }); setName(''); setNote(''); setMask(127) } }}>
          <input type="text" placeholder={hint} value={name} onChange={e => setName(e.target.value)} style={{ flex: '2 1 200px', minWidth: 0, height: 44 }} />
          <input type="text" placeholder={detail} value={note} onChange={e => setNote(e.target.value)} style={{ flex: '2 1 200px', minWidth: 0, height: 44 }} />
          <div role="group" aria-label="Days" style={{ display: 'flex', gap: 4 }}>
            {WEEK.map((d, i) => <button type="button" key={d} className={'wp-day' + (mask & (1 << i) ? ' on' : '')} aria-pressed={!!(mask & (1 << i))} onClick={() => setMask(m => (m ^ (1 << i)) || 127)} style={{ width: 44 }}>{d.slice(0, 2)}</button>)}
          </div>
          <button className="btn small" type="submit">Add step</button>
        </form>
      )}
    </div>
  )
}

/** MMO: projects like the Goals tab; open one for its board. Stages are editable per project (Edit). Drag cards between stages. */
function Kanban({ items, edit, add, upsert, remove, tasks, onPush }: Ops & { tasks: Task[]; onPush: Push }) {
  const [name, setName] = useState(''); const [why, setWhy] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const projects = items.filter(x => x.kind === 'idea').sort((a, b) => a.sort - b.sort)
  const homeTask = (it: ProjItem) => (it.sub.startsWith('task:') ? tasks.find(t => t.id === it.sub.slice(5)) : undefined)
  const stageFor = (it: ProjItem, st: Stage[]) => (homeTask(it)?.done_at ? DONE_STAGE : stageOf(it.num1, st))
  const tasksOf = (id: string) => items.filter(x => x.kind === 'task' && x.cat === id)
  const p = projects.find(x => x.id === open)
  if (p) return <Board p={p} cards={tasksOf(p.id)} stageFor={stageFor} homeTask={homeTask} edit={edit} add={add} upsert={upsert} remove={remove} onPush={onPush} onBack={() => setOpen(null)} />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {projects.length === 0 && <div className="card muted" style={{ padding: 22, fontSize: 16, lineHeight: 1.5 }}>Add your first project below.</div>}
      {projects.map(pr => {
        const st = parseStages(pr.cat)
        const cs = tasksOf(pr.id)
        const done = cs.filter(x => stageFor(x, st) === DONE_STAGE).length
        const pct = cs.length ? Math.round((done / cs.length) * 100) : 0
        return (
          <div key={pr.id} className="card" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {edit ? <>
                  <input type="text" aria-label="Project name" defaultValue={pr.title} onBlur={e => { const v = e.target.value.trim(); if (v && v !== pr.title) upsert({ ...pr, title: v }) }} style={{ width: '100%', marginBottom: 6 }} />
                  <input type="text" aria-label="Project description" placeholder="One line about it" defaultValue={pr.sub} onBlur={e => { const v = e.target.value.trim(); if (v !== pr.sub) upsert({ ...pr, sub: v }) }} style={{ width: '100%' }} />
                </> : <>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>{pr.title}</div>
                  {pr.sub && <div className="muted" style={{ fontSize: 15 }}>{pr.sub}</div>}
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{st.map(s => `${cs.filter(x => stageFor(x, st) === s.id).length} ${s.name.toLowerCase()}`).join(' · ')}</div>
                </>}
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)' }}>{pct}%</div>
            </div>
            <div style={{ height: 10, borderRadius: 10, background: 'var(--faint)' }}><div style={{ height: 10, borderRadius: 10, width: `${pct}%`, background: 'var(--accent)' }} /></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {edit && <RM label={`Remove ${pr.title}`} onClick={() => { if (confirm(`Remove "${pr.title}" and all its tasks?`)) { items.filter(x => x.cat === pr.id).forEach(x => remove(x.id)); remove(pr.id) } }} />}
              {!edit && <button className="btn small" onClick={() => setOpen(pr.id)}>Open board</button>}
            </div>
          </div>
        )
      })}
      <form className="card" style={{ display: 'flex', gap: 8, padding: 16, flexWrap: 'wrap' }} onSubmit={e => { e.preventDefault(); if (name.trim()) { add('idea', { title: name.trim(), sub: why.trim() }); setName(''); setWhy('') } }}>
        <input type="text" placeholder="New project" value={name} onChange={e => setName(e.target.value)} style={{ flex: '1 1 200px', minWidth: 0 }} />
        <input type="text" placeholder="One line about it (optional)" value={why} onChange={e => setWhy(e.target.value)} style={{ flex: '2 1 260px', minWidth: 0 }} />
        <button className="btn small" type="submit">Add project</button>
      </form>
    </div>
  )
}

type Drag = { id: string; from: number; x: number; y: number; dx: number; dy: number; w: number; moved: boolean; to: number; at: number }

function Board({ p, cards, stageFor, homeTask, edit, add, upsert, remove, onPush, onBack }: { p: ProjItem; cards: ProjItem[]; stageFor: (it: ProjItem, st: Stage[]) => number; homeTask: (it: ProjItem) => Task | undefined; edit: boolean; add: Ops['add']; upsert: Ops['upsert']; remove: Ops['remove']; onPush: Push; onBack: () => void }) {
  const stages = parseStages(p.cat)
  const first = stages[0].id
  const [draft, setDraft] = useState('')
  const [drag, setDragState] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const setDrag = (d: Drag | null) => { dragRef.current = d; setDragState(d) }
  const boardEl = useRef<HTMLDivElement | null>(null)
  const colEls = useRef(new Map<number, HTMLDivElement>())
  const cardEls = useRef(new Map<string, HTMLDivElement>())
  const inCol = (c: number) => cards.filter(x => stageFor(x, stages) === c).sort((a, b) => a.sort - b.sort)
  const pct = cards.length ? Math.round((inCol(DONE_STAGE).length / cards.length) * 100) : 0

  // ---- editing the stages ----
  const saveStages = (list: Stage[]) => upsert({ ...p, cat: JSON.stringify(list) })
  const renameStage = (id: number, name: string) => saveStages(stages.map(s => (s.id === id ? { ...s, name } : s)))
  const moveStage = (i: number, by: number) => { const l = [...stages]; const [x] = l.splice(i, 1); l.splice(i + by, 0, x); saveStages(l) }
  const addStage = () => { const l = [...stages]; const at = Math.max(0, l.findIndex(s => s.id === DONE_STAGE)); l.splice(at, 0, { id: nextStageId(l), name: 'New stage' }); saveStages(l) }
  const removeStage = (s: Stage) => {
    const left = stages.filter(x => x.id !== s.id)
    const n = inCol(s.id).length
    if (n && !confirm(`Remove "${s.name}"? Its ${n} ${n === 1 ? 'task moves' : 'tasks move'} to "${left[0].name}".`)) return
    inCol(s.id).forEach(it => upsert({ ...it, num1: left[0].id }))
    saveStages(left)
  }

  // ---- drag and drop (works with a finger on the iPad) ----
  const target = (x: number, y: number, id: string): { to: number; at: number } => {
    let to = dragRef.current?.to ?? first
    for (const [c, el] of colEls.current) { const r = el.getBoundingClientRect(); if (x >= r.left && x <= r.right) { to = c; break } }
    const list = inCol(to).filter(x => x.id !== id)
    let at = 0
    for (const it of list) { const el = cardEls.current.get(it.id); if (el) { const r = el.getBoundingClientRect(); if (y > r.top + r.height / 2) at++ } }
    return { to, at }
  }
  const drop = (d: Drag) => {
    const moving = cards.find(x => x.id === d.id); if (!moving) return
    const list = inCol(d.to).filter(x => x.id !== d.id)
    list.splice(d.at, 0, moving)
    list.forEach((it, i) => {
      const f: ProjItem = { ...it, sort: i + 1 }
      if (it.id === d.id) { f.num1 = d.to; if (d.to !== DONE_STAGE && homeTask(it)?.done_at) f.sub = '' }
      if (f.sort !== it.sort || f.num1 !== it.num1 || f.sub !== it.sub) upsert(f)
    })
  }
  const latest = useRef({ target, drop }); latest.current = { target, drop }
  const start = (e: RPointerEvent, it: ProjItem, c: number, i: number, el: HTMLDivElement) => {
    if (edit || e.button > 0) return
    const r = el.getBoundingClientRect()
    setDrag({ id: it.id, from: c, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, moved: false, to: c, at: i })
    const sx = e.clientX, sy = e.clientY
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current; if (!d) return
      const moved = d.moved || Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6
      // near the left or right edge, slide the board so you can reach the other stages
      const b = boardEl.current
      if (moved && b) { const br = b.getBoundingClientRect(); if (ev.clientX > br.right - 70) b.scrollLeft += 16; else if (ev.clientX < br.left + 70) b.scrollLeft -= 16 }
      setDrag({ ...d, x: ev.clientX, y: ev.clientY, moved, ...(moved ? latest.current.target(ev.clientX, ev.clientY, d.id) : {}) })
    }
    const noScroll = (ev: TouchEvent) => { if (dragRef.current) ev.preventDefault() }
    const end = () => {
      const d = dragRef.current
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); window.removeEventListener('touchmove', noScroll)
      if (d?.moved) latest.current.drop(d)
      setDrag(null)
    }
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end)
    window.addEventListener('touchmove', noScroll, { passive: false })
  }

  const dragged = drag && cards.find(x => x.id === drag.id)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button className="btn small" onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingLeft: 14 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>All projects</button>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{p.title}</div>
          {p.sub && <div className="muted" style={{ fontSize: 14 }}>{p.sub}</div>}
        </div>
        <div style={{ width: 160 }}>
          <div style={{ height: 10, borderRadius: 10, background: 'var(--faint)' }}><div style={{ height: 10, borderRadius: 10, width: `${pct}%`, background: 'var(--accent)' }} /></div>
          <div className="muted" style={{ fontSize: 12, textAlign: 'right', marginTop: 2 }}>{pct}% done</div>
        </div>
      </div>
      <div className="kanban" ref={boardEl}>
        {stages.map((stg, si) => {
          const c = stg.id
          const list = inCol(c)
          const showGap = drag?.moved && drag.to === c
          // the dragged card stays in place (faded) so the iPad keeps following the finger; the dashed gap shows where it will land
          let k = 0
          const slots = list.map(it => { const isDragged = drag?.moved && it.id === drag.id; const gapBefore = !!showGap && !isDragged && k === drag!.at; if (!isDragged) k++; return { it, gapBefore } })
          const others = k
          const tone = c === DONE_STAGE ? 'kb-done' : si === 0 ? 'kb-todo' : 'kb-doing'
          return (
            <div key={c} ref={el => { if (el) colEls.current.set(c, el); else colEls.current.delete(c) }} className={'kb-col ' + tone + (showGap ? ' over' : '')}>
              {edit ? (
                <div className="kb-head" style={{ gap: 4 }}>
                  <input type="text" aria-label="Stage name" defaultValue={stg.name} key={stg.name} onBlur={e => { const v = e.target.value.trim(); if (v && v !== stg.name) renameStage(c, v) }} style={{ flex: 1, minWidth: 0, height: 38, fontSize: 15, fontWeight: 700 }} />
                  <button className="kb-mini" aria-label={`Move ${stg.name} left`} disabled={si === 0} onClick={() => moveStage(si, -1)}>‹</button>
                  <button className="kb-mini" aria-label={`Move ${stg.name} right`} disabled={si === stages.length - 1} onClick={() => moveStage(si, 1)}>›</button>
                  {c !== DONE_STAGE && stages.length > 2 && <button className="kb-mini" aria-label={`Remove ${stg.name}`} onClick={() => removeStage(stg)}>✕</button>}
                </div>
              ) : <div className="kb-head"><span>{stg.name}</span><span className="kb-count">{list.length}</span></div>}
              <div className="kb-list">
                {slots.map(({ it, gapBefore }, i) => (
                  <div key={it.id}>
                    {gapBefore && <div className="kb-gap" />}
                    <KCard it={it} done={c === DONE_STAGE} home={homeTask(it)} edit={edit} faded={drag?.id === it.id && drag.moved}
                      setEl={el => { if (el) cardEls.current.set(it.id, el); else cardEls.current.delete(it.id) }}
                      onDown={(e, el) => start(e, it, c, i, el)}
                      onRename={v => upsert({ ...it, title: v })} onRemove={() => remove(it.id)}
                      onToDo={() => { const id = onPush(it.title); upsert({ ...it, sub: 'task:' + id }) }} />
                  </div>
                ))}
                {showGap && drag!.at >= others && <div className="kb-gap" />}
                {list.length === 0 && !showGap && <div className="kb-empty" />}
              </div>
              {si === 0 && <form style={{ display: 'flex', gap: 6, marginTop: 8 }} onSubmit={e => { e.preventDefault(); if (draft.trim()) { add('task', { cat: p.id, title: draft.trim(), num1: c, sort: Math.max(0, ...list.map(x => x.sort)) + 1 }); setDraft('') } }}>
                <input type="text" placeholder="New task" value={draft} onChange={e => setDraft(e.target.value)} style={{ flex: 1, minWidth: 0, height: 40, fontSize: 15, padding: '0 12px', borderRadius: 12 }} />
                <button className="btn small" type="submit" style={{ height: 40, fontSize: 13, padding: '0 14px' }}>Add</button>
              </form>}
            </div>
          )
        })}
        {edit && <button className="kb-col kb-add" onClick={addStage}><span style={{ fontSize: 28, lineHeight: 1 }}>+</span><span>Add stage</span></button>}
      </div>
      {drag?.moved && dragged && <div className="kb-card kb-ghost" style={{ position: 'fixed', left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.w }}><div style={{ fontSize: 15, fontWeight: 600 }}>{dragged.title}</div></div>}
    </div>
  )
}

function KCard({ it, done, home, edit, faded, setEl, onDown, onRename, onRemove, onToDo }: {
  it: ProjItem; done: boolean; home: Task | undefined; edit: boolean; faded: boolean; setEl: (el: HTMLDivElement | null) => void
  onDown: (e: RPointerEvent, el: HTMLDivElement) => void; onRename: (v: string) => void; onRemove: () => void; onToDo: () => void
}) {
  const el = useRef<HTMLDivElement | null>(null)
  return (
    <div ref={x => { el.current = x; setEl(x) }} className={'kb-card' + (edit ? ' editing' : '') + (faded ? ' faded' : '') + (done ? ' is-done' : '')}
      onPointerDown={e => { if ((e.target as HTMLElement).closest('button, input, a')) return; e.preventDefault(); onDown(e, el.current!) }}>
      {edit ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="text" aria-label="Task" defaultValue={it.title} onBlur={e => { const v = e.target.value.trim(); if (v && v !== it.title) onRename(v) }} style={{ flex: 1, minWidth: 0, height: 36, fontSize: 14 }} />
          <RM label={`Remove ${it.title}`} onClick={onRemove} />
        </div>
      ) : (
        <>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, ...(done ? { textDecoration: 'line-through', color: 'var(--muted)' } : {}) }}>{it.title}</div>
          {!done && <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
            {home && !home.done_at ? <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>On home To do</span>
              : <button className="kb-mini" onClick={onToDo}>+ To do</button>}
          </div>}
        </>
      )}
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
  const rename = (j: Job, f: Partial<Pick<Job, 'title' | 'company' | 'pay' | 'place' | 'kind' | 'deadline'>>) => {
    const g = { ...f, ...(f.company !== undefined ? { address: '' } : {}) }
    patch(j.id, g)
    updateJob(j.id, g).then(() => { if (f.company) lookUp(j.id) }).catch(e => { logError('Jobs: saving', e); setMsg(/deadline/i.test(String(e?.message)) ? 'To keep closing dates, run 017_job_deadline.sql in Supabase.' : 'Could not save.') })
  }
  const WORKS = ['Full time', 'Part time', 'Casual', 'Contract']
  const workOf = (k: string) => WORKS.find(w => k.toLowerCase().startsWith(w.toLowerCase())) || ''
  const viaOf = (k: string) => (k.match(/via [^·]+/) || [''])[0].trim()
  const closes = (d?: string | null) => { if (!d) return null; const n = Math.round((new Date(d).getTime() - new Date(t).getTime()) / 86400000); return { text: n < 0 ? `Closed ${fmtShort(d)}` : n === 0 ? 'Closes today' : n === 1 ? 'Closes tomorrow' : `Closes ${fmtShort(d)}`, soon: n >= 0 && n <= 3, past: n < 0 } }
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
  const low = (x: string) => (/^\d/.test(x) ? x : x.toLowerCase())
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
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <input type="text" aria-label="Salary" placeholder="Salary" defaultValue={j.pay} onBlur={e => { const v = e.target.value.trim(); if (v !== j.pay) rename(j, { pay: v }) }} style={{ flex: '1 1 140px', minWidth: 0, height: 40 }} />
                <input type="text" aria-label="Location" placeholder="Location" defaultValue={j.place} onBlur={e => { const v = e.target.value.trim(); if (v !== j.place) rename(j, { place: v }) }} style={{ flex: '1 1 140px', minWidth: 0, height: 40 }} />
                <select aria-label="Work type" defaultValue={workOf(j.kind)} onChange={e => rename(j, { kind: [e.target.value, viaOf(j.kind)].filter(Boolean).join(' · ') })} style={{ flex: '0 1 140px', height: 40 }}>
                  <option value="">Work type</option>{WORKS.map(w => <option key={w}>{w}</option>)}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>Closes<input type="date" aria-label="Closing date" defaultValue={j.deadline || ''} onChange={e => rename(j, { deadline: e.target.value || null })} style={{ height: 40 }} /></label>
              </div>
            </div>
          ) : (
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <a href={j.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
              <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.25 }}>{j.title}</div>
              <div className="muted" style={{ fontSize: 14, marginTop: 2 }}>{[j.company, j.place].filter(Boolean).join(' · ')}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6, fontSize: 13, fontWeight: 600 }}>
                {j.pay && <span style={{ color: 'var(--accent)' }}>{j.pay}</span>}
                {j.kind && <span className="muted">{j.kind}</span>}
                <span className="muted">{j.posted ? `Posted ${low(age(j.posted))}` : j.search === 'shared' ? `Saved ${low(age(j.first_seen))}` : ''}</span>
                {(() => { const c = closes(j.deadline); return c && <span style={{ color: c.soon ? 'var(--late)' : c.past ? 'var(--muted)' : 'var(--ink)', fontWeight: 700 }}>{c.text}</span> })()}
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
