import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { emptyState, load, loadCalLinks, saveCalLink, loadMorning, saveMorning, type MItem, save, supabase, usingDatabase, type CalLinks } from './lib/backend.ts'
import { Private } from './Private.tsx'
import { Ask } from './Ask.tsx'
import { MonthCalendar } from './MonthCalendar.tsx'
import { Credit, PhotoPicker } from './PhotoPicker.tsx'
import { Face, FaceSettings, refreshAvatars } from './Face.tsx'
import { WeatherScene } from './WeatherScene.tsx'
import { skyOf } from './lib/photos.ts'
import { clearErrors, getErrors, installGlobalHandlers, logError, markSeen, unseenCount } from './lib/errorlog.ts'
import { playerSrc } from './lib/embed.ts'
import { MediaProvider, useMedia } from './Media.tsx'
import { Weekly } from './Weekly.tsx'
import { Products } from './Products.tsx'
import { lockRegister, lockRegistered, lockReset, lockSupported } from './lib/privateData.ts'
import { Knowledge } from './Knowledge.tsx'
import { getGoodreadsUrl, goodreadsRssFrom, lastGoodreadsSync, setGoodreadsUrl, syncGoodreads } from './lib/knowledge.ts'
import { IconView } from './CalIconArt.tsx'
import { getCalIcons, setCalIcon, TET_ICONS, VEG_ICONS } from './lib/calIcons.ts'
import { fetchCalendar, scheduleDays, type CalEvent } from './lib/calendar.ts'
import { addMonthKey, daysInMonth, longestInMonth, monthLabel, streak, weatherText } from './lib/habits.ts'
import * as A from './lib/actions.ts'
import { addDays, diffDays, dowShort, fmtLong, fmtShort, isoToYmd, today } from './lib/dates.ts'
import { daysLate, headsUps, nextDue, status, type Rule, type Unit } from './lib/rules.ts'
import { PEOPLE, POINTS, SIZE_LABEL, type Op, type PEvent, type Size, type State, type Task, type Who } from './lib/types.ts'

type Tab = 'home' | 'habits' | 'morning' | 'private' | 'calendar' | 'ask' | 'weekly' | 'products' | 'reminders' | 'points' | 'knowledge' | 'settings'
type Pending = { kind: 'task' | 'rule'; id: string; title: string; size: Size } | null
const THEMES = [
  { id: 'lilac', name: 'Lilac haze', note: 'Lavender, dusty pink' },
  { id: 'warm', name: 'Warm soft', note: 'Cream and plum' },
  { id: 'minimal', name: 'Calm minimal', note: 'Grey-green and sage' },
]

export default function App() {
  const [state, setState] = useState<State | null>(null)
  const [session, setSession] = useState<boolean>(!usingDatabase)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('home')
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('hsh.theme') || 'lilac' } catch { return 'lilac' } })
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editingRule, setEditingRule] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const stateRef = useRef<State | null>(null)
  stateRef.current = state
  const [mode, setMode] = useState<'light' | 'dark' | 'auto'>(() => { try { return (localStorage.getItem('hsh.mode') as 'light' | 'dark' | 'auto') || 'light' } catch { return 'light' } })
  const dark = useDark(mode)
  useEffect(() => { document.documentElement.dataset.mode = dark ? 'dark' : 'light'; try { localStorage.setItem('hsh.mode', mode) } catch { /* ignore */ } }, [dark, mode])
  const [errs, setErrs] = useState(unseenCount())
  const [openSec, setOpenSec] = useState<'errors' | 'reminders' | null>(null)
  useEffect(() => { installGlobalHandlers(); const f = () => setErrs(unseenCount()); window.addEventListener('hsh-errors', f); return () => window.removeEventListener('hsh-errors', f) }, [])

  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('hsh.theme', theme) } catch { /* ignore */ } }, [theme])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(!!s))
    return () => data.subscription.unsubscribe()
  }, [])

  const refresh = useCallback(() => load().then(setState).catch(e => { logError('Loading data', e); setError(String(e.message || e)) }), [])
  useEffect(() => { if (session) { refresh(); refreshAvatars() } }, [session, refresh])
  // keep the door iPad fresh: reload data every few minutes, and the screen re-checks "today" each minute
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 60000); return () => clearInterval(t) }, [])
  useEffect(() => { if (!session || !usingDatabase) return; const t = setInterval(refresh, 300000); return () => clearInterval(t) }, [session, refresh])

  const apply = useCallback(async (r: { state: State; ops: Op[]; batch?: string }) => {
    setState(r.state)
    const msg = await save(r.state, r.ops)
    if (msg) { logError('Saving to the database', msg); setError('Could not save: ' + msg) }
    return r
  }, [])

  const doComplete = async (p: NonNullable<Pending>, who: Who) => {
    setPending(null)
    if (!stateRef.current) return
    await apply(A.complete(stateRef.current, p.kind, p.id, who))
  }

  if (usingDatabase && !session) return <Login />
  if (!state) return <div className="app"><div className="muted" style={{ fontSize: 24 }}>{error ?? 'Loading…'}</div></div>

  return (
    <MediaProvider>
    <div className="app">
      {error && <div className="card" style={{ padding: '10px 18px', color: 'var(--late)', fontWeight: 600 }}>{error} <button className="btn small outline" onClick={() => setError(null)}>Dismiss</button></div>}
      <div className="main">
        {tab === 'home' && <Home s={state} apply={apply} onEdit={setEditing} onEditRule={setEditingRule} onAdd={() => setAdding(true)} onTick={setPending} goReminders={() => { setTab('settings'); setOpenSec('reminders') }} />}
        {tab === 'habits' && <Habits s={state} apply={apply} />}
        {tab === 'calendar' && <MonthCalendar />}
        {tab === 'morning' && <Morning />}
        {tab === 'private' && <Private tasks={state.tasks} onPush={title => { const r = A.addTask(state, title, 'baby'); apply(r); return r.state.tasks[r.state.tasks.length - 1].id }} />}
        <div className="keep" style={{ height: '100%', display: tab === 'ask' ? 'block' : 'none' }}><Ask s={state} /></div>
        <div style={{ height: '100%', display: tab === 'weekly' ? 'block' : 'none' }}><Weekly s={state} /></div>
        <div style={{ height: '100%', display: tab === 'knowledge' ? 'block' : 'none' }}><Knowledge /></div>
        {tab === 'points' && <Points s={state} apply={apply} />}
        {tab === 'settings' && <Settings s={state} apply={apply} theme={theme} setTheme={setTheme} mode={mode} setMode={setMode} openSec={openSec} clearOpen={() => setOpenSec(null)} onDone={setPending} />}
      </div>
      <nav className="nav">
        {([['home', 'Home'], ['calendar', 'Calendar'], ['points', 'Points'], ['habits', 'Habits'], ['morning', 'Affirmation'], ['private', 'Goals'], ['weekly', 'Report'], ['knowledge', 'Knowledge'], ['ask', 'AI chat'], ['settings', 'Settings']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{id === 'private' && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: 6, verticalAlign: -1 }}><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>}{label}</button>
        ))}
        {errs > 0 ? <span className="status" style={{ fontSize: 14, color: 'var(--late)', fontWeight: 600, cursor: 'pointer' }} onClick={() => { setTab('settings'); setOpenSec('errors') }}>Something went wrong: see Settings → Logs</span> : <span className="muted status" style={{ fontSize: 14 }}>{!usingDatabase ? 'Demo mode: saved on this iPad only' : ''}</span>}
      </nav>
      {adding && <AddTask onClose={() => setAdding(false)} onAdd={async (t, sz) => { setAdding(false); if (stateRef.current) await apply(A.addTask(stateRef.current, t, sz)) }} />}
      {editing && (() => {
        const tk = state.tasks.find(x => x.id === editing)
        if (!tk) return null
        const live = state.events.filter(e => e.task_id === tk.id && !e.undone_at)
        return <EditTask key={tk.id} t={tk} done={live.length > 0} onClose={() => setEditing(null)}
          onSave={(title, size) => { setEditing(null); apply(A.editTask(state, tk.id, { title, size })) }}
          onDelete={() => { setEditing(null); apply(A.deleteTask(state, tk.id)) }}
          onUndo={() => { setEditing(null); apply(A.undo(state, live[0].batch)) }} />
      })()}
      {editingRule && (() => {
        const r = state.rules.find(x => x.id === editingRule)
        if (!r) return null
        const t0 = today()
        const live = state.events.filter(e => e.rule_id === r.id && !e.undone_at && isoToYmd(e.created_at) === t0)
        return <EditRuleQuick key={r.id} r={r} canUndo={live.length > 0} onClose={() => setEditingRule(null)}
          onSave={(name, size) => { setEditingRule(null); apply(A.updateRule(state, r.id, { name, size })) }}
          onUndo={() => { setEditingRule(null); apply(A.undo(state, live[0].batch)) }} />
      })()}
      {pending && <WhoDid p={pending} onPick={w => doComplete(pending, w)} onClose={() => setPending(null)} />}
    </div>
    </MediaProvider>
  )
}

