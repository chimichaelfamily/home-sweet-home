import { useEffect, useRef, useState } from 'react'
import type { State } from './lib/types.ts'
import { status, daysLate } from './lib/rules.ts'
import { today } from './lib/dates.ts'
import { logError } from './lib/errorlog.ts'
import { askAI, type Msg } from './lib/ai.ts'

type SR = { start: () => void; stop: () => void; lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null }
const Rec = (typeof window !== 'undefined' ? ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition) : undefined) as (new () => SR) | undefined

export function Ask({ s }: { s: State }) {
  const t = today()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [listening, setListening] = useState(false)
  const [speak, setSpeak] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const rec = useRef<SR | null>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])

  const overdue = s.rules.filter(r => status(r, t) === 'overdue' && !s.snoozes.some(z => z.rule_id === r.id && z.until > t)).map(r => `${r.name} (${daysLate(r, t)} days late)`)
  const todo = s.tasks.filter(x => !x.done_at).map(x => x.title)
  const context = `Today is ${t}. Open tasks: ${todo.join('; ') || 'none'}. Overdue reminders: ${overdue.join('; ') || 'none'}.`

  const send = async (q: string) => {
    q = q.trim(); if (!q || busy) return
    const next: Msg[] = [...msgs, { role: 'user', text: q }]
    setMsgs(next); setText(''); setErr(''); setBusy(true)
    try {
      const a = await askAI(next, context)
      setMsgs([...next, { role: 'model', text: a }])
      if (speak && 'speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(a); u.lang = 'en-AU'; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u) }
    } catch (e) { logError('AI chat', e); setErr((e as Error).message) } finally { setBusy(false) }
  }
  const mic = () => {
    if (!Rec) return
    if (listening) { rec.current?.stop(); return }
    const r = new Rec(); r.lang = 'en-AU'; r.interimResults = false
    r.onresult = e => { const v = e.results[0][0].transcript; setText(v); send(v) }
    r.onend = () => setListening(false); r.onerror = () => { setListening(false); setErr('The microphone did not work. Check that Safari may use it.') }
    rec.current = r; setListening(true); r.start()
  }
  const presets: [string, string][] = [
    ['Cooking ideas', 'Suggest 3 easy dinners for two of us under 40 minutes. Ask me what we have in the fridge first.'],
    ['Money check-in', 'Let us do a calm weekly money check-in. Ask me one question at a time.'],
    ['Plan our week', 'Help us plan this week at home using our open tasks and overdue reminders. Group small jobs together.'],
  ]
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 36, fontWeight: 600 }}>AI chat</div>
        <div style={{ flex: 1 }} />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 15 }}><input type="checkbox" checked={speak} onChange={e => setSpeak(e.target.checked)} style={{ width: 22, height: 22 }} />Read answers aloud</label>
        {msgs.length > 0 && <button className="btn small outline" onClick={() => { setMsgs([]); window.speechSynthesis?.cancel() }}>New chat</button>}
      </div>
      <div className="card scroll" style={{ flex: 1, minHeight: 0, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {msgs.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="muted" style={{ fontSize: 17 }}>Ask anything, or start with one of these. Don't type account numbers. The answers come from Gemini, Google's AI.</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{presets.map(([l, q]) => <button key={l} className="btn small outline" onClick={() => send(q)}>{l}</button>)}</div>
          </div>)}
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%', padding: '12px 18px', borderRadius: 20, fontSize: 18, lineHeight: 1.5, whiteSpace: 'pre-wrap', background: m.role === 'user' ? 'var(--accent)' : 'var(--faint)', color: m.role === 'user' ? 'var(--on-accent)' : 'var(--ink)' }}>{m.text}</div>
        ))}
        {busy && <div className="muted" style={{ fontSize: 16 }}>Thinking…</div>}
        {err && <div style={{ fontSize: 15, color: 'var(--late)' }}>{err}</div>}
        <div ref={end} />
      </div>
      <form style={{ display: 'flex', gap: 10 }} onSubmit={e => { e.preventDefault(); send(text) }}>
        {Rec && <button type="button" className="btn" aria-label={listening ? 'Stop listening' : 'Talk'} onClick={mic} style={{ width: 120, background: listening ? 'var(--late)' : undefined }}>{listening ? 'Listening…' : 'Talk'}</button>}
        <input type="text" placeholder="Type a question" value={text} onChange={e => setText(e.target.value)} />
        <button className="btn" type="submit" disabled={busy}>Send</button>
      </form>
    </div>
  )
}
