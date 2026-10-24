import { useState } from 'react'
import { addMonthKey, monthLabel } from './lib/habits.ts'
import { pad, today } from './lib/dates.ts'
import { solarToLunar } from './lib/lunar.ts'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function MonthCalendar() {
  const t = today()
  const [month, setMonth] = useState(t.slice(0, 7))
  const [x0, setX0] = useState<{ x: number; y: number } | null>(null)
  const y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7))
  const first = new Date(y, m - 1, 1)
  const lead = (first.getDay() + 6) % 7 // Monday first
  const count = new Date(y, m, 0).getDate()
  const rows = Math.ceil((lead + count) / 7)
  const cells = Array.from({ length: rows * 7 }, (_, i) => { const d = i - lead + 1; return d >= 1 && d <= count ? d : 0 })
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontSize: 36, fontWeight: 600 }}>Calendar</div>
        <div style={{ fontSize: 22, fontWeight: 600, minWidth: 170 }}>{monthLabel(month)}</div>
        <div style={{ flex: 1 }} />
        {month !== t.slice(0, 7) && <button className="btn small" onClick={() => setMonth(t.slice(0, 7))}>Today</button>}
      </div>
      <div className="card" onTouchStart={e => setX0({ x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={e => { if (!x0) return; const dx = e.changedTouches[0].clientX - x0.x, dy = e.changedTouches[0].clientY - x0.y; setX0(null); if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) setMonth(addMonthKey(month, dx < 0 ? 1 : -1)) }}
        style={{ touchAction: 'pan-y', flex: 1, minHeight: 0, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {DOW.map(d => <div key={d} className="muted" style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>{d.toUpperCase()}</div>)}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: `repeat(${rows}, 1fr)`, gap: 6 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} />
            const ymd = `${month}-${pad(d)}`, isToday = ymd === t
            const l = solarToLunar(d, m, y)
            const label = l.day === 1 ? `${l.day}/${l.month}${l.leap ? 'N' : ''}` : String(l.day)
            const weekend = i % 7 >= 5
            return (
              <div key={i} style={{ position: 'relative', minHeight: 70, borderRadius: 16, border: `1.5px solid ${isToday ? 'var(--accent)' : 'var(--border)'}`, background: weekend ? 'var(--faint)' : 'transparent', padding: '8px 10px' }}>
                <span style={{ fontSize: 20, fontWeight: isToday ? 700 : 500, ...(isToday ? { background: 'var(--accent)', color: 'var(--on-accent)', borderRadius: 999, padding: '2px 9px' } : {}) }}>{d}</span>
                <span className="muted" style={{ position: 'absolute', right: 10, bottom: 6, fontSize: 12, fontWeight: l.day === 1 ? 700 : 400 }}>{label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
