import { Credit, PhotoPicker } from './PhotoPicker.tsx'
import { logError } from './lib/errorlog.ts'
import { useEffect, useRef, useState } from 'react'
import { daysUntil, lockRegister, lockRegistered, lockReset, lockSupported, lockUnlock, loadPrivate, money, monthsTo, savePrivate, type Kind, type PItem } from './lib/privateData.ts'

const IDLE_MS = 2 * 60 * 1000
type Sub = 'goals' | 'vision' | 'money'

export function Private() {
  const [unlocked, setUnlocked] = useState(false)
  const [registered, setRegistered] = useState(lockRegistered())
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

  const go = async (setup: boolean) => {
    setMsg('')
    try { if (setup) { await lockRegister(); setRegistered(true) } else await lockUnlock(); setUnlocked(true) }
    catch { setMsg(setup ? 'Setup was cancelled or not allowed. Try again.' : 'Face ID did not match. Try again.') }
  }

  if (unlocked) return <Inside onLock={() => setUnlocked(false)} />
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 520, padding: 36, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 34, fontWeight: 600 }}>Goals</div>
        <div className="muted" style={{ fontSize: 17, lineHeight: 1.5 }}>Goals, vision board and money. Locked with Face ID, and it locks itself after 2 minutes.</div>
        {!lockSupported() && <div style={{ fontSize: 15 }}>This browser does not support Face ID passkeys. Open the app from the Home Screen icon in Safari.</div>}
        {lockSupported() && !registered && <button className="btn" onClick={() => go(true)}>Set up Face ID for this device</button>}
        {lockSupported() && registered && <button className="btn" onClick={() => go(false)}>Unlock with Face ID</button>}
        {msg && <div style={{ fontSize: 15 }}>{msg}</div>}
        {registered && <button className="btn small outline" onClick={() => { lockReset(); setRegistered(false) }}>Reset the lock</button>}
      </div>
    </div>
  )
}

function Inside({ onLock }: { onLock: () => void }) {
  const [sub, setSub] = useState<Sub>('goals')
  const [items, setItems] = useState<PItem[]>([])
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState(false)
  useEffect(() => { loadPrivate().then(setItems).catch(() => { logError('Goals: loading', 'Could not load. Has 005_private.sql been run?'); setErr('Could not load. Has 005_private.sql been run?') }) }, [])
  const of = (k: Kind) => items.filter(x => x.kind === k).sort((a, b) => a.sort - b.sort)
  const upsert = (it: PItem) => { const next = items.some(x => x.id === it.id) ? items.map(x => x.id === it.id ? it : x) : [...items, it]; setItems(next); savePrivate(next, { upsert: it }).catch(() => { logError('Goals: saving', 'Could not save. Has 005_private.sql been run?'); setErr('Could not save. Has 005_private.sql been run?') }) }
  const remove = (id: string) => { const next = items.filter(x => x.id !== id); setItems(next); savePrivate(next, { remove: id }).catch(() => setErr('Could not remove.')) }
  const add = (kind: Kind, f: Partial<PItem>) => { const l = of(kind); upsert({ id: `${kind}-${Date.now().toString(36)}`, kind, title: '', sub: '', cat: '', num1: 0, num2: 0, day: null, sort: (l[l.length - 1]?.sort ?? 0) + 1, ...f }) }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 36, fontWeight: 600 }}>Goals</div>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--ground)', borderRadius: 999 }}>
          {([['goals', 'Goals'], ['vision', 'Vision board'], ['money', 'Money magic']] as [Sub, string][]).map(([k, l]) => <button key={k} onClick={() => setSub(k)} style={{ height: 40, padding: '0 18px', borderRadius: 999, border: 'none', fontWeight: 600, fontSize: 15, background: sub === k ? 'var(--accent)' : 'transparent', color: sub === k ? 'var(--on-accent)' : 'var(--ink)' }}>{l}</button>)}
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn small outline" onClick={() => setEdit(!edit)}>{edit ? 'Done editing' : 'Edit'}</button>
        <button className="btn small" onClick={onLock}>Lock</button>
      </div>
      {err && <div style={{ fontSize: 14 }}>{err}</div>}
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        {sub === 'goals' && <Goals pillars={of('pillar')} ladder={of('ladder')} edit={edit} add={add} upsert={upsert} remove={remove} />}
        {sub === 'vision' && <Vision counts={of('countdown')} pins={of('pin')} edit={edit} add={add} upsert={upsert} remove={remove} />}
        {sub === 'money' && <Money rows={of('money')} edit={edit} add={add} upsert={upsert} remove={remove} />}
      </div>
    </div>
  )
}