function Login() {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [msg, setMsg] = useState('')
  return (
    <div className="app" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <form className="dialog" style={{ width: 460 }} onSubmit={async e => { e.preventDefault(); const { error } = await supabase!.auth.signInWithPassword({ email, password: pw }); if (error) setMsg(error.message) }}>
        <div style={{ fontSize: 32, fontWeight: 600 }}>Home Sweet Home</div>
        <label htmlFor="em">Household email</label><input id="em" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <label htmlFor="pw">Password</label><input id="pw" type="password" value={pw} onChange={e => setPw(e.target.value)} />
        {msg && <div style={{ color: 'var(--late)' }}>{msg}</div>}
        <button className="btn" type="submit">Sign in</button>
      </form>
    </div>
  )
}

function Check() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--on-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
}
const monthKey = () => today().slice(0, 7)
const monthTotals = (s: State) => A.monthPoints(s, monthKey())

function overdueList(s: State) {
  const t = today()
  const snoozed = new Set(s.snoozes.filter(z => z.until > t).map(z => z.rule_id))
  return s.rules.filter(r => status(r, t) === 'overdue' && !snoozed.has(r.id)).sort((a, b) => daysLate(b, t) - daysLate(a, t))
}

type Wx = { temp: number; text: string; hi: number; lo: number; code: number; day: boolean } | null
function useWeather(): Wx {
  const [w, setW] = useState<Wx>(null)
  useEffect(() => {
    let off = false
    const go = () => fetch('https://api.open-meteo.com/v1/forecast?latitude=-37.81&longitude=144.96&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=Australia%2FMelbourne&forecast_days=1')
      .then(r => r.json()).then(j => { if (!off) setW({ code: j.current.weather_code, day: j.current.is_day === 1, temp: Math.round(j.current.temperature_2m), text: weatherText(j.current.weather_code), hi: Math.round(j.daily.temperature_2m_max[0]), lo: Math.round(j.daily.temperature_2m_min[0]) }) })
      .catch(() => { /* offline: keep the last reading */ })
    go(); const t = setInterval(go, 30 * 60000)
    return () => { off = true; clearInterval(t) }
  }, [])
  return w
}

function HabitChips({ s, apply, who }: { s: State; apply: (r: { state: State; ops: Op[] }) => Promise<unknown>; who: 'linh' | 'michael' }) {
  const t = today()
  const hs = s.habits.filter(h => h.person_id === who && h.active).sort((a, b) => a.sort - b.sort)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {hs.map(h => {
        const on = s.habitLogs.some(l => l.habit_id === h.id && l.day === t)
        return <button key={h.id} aria-pressed={on} onClick={() => apply(A.toggleHabit(s, h.id, t))} style={{ height: 44, borderRadius: 999, fontSize: 16, fontWeight: 600, border: on ? 'none' : '1px solid var(--border)', background: on ? 'var(--accent)' : 'var(--faint)', color: on ? 'var(--on-accent)' : 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{on && <Check />}{h.name}</button>
      })}
    </div>
  )
}
function PersonToggle({ who, setWho }: { who: 'linh' | 'michael'; setWho: (w: 'linh' | 'michael') => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--ground)', borderRadius: 999 }}>
      {(['linh', 'michael'] as const).map(p => (
        <button key={p} aria-label={PEOPLE[p]} aria-pressed={who === p} onClick={() => setWho(p)} style={{ padding: 3, borderRadius: 999, border: 'none', background: who === p ? 'var(--card)' : 'transparent', opacity: who === p ? 1 : .5, boxShadow: who === p ? '0 1px 6px rgba(0,0,0,.2)' : 'none' }}><Face who={p} size={40} /></button>
      ))}
    </div>
  )
}

/** Dark after sunset in Melbourne (falls back to 7pm to 6am if the sunset time cannot be fetched). */
function useDark(mode: 'light' | 'dark' | 'auto'): boolean {
  const [sun, setSun] = useState<{ rise: number; set: number } | null>(null)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t) }, [])
  useEffect(() => {
    if (mode !== 'auto') return
    fetch('https://api.open-meteo.com/v1/forecast?latitude=-37.81&longitude=144.96&daily=sunrise,sunset&timezone=Australia%2FMelbourne&forecast_days=1')
      .then(r => r.json()).then(j => setSun({ rise: new Date(j.daily.sunrise[0]).getTime(), set: new Date(j.daily.sunset[0]).getTime() }))
      .catch(() => setSun(null))
  }, [mode, today()])
  if (mode === 'dark') return true
  if (mode === 'light') return false
  if (sun) return now >= sun.set || now < sun.rise
  const h = new Date(now).getHours(); return h >= 19 || h < 6
}

function Habits({ s, apply }: { s: State; apply: (r: { state: State; ops: Op[] }) => Promise<unknown> }) {
  const t = today()
  const [who, setWho] = useState<'linh' | 'michael'>('linh')
  const [month, setMonth] = useState(t.slice(0, 7))
  const hs = s.habits.filter(h => h.person_id === who && h.active).sort((a, b) => a.sort - b.sort)
  const n = daysInMonth(month)
  const elapsed = month === t.slice(0, 7) ? Number(t.slice(8, 10)) : month < t.slice(0, 7) ? n : 0
  const set = (id: string) => new Set(s.habitLogs.filter(l => l.habit_id === id).map(l => l.day))
  const sets = hs.map(h => set(h.id))
  const dayKey = (d: number) => `${month}-${String(d).padStart(2, '0')}`
  let perfect = 0, doneTotal = 0
  for (let d = 1; d <= elapsed; d++) { const c = sets.filter(x => x.has(dayKey(d))).length; doneTotal += c; if (hs.length && c === hs.length) perfect++ }
  const pct = elapsed && hs.length ? Math.round((doneTotal / (elapsed * hs.length)) * 100) : 0
  const best = Math.max(0, ...sets.map(x => longestInMonth(x, month, t)))
  const gridCard = useRef<HTMLDivElement>(null)
  useEffect(() => { const el = gridCard.current; if (el && window.innerWidth <= 640) el.scrollLeft = month === t.slice(0, 7) ? Math.max(0, (Number(t.slice(8, 10)) - 4) * 26) : 0 }, [month, t])
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="mc-head" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 36, fontWeight: 600 }}>Habits</div>
        <button className="btn small outline" aria-label="Previous month" onClick={() => setMonth(addMonthKey(month, -1))}>‹</button>
        <div className="mc-month" style={{ fontSize: 22, fontWeight: 600, minWidth: 170, textAlign: 'center' }}>{monthLabel(month)}</div>
        <button className="btn small outline" aria-label="Next month" onClick={() => setMonth(addMonthKey(month, 1))}>›</button>
        <div style={{ flex: 1 }} /><PersonToggle who={who} setWho={setWho} />
      </div>
      <div className="h-stats" style={{ display: 'flex', gap: 14 }}>
        {[['Longest streak', `${best} days`], ['Perfect days', `${perfect} of ${elapsed}`], ['Done', `${pct}%`]].map(([a, b]) => (
          <div key={a} className="card" style={{ flex: 1, padding: '14px 22px' }}><div className="muted" style={{ fontSize: 14, fontWeight: 600 }}>{a}</div><div style={{ fontSize: 30, fontWeight: 600 }}>{b}</div></div>
        ))}
      </div>
      <div ref={gridCard} className="card scroll" style={{ flex: 1, padding: '14px 24px' }}>
        {hs.length === 0 && <div className="muted" style={{ padding: 16, fontSize: 17 }}>No habits yet. Add some in Settings.</div>}
        <div className="habit-grid" style={{ display: 'grid', gridTemplateColumns: `var(--hc, 170px) repeat(${n}, minmax(var(--hd, 0px), 1fr)) var(--hs, 100px)`, alignItems: 'center', rowGap: 4 }}>
          <div />{Array.from({ length: n }, (_, i) => { const isT = dayKey(i + 1) === t; return <div key={i} className={isT ? '' : 'muted'} style={{ fontSize: isT ? 15 : 11, textAlign: 'center', ...(isT ? { fontWeight: 800, color: 'var(--accent)' } : {}) }}>{i + 1}</div> })}<div className="muted" style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>STREAK</div>
          {hs.map((h, hi) => (
            <HabitRow key={h.id} name={h.name} n={n} done={sets[hi]} dayKey={dayKey} today={t} streakN={streak(sets[hi], t)} onToggle={d => apply(A.toggleHabit(s, h.id, dayKey(d)))} />
          ))}
        </div>
      </div>
    </div>
  )
}
function HabitRow({ name, n, done, dayKey, today: t, streakN, onToggle }: { name: string; n: number; done: Set<string>; dayKey: (d: number) => string; today: string; streakN: number; onToggle: (d: number) => void }) {
  return (
    <>
      <div className="h-name" style={{ fontSize: 18, fontWeight: 600 }}>{name}</div>
      {Array.from({ length: n }, (_, i) => {
        const k = dayKey(i + 1); const on = done.has(k); const future = k > t
        return <button key={i} aria-label={`${name} day ${i + 1}`} aria-pressed={on} disabled={future} onClick={() => onToggle(i + 1)} style={{ height: 36, border: 'none', background: 'transparent', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: on ? 'var(--accent)' : 'transparent', border: on ? 'none' : `1.5px solid ${future ? 'var(--border)' : k === t ? 'var(--accent)' : 'var(--mborder)'}`, opacity: future ? .5 : 1 }} />
        </button>
      })}
      <div style={{ textAlign: 'right', fontSize: 16, fontWeight: 600 }}>{streakN} {streakN === 1 ? 'day' : 'days'}</div>
    </>
  )
}

