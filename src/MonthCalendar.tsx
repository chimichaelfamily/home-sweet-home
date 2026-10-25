import { useEffect, useState } from 'react'
import { getCalIcons } from './lib/calIcons.ts'
import { addMonthKey, monthLabel } from './lib/habits.ts'
import { pad, today } from './lib/dates.ts'
import { solarToLunar } from './lib/lunar.ts'
import { vicHolidays } from './lib/vicHolidays.ts'

const Leaf = () => <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-label="Vegetarian day"><path d="M5 19C5 10 10 5 20 4c0 9-5 15-13 15z" fill="#3FA66B" stroke="#2B7D4D" strokeWidth="1.5" strokeLinejoin="round" /><path d="M5 19c3-5 6-8 10-10" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /></svg>
const Pocket = () => <svg width="18" height="20" viewBox="0 0 24 28" fill="none" aria-label="Lunar New Year"><rect x="3" y="2" width="18" height="24" rx="3" fill="#D6262B" stroke="#9E1519" strokeWidth="1.5" /><path d="M3 9c6 5 12 5 18 0" stroke="#F6C453" strokeWidth="1.5" /><circle cx="12" cy="15" r="3.5" fill="#F6C453" /></svg>

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function MonthCalendar() {
  const [icons, setIcons] = useState(getCalIcons())
  useEffect(() => { const f = () => setIcons(getCalIcons()); window.addEventListener('hsh-calicons', f); return () => window.removeEventListener('hsh-calicons', f) }, [])
  const t = today()
  const [month, setMonth] = useState(t.slice(0, 7))
  const [x0, setX0] = useState<{ x: number; y: number } | null>(null)
  const y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7))
  const first = new Date(y, m - 1, 1)
  const lead = (first.getDay() + 6) % 7 // Monday first
  const count = new Date(y, m, 0).getDate()
  const hol = vicHolidays(y)
  const rows = Math.ceil((lead + count) / 7)
  const cells = Array.from({ length: rows * 7 }, (_, i) => { const d = i - lead + 1; return d >= 1 && d <= count ? d : 0 })
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontSize: 36, fontWeight: 600 }}>Calendar</div>
        <button className="btn small outline" aria-label="Previous month" onClick={() => setMonth(addMonthKey(month, -1))}>‹</button>
        <div style={{ fontSize: 22, fontWeight: 600, minWidth: 170, textAlign: 'center' }}>{monthLabel(month)}</div>
        <button className="btn small outline" aria-label="Next month" onClick={() => setMonth(addMonthKey(month, 1))}>›</button>
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
            const nx = new Date(y, m - 1, d + 1)
            const nl = solarToLunar(nx.getDate(), nx.getMonth() + 1, nx.getFullYear())
            const tet = (l.month === 1 && !l.leap && l.day <= 3) || (nl.month === 1 && nl.day === 1 && !nl.leap)
            const veg = l.day === 1 || l.day === 15
            const holiday = hol[ymd]
            const bg = tet ? 'rgba(214,38,43,.16)' : holiday ? 'rgba(59,130,246,.15)' : weekend ? 'var(--faint)' : 'transparent'
            return (
              <div key={i} style={{ position: 'relative', minHeight: 70, borderRadius: 16, border: `1.5px solid ${isToday ? 'var(--accent)' : tet ? 'rgba(214,38,43,.55)' : 'var(--border)'}`, background: bg, padding: '8px 10px', overflow: 'hidden' }}>
                <span style={{ fontSize: 20, fontWeight: isToday ? 700 : 500, ...(isToday ? { background: 'var(--accent)', color: 'var(--on-accent)', borderRadius: 999, padding: '2px 9px' } : {}) }}>{d}</span>
                {tet && <span style={{ position: 'absolute', right: 8, top: 6, fontSize: 18, lineHeight: 1 }}>{icons.tet === 'pocket' ? <Pocket /> : icons.tet}</span>}
                {holiday && <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2, marginTop: 3, color: 'var(--blue-tx)' }}>{holiday}</div>}
                {veg && <span style={{ position: 'absolute', left: 9, bottom: 5, fontSize: 18, lineHeight: 1 }}>{icons.veg === 'leaf' ? <Leaf /> : icons.veg}</span>}
                <span className="muted" style={{ position: 'absolute', right: 10, bottom: 6, fontSize: 12, fontWeight: l.day === 1 ? 700 : 400 }}>{label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
