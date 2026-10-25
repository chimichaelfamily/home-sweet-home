import { Credit, PhotoPicker } from './PhotoPicker.tsx'
import { logError } from './lib/errorlog.ts'
import type { Task } from './lib/types.ts'
import { Anchors } from './Anchors.tsx'
import { DEMO_ANCHORS, demoItems } from './lib/demoGoals.ts'
import { useEffect, useRef, useState } from 'react'
import { daysUntil, lockRegistered, lockSupported, lockUnlock, loadPrivate, money, monthsTo, savePrivate, type Kind, type PItem } from './lib/privateData.ts'

const IDLE_MS = 2 * 60 * 1000
type Sub = 'anchors' | 'goals' | 'vision' | 'money'

export function Private({ tasks, onPush }: { tasks: Task[]; onPush: (title: string) => string }) {
  const [unlocked, setUnlocked] = useState(false)
  const registered = lockRegistered()
  const [guest, setGuest] = useState(false)
  const [msg, setMsg] = useState('')
  const timer = useRef<number | undefined>(undefined)

  // lock again after 2 minutes without a tap
  useEffect(() => {
    if (!unlocked) return
    const arm = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setUnlocked(false), IDLE_MS) }
    arm()
    const ev = ['pointerdown', 'keydown']
    ev.forEach(e => window.addEventListener(e, arm))
    return () => { window.clearTimeout(timer.current); ev.forEach(e => window.removeEventListener(e, arm)) }
  }, [unlocked])

  const go = async () => {
    setMsg('')
    try { await lockUnlock(); setUnlocked(true) } catch { setMsg('Face ID did not match. Try again.') }
  }

  if (unlocked) return <Inside onLock={() => setUnlocked(false)} tasks={tasks} onPush={onPush} />
  if (guest) return <Inside demo onLock={() => setGuest(false)} tasks={[]} onPush={() => 'demo'} />
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 520, maxWidth: '100%', padding: 36, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 34, fontWeight: 600 }}>Goals</div>
        <div className="muted" style={{ fontSize: 17, lineHeight: 1.5 }}>Goals, vision board and money.</div>
        {!lockSupported() && <div style={{ fontSize: 15 }}>This browser does not support Face ID passkeys. Open the app from the Home Screen icon in Safari.</div>}
        {lockSupported() && registered && <button className="btn" onClick={go}>Smile to unlock</button>}
        {lockSupported() && !registered && <div className="muted" style={{ fontSize: 15 }}>Face ID is not set up on this device yet. Settings → Face ID.</div>}
        {msg && <div style={{ fontSize: 15 }}>{msg}</div>}
        <button className="btn outline" onClick={() => setGuest(true)}>Guest view</button>
      </div>
    </div>
  )
}

function Inside({ onLock, tasks, onPush, demo = false }: { onLock: () => void; tasks: Task[]; onPush: (title: string) => string; demo?: boolean }) {
  const [sub, setSub] = useState<Sub>('anchors')
  const [items, setItems] = useState<PItem[]>(() => (demo ? demoItems() : []))
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState(false)
  useEffect(() => { if (demo) return; loadPrivate().then(setItems).catch(() => { logError('Goals: loading', 'Could not load. Has 005_private.sql been run?'); setErr('Could not load. Has 005_private.sql been run?') }) }, [])
  const of = (k: Kind) => items.filter(x => x.kind === k).sort((a, b) => a.sort - b.sort)
  const upsert = (it: PItem) => { const next = items.some(x => x.id === it.id) ? items.map(x => x.id === it.id ? it : x) : [...items, it]; setItems(next); if (demo) return; savePrivate(next, { upsert: it }).catch(() => { logError('Goals: saving', 'Could not save. Have 005_private.sql and 011_goal_steps.sql been run?'); setErr('Could not save. Have 005_private.sql and 011_goal_steps.sql been run?') }) }
  const remove = (id: string) => { const next = items.filter(x => x.id !== id); setItems(next); if (demo) return; savePrivate(next, { remove: id }).catch(() => setErr('Could not remove.')) }
  const add = (kind: Kind, f: Partial<PItem>) => { const l = of(kind); upsert({ id: `${kind}-${Date.now().toString(36)}`, kind, title: '', sub: '', cat: '', num1: 0, num2: 0, day: null, sort: (l[l.length - 1]?.sort ?? 0) + 1, ...f }) }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="mc-head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 36, fontWeight: 600 }}>Goals</div>
        {demo && <span className="pill" style={{ background: 'var(--ground)', border: '1px solid var(--border)' }}>Guest view</span>}
        <div className="sub-tabs" style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--ground)', borderRadius: 999 }}>
          {([['anchors', 'Anchors'], ['goals', 'Goals'], ['vision', 'Vision board'], ['money', 'Money magic']] as [Sub, string][]).map(([k, l]) => <button key={k} onClick={() => setSub(k)} style={{ height: 40, padding: '0 18px', borderRadius: 999, border: 'none', fontWeight: 600, fontSize: 15, background: sub === k ? 'var(--accent)' : 'transparent', color: sub === k ? 'var(--on-accent)' : 'var(--ink)' }}>{l}</button>)}
        </div>
        <div style={{ flex: 1 }} />
        {sub !== 'anchors' && <button className="btn small outline" onClick={() => setEdit(!edit)}>{edit ? 'Done editing' : 'Edit'}</button>}
        <button className="btn small" onClick={onLock}>{demo ? 'Leave guest view' : 'Lock'}</button>
      </div>
      {err && <div style={{ fontSize: 14 }}>{err}</div>}
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        {sub === 'anchors' && <Anchors list={demo ? DEMO_ANCHORS : undefined} />}
        {sub === 'goals' && <Goals pillars={of('pillar')} steps={of('step')} tasks={tasks} onPush={onPush} demo={demo} edit={edit} add={add} upsert={upsert} remove={remove} />}
        {sub === 'vision' && <Vision counts={of('countdown')} pins={of('pin')} edit={edit} add={add} upsert={upsert} remove={remove} />}
        {sub === 'money' && <Money rows={of('money')} edit={edit} add={add} upsert={upsert} remove={remove} />}
      </div>
    </div>
  )
}

