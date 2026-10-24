import { useState } from 'react'
import type { State } from './lib/types.ts'
import { status, daysLate } from './lib/rules.ts'
import { today } from './lib/dates.ts'

const open = (q: string) => window.open('https://claude.ai/new?q=' + encodeURIComponent(q), '_blank')

export function Ask({ s }: { s: State }) {
  const [fridge, setFridge] = useState('')
  const [feel, setFeel] = useState('')
  const [money, setMoney] = useState('')
  const t = today()
  const overdue = s.rules.filter(r => status(r, t) === 'overdue' && !s.snoozes.some(z => z.rule_id === r.id && z.until > t)).map(r => `${r.name} (${daysLate(r, t)} days late)`)
  const todo = s.tasks.filter(x => !x.done_at).map(x => x.title)

  const cards: { title: string; body: string; ph?: string; val?: string; set?: (v: string) => void; prompt: () => string; btn: string }[] = [
    { title: 'Cooking ideas', body: 'Tell Claude what is in the fridge and what you feel like.', ph: 'e.g. chicken, rice, spinach, 30 minutes', val: fridge, set: setFridge, btn: 'Ask for recipes',
      prompt: () => `Two of us in Melbourne. Please suggest 3 easy dinners using: ${fridge || 'whatever is in a normal pantry'}. ${feel ? 'We feel like: ' + feel + '. ' : ''}Keep each under 40 minutes and tell me what else to buy.` },
    { title: 'Money check-in', body: 'A calm weekly chat about saving. Add anything you want to mention.', ph: 'e.g. I want to compare two savings accounts', val: money, set: setMoney, btn: 'Start the check-in',
      prompt: () => `Let's do a calm weekly money check-in for a couple in Australia saving for a house deposit and a wedding. ${money} Ask me one question at a time, and give general information only, not personal financial advice.` },
    { title: 'Plan our week', body: 'Uses your open tasks and overdue reminders from this app.', btn: 'Plan with Claude',
      prompt: () => `Help us plan this week at home. Open tasks: ${todo.join('; ') || 'none'}. Overdue reminders: ${overdue.join('; ') || 'none'}. Suggest a realistic order across the week, with small tasks grouped together.` },
    { title: 'Just talk', body: 'Open a blank Claude chat. Tap the microphone in the Claude app for voice.', btn: 'Open Claude', prompt: () => 'Hi Claude, I would like to talk something through.' },
  ]
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 36, fontWeight: 600 }}>Ask Claude</div>
      <div className="muted" style={{ fontSize: 15 }}>Opens a new chat in Claude with your question ready. In the Claude app, tap the microphone to talk instead of type. Money details you type here are sent to Claude, so leave out account numbers.</div>
      <div className="scroll" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignContent: 'start' }}>
        {cards.map(c => (
          <div key={c.title} className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{c.title}</div>
            <div className="muted" style={{ fontSize: 15 }}>{c.body}</div>
            {c.set && <input type="text" placeholder={c.ph} value={c.val} onChange={e => c.set!(e.target.value)} />}
            {c.title === 'Cooking ideas' && <input type="text" placeholder="What we feel like (optional)" value={feel} onChange={e => setFeel(e.target.value)} />}
            <button className="btn" style={{ marginTop: 'auto' }} onClick={() => open(c.prompt())}>{c.btn}</button>
          </div>
        ))}
      </div>
    </div>
  )
}
