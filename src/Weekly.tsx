import { useEffect, useState } from 'react'
import type { State } from './lib/types.ts'
import { PEOPLE } from './lib/types.ts'
import { today, fmtShort, addDays } from './lib/dates.ts'
import { mondayOf, weekly } from './lib/weekly.ts'
import { supabase } from './lib/backend.ts'
import { askAI } from './lib/ai.ts'
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
    catch (e) { setMsg((e as Error).message) } finally { setWriting(false) }
  }
  const stat = (label: string, a: string, b: string) => (
    <div className="card" style={{ flex: 1, padding: '14px 18px' }}>
      <div className="muted" style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 700, marginTop: 4 }}><span style={{ color: 'var(--accent)' }}>{a}</span><span style={{ color: 'var(--blue-bd)' }}>{b}</span></div>
    </div>)
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 36, fontWeight: 600 }}>Weekly</div>
        <button className="btn small outline" aria-label="Earlier week" onClick={() => setOffset(offset + 1)}>‹</button>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{fmtShort(w.from)} to {fmtShort(w.to)}</div>
        <button className="btn small outline" aria-label="Later week" disabled={offset === 0} onClick={() => setOffset(offset - 1)}>›</button>
      </div>
      <div className="scroll" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{w.leader === 'tie' ? 'It was a tie this week' : `${PEOPLE[w.leader]} led the race this week`}</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 15 }}>{PEOPLE.linh} {L.points} points · {PEOPLE.michael} {M.points} points</div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {stat('TASKS DONE', String(L.tasks), String(M.tasks))}
          {stat('HABITS DONE', `${L.habitPct}%`, `${M.habitPct}%`)}
          {stat('PERFECT HABIT DAYS', String(L.perfectDays), String(M.perfectDays))}
          {stat('BEST STREAK', `${L.bestStreak}d`, `${M.bestStreak}d`)}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ flex: 1, padding: 20 }}>
            <div style={{ fontSize: 19, fontWeight: 600 }}>Overdue ({w.overdue.length})</div>
            <div className="muted" style={{ fontSize: 15, marginTop: 6 }}>{w.overdue.slice(0, 5).join(' · ') || 'Nothing overdue'}{w.overdue.length > 5 ? ` · and ${w.overdue.length - 5} more` : ''}</div>
          </div>
          <div className="card" style={{ flex: 1, padding: 20 }}>
            <div style={{ fontSize: 19, fontWeight: 600 }}>Coming up (next 7 days)</div>
            <div className="muted" style={{ fontSize: 15, marginTop: 6 }}>{w.comingUp.map(c => `${c.name} (${fmtShort(c.due)})`).join(' · ') || 'Nothing due'}</div>
          </div>
        </div>
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 600 }}>This week's note</div>
          {!editing && (note ? <div style={{ fontSize: 17, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{note}</div> : <div className="muted" style={{ fontSize: 15 }}>No note yet. Tap "Write this week's newsletter" and Gemini will write it.</div>)}
          {editing && <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={8} placeholder="Write or paste your note" style={{ width: '100%', fontSize: 17, borderRadius: 16, border: '2px solid var(--border)', padding: 14, fontFamily: 'inherit' }} />}
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 15 }}><input type="checkbox" checked={withGoals} onChange={e => setWithGoals(e.target.checked)} style={{ width: 22, height: 22 }} />Also include my goals and money progress (sent to Gemini, Google's AI)</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn small" disabled={writing} onClick={write}>{writing ? 'Writing…' : note ? 'Write it again' : 'Write this week\'s newsletter'}</button>
            {!editing && <button className="btn small outline" onClick={() => setEditing(true)}>{note ? 'Edit note' : 'Write my own'}</button>}
            {editing && <button className="btn small" onClick={async () => { await saveNote(key, draft.trim()); setNote(draft.trim()); setEditing(false); setMsg('Saved.') }}>Save note</button>}
            {editing && <button className="btn small outline" onClick={() => { setDraft(note); setEditing(false) }}>Cancel</button>}
          </div>
          {msg && <div style={{ fontSize: 14 }}>{msg}</div>}
        </div>
      </div>
    </div>
  )
}