interface Ops { edit: boolean; add: (k: Kind, f: Partial<PItem>) => void; upsert: (i: PItem) => void; remove: (id: string) => void }
const RM = ({ onClick }: { onClick: () => void }) => <button className="btn small outline" onClick={onClick}>Remove</button>

function Goals({ pillars, steps, tasks, onPush, demo, edit, add, upsert, remove }: { pillars: PItem[]; steps: PItem[]; tasks: Task[]; onPush: (title: string) => string; demo: boolean } & Ops) {
  const [pt, setPt] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [openGoals, setOpenGoals] = useState<Set<string>>(new Set())
  const [showDone, setShowDone] = useState<Set<string>>(new Set())
  const taskOf = (st: PItem) => (st.sub.startsWith('task:') ? tasks.find(t => t.id === st.sub.slice(5)) : undefined)
  const isDone = (st: PItem) => st.num1 === 1 || !!taskOf(st)?.done_at
  const inTodo = (st: PItem) => { if (demo) return st.sub.startsWith('task:'); const t = taskOf(st); return !!t && !t.done_at }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {pillars.length === 0 && <div className="card muted" style={{ padding: 22 }}>Tap Edit to add a big goal, like "Vietnam trip". Then break it into steps and choose which ones go on your To do list.</div>}
      {pillars.map(p => {
        const mine = steps.filter(x => x.cat === p.id).sort((a, b) => a.sort - b.sort)
        const done = mine.filter(isDone).length
        const pct = mine.length ? Math.round((done / mine.length) * 100) : Math.min(100, Math.round(p.num1))
        const draft = drafts[p.id] ?? ''
        return (
          <div key={p.id} className="card" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {edit ? <input type="text" aria-label="Goal name" defaultValue={p.title} onBlur={e => { const v = e.target.value.trim(); if (v && v !== p.title) upsert({ ...p, title: v }) }} style={{ width: '100%' }} />
                  : <div style={{ fontSize: 24, fontWeight: 600 }}>{p.title}</div>}
                <div className="muted" style={{ fontSize: 14 }}>{mine.length ? `${done} of ${mine.length} steps done` : 'No steps yet'}</div>
              </div>
              <div style={{ fontSize: 34, fontWeight: 700, color: 'var(--accent)' }}>{pct}%</div>
            </div>
            <div style={{ height: 12, borderRadius: 10, background: 'var(--faint)' }}><div style={{ height: 12, borderRadius: 10, width: `${pct}%`, background: 'var(--accent)' }} /></div>
            {edit && mine.length === 0 && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><label className="muted" style={{ fontSize: 13 }}>Progress %</label><input type="number" min={0} max={100} aria-label="Percent" defaultValue={p.num1} onBlur={e => upsert({ ...p, num1: Math.min(100, Number(e.target.value) || 0) })} style={{ width: 100 }} /></div>}
            {(() => {
              const isOpen = openGoals.has(p.id); const todo = mine.filter(x => !isDone(x)); const doneSteps = mine.filter(isDone); const nextStep = todo[0]
              const toggle = () => { const n = new Set(openGoals); if (isOpen) n.delete(p.id); else n.add(p.id); setOpenGoals(n) }
              const stepRow = (st: PItem) => {
                const d = isDone(st); const t = inTodo(st)
                return (
                  <div key={st.id} className="row" style={{ minHeight: 40, gap: 10 }}>
                    <button className={'circle' + (d ? ' done' : '')} aria-label={d ? `Mark "${st.title}" not done` : `Mark "${st.title}" done`} style={{ width: 22, height: 22 }} onClick={() => upsert({ ...st, num1: d ? 0 : 1 })}>{d && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.500l4.500 4.500L19 7" /></svg>}</button>
                    <div style={{ flex: 1, fontSize: 15, ...(d ? { textDecoration: 'line-through', color: 'var(--muted)' } : {}) }}>{st.title}</div>
                    {!d && (t ? <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>In To do</span>
                      : <button className="btn small outline" style={{ height: 30, fontSize: 12, padding: '0 10px' }} onClick={() => { const id = onPush(st.title); upsert({ ...st, sub: 'task:' + id }) }}>+ To do</button>)}
                    {edit && <RM onClick={() => remove(st.id)} />}
                  </div>
                )
              }
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {nextStep && !isOpen && <div className="muted" style={{ flex: 1, minWidth: 0, fontSize: 14 }}>Next: {nextStep.title}</div>}
                    {!nextStep && !isOpen && <div style={{ flex: 1 }} />}
                    {isOpen && <div style={{ flex: 1 }} />}
                    <button onClick={toggle} style={{ border: 'none', background: 'none', padding: 0, fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{isOpen ? 'Hide steps' : mine.length ? `Steps (${mine.length})` : 'Add steps'}</button>
                  </div>
                  {isOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {todo.map(stepRow)}
                      {doneSteps.length > 0 && <button onClick={() => { const n = new Set(showDone); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); setShowDone(n) }} style={{ alignSelf: 'flex-start', border: 'none', background: 'none', padding: '8px 0', fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>{showDone.has(p.id) ? 'Hide done' : `Show done (${doneSteps.length})`}</button>}
                      {showDone.has(p.id) && doneSteps.map(stepRow)}
                      <form style={{ display: 'flex', gap: 6, marginTop: 6 }} onSubmit={e => { e.preventDefault(); const v = draft.trim(); if (v) { add('step', { title: v, cat: p.id, sort: (mine[mine.length - 1]?.sort ?? 0) + 1 }); setDrafts({ ...drafts, [p.id]: '' }) } }}>
                        <input type="text" placeholder="Add a step" value={draft} onChange={e => setDrafts({ ...drafts, [p.id]: e.target.value })} style={{ flex: 1, minWidth: 0, height: 38, fontSize: 15, padding: '0 12px', borderRadius: 12 }} />
                        <button className="btn small" type="submit" style={{ height: 38, fontSize: 13, padding: '0 14px' }}>Add</button>
                      </form>
                    </div>)}
                </>
              )
            })()}
            {edit && <div><RM onClick={() => { if (confirm(`Remove "${p.title}" and its steps?`)) { mine.forEach(x => remove(x.id)); remove(p.id) } }} /></div>}
          </div>
        )
      })}
      {edit && <form className="card" style={{ display: 'flex', gap: 8, padding: 16 }} onSubmit={e => { e.preventDefault(); if (pt.trim()) { add('pillar', { title: pt.trim() }); setPt('') } }}>
        <input type="text" placeholder="New big goal, e.g. Vietnam trip" value={pt} onChange={e => setPt(e.target.value)} style={{ flex: 1, minWidth: 0 }} /><button className="btn small" type="submit">Add goal</button>
      </form>}
    </div>
  )
}

function Vision({ counts, pins, edit, add, upsert, remove }: { counts: PItem[]; pins: PItem[] } & Ops) {
  const [ct, setCt] = useState(''); const [cd, setCd] = useState(''); const [pt, setPt] = useState(''); const [pick, setPick] = useState<string | null>(null)
  const [big, setBig] = useState<string | null>(null)
  const cs = [...counts].filter(c => c.day).sort((a, b) => a.day!.localeCompare(b.day!))
  const shown = pins
  const bigPin = pins.find(x => x.id === big)
  const tint = (i: number) => `linear-gradient(135deg, hsl(${(i * 47 + 280) % 360} 35% 55%), hsl(${(i * 47 + 330) % 360} 40% 42%))`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {pick && (() => { const pin = pins.find(x => x.id === pick); return pin ? <PhotoPicker initial={pin.title} onPick={(img, credit) => { upsert({ ...pin, img, sub: img && credit ? credit : '' }); setPick(null) }} onClose={() => setPick(null)} /> : null })()}
      {bigPin && (
        <div className="overlay" onClick={() => setBig(null)} style={{ zIndex: 30, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 'min(94vw, 900px)', maxHeight: '92dvh', borderRadius: 24, overflow: 'hidden', background: 'var(--card)', display: 'flex', flexDirection: 'column' }}>
            {bigPin.img && <img src={bigPin.img} alt={bigPin.title} style={{ width: '100%', maxHeight: '74dvh', objectFit: 'contain', background: '#000' }} />}
            <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 22, fontWeight: 600 }}>{bigPin.title}</div>{bigPin.img && <Credit credit={bigPin.sub} />}</div>
              <button className="btn small" onClick={() => setBig(null)}>Close</button>
            </div>
          </div>
        </div>)}
      {cs.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {cs.map(c => { const n = daysUntil(c.day!); return (
            <div key={c.id} style={{ flex: 'none', display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 16px', borderRadius: 999, border: '1.5px solid var(--border)', background: 'var(--card)' }}>
              <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}>{c.title}</span>
              <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{n > 0 ? `${n} days` : n === 0 ? 'Today!' : `${-n}d ago`}</span>
              {edit && <button aria-label={`Remove ${c.title}`} onClick={() => remove(c.id)} style={{ border: 'none', background: 'transparent', color: 'var(--muted)', fontSize: 18, padding: 0 }}>×</button>}
            </div>) })}
        </div>)}
      {edit && <form style={{ display: 'flex', gap: 8, maxWidth: 640 }} onSubmit={e => { e.preventDefault(); if (ct.trim() && cd) { add('countdown', { title: ct.trim(), day: cd }); setCt(''); setCd('') } }}><input type="text" placeholder="New countdown" value={ct} onChange={e => setCt(e.target.value)} /><input type="date" aria-label="Date" value={cd} onChange={e => setCd(e.target.value)} /><button className="btn small" type="submit">Add</button></form>}
      {shown.length === 0 && <div className="muted">Nothing here yet. Tap Edit and add something you want in your life.</div>}
      <div className="photo-wall">
        {shown.map((p, i) => (
          <div key={p.id} className="wall-tile" style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', cursor: edit ? 'default' : 'pointer', background: p.img ? '#222' : tint(i), minHeight: p.img ? undefined : 150 + (i % 3) * 30 }} onClick={() => { if (!edit) setBig(p.id) }}>
            {p.img && <img src={p.img} alt={p.title} style={{ display: 'block', width: '100%', height: 'auto' }} />}
            <div style={{ position: p.img ? 'absolute' : 'static', inset: p.img ? 'auto 0 0 0' : undefined, padding: '26px 14px 12px', color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,.5)', background: p.img ? 'linear-gradient(transparent, rgba(0,0,0,.65))' : 'none', ...(p.img ? {} : { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 150 }) }}>
              <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.2 }}>{p.title}</div>
              {p.img && <Credit credit={p.sub} />}
              {edit && <div style={{ marginTop: 8, display: 'flex', gap: 6 }}><button className="btn small outline" onClick={e => { e.stopPropagation(); setPick(p.id) }}>{p.img ? 'Change photo' : 'Add photo'}</button><RM onClick={() => remove(p.id)} /></div>}
            </div>
          </div>
        ))}
      </div>
      {edit && <form style={{ display: 'flex', gap: 8, maxWidth: 640 }} onSubmit={e => { e.preventDefault(); if (pt.trim()) { add('pin', { title: pt.trim(), cat: '' }); setPt('') } }}><input type="text" placeholder="New vision, e.g. A garden full of flowers" value={pt} onChange={e => setPt(e.target.value)} /><button className="btn small" type="submit">Add</button></form>}
    </div>
  )
}