const Pencil = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>

function Home({ s, apply, onEdit, onEditRule, onAdd, onTick, goReminders }: { s: State; apply: (r: { state: State; ops: Op[] }) => Promise<unknown>; onEdit: (id: string) => void; onEditRule: (id: string) => void; onAdd: () => void; onTick: (p: NonNullable<Pending>) => void; goReminders: () => void }) {
  const t = today()
  const now = new Date()
  const totals = monthTotals(s)
  const wx = useWeather()
  const [hwho, setHwho] = useState<'linh' | 'michael'>('linh')
  const untick = (kind: 'task' | 'rule', id: string) => {
    const ev = s.events.filter(e => !e.undone_at && (kind === 'task' ? e.task_id === id : e.rule_id === id && isoToYmd(e.created_at) === t)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0]
    if (ev) apply(A.undo(s, ev.batch))
  }
  const doneRulesToday = [...new Map(s.events.filter(e => e.rule_id && !e.undone_at && isoToYmd(e.created_at) === t).map(e => [e.rule_id!, e])).values()]
  const todayTasks = s.tasks.filter(x => x.due_date <= t && (!x.done_at || isoToYmd(x.done_at) === t))
  const later = s.tasks.filter(x => x.due_date > t && !x.done_at)
  const over = overdueList(s)
  const doneCount = todayTasks.filter(x => x.done_at).length
  const personTag = (a: string | null) => a === 'linh' ? 'L' : a === 'michael' ? 'M' : null
  return (
    <div className="cols rev" style={{ height: '100%', display: 'flex', flexDirection: 'row-reverse', gap: 20 }}>
      <div className="card todo-card" style={{ width: 500, flex: 'none', padding: 28, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 600 }}>To do</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="pill" style={{ background: 'var(--ground)', border: '1.5px solid var(--border)', color: 'var(--ink)', fontSize: 16, padding: '4px 14px 4px 5px', display: 'flex', alignItems: 'center', gap: 8 }}><Face who="linh" size={30} /><b style={{ fontSize: 22 }}>{totals.linh}</b></div>
            <div className="pill" style={{ background: 'var(--ground)', border: '1.5px solid var(--border)', color: 'var(--ink)', fontSize: 16, padding: '4px 14px 4px 5px', display: 'flex', alignItems: 'center', gap: 8 }}><Face who="michael" size={30} /><b style={{ fontSize: 22 }}>{totals.michael}</b></div>
          </div>
        </div>
        <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
          <div className="head" style={{ marginTop: 4 }}>TODAY</div>
          {todayTasks.length === 0 && <div className="muted" style={{ padding: '14px 0', fontSize: 17 }}>Nothing yet. Add a task below.</div>}
          {todayTasks.map(x => (
            <div className="row" key={x.id}>
              <button className={'circle' + (x.done_at ? ' done' : '')} aria-label={x.done_at ? `Undo ${x.title}` : `Tick ${x.title}`} onClick={() => x.done_at ? untick('task', x.id) : onTick({ kind: 'task', id: x.id, title: x.title, size: x.size })}>{x.done_at && <Check />}</button>
              <div role="button" onClick={() => x.done_at ? untick('task', x.id) : onTick({ kind: 'task', id: x.id, title: x.title, size: x.size })} style={{ flex: 1, fontSize: 17, cursor: 'pointer', ...(x.done_at ? { textDecoration: 'line-through', color: 'var(--muted)' } : {}) }}>{x.title}</div>
              {personTag(x.assignee) && <span className="pill" style={{ background: 'var(--ground)', border: '1px solid var(--border)' }}>{personTag(x.assignee)}</span>}
              <span role="button" className={'pill ' + x.size} style={{ cursor: 'pointer' }} onClick={() => onEdit(x.id)}>+{POINTS[x.size]}</span>
              <button className="more" aria-label={`Edit ${x.title}`} onClick={() => onEdit(x.id)}><Pencil /></button>
            </div>
          ))}
          {doneRulesToday.map(e => (
            <div className="row" key={e.id}>
              <button className="circle done" aria-label={`Undo ${e.title}`} onClick={() => untick('rule', e.rule_id!)}><Check /></button>
              <div role="button" onClick={() => untick('rule', e.rule_id!)} style={{ flex: 1, fontSize: 17, cursor: 'pointer', textDecoration: 'line-through', color: 'var(--muted)' }}>{e.title}</div>
              <button className="more" aria-label={`Edit ${e.title}`} onClick={() => onEditRule(e.rule_id!)}><Pencil /></button>
            </div>
          ))}
          {over.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <div className="head" style={{ color: 'var(--late)' }}>OVERDUE · {over.length}</div>
                {over.length > 3 && <button className="btn small outline" style={{ height: 32, fontSize: 14, borderColor: 'var(--accent)', color: 'var(--late)' }} onClick={goReminders}>{over.length - 3} more overdue</button>}
              </div>
              {over.slice(0, 3).map(r => (
                <div className="row" key={r.id} style={{ minHeight: 46 }}>
                  <button className="circle late" style={{ width: 30, height: 30 }} aria-label={`Tick ${r.name}`} onClick={() => onTick({ kind: 'rule', id: r.id, title: r.name, size: r.size })} />
                  <div role="button" onClick={() => onTick({ kind: 'rule', id: r.id, title: r.name, size: r.size })} style={{ flex: 1, fontSize: 16, fontWeight: 500, cursor: 'pointer' }}>{r.name}</div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--late)' }}>{daysLate(r, t)} days late</span>
                  <button className="more" aria-label={`Edit ${r.name}`} onClick={() => onEditRule(r.id)}><Pencil /></button>
                </div>
              ))}
            </>
          )}
          {later.length > 0 && <div className="head" style={{ marginTop: 12 }}>LATER</div>}
          {later.map(x => (
            <div className="row" key={x.id}><div className="circle" /><div style={{ flex: 1, fontSize: 17 }}>{x.title}<div className="muted" style={{ fontSize: 12 }}>{fmtShort(x.due_date)}</div></div><span role="button" className={'pill ' + x.size} style={{ cursor: 'pointer' }} onClick={() => onEdit(x.id)}>+{POINTS[x.size]}</span><button className="more" aria-label={`Edit ${x.title}`} onClick={() => onEdit(x.id)}><Pencil /></button></div>
          ))}
        </div>
        <button onClick={onAdd} style={{ marginTop: 8, height: 56, borderRadius: 16, border: '1.5px dashed var(--mborder)', background: 'transparent', fontSize: 16, fontWeight: 600 }}>+ Add task</button>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <WeatherScene sky={wx ? skyOf(wx.code) : null} day={wx ? wx.day : true} temp={wx ? wx.temp : null}>
          <div>
            <div style={{ fontSize: 56, fontWeight: 600, letterSpacing: -2, lineHeight: 1 }}>{now.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: false })}</div>
            <div style={{ fontSize: 18, opacity: .9 }}>{now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
          {wx ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 54, fontWeight: 600, letterSpacing: -2, lineHeight: 1 }}>{wx.temp}°</div>
              <div><div style={{ fontSize: 19, fontWeight: 600 }}>{wx.text}</div><div style={{ fontSize: 15, opacity: .9 }}>H {wx.hi}° · L {wx.lo}°</div><div style={{ fontSize: 15, opacity: .9 }}>Melbourne</div></div>
            </div>
          ) : <div style={{ fontSize: 16, opacity: .9 }}>Melbourne weather loading…</div>}
        </WeatherScene>
        <Schedule />
        <div className="card" style={{ flex: 'none', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontSize: 24, fontWeight: 600 }}>Habits</div><PersonToggle who={hwho} setWho={setHwho} /></div>
          <HabitChips s={s} apply={apply} who={hwho} />
        </div>
      </div>
    </div>
  )
}

