import ICAL from 'ical.js'
import { addDays, fromYmd, toYmd } from './dates.ts'

export type CalKey = 'linh' | 'michael' | 'chi' // linh = the shared (Both) calendar
export interface CalEvent { title: string; day: string; time: string; allDay: boolean; sort: number; person: CalKey }

/** Days to show: from today until Sunday (Tue shows Tue..Sun, Sat shows Sat+Sun); on Sunday, Sunday through next Sunday. */
export function scheduleDays(todayYmd: string): string[] {
  const dow = fromYmd(todayYmd).getDay() // 0 Sun
  const count = dow === 0 ? 8 : 8 - dow // days from today through the coming Sunday
  return Array.from({ length: count }, (_, i) => addDays(todayYmd, i))
}

const hm = (d: Date) => d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase()

export function parseIcs(text: string, person: CalKey, from: string, to: string): CalEvent[] {
  const out: CalEvent[] = []
  const lo = fromYmd(from), hi = fromYmd(addDays(to, 1))
  const comp = new ICAL.Component(ICAL.parse(text))
  for (const tz of comp.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(tz)
  const add = (title: string, start: ICAL.Time, end: ICAL.Time | null) => {
    const s = start.toJSDate()
    const allDay = start.isDate
    if (allDay) {
      const e = end ? end.toJSDate() : addDaysDate(s, 1)
      for (let d = new Date(s); d < e; d = addDaysDate(d, 1)) {
        if (d >= lo && d < hi) out.push({ title, day: toYmd(d), time: 'All day', allDay: true, sort: -1, person })
      }
    } else if (s >= lo && s < hi) {
      out.push({ title, day: toYmd(s), time: hm(s), allDay: false, sort: s.getHours() * 60 + s.getMinutes(), person })
    }
  }
  for (const v of comp.getAllSubcomponents('vevent')) {
    const ev = new ICAL.Event(v)
    if (ev.isRecurring()) {
      const it = ev.iterator()
      for (let n = 0, next = it.next(); next && n < 800; n++, next = it.next()) {
        if (next.toJSDate() >= hi) break
        const det = ev.getOccurrenceDetails(next)
        if (det.endDate.toJSDate() > lo) add(ev.summary || '(no title)', det.startDate, det.endDate)
      }
    } else if (ev.startDate) {
      add(ev.summary || '(no title)', ev.startDate, ev.endDate)
    }
  }
  return out
}
function addDaysDate(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }

export async function fetchCalendar(url: string, person: CalKey, from: string, to: string): Promise<CalEvent[]> {
  const r = await fetch('/api/ical?url=' + encodeURIComponent(url))
  if (!r.ok) throw new Error(await r.text())
  return parseIcs(await r.text(), person, from, to)
}