/** Add to or take away from the amount saved, by 500 or any number you type. */
function Adjust({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [amt, setAmt] = useState('500')
  const a = Math.abs(Number(amt)) || 0
  const bump = (sign: 1 | -1) => { if (a > 0) onChange(Math.max(0, Math.round((value + sign * a) * 100) / 100)) }
  const round = { width: 34, height: 34, borderRadius: '50%', fontSize: 20, fontWeight: 600, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 } as const
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
      <button className="btn outline" aria-label={`Take away ${a} dollars`} style={round} onClick={() => bump(-1)}>−</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 34, padding: '0 10px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--card)' }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>$</span>
        <input type="number" inputMode="decimal" aria-label="Amount" value={amt} onChange={e => setAmt(e.target.value)} style={{ width: 62, height: 30, border: 'none', padding: 0, fontSize: 15, fontWeight: 600, background: 'transparent' }} />
      </div>
      <button className="btn" aria-label={`Add ${a} dollars`} style={round} onClick={() => bump(1)}>+</button>
    </div>
  )
}

function Money({ rows, edit, add, upsert, remove }: { rows: PItem[] } & Ops) {
  const [n, setN] = useState(''); const [t, setT] = useState(''); const [y, setY] = useState(String(new Date().getFullYear() + 1)); const [sv, setSv] = useState('')
  const years = [...new Set(rows.map(r => r.cat))].sort()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 22, fontWeight: 600 }}>Money magic</div>
      {rows.length === 0 && <div className="card muted" style={{ padding: 20 }}>Add a goal with its target and a year. The monthly amount works itself out.</div>}
      {years.map(yr => (
        <div key={yr} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="muted" style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, marginTop: 6 }}>BY {yr}</div>
          {rows.filter(r => r.cat === yr).map(r => {
            const pct = r.num2 > 0 ? Math.min(100, Math.round(r.num1 / r.num2 * 100)) : 0
            const left = Math.max(0, r.num2 - r.num1); const per = left / monthsTo(Number(yr))
            return (
              <div key={r.id} className="card" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>{r.title}</div>
                    <div className="muted" style={{ fontSize: 15 }}>{money(r.num1)} of {money(r.num2)}</div>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)' }}>{pct}%</div>
                </div>
                <div style={{ height: 12, borderRadius: 10, background: 'var(--faint)' }}><div style={{ height: 12, borderRadius: 10, width: `${pct}%`, background: 'var(--accent)' }} /></div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div className="muted" style={{ fontSize: 14 }}>{left > 0 ? `${money(per)} a month until Dec ${yr}` : 'Reached!'}</div>
                  {!edit && <Adjust value={r.num1} onChange={v => upsert({ ...r, num1: v })} />}
                </div>
                {edit && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 4 }}>
                    <label style={{ flex: '2 1 180px' }}>Goal name<input type="text" defaultValue={r.title} onBlur={e => { const v = e.target.value.trim(); if (v && v !== r.title) upsert({ ...r, title: v }) }} style={{ width: '100%' }} /></label>
                    <label style={{ width: 130 }}>Target $<input type="number" defaultValue={r.num2} onBlur={e => { const v = Number(e.target.value); if (v > 0 && v !== r.num2) upsert({ ...r, num2: v }) }} style={{ width: '100%' }} /></label>
                    <label style={{ width: 130 }}>Saved so far $<input type="number" aria-label="Saved so far" defaultValue={r.num1} onBlur={e => upsert({ ...r, num1: Number(e.target.value) || 0 })} style={{ width: '100%' }} /></label>
                    <label style={{ width: 110 }}>By Dec<input type="number" aria-label="By year" defaultValue={Number(r.cat)} onBlur={e => { const v = Math.round(Number(e.target.value)); if (v >= new Date().getFullYear() && v < 2100 && String(v) !== r.cat) upsert({ ...r, cat: String(v) }) }} style={{ width: '100%' }} /></label>
                    <RM onClick={() => remove(r.id)} />
                  </div>)}
              </div>
            )
          })}
        </div>
      ))}
      {edit && <form className="card" style={{ display: 'flex', gap: 8, padding: 16, flexWrap: 'wrap' }} onSubmit={e => { e.preventDefault(); if (n.trim() && Number(t) > 0) { add('money', { title: n.trim(), num2: Number(t), num1: Number(sv) || 0, cat: y }); setN(''); setT(''); setSv('') } }}>
        <input type="text" placeholder="Goal name" value={n} onChange={e => setN(e.target.value)} style={{ flex: 2, minWidth: 180 }} />
        <input type="number" placeholder="Target $" value={t} onChange={e => setT(e.target.value)} style={{ width: 130 }} />
        <input type="number" placeholder="Saved $" value={sv} onChange={e => setSv(e.target.value)} style={{ width: 130 }} />
        <input type="number" aria-label="By year" value={y} onChange={e => setY(e.target.value)} style={{ width: 100 }} />
        <button className="btn small" type="submit">Add</button>
      </form>}
    </div>
  )
}