function Schedule() {
  const t = today()
  const days = scheduleDays(t)
  const [links, setLinks] = useState<CalLinks | null>(null)
  const [events, setEvents] = useState<CalEvent[]>([])
  const [err, setErr] = useState('')
  useEffect(() => {
    let off = false
    const go = async () => {
      try {
        const l = await loadCalLinks(); if (off) return
        setLinks(l)
        const all: CalEvent[] = []
        if (l.linh) all.push(...await fetchCalendar(l.linh, 'linh', days[0], days[days.length - 1]))
        if (l.michael) all.push(...await fetchCalendar(l.michael, 'michael', days[0], days[days.length - 1]))
        if (l.chi) all.push(...await fetchCalendar(l.chi, 'chi', days[0], days[days.length - 1]))
        if (!off) { setEvents(all); setErr('') }
      } catch (e) { logError('Calendar', e); if (!off) setErr('Could not refresh the calendar. Showing the last update.') }
    }
    go(); const id = setInterval(go, 10 * 60000)
    return () => { off = true; clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])
  const [calTab, setCalTab] = useState<'linh' | 'michael' | 'chi'>('michael')
  const connected = links && (links.linh || links.michael || links.chi)
  const tabHas = (k: 'linh' | 'michael' | 'chi') => !!links?.[k]
  return (
    <div className="card grow-min" style={{ flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 24, fontWeight: 600 }}>Schedule</div>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--ground)', borderRadius: 999 }}>
          {([['michael', 'Michael'], ['chi', 'Chi'], ['linh', 'Both']] as const).map(([k, l]) => <button key={k} onClick={() => setCalTab(k)} style={{ height: 34, padding: '0 14px', borderRadius: 999, border: 'none', fontWeight: 600, fontSize: 14, background: calTab === k ? 'var(--accent)' : 'transparent', color: calTab === k ? 'var(--on-accent)' : 'var(--ink)' }}>{l}</button>)}
        </div>
      </div>
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        {links && connected && !tabHas(calTab) && <div className="muted" style={{ fontSize: 15 }}>No {calTab === 'linh' ? 'shared' : calTab === 'chi' ? "Chi's" : "Michael's"} calendar added yet. Settings → Calendars.</div>}
        {links && !connected && <div className="muted" style={{ fontSize: 16, lineHeight: 1.5 }}>No calendar yet. Open Settings → Calendars and paste a calendar link.</div>}
        {connected && tabHas(calTab) && days.map(d => {
          const ev = events.filter(e => e.day === d && e.person === calTab).sort((a, b) => a.sort - b.sort)
          return (
            <div key={d} style={{ display: 'flex', gap: 14, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 62, flex: 'none', fontWeight: 700, fontSize: 15, color: d === t ? 'var(--accent)' : 'var(--ink)' }}>{d === t ? 'Today' : dowShort(d)}<div className="muted" style={{ fontSize: 12, fontWeight: 500 }}>{fmtShort(d)}</div></div>
              <div style={{ flex: 1 }}>
                {ev.length === 0 && <div className="muted" style={{ fontSize: 14, padding: '4px 0' }}>Nothing planned</div>}
                {ev.map((e, i) => <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 16, padding: '3px 0' }}><span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: 'var(--accent)' }} /><span className="muted" style={{ width: 64, flex: 'none', fontSize: 14 }}>{e.time}</span><span style={{ fontWeight: 600 }}>{e.title}</span></div>)}
              </div>
            </div>
          )
        })}
        {err && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{err}</div>}
      </div>
    </div>
  )
}

async function smallPng(file: File, max = 96): Promise<string> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return c.toDataURL('image/png')
}