interface Ops { edit: boolean; add: (k: Kind, f: Partial<PItem>) => void; upsert: (i: PItem) => void; remove: (id: string) => void }
const RM = ({ onClick }: { onClick: () => void }) => <button className="btn small outline" onClick={onClick}>Remove</button>
const WHENS = ['10 YEARS', 'THIS YEAR', 'THIS QUARTER', 'THIS MONTH', 'THIS WEEK']
const STATUS = ['To define', 'Next', 'In progress', 'Suggested', 'Done']

function Goals({ pillars, ladder, edit, add, upsert, remove }: { pillars: PItem[]; ladder: PItem[] } & Ops) {
  const [pt, setPt] = useState(''); const [lt, setLt] = useState(''); const [lw, setLw] = useState(WHENS[1])
  const sorted = [...ladder].sort((a, b) => WHENS.indexOf(a.cat) - WHENS.indexOf(b.cat))
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div className="card" style={{ flex: 1, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 600 }}>Big picture</div>
        {pillars.length === 0 && <div className="muted">Add your big goals, like "Live free" or "Our home".</div>}
        {pillars.map(p => (
          <div key={p.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 600 }}><span>{p.title}</span><span>{Math.round(p.num1)}%</span></div>
            <div style={{ height: 10, borderRadius: 10, background: 'var(--faint)', marginTop: 6 }}><div style={{ height: 10, borderRadius: 10, width: `${Math.min(100, p.num1)}%`, background: 'var(--accent)' }} /></div>
            {edit && <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><input type="number" min={0} max={100} aria-label="Percent" defaultValue={p.num1} onBlur={e => upsert({ ...p, num1: Number(e.target.value) || 0 })} style={{ width: 100 }} /><RM onClick={() => remove(p.id)} /></div>}
          </div>
        ))}
        {edit && <form style={{ display: 'flex', gap: 8 }} onSubmit={e => { e.preventDefault(); if (pt.trim()) { add('pillar', { title: pt.trim() }); setPt('') } }}><input type="text" placeholder="New big goal" value={pt} onChange={e => setPt(e.target.value)} /><button className="btn small" type="submit">Add</button></form>}
      </div>
      <div className="card" style={{ flex: 1.2, padding: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 600 }}>From 10 years to this week</div>
        {ladder.length === 0 && <div className="muted">Add steps from far away to this week.</div>}
        {sorted.map(l => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, borderBottom: '1px solid var(--border)' }}>
            <div className="muted" style={{ width: 110, fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>{l.cat}</div>
            <div style={{ flex: 1, fontSize: 18, fontWeight: 600 }}>{l.title}</div>
            {edit ? <><select aria-label="Status" value={l.sub} onChange={e => upsert({ ...l, sub: e.target.value })}>{STATUS.map(x => <option key={x}>{x}</option>)}</select><RM onClick={() => remove(l.id)} /></>
              : <span style={{ fontSize: 13, fontWeight: 600, padding: '4px 12px', borderRadius: 999, border: '1.5px solid var(--mborder)' }}>{l.sub || 'Next'}</span>}
          </div>
        ))}
        {edit && <form style={{ display: 'flex', gap: 8 }} onSubmit={e => { e.preventDefault(); if (lt.trim()) { add('ladder', { title: lt.trim(), cat: lw, sub: 'Next' }); setLt('') } }}><select aria-label="When" value={lw} onChange={e => setLw(e.target.value)}>{WHENS.map(x => <option key={x}>{x}</option>)}</select><input type="text" placeholder="New step" value={lt} onChange={e => setLt(e.target.value)} /><button className="btn small" type="submit">Add</button></form>}
      </div>
    </div>
  )
}

