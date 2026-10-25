import { useEffect, useState } from 'react'
import type { State } from './lib/types.ts'
import { PEOPLE } from './lib/types.ts'
import { today, fmtShort, addDays } from './lib/dates.ts'
import { mondayOf, weekly } from './lib/weekly.ts'
import { supabase } from './lib/backend.ts'
import { logError } from './lib/errorlog.ts'
import { askAI } from './lib/ai.ts'
import { Face } from './Face.tsx'
import { loadPrivate, money, type PItem } from './lib/privateData.ts'

const KEY = 'home-sweet-home.weekly.v1'
async function loadNote(week: string): Promise<string> {
  if (supabase) { const { data } = await supabase.from('weekly_notes').select('body').eq('week', week).maybeSingle(); return data?.body ?? '' }
  try { return JSON.parse(localStorage.getItem(KEY) || '{}')[week] ?? '' } catch { return '' }
}
async function saveNote(week: string, body: string) {
  if (supabase) { await supabase.from('weekly_notes').upsert({ week, body }, { onConflict: 'week' }); return }
  try { const all = JSON.parse(localStorage.getItem(KEY) || '{}'); all[week] = body; localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* ignore */ }
}

export function Weekly({ s }: { s: State }) {
  const t = today()
  const [offset, setOffset] = useState(0) // weeks back
  const to = addDays(t, -7 * offset)
  const w = weekly(s, to)
  const key = mondayOf(to)
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [withGoals, setWithGoals] = useState(false)
  const [priv, setPriv] = useState<PItem[]>([])
  const [msg, setMsg] = useState('')
  useEffect(() => { setEditing(false); loadNote(key).then(n => { setNote(n); setDraft(n) }).catch(() => setNote('')) }, [key])
  useEffect(() => { if (withGoals) loadPrivate().then(setPriv).catch(() => setMsg('Could not load goals.')) }, [withGoals])

  const L = w.people.linh, M = w.people.michael
  const goalsText = () => {
    const pil = priv.filter(p => p.kind === 'pillar').map(p => `${p.title} ${Math.round(p.num1)}%`).join('; ')
    const mon = priv.filter(p => p.kind === 'money').map(p => `${p.title}: ${money(p.num1)} of ${money(p.num2)} by ${p.cat}`).join('; ')
    return `Big goals: ${pil || 'none set'}. Money goals: ${mon || 'none set'}.`
  }
  const prompt = () => `You are writing our weekly home newsletter. Be warm, specific and brief. Give: 3 wins, 3 gentle things to improve, a meal-planning idea, and one money habit for the week (general information only, not financial advice).
Week ${fmtShort(w.from)} to ${fmtShort(w.to)}.
Points: Linh Chi ${L.points} (${L.tasks} tasks), Michael ${M.points} (${M.tasks} tasks).
Habits: Linh Chi ${L.habitPct}% done, ${L.perfectDays} perfect days, best streak ${L.bestStreak}; Michael ${M.habitPct}% done, ${M.perfectDays} perfect days, best streak ${M.bestStreak}.
Open tasks: ${w.open.join('; ') || 'none'}. Overdue reminders: ${w.overdue.join('; ') || 'none'}. Coming up next 7 days: ${w.comingUp.map(c => `${c.name} (${fmtShort(c.due)})`).join('; ') || 'nothing'}.
${withGoals ? goalsText() : ''}`
  const [writing, setWriting] = useState(false)
  const write = async () => {
    setWriting(true); setMsg('')
    try { const a = await askAI([{ role: 'user', text: prompt() }]); setNote(a); setDraft(a); await saveNote(key, a); setMsg('Written and saved.') }
    catch (e) { logError('Report: writing', e); setMsg((e as Error).message) } finally { setWriting(false) }
  }
  const COL = { linh: 'var(--accent)', michael: 'var(--blue-bd)' } as const
  const DAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const dayLetter = (d: string) => ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(d + 'T00:00:00').getDay()]
  const maxDay = Math.max(1, ...L.pointsByDay, ...M.pointsByDay)
  void DAY
  const total = Math.max(1, L.points + M.points)
  const Tile = ({ who, p }: { who: 'linh' | 'michael'; p: typeof L }) => (
    <div className="card" style={{ flex: 1, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Face who={who} size={56} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, color: COL[who] }}>{p.points}</div>
          <div className="muted" style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>POINTS</div>
        </div>
        {w.leader === who && <span style={{ fontSize: 28 }} aria-label="Leader">👑</span>}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {[['Tasks', String(p.tasks)], ['Habits', `${p.habitPct}%`], ['Perfect days', String(p.perfectDays)], ['Best streak', `${p.bestStreak}d`]].map(([l, v]) => (
          <div key={l} style={{ flex: 1, background: 'var(--ground)', borderRadius: 14, padding: '8px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{v}</div>
            <div className="muted" style={{ fontSize: 12 }}>{l}</div>
          </div>
        ))}
      </div>
      <div>
        <div style={{ height: 12, borderRadius: 6, background: 'var(--ground)', overflow: 'hidden' }}><div style={{ width: `${p.habitPct}%`, height: '100%', background: COL[who] }} /></div>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Habits completed</div>
      </div>
    </div>)
  const Grid = ({ who, p }: { who: 'linh' | 'michael'; p: typeof L }) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><Face who={who} size={28} /><span style={{ fontWeight: 600, fontSize: 16 }}>{PEOPLE[who]}</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) repeat(7, 22px)', gap: '6px 5px', alignItems: 'center' }}>
        <span />{w.days.map(d => <span key={d} className="muted" style={{ fontSize: 11, textAlign: 'center' }}>{dayLetter(d)}</span>)}
        {p.habits.map(h => (
          <div key={h.name} style={{ display: 'contents' }}>
            <span style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
            {h.done.map((d, i) => <span key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: d ? COL[who] : 'var(--ground)', border: '1px solid var(--border)' }} />)}
          </div>
        ))}
        {p.habits.length === 0 && <span className="muted" style={{ gridColumn: '1 / -1', fontSize: 14 }}>No habits yet</span>}
      </div>
    </div>)
  const Chip = ({ children, late }: { children: React.ReactNode; late?: boolean }) => (
    <span style={{ padding: '6px 14px', borderRadius: 999, fontSize: 15, fontWeight: 500, background: late ? 'var(--late-bg, var(--ground))' : 'var(--ground)', color: late ? 'var(--late)' : 'var(--ink)', border: '1px solid var(--border)' }}>{children}</span>)
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 36, fontWeight: 600 }}>Report</div>
        <button className="btn small outline" aria-label="Earlier week" onClick={() => setOffset(offset + 1)}>‹</button>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{fmtShort(w.from)} to {fmtShort(w.to)}</div>
        <button className="btn small outline" aria-label="Later week" disabled={offset === 0} onClick={() => setOffset(offset - 1)}>›</button>
      </div>
      <div className="scroll" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12 }}><Tile who="linh" p={L} /><Tile who="michael" p={M} /></div>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', height: 18, borderRadius: 9, overflow: 'hidden', background: 'var(--ground)' }}>
            <div style={{ width: `${(L.points / total) * 100}%`, background: COL.linh }} />
            <div style={{ width: `${(M.points / total) * 100}%`, background: COL.michael }} />
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>Points each day</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150 }}>
            {w.days.map((d, i) => (
              <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, width: '100%', height: 110, justifyContent: 'center' }}>
                  {(['linh', 'michael'] as const).map(who => { const v = w.people[who].pointsByDay[i]; return (
                    <div key={who} title={`${PEOPLE[who]} ${v}`} style={{ width: '38%', maxWidth: 28, height: `${(v / maxDay) * 100}%`, minHeight: v ? 4 : 0, background: COL[who], borderRadius: '6px 6px 0 0' }} />) })}
                </div>
                <span className="muted" style={{ fontSize: 13 }}>{dayLetter(d)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>Habits this week</div>
          <div style={{ display: 'flex', gap: 28 }}><Grid who="linh" p={L} /><Grid who="michael" p={M} /></div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ flex: 1, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}><span style={{ fontSize: 40, fontWeight: 700, color: w.overdue.length ? 'var(--late)' : 'var(--ink)' }}>{w.overdue.length}</span><span style={{ fontSize: 17, fontWeight: 600 }}>overdue</span></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{w.overdue.slice(0, 6).map(n => <Chip key={n} late>{n}</Chip>)}{w.overdue.length > 6 && <Chip>+{w.overdue.length - 6}</Chip>}</div>
          </div>
          <div className="card" style={{ flex: 1, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}><span style={{ fontSize: 40, fontWeight: 700 }}>{w.comingUp.length}</span><span style={{ fontSize: 17, fontWeight: 600 }}>due in 7 days</span></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{w.comingUp.slice(0, 6).map(c => <Chip key={c.name}>{c.name} · {fmtShort(c.due)}</Chip>)}</div>
          </div>
          <div className="card" style={{ flex: 1, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}><span style={{ fontSize: 40, fontWeight: 700 }}>{w.open.length}</span><span style={{ fontSize: 17, fontWeight: 600 }}>open tasks</span></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{w.open.slice(0, 8).map(n => <Chip key={n}>{n}</Chip>)}{w.open.length > 8 && <Chip>+{w.open.length - 8}</Chip>}</div>
          </div>
        </div>
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 600 }}>This week's note</div>
          {!editing && (note ? <div style={{ fontSize: 17, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{note}</div> : null)}
          {editing && <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={8} placeholder="Write or paste your note" style={{ width: '100%', fontSize: 17, borderRadius: 16, border: '2px solid var(--border)', padding: 14, fontFamily: 'inherit' }} />}
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 15 }}><input type="checkbox" checked={withGoals} onChange={e => setWithGoals(e.target.checked)} style={{ width: 22, height: 22 }} />Also include my goals and money progress (sent to Gemini, Google's AI)</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn small" disabled={writing} onClick={write}>{writing ? 'Writing…' : note ? 'Write it again' : 'Write this week\'s newsletter'}</button>
            {!editing && <button className="btn small outline" onClick={() => setEditing(true)}>{note ? 'Edit note' : 'Write my own'}</button>}
            {!editing && note && <button className="btn small outline" onClick={async () => { await saveNote(key, ''); setNote(''); setDraft(''); setMsg('') }}>Clear note</button>}
            {editing && <button className="btn small" onClick={async () => { await saveNote(key, draft.trim()); setNote(draft.trim()); setEditing(false); setMsg('Saved.') }}>Save note</button>}
            {editing && <button className="btn small outline" onClick={() => { setDraft(note); setEditing(false) }}>Cancel</button>}
          </div>
          {msg && <div style={{ fontSize: 14 }}>{msg}</div>}
        </div>
      </div>
    </div>
  )
}