function CalendarSettings() {
  const [links, setLinks] = useState<CalLinks | null>(null)
  const [msg, setMsg] = useState('')
  const [icon, setIcon] = useState(getCalIcons())
  useEffect(() => { loadCalLinks().then(setLinks).catch(() => setLinks({ linh: '', michael: '', chi: '' })) }, [])
  if (!links) return <div className="muted">Loading…</div>
  const save1 = async (p: 'linh' | 'michael' | 'chi', v: string) => {
    v = v.trim()
    if (v && !/^https:\/\/(calendar\.google\.com|outlook\.office365\.com|outlook\.office\.com|outlook\.live\.com)\//.test(v)) { setMsg('That does not look like a Google or Outlook calendar link (an .ics link).'); return }
    setMsg('')
    try { await saveCalLink(p, v, links); setLinks({ ...links, [p]: v }); setMsg('Saved. The schedule refreshes within a few minutes, or reload the app.') }
    catch (e) { logError('Calendar: saving link', e); setMsg('Could not save. Has 010_third_calendar.sql been run?') }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640 }}>
      <div style={{ fontSize: 30, fontWeight: 600 }}>Calendars</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontWeight: 600 }}>Michael's calendar link</label>
        <input type="text" defaultValue={links.michael} placeholder="https://…/basic.ics" onBlur={e => { if (e.target.value.trim() !== links.michael) save1('michael', e.target.value) }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontWeight: 600 }}>Chi's calendar link</label>
        <input type="text" defaultValue={links.chi} placeholder="https://…/basic.ics" onBlur={e => { if (e.target.value.trim() !== links.chi) save1('chi', e.target.value) }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontWeight: 600 }}>Both of us (shared) calendar link</label>
        <input type="text" defaultValue={links.linh} placeholder="https://…/basic.ics" onBlur={e => { if (e.target.value.trim() !== links.linh) save1('linh', e.target.value) }} />
      </div>
      {msg && <div style={{ fontSize: 14 }}>{msg}</div>}
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 10 }}>Calendar icons</div>
      {([['veg', 'Vegetarian day', VEG_ICONS], ['tet', 'Lunar New Year', TET_ICONS]] as const).map(([k, lab, opts]) => (
        <div key={k}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{lab}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {opts.map(o => (
              <button key={o} aria-pressed={icon[k] === o} onClick={() => { setCalIcon(k, o); setIcon(getCalIcons()) }} style={{ width: 58, height: 58, borderRadius: 16, border: '2.5px solid ' + (icon[k] === o ? 'var(--accent)' : 'var(--border)'), background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconView value={o} size={30} /></button>
            ))}
            {icon[k].startsWith('data:') && <button aria-pressed="true" style={{ width: 58, height: 58, borderRadius: 16, border: '2.5px solid var(--accent)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconView value={icon[k]} size={34} /></button>}
            <label className="btn small outline" style={{ alignSelf: 'center', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>Use my own picture<input type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { setCalIcon(k, await smallPng(f)); setIcon(getCalIcons()) } catch (er) { logError('Calendar icon', er); setMsg('Could not use that picture.') } }} /></label>
          </div>
        </div>
      ))}
    </div>
  )
}

function Morning() {
  const [items, setItems] = useState<MItem[]>([])
  const [who, setWho] = useState<'linh' | 'michael'>('linh')
  const [i, setI] = useState(0)
  const [edit, setEdit] = useState(false)
  const [picking, setPicking] = useState<string | null>(null)
  useEffect(() => { loadMorning().then(setItems).catch(() => setItems([])) }, [])
  const mine = (k: MItem['kind']) => items.filter(x => x.person_id === who && x.kind === k).sort((a, b) => a.sort - b.sort)
  const aff = mine('affirmation'), links = mine('link'), songs = mine('song')
  const upsert = (it: MItem) => { const next = items.some(x => x.id === it.id) ? items.map(x => x.id === it.id ? it : x) : [...items, it]; setItems(next); saveMorning(next, { upsert: it }).catch(e => logError('Morning: saving', e)) }
  const remove = (id: string) => { const next = items.filter(x => x.id !== id); setItems(next); saveMorning(next, { remove: id }).catch(e => logError('Morning: saving', e)) }
  const add = (kind: MItem['kind'], title: string, sub = '', url = '') => {
    const list = mine(kind); upsert({ id: `${who}-${kind}-${Date.now().toString(36)}`, person_id: who, kind, title, sub, url, sort: (list[list.length - 1]?.sort ?? 0) + 1 })
  }
  const cur = aff[Math.min(i, Math.max(0, aff.length - 1))]
  const media = useMedia()
  const [watching, setWatching] = useState<MItem | null>(null)
  const watchSrc = watching ? playerSrc(watching.url) : null
  const row = (it: MItem, kind: 'link' | 'song') => {
    const can = !!(it.url && playerSrc(it.url))
    const on = kind === 'link' ? watching?.id === it.id : media.music?.id === it.id
    return (
      <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 54, borderBottom: '1px solid var(--border)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: on ? 'var(--accent)' : 'var(--ink)' }}>{on ? '▶ ' : ''}{it.title}</div>
          {it.sub && <div className="muted" style={{ fontSize: 13 }}>{it.sub}</div>}
        </div>
        {edit ? <button className="btn small outline" style={{ height: 34, fontSize: 13 }} onClick={() => remove(it.id)}>Remove</button>
          : can ? (on ? <button className="btn small outline" style={{ height: 36, fontSize: 13 }} onClick={() => kind === 'link' ? setWatching(null) : media.stopMusic()}>Stop</button>
            : <button className="btn small" style={{ height: 36, fontSize: 13 }} onClick={() => { if (kind === 'link') { media.stopMusic(); setWatching(it) } else { setWatching(null); media.playMusic(it.id, it.title, it.url) } }}>{kind === 'song' ? 'Play' : 'Watch'}</button>)
          : it.url ? <a className="btn small outline" href={it.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', height: 36, fontSize: 13 }}>Open</a>
          : <span className="muted" style={{ fontSize: 13 }}>No link</span>}
      </div>
    )
  }
  const AddForm = ({ kind, ph, subPh }: { kind: 'link' | 'song'; ph: string; subPh: string }) => {
    const [a, setA] = useState(''); const [b, setB] = useState(''); const [u, setU] = useState('')
    return (
      <form style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }} onSubmit={e => { e.preventDefault(); if (a.trim()) { add(kind, a.trim(), b.trim(), u.trim()); setA(''); setB(''); setU('') } }}>
        <div style={{ display: 'flex', gap: 8 }}><input type="text" placeholder={ph} value={a} onChange={e => setA(e.target.value)} /><input type="text" placeholder={subPh} value={b} onChange={e => setB(e.target.value)} /></div>
        <div style={{ display: 'flex', gap: 8 }}><input type="text" placeholder="Paste the link (https://…)" value={u} onChange={e => setU(e.target.value)} /><button className="btn small" type="submit">Add</button></div>
      </form>
    )
  }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {watching && watchSrc && (
        <div className="overlay" style={{ zIndex: 46, padding: 16 }} onClick={() => setWatching(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(96vw, 1100px)', borderRadius: 24, overflow: 'hidden', background: 'var(--card)', boxShadow: '0 24px 64px rgba(0,0,0,.45)' }}>
            <iframe title={watching.title} src={watchSrc.src} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen style={{ display: 'block', width: '100%', aspectRatio: '16 / 9', maxHeight: '78dvh', border: 0, background: '#000' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px' }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 18, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{watching.title}</div>
              <button className="btn small" onClick={() => setWatching(null)}>Close</button>
            </div>
          </div>
        </div>)}
      {picking && (() => { const a = items.find(x => x.id === picking); return a ? <PhotoPicker onPick={(img, credit) => { upsert({ ...a, img, sub: img && credit ? credit : '' }); setPicking(null) }} onClose={() => setPicking(null)} /> : null })()}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontSize: 36, fontWeight: 600 }}>Affirmation</div>
        <div style={{ flex: 1 }} />
        <button className="btn small outline" onClick={() => setEdit(!edit)}>{edit ? 'Done editing' : 'Edit'}</button>
        <PersonToggle who={who} setWho={w => { setWho(w); setI(0) }} />
      </div>
      <div className="scroll" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 20 }}>
        <div className="cols" style={{ display: 'flex', gap: 14, alignItems: 'stretch', flex: 'none' }}>
        <div className="aff-card" style={{ flex: 1.3, minWidth: 0, minHeight: 360, borderRadius: 28, padding: 28, display: 'flex', flexDirection: 'column', gap: 14, color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,.35)', background: cur?.img ? `linear-gradient(rgba(20,12,30,.35),rgba(20,12,30,.55)), center / cover url("${cur.img}")` : 'linear-gradient(135deg,var(--accent),var(--g2))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, letterSpacing: 1.5 }}><span>1 · READ YOUR AFFIRMATIONS</span><span>{aff.length ? `${Math.min(i, aff.length - 1) + 1} of ${aff.length}` : ''}</span></div>
          {!edit && <>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', fontSize: 36, fontWeight: 600, lineHeight: 1.2 }}>{cur ? cur.title : 'No affirmations yet. Tap Edit to add some.'}</div>
            {cur?.img && <Credit credit={cur.sub} />}
            <div style={{ display: 'flex', gap: 8 }}>{aff.map((_, k) => <div key={k} style={{ flex: 1, height: 6, borderRadius: 6, background: k <= i ? '#fff' : 'rgba(255,255,255,.35)' }} />)}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" style={{ minWidth: 120, background: 'rgba(20,12,30,.78)', border: '2px solid #fff', color: '#fff', textShadow: 'none', fontWeight: 700, opacity: i === 0 ? .55 : 1 }} disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
              <button className="btn" style={{ flex: 1, background: '#fff', color: '#1F1F1E', textShadow: 'none', fontWeight: 700, boxShadow: '0 2px 10px rgba(0,0,0,.35)' }} onClick={() => setI(i + 1 >= aff.length ? 0 : i + 1)}>{i + 1 >= aff.length ? 'Start again' : 'Next'}</button>
            </div></>}
          {edit && <div className="scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {aff.map(a => <div key={a.id} style={{ display: 'flex', gap: 8 }}><input type="text" defaultValue={a.title} onBlur={e => { const v = e.target.value.trim(); if (v && v !== a.title) upsert({ ...a, title: v }) }} /><button className="btn small" style={{ background: 'transparent', border: '1.5px solid #fff', color: '#fff' }} onClick={() => setPicking(a.id)}>{a.img ? 'Photo ✓' : 'Photo'}</button><button className="btn small" style={{ background: 'transparent', border: '1.5px solid #fff', color: '#fff' }} onClick={() => remove(a.id)}>Remove</button></div>)}
            <form onSubmit={e => { e.preventDefault(); const f = e.currentTarget.elements.namedItem('new') as HTMLInputElement; if (f.value.trim()) { add('affirmation', f.value.trim()); f.value = '' } }} style={{ display: 'flex', gap: 8 }}><input name="new" type="text" placeholder="New affirmation" /><button className="btn small" type="submit" style={{ background: '#fff', color: 'var(--ink)' }}>Add</button></form>
          </div>}
        </div>
        <div className="card" style={{ flex: 1, minWidth: 0, maxHeight: 460, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="muted" style={{ fontSize: 14, fontWeight: 600, letterSpacing: 1.5 }}>2 · MORNING MUSIC</div>
          <div>
            {songs.length === 0 && !edit && <div className="muted" style={{ fontSize: 15, padding: '8px 0' }}>No songs yet. Tap Edit and paste a YouTube or Spotify link.</div>}
            {songs.map(sg => row(sg, 'song'))}
          </div>
          {edit && <AddForm kind="song" ph="Song or playlist" subPh="Artist" />}
        </div>
        </div>
        <div className="card" style={{ flex: 'none', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="muted" style={{ fontSize: 14, fontWeight: 600, letterSpacing: 1.5 }}>3 · MOVE YOUR BODY</div>
          <div>
            {links.length === 0 && !edit && <div className="muted" style={{ fontSize: 15, padding: '8px 0' }}>No videos yet. Tap Edit and paste a YouTube link.</div>}
            {links.map(l => row(l, 'link'))}
          </div>
          {edit && <AddForm kind="link" ph="Name, e.g. Morning stretch" subPh="Note, e.g. YouTube · 20 min" />}
        </div>
      </div>
    </div>
  )
}

function AddTask({ onClose, onAdd }: { onClose: () => void; onAdd: (t: string, s: Size) => void }) {
  const [title, setTitle] = useState(''); const [size, setSize] = useState<Size>('baby')
  return (
    <div className="overlay"><form className="dialog" style={{ width: 600 }} onSubmit={e => { e.preventDefault(); if (title.trim()) onAdd(title, size) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontSize: 32, fontWeight: 600 }}>Add task</div><button type="button" className="btn small outline" onClick={onClose}>Close</button></div>
      <label htmlFor="tn">Task name</label>
      <input id="tn" type="text" autoFocus value={title} placeholder="What needs doing?" onChange={e => setTitle(e.target.value)} />
      <label>Size</label>
      <div style={{ display: 'flex', gap: 12 }}>
        {(['baby', 'biggie'] as Size[]).map(sz => (
          <button type="button" key={sz} onClick={() => setSize(sz)} aria-pressed={size === sz} style={{ flex: 1, height: 104, borderRadius: 20, textAlign: 'left', padding: '0 22px', background: size === sz ? 'var(--faint)' : 'var(--card)', border: size === sz ? '2.5px solid var(--accent)' : '1.5px solid var(--border)' }}>
            <div style={{ fontSize: 26, fontWeight: 600 }}>{SIZE_LABEL[sz]}</div><div style={{ fontSize: 18 }}>{POINTS[sz]} point{POINTS[sz] > 1 ? 's' : ''}</div>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" type="submit" disabled={!title.trim()} style={{ opacity: title.trim() ? 1 : .5 }}>Add task</button></div>
    </form></div>
  )
}

function EditTask({ t, done, onSave, onDelete, onUndo, onClose }: { t: Task; done: boolean; onSave: (title: string, size: Size) => void; onDelete: () => void; onUndo: () => void; onClose: () => void }) {
  const [title, setTitle] = useState(t.title)
  const [size, setSize] = useState<Size>(t.size)
  return (
    <div className="overlay" onClick={onClose}><div className="dialog" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
      <div style={{ fontSize: 30, fontWeight: 600 }}>Edit task</div>
      <input type="text" aria-label="Task name" value={title} onChange={e => setTitle(e.target.value)} />
      <div style={{ display: 'flex', gap: 10 }}>
        {(['baby', 'biggie'] as Size[]).map(z => <button key={z} onClick={() => setSize(z)} style={{ flex: 1, height: 56, borderRadius: 18, fontSize: 18, fontWeight: 600, border: '2px solid ' + (size === z ? 'var(--accent)' : 'var(--border)'), background: size === z ? 'var(--accent)' : 'var(--card)', color: size === z ? 'var(--on-accent)' : 'var(--ink)' }}>{SIZE_LABEL[z]} · +{POINTS[z]}</button>)}
      </div>
      {done && <div className="muted" style={{ fontSize: 15 }}>This task is done. Changing its size also changes the points already given.</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn outline" onClick={() => { if (confirm('Delete this task' + (done ? ' and its points' : '') + '?')) onDelete() }}>Delete</button>
        <div style={{ flex: 1 }} />
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={!title.trim()} onClick={() => onSave(title, size)}>Save</button>
      </div>
    </div></div>
  )
}

function EditRuleQuick({ r, canUndo, onSave, onUndo, onClose }: { r: Rule; canUndo: boolean; onSave: (name: string, size: Size) => void; onUndo: () => void; onClose: () => void }) {
  const [name, setName] = useState(r.name)
  const [size, setSize] = useState<Size>(r.size)
  return (
    <div className="overlay" onClick={onClose}><div className="dialog" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
      <div style={{ fontSize: 30, fontWeight: 600 }}>Edit reminder</div>
      <input type="text" aria-label="Name" value={name} onChange={e => setName(e.target.value)} />
      <div style={{ display: 'flex', gap: 10 }}>
        {(['baby', 'biggie'] as Size[]).map(z => <button key={z} onClick={() => setSize(z)} style={{ flex: 1, height: 56, borderRadius: 18, fontSize: 18, fontWeight: 600, border: '2px solid ' + (size === z ? 'var(--accent)' : 'var(--border)'), background: size === z ? 'var(--accent)' : 'var(--card)', color: size === z ? 'var(--on-accent)' : 'var(--ink)' }}>{SIZE_LABEL[z]} · +{POINTS[z]}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }} />
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={!name.trim()} onClick={() => onSave(name.trim(), size)}>Save</button>
      </div>
    </div></div>
  )
}

function WhoDid({ p, onPick, onClose }: { p: NonNullable<Pending>; onPick: (w: Who) => void; onClose: () => void }) {
  const pts = POINTS[p.size]
  const opts: [Who, string, string, string][] = [['linh', 'Linh Chi', 'L', `+${pts}`], ['michael', 'Michael', 'M', `+${pts}`], ['both', 'Both of us', 'L+M', `+${pts} each`]]
  return (
    <div className="overlay" onClick={onClose}><div className="dialog" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
      <div style={{ fontSize: 32, fontWeight: 600 }}>Who did it?</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ fontSize: 21 }}>{p.title}</div><span className={'pill ' + p.size}>{SIZE_LABEL[p.size]} · +{pts}</span></div>
      {opts.map(([w, name, ini, pt]) => (
        <button key={w} onClick={() => onPick(w)} style={{ height: 76, borderRadius: 20, border: '1.5px solid var(--mborder)', background: 'var(--card)', display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px', textAlign: 'left' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: ini.length > 1 ? 15 : 20, fontWeight: 600, background: w === 'linh' ? 'var(--accent)' : w === 'michael' ? 'var(--blue-bg)' : 'var(--ground)', color: w === 'linh' ? 'var(--on-accent)' : w === 'michael' ? 'var(--blue-tx)' : 'var(--ink)', border: w === 'michael' ? '2px solid var(--blue-bd)' : 'none' }}>{ini}</div>
          <div style={{ flex: 1, fontSize: 24, fontWeight: 600 }}>{name}</div><div className="muted" style={{ fontSize: 18 }}>{pt}</div>
        </button>
      ))}
      <button style={{ height: 48, border: 'none', background: 'transparent', fontSize: 18, fontWeight: 600 }} onClick={onClose}>Cancel</button>
    </div></div>
  )
}

function Reminders({ s, apply, onDone, embedded }: { s: State; apply: (r: { state: State; ops: Op[] }) => Promise<unknown>; onDone: (p: NonNullable<Pending>) => void; embedded?: boolean }) {
  const t = today()
  const [menu, setMenu] = useState<string | null>(null)
  const [pick, setPick] = useState('')
  const snoozedUntil = (id: string) => s.snoozes.find(z => z.rule_id === id && z.until > t)?.until
  const kept = s.rules.filter(r => r.keep && r.last_done)
  const snoozed = kept.filter(r => snoozedUntil(r.id)).sort((a, b) => (snoozedUntil(a.id)! < snoozedUntil(b.id)! ? -1 : 1))
  const active = kept.filter(r => !snoozedUntil(r.id))
  const over = active.filter(r => status(r, t) === 'overdue').sort((a, b) => daysLate(b, t) - daysLate(a, t))
  const rest = active.filter(r => status(r, t) !== 'overdue').sort((a, b) => (nextDue(a)! < nextDue(b)! ? -1 : 1))
  const [all, setAll] = useState(false)
  const coming = rest.filter(r => diffDays(nextDue(r)!, t) <= 14)
  const later = rest.filter(r => diffDays(nextDue(r)!, t) > 14)
  const snoozeTo = (id: string, d: string) => { setMenu(null); apply(A.snooze(s, id, d)) }
  const row = (r: Rule, isOver: boolean) => {
    const due = nextDue(r)!
    return (
      <div className="row rem" key={r.id} style={{ minHeight: 62, position: 'relative' }}>
        <div className="rem-name" style={{ flex: 1, minWidth: 0, fontSize: 20, fontWeight: 500 }}>{r.name}</div>
        <div className="rem-when" style={{ width: 170, fontSize: 16, fontWeight: 500, color: isOver ? 'var(--late)' : 'var(--muted)' }}>{isOver ? `${daysLate(r, t)} days late` : fmtLong(due)}</div>
        {isOver && <button className="btn small outline" onClick={() => { setPick(''); setMenu(menu === r.id ? null : r.id) }}>Snooze</button>}
        <button className="btn small" onClick={() => onDone({ kind: 'rule', id: r.id, title: r.name, size: r.size })}>Done</button>
        {menu === r.id && (
          <div className="card" style={{ position: 'absolute', right: 90, top: 52, zIndex: 5, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '0 8px 24px rgba(0,0,0,.2)', width: 220 }}>
            {[['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7], ['In 2 weeks', 14], ['In a month', 30]].map(([l, d]) => (
              <button key={l as string} className="btn small outline" onClick={() => snoozeTo(r.id, addDays(t, d as number))}>{l}</button>
            ))}
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Or pick a day</div>
            <input type="date" min={addDays(t, 1)} value={pick} aria-label="Snooze until" onChange={e => setPick(e.target.value)} style={{ height: 48, fontSize: 16, borderRadius: 12, border: '2px solid var(--border)', padding: '0 8px' }} />
            <button className="btn small" disabled={!pick} onClick={() => snoozeTo(r.id, pick)}>Snooze to this day</button>
            <button className="btn small ghost" onClick={() => setMenu(null)}>Cancel</button>
          </div>
        )}
      </div>
    )
  }
  const section = (label: string, list: Rule[], isOver: boolean, color?: string) => list.length ? (
    <><div className="head" style={{ margin: '14px 0 2px', color }}>{label}</div>{list.map(r => row(r, isOver))}</>
  ) : null
  return (
    <div style={{ height: embedded ? 'auto' : '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}><div style={{ fontSize: embedded ? 30 : 36, fontWeight: 600 }}>Reminders</div></div>
      <div className={embedded ? '' : 'card scroll'} style={embedded ? { padding: 0 } : { flex: 1, padding: '6px 28px 24px' }}>
        {section(`OVERDUE · ${over.length}`, over, true, 'var(--late)')}
        {section(`COMING UP · ${coming.length}`, coming, false)}
        {over.length === 0 && coming.length === 0 && <div className="muted" style={{ padding: '18px 0', fontSize: 17 }}>Nothing overdue and nothing due in the next 2 weeks.</div>}
        {all && section('LATER', later, false)}
        {later.length > 0 && <button className="btn small outline" style={{ marginTop: 16 }} onClick={() => setAll(!all)}>{all ? 'Show less' : `See all (${later.length} more)`}</button>}
        {snoozed.length > 0 && (
          <>
            <div className="head" style={{ margin: '22px 0 2px' }}>SNOOZED</div>
            {snoozed.map(r => (
              <div className="row rem" key={r.id} style={{ minHeight: 62 }}>
                <div className="rem-name" style={{ flex: 1, fontSize: 20, fontWeight: 500 }}>{r.name}</div>
                <div className="muted rem-when" style={{ width: 170, fontSize: 16 }}>back {fmtLong(snoozedUntil(r.id)!)}</div>
                <button className="btn small outline" onClick={() => apply(A.unsnooze(s, r.id))}>Undo snooze</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function Points({ s, apply }: { s: State; apply: (r: { state: State; ops: Op[] }) => Promise<unknown> }) {
  const [filter, setFilter] = useState<'all' | 'linh' | 'michael'>('all')
  const tot = monthTotals(s)
  const month = new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  const evs = s.events.filter(e => isoToYmd(e.created_at).slice(0, 7) === monthKey() && !e.undone_at && (filter === 'all' || e.person_id === filter)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const Lane = ({ who }: { who: 'linh' | 'michael' }) => {
    const pts = tot[who]; const frac = Math.min(pts, 100) / 100; const me = who === 'linh'; const color = me ? 'var(--accent)' : 'var(--blue-bd)'
    return (
      <div className="lane" style={{ display: 'flex', alignItems: 'center', gap: 18, height: 84 }}>
        <span className="lane-face"><Face who={who} size={72} /></span>
        
        <div className="lane-track" style={{ flex: 1, position: 'relative', height: 60 }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 16, height: 32, borderRadius: 16, background: '#3A3A3E', boxShadow: 'inset 0 2px 6px rgba(0,0,0,.4)' }} />
          <div style={{ position: 'absolute', left: 16, right: 56, top: 31, height: 3, backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,.75) 0 14px, transparent 14px 28px)' }} />
          <div style={{ position: 'absolute', left: 16, top: 30, height: 5, borderRadius: 3, width: `calc((100% - 106px) * ${frac} + 40px)`, background: color }} />
          <div style={{ position: 'absolute', top: 8, left: `calc((100% - 106px) * ${frac})` }}>
            <svg width="64" height="40" viewBox="0 0 64 40" fill="none" aria-hidden="true">
              <ellipse cx="32" cy="36" rx="26" ry="3" fill="rgba(0,0,0,.35)" />
              <path d="M3 28v-5c0-3 2-5 5-5.5l9-1.5 7-9c1.5-2 3.500-3 6-3h10c2.500 0 4.500 1 6 3l7 8 7 1.500c3 .5 5 2.500 5 5.500v6c0 1-1 2-2 2H5c-1.500 0-2-1-2-2z" fill={color} stroke="#1F1F1E" strokeWidth="2" strokeLinejoin="round" />
              <path d="M24 17l5-7c.800-1 1.800-1.500 3-1.500h8c1.200 0 2.200.5 3 1.500l5 7z" fill="#DFF1FF" stroke="#1F1F1E" strokeWidth="1.500" strokeLinejoin="round" />
              <path d="M37 9v8" stroke="#1F1F1E" strokeWidth="1.500" />
              <rect x="57" y="21" width="5" height="4" rx="1.500" fill="#FFE27A" stroke="#1F1F1E" strokeWidth="1" />
              <circle cx="17" cy="30" r="6.500" fill="#1F1F1E" /><circle cx="17" cy="30" r="2.500" fill="#C9C9C6" />
              <circle cx="47" cy="30" r="6.500" fill="#1F1F1E" /><circle cx="47" cy="30" r="2.500" fill="#C9C9C6" />
            </svg>
          </div>
          <div style={{ position: 'absolute', right: 8, top: 0, width: 34, height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center' }} aria-hidden="true">
            <div style={{ width: 34, height: 52, borderRadius: 10, background: '#2B2B2A', border: '2px solid #1A1A19', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.35)' }}>
              {[['#FF4D4F', pts < 50], ['#FFB020', pts >= 50 && pts < 100], ['#2FCB75', pts >= 100]].map(([c, on], k) => <span key={k} style={{ width: 12, height: 12, borderRadius: '50%', background: on ? (c as string) : '#555', boxShadow: on ? `0 0 10px 2px ${c}` : 'none' }} />)}
            </div>
            <div style={{ width: 5, height: 12, background: '#2B2B2A' }} />
          </div>
        </div>
        <div className="lane-score" style={{ width: 120, textAlign: 'right', flex: 'none' }}><span style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1 }}>{pts}</span><span className="muted" style={{ fontSize: 16 }}> / 100</span></div>
      </div>
    )
  }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}><div style={{ fontSize: 36, fontWeight: 600 }}>Points</div><div style={{ fontSize: 22, fontWeight: 600 }}>{month}</div></div>
      <div className="card" style={{ padding: '16px 28px', flex: 'none' }}><Lane who="linh" /><Lane who="michael" /></div>
      <div className="card" style={{ flex: 1, minHeight: 0, padding: '18px 28px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 600 }}>History</div>
          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--ground)', borderRadius: 999 }}>
            {(['all', 'linh', 'michael'] as const).map(f => <button key={f} onClick={() => setFilter(f)} aria-label={f === 'all' ? 'All' : PEOPLE[f]} style={{ height: 44, padding: '0 20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, border: 'none', fontWeight: 600, fontSize: 16, background: filter === f ? 'var(--accent)' : 'transparent', color: filter === f ? 'var(--on-accent)' : 'var(--ink)' }}>{f === 'all' ? 'All' : <Face who={f} size={30} />}</button>)}
          </div>
        </div>
        <div className="scroll" style={{ flex: 1 }}>
          {evs.length === 0 && <div className="muted" style={{ padding: 16, fontSize: 17 }}>No points yet this month. Tick a task to start the race.</div>}
          {evs.map(e => (
            <div className="row" key={e.id} style={{ minHeight: 60, opacity: e.undone_at ? .45 : 1 }}>
              <div className="muted" style={{ width: 90, fontSize: 15 }}>{fmtShort(isoToYmd(e.created_at))}</div>
              <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, background: e.person_id === 'linh' ? 'var(--accent)' : 'var(--blue-bg)', color: e.person_id === 'linh' ? 'var(--on-accent)' : 'var(--blue-tx)' }}>{e.person_id === 'linh' ? 'L' : 'M'}</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 20, fontWeight: 600, textDecoration: e.undone_at ? 'line-through' : 'none' }}>{e.title}</div><div className="muted" style={{ fontSize: 15 }}>{[e.category, SIZE_LABEL[e.size], e.shared ? 'done together' : null].filter(Boolean).join(' · ')}</div></div>
              <span className={'pill ' + e.size}>+{e.points}{e.shared ? ' each' : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RuleDialog({ rule, onSave, onDelete, onClose }: { rule: Rule | null; onSave: (d: Omit<Rule, 'id'>) => void; onDelete: () => void; onClose: () => void }) {
  const [d, setD] = useState<Omit<Rule, 'id'>>(rule ? { ...rule } : { name: '', category: 'Home', action: 'Clean', every_n: 1, unit: 'months', applies_to: 'Both', keep: true, last_done: today(), size: 'baby' })
  const set = (p: Partial<Omit<Rule, 'id'>>) => setD({ ...d, ...p })
  return (
    <div className="overlay" onClick={onClose}><div className="dialog" style={{ width: 480, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
      <div style={{ fontSize: 30, fontWeight: 600 }}>{rule ? 'Edit rule' : 'New rule'}</div>
      <label htmlFor="rn">Name</label><input id="rn" type="text" value={d.name} autoFocus={!rule} placeholder="e.g. Clean the oven" onChange={e => set({ name: e.target.value })} />
      <label htmlFor="rc">Category</label><input id="rc" type="text" value={d.category} onChange={e => set({ category: e.target.value })} />
      <label htmlFor="re">Repeat every</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input id="re" type="number" min={1} value={d.every_n} style={{ width: 90 }} onChange={e => set({ every_n: Math.max(1, Number(e.target.value) || 1) })} />
        <select aria-label="Unit" value={d.unit} onChange={e => set({ unit: e.target.value as Unit })}>{['days', 'weeks', 'months', 'years'].map(u => <option key={u}>{u}</option>)}</select>
      </div>
      <label htmlFor="rl">Last done</label><input id="rl" type="date" value={d.last_done ?? ''} onChange={e => set({ last_done: e.target.value || null })} />
      <label>Points when done</label>
      <div style={{ display: 'flex', gap: 8 }}>{(['baby', 'biggie'] as Size[]).map(sz => <button key={sz} className={'btn small ' + (d.size === sz ? '' : 'outline')} onClick={() => set({ size: sz })}>{SIZE_LABEL[sz]} +{POINTS[sz]}</button>)}</div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 16 }}><input type="checkbox" checked={d.keep} style={{ width: 24, height: 24 }} onChange={e => set({ keep: e.target.checked })} /> Show in Reminders</label>
      <div style={{ display: 'flex', gap: 10 }}>
        {rule && <button className="btn outline" onClick={onDelete}>Delete</button>}
        <div style={{ flex: 1 }} />
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={!d.name.trim()} onClick={() => onSave({ ...d, name: d.name.trim() })}>Save</button>
      </div>
    </div></div>
  )
}

function GoodreadsSettings() {
  const [msg, setMsg] = useState('')
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState(lastGoodreadsSync())
  useEffect(() => { getGoodreadsUrl().then(setUrl).catch(() => setUrl('')) }, [])
  const sync = async (u: string) => {
    setBusy(true); setMsg('')
    try { const r = await syncGoodreads(u); setLast(lastGoodreadsSync()); setMsg(`Synced ${r.seen} books from Goodreads: ${r.added} new, ${r.updated} updated.`) }
    catch (e) { logError('Goodreads sync', e); setMsg((e as Error).message + ' If your Goodreads profile is private, use the RSS link instead of the profile link.') } finally { setBusy(false) }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640 }}>
      <div style={{ fontSize: 30, fontWeight: 600 }}>Goodreads</div>
      <div className="muted" style={{ fontSize: 15 }}>Paste your Goodreads profile link. New books, shelves and ratings come into the app once a week.</div>
      {url !== null && <input type="text" defaultValue={url} placeholder="https://www.goodreads.com/user/show/…" onBlur={async e => {
        const raw = e.target.value.trim(); if (raw === url) return
        const v = raw ? goodreadsRssFrom(raw) : ''
        if (v === null) { setMsg('That does not look like a Goodreads profile or RSS link.'); return }
        try { await setGoodreadsUrl(v); setUrl(v); e.target.value = v; setMsg(v ? 'Saved.' : 'Removed.'); if (v) sync(v) } catch (er) { logError('Goodreads link', er); setMsg('Could not save the link.') }
      }} />}
      {url && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><button className="btn small outline" disabled={busy} onClick={() => sync(url)}>{busy ? 'Syncing…' : 'Sync now'}</button><span className="muted" style={{ fontSize: 14 }}>{last ? `Last synced ${new Date(last).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}` : 'Not synced yet'}</span></div>}
      {msg && <div style={{ fontSize: 15 }}>{msg}</div>}
    </div>
  )
}

function FaceIdSettings() {
  const [reg, setReg] = useState(lockRegistered())
  const [msg, setMsg] = useState('')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>
      <div style={{ fontSize: 30, fontWeight: 600 }}>Face ID</div>
      <div style={{ fontSize: 17 }}>{!lockSupported() ? 'This browser does not support Face ID passkeys. Open the app from the Home Screen icon in Safari.' : reg ? 'Face ID is set up on this device. Goals unlock with your face.' : 'Face ID is not set up on this device yet.'}</div>
      {lockSupported() && !reg && <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={async () => { setMsg(''); try { await lockRegister(); setReg(true); setMsg('Done. Goals now unlock with Face ID.') } catch { setMsg('Setup was cancelled or not allowed. Try again.') } }}>Set up Face ID on this device</button>}
      {reg && <button className="btn outline" style={{ alignSelf: 'flex-start' }} onClick={() => { if (confirm('Reset the Face ID lock on this device? You can set it up again straight away.')) { lockReset(); setReg(false); setMsg('The lock was reset.') } }}>Reset the lock</button>}
      {msg && <div style={{ fontSize: 15 }}>{msg}</div>}
    </div>
  )
}

function Settings({ s, apply, theme, setTheme, mode, setMode, openSec, clearOpen, onDone }: { s: State; apply: (r: { state: State; ops: Op[] }) => Promise<unknown>; theme: string; setTheme: (t: string) => void; mode: 'light' | 'dark' | 'auto'; setMode: (m: 'light' | 'dark' | 'auto') => void; openSec: 'errors' | 'reminders' | null; clearOpen: () => void; onDone: (p: NonNullable<Pending>) => void }) {
  const [sec, setSec] = useState<'look' | 'rules' | 'reminders' | 'habits' | 'faces' | 'faceid' | 'calendars' | 'products' | 'goodreads' | 'errors'>('look')
  const [ruleDlg, setRuleDlg] = useState<Rule | 'new' | null>(null)
  const [hwho, setHwho] = useState<'linh' | 'michael'>('linh')
  const [newHabit, setNewHabit] = useState('')
  const [errList, setErrList] = useState(getErrors())
  useEffect(() => { if (openSec) { setSec(openSec); clearOpen() } }, [openSec, clearOpen])
  useEffect(() => { if (sec === 'errors') markSeen(); const f = () => setErrList(getErrors()); window.addEventListener('hsh-errors', f); return () => window.removeEventListener('hsh-errors', f) }, [sec])
  const t = today()
  const sorted = useMemo(() => [...s.rules].sort((a, b) => (nextDue(a) ?? 'z') < (nextDue(b) ?? 'z') ? -1 : 1), [s.rules])
  const label: Record<string, string> = { overdue: 'Overdue', today: 'Due today', soon: 'Within 30 days', ok: 'OK', skipped: 'Skipped', notstarted: 'Not started' }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {ruleDlg && <RuleDialog key={ruleDlg === 'new' ? 'new' : ruleDlg.id} rule={ruleDlg === 'new' ? null : ruleDlg} onClose={() => setRuleDlg(null)}
        onSave={d => { setRuleDlg(null); apply(ruleDlg === 'new' ? A.addRule(s, d) : A.updateRule(s, ruleDlg.id, d)) }}
        onDelete={() => { if (ruleDlg !== 'new' && confirm(`Delete "${ruleDlg.name}"?`)) { setRuleDlg(null); apply(A.deleteRule(s, ruleDlg.id)) } }} />}
      <div style={{ fontSize: 36, fontWeight: 600 }}>Settings</div>
      <div className="cols" style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16 }}>
        <div className="card side" style={{ width: 280, flex: 'none', padding: 14, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', minHeight: 0 }}>
          {([['look', 'Theme'], ['calendars', 'Calendars'], ['faces', 'Faces'], ['faceid', 'Face ID'], ['habits', 'Habits'], ['reminders', 'Reminders'], ['rules', `Rules (${s.rules.length})`], ['products', 'Expired products'], ['goodreads', 'Goodreads'], ['errors', 'Logs']] as const).map(([id, l]) => (
            <button key={id} onClick={() => setSec(id)} style={{ flex: 'none', minHeight: 56, textAlign: 'left', borderRadius: 16, border: 'none', padding: '0 18px', fontSize: 19, fontWeight: 600, background: sec === id ? 'var(--accent)' : 'transparent', color: sec === id ? 'var(--on-accent)' : 'var(--ink)' }}>{l}</button>
          ))}
        </div>
        <div className="card scroll" style={{ flex: 1, minWidth: 0, padding: 26 }}>
          {sec === 'look' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 30, fontWeight: 600 }}>Theme</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 17 }}>Brightness</span>
                {([['light', 'Light'], ['dark', 'Dark'], ['auto', 'Dark after sunset']] as const).map(([k, l]) => <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)} style={{ height: 44, padding: '0 18px', borderRadius: 999, fontWeight: 600, fontSize: 16, border: '1.5px solid var(--mborder)', background: mode === k ? 'var(--accent)' : 'transparent', color: mode === k ? 'var(--on-accent)' : 'var(--ink)' }}>{l}</button>)}
              </div>
              <div className="theme-row" style={{ display: 'flex', gap: 14 }}>
                {THEMES.map(th => (
                  <button key={th.id} onClick={() => setTheme(th.id)} aria-pressed={theme === th.id} data-theme={th.id} style={{ flex: 1, borderRadius: 22, padding: 12, textAlign: 'left', background: 'var(--card)', border: theme === th.id ? '2.5px solid var(--accent)' : '1.5px solid var(--border)', color: 'var(--ink)' }}>
                    <div style={{ height: 120, borderRadius: 14, background: 'var(--ground)', padding: 10, display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}><div style={{ height: 30, borderRadius: 10, background: 'var(--accent)' }} /><div style={{ flex: 1, borderRadius: 10, background: 'var(--card)' }} /></div>
                      <div style={{ width: 70, borderRadius: 10, background: 'var(--card)' }} />
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 600, marginTop: 10 }}>{th.name}</div><div className="muted" style={{ fontSize: 14 }}>{th.note}{theme === th.id ? ' · selected' : ''}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {sec === 'reminders' && <Reminders s={s} apply={apply} onDone={onDone} embedded />}
          {sec === 'rules' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 30, fontWeight: 600 }}>Rules <span className="muted" style={{ fontWeight: 500 }}>· {s.rules.length}</span></div>
                <button className="btn small" onClick={() => setRuleDlg('new')}>+ Add rule</button>
              </div>
              {sorted.map(r => (
                <button key={r.id} onClick={() => setRuleDlg(r)} className="row" style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--row)', background: 'transparent', textAlign: 'left', padding: '0 8px', borderRadius: 12, minHeight: 56 }}>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 18, fontWeight: 600 }}>{r.name}</div><div className="muted" style={{ fontSize: 13 }}>{r.category} · every {r.every_n} {r.unit}</div></div>
                  <div style={{ width: 100, fontSize: 15 }}>{nextDue(r) ? fmtShort(nextDue(r)!) : '—'}</div>
                  <span className="pill" style={{ background: status(r, t) === 'overdue' ? 'var(--accent)' : 'var(--faint)', color: status(r, t) === 'overdue' ? 'var(--on-accent)' : 'var(--muted)', border: '1px solid var(--border)' }}>{label[status(r, t)]}</span>
                </button>
              ))}
            </div>
          )}
          {sec === 'habits' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontSize: 30, fontWeight: 600 }}>Habits</div><PersonToggle who={hwho} setWho={setHwho} /></div>
              {s.habits.filter(h => h.person_id === hwho && h.active).sort((a, b) => a.sort - b.sort).map(h => (
                <div key={h.id} style={{ display: 'flex', gap: 10 }}>
                  <input type="text" aria-label="Habit name" defaultValue={h.name} onBlur={e => { const v = e.target.value.trim(); if (v && v !== h.name) apply(A.updateHabit(s, h.id, { name: v })) }} />
                  <button className="btn small outline" onClick={() => apply(A.updateHabit(s, h.id, { active: false }))}>Remove</button>
                </div>
              ))}
              <form style={{ display: 'flex', gap: 10 }} onSubmit={e => { e.preventDefault(); if (newHabit.trim()) { apply(A.addHabit(s, hwho, newHabit)); setNewHabit('') } }}>
                <input type="text" aria-label="New habit" placeholder="New habit, e.g. Walk 20 min" value={newHabit} onChange={e => setNewHabit(e.target.value)} />
                <button className="btn small" type="submit">Add</button>
              </form>
            </div>
          )}
          {sec === 'errors' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ fontSize: 30, fontWeight: 600, flex: 1 }}>Logs</div>{errList.length > 0 && <button className="btn small outline" onClick={() => { clearErrors(); setErrList([]) }}>Clear</button>}</div>
              {errList.length === 0 && <div className="muted" style={{ fontSize: 17 }}>No problems recorded. If something does not save or load, it will be listed here with the time.</div>}
              {errList.map((e, i) => (
                <div key={i} className="card" style={{ padding: '12px 18px' }}>
                  <div style={{ fontWeight: 600 }}>{e.where}</div>
                  <div className="muted" style={{ fontSize: 14 }}>{new Date(e.at).toLocaleString('en-AU')}</div>
                  <div style={{ fontSize: 16, marginTop: 4, wordBreak: 'break-word' }}>{e.message}</div>
                </div>
              ))}
            </div>
          )}
          {sec === 'faces' && <FaceSettings />}
          {sec === 'faceid' && <FaceIdSettings />}
          {sec === 'goodreads' && <GoodreadsSettings />}
          {sec === 'calendars' && <CalendarSettings />}
          {sec === 'products' && <div style={{ height: '100%', minWidth: 0 }}><Products /></div>}
        </div>
      </div>
    </div>
  )
}