const CATS = ['Love', 'Money', 'Travel', 'Health', 'Home', 'Career']
function Vision({ counts, pins, edit, add, upsert, remove }: { counts: PItem[]; pins: PItem[] } & Ops) {
  const [ct, setCt] = useState(''); const [cd, setCd] = useState(''); const [pt, setPt] = useState(''); const [pc, setPc] = useState(CATS[0]); const [f, setF] = useState('All'); const [pick, setPick] = useState<string | null>(null)
  const cs = [...counts].filter(c => c.day).sort((a, b) => a.day!.localeCompare(b.day!))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {pick && (() => { const pin = pins.find(x => x.id === pick); return pin ? <PhotoPicker initial={pin.title} onPick={(img, credit) => { upsert({ ...pin, img, sub: img && credit ? credit : '' }); setPick(null) }} onClose={() => setPick(null)} /> : null })()}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {cs.map((c, i) => { const n = daysUntil(c.day!); return (
          <div key={c.id} className="card" style={{ minWidth: 220, padding: '14px 20px', ...(i === 0 ? { background: 'var(--accent)', color: 'var(--on-accent)' } : {}) }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{c.title}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{n > 0 ? `in ${n} days` : n === 0 ? 'Today!' : `${-n} days ago`}</div>
            {edit && <div style={{ marginTop: 6 }}><RM onClick={() => remove(c.id)} /></div>}
          </div>) })}
        {cs.length === 0 && <div className="muted">Add countdowns, like "Christmas tree goes up".</div>}
      </div>
      {edit && <form style={{ display: 'flex', gap: 8, maxWidth: 640 }} onSubmit={e => { e.preventDefault(); if (ct.trim() && cd) { add('countdown', { title: ct.trim(), day: cd }); setCt(''); setCd('') } }}><input type="text" placeholder="New countdown" value={ct} onChange={e => setCt(e.target.value)} /><input type="date" aria-label="Date" value={cd} onChange={e => setCd(e.target.value)} /><button className="btn small" type="submit">Add</button></form>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['All', ...CATS].map(c => <button key={c} onClick={() => setF(c)} style={{ height: 40, padding: '0 16px', borderRadius: 999, fontWeight: 600, fontSize: 15, border: '1.5px solid var(--mborder)', background: f === c ? 'var(--accent)' : 'transparent', color: f === c ? 'var(--on-accent)' : 'var(--ink)' }}>{c}</button>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {pins.filter(p => f === 'All' || p.cat === f).map((p, i) => (
          <div key={p.id} style={{ minHeight: 150, borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,.45)', background: p.img ? `linear-gradient(transparent 35%, rgba(0,0,0,.6)), center / cover url("${p.img}")` : `linear-gradient(135deg, hsl(${(i * 47 + 280) % 360} 35% 55%), hsl(${(i * 47 + 330) % 360} 40% 42%))` }}>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: .85 }}>{p.cat.toUpperCase()}</div>
            <div style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.2 }}>{p.title}</div>
            {p.img && <Credit credit={p.sub} />}
            {edit && <div style={{ marginTop: 8, display: 'flex', gap: 6 }}><button className="btn small outline" onClick={() => setPick(p.id)}>{p.img ? 'Change photo' : 'Add photo'}</button><RM onClick={() => remove(p.id)} /></div>}
          </div>
        ))}
      </div>
      {edit && <form style={{ display: 'flex', gap: 8, maxWidth: 640 }} onSubmit={e => { e.preventDefault(); if (pt.trim()) { add('pin', { title: pt.trim(), cat: pc }); setPt('') } }}><input type="text" placeholder="New vision, e.g. A garden full of flowers" value={pt} onChange={e => setPt(e.target.value)} /><select aria-label="Category" value={pc} onChange={e => setPc(e.target.value)}>{CATS.map(c => <option key={c}>{c}</option>)}</select><button className="btn small" type="submit">Add</button></form>}
      <div className="muted" style={{ fontSize: 13 }}>In Edit, tap Add photo on a card to search free photos or use one from your iPad.</div>
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
              <div key={r.id} className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>{r.title}</div>
                    <div className="muted" style={{ fontSize: 15 }}>{money(r.num1)} of {money(r.num2)}</div>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)' }}>{pct}%</div>
                </div>
                <div style={{ height: 12, borderRadius: 10, background: 'var(--faint)' }}><div style={{ height: 12, borderRadius: 10, width: `${pct}%`, background: 'var(--accent)' }} /></div>
                <div className="muted" style={{ fontSize: 14 }}>{left > 0 ? `${money(per)} a month until Dec ${yr}` : 'Reached!'}</div>
                {edit && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><label className="muted" style={{ fontSize: 13 }}>Saved so far</label><input type="number" aria-label="Saved so far" defaultValue={r.num1} onBlur={e => upsert({ ...r, num1: Number(e.target.value) || 0 })} style={{ width: 140 }} /><RM onClick={() => remove(r.id)} /></div>}
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
