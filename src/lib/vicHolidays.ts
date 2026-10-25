// Victorian public holidays, worked out from the dates' rules (checked against the official 2026 list).
import { addDays, pad } from './dates.ts'

const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const dow = (s: string) => new Date(s + 'T00:00:00').getDay() // 0 Sun .. 6 Sat

function easterSunday(y: number): string {
  // Anonymous Gregorian algorithm
  const a = y % 19, b = Math.floor(y / 100), c = y % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1
  return ymd(y, month, day)
}
/** nth weekday (0 Sun..6 Sat) of a month; n = 1.. */
function nth(y: number, m: number, wd: number, n: number): string {
  const first = ymd(y, m, 1)
  return addDays(first, (wd - dow(first) + 7) % 7 + 7 * (n - 1))
}
function lastWeekday(y: number, m: number, wd: number): string {
  const last = ymd(y, m, new Date(y, m, 0).getDate())
  return addDays(last, -((dow(last) - wd + 7) % 7))
}
const nextMonday = (s: string) => addDays(s, (8 - dow(s)) % 7 || 7)

export function vicHolidays(y: number): Record<string, string> {
  const h: Record<string, string> = {}
  const put = (d: string, name: string) => { h[d] = h[d] ? h[d] + ' · ' + name : name }
  const easter = easterSunday(y)
  const ny = ymd(y, 1, 1); put(ny, "New Year's Day"); if ([0, 6].includes(dow(ny))) put(nextMonday(ny), "New Year's Day (day off)")
  const au = ymd(y, 1, 26); put(au, 'Australia Day'); if ([0, 6].includes(dow(au))) put(nextMonday(au), 'Australia Day (day off)')
  put(nth(y, 3, 1, 2), 'Labour Day')
  put(addDays(easter, -2), 'Good Friday'); put(addDays(easter, -1), 'Easter Saturday'); put(easter, 'Easter Sunday'); put(addDays(easter, 1), 'Easter Monday')
  put(ymd(y, 4, 25), 'ANZAC Day')
  put(nth(y, 6, 1, 2), "King's Birthday")
  put(addDays(lastWeekday(y, 9, 6), -1), 'Grand Final Friday')
  put(nth(y, 11, 2, 1), 'Melbourne Cup')
  const xmas = ymd(y, 12, 25), box = ymd(y, 12, 26)
  put(xmas, 'Christmas Day'); put(box, 'Boxing Day')
  const x = dow(xmas)
  if (x === 6) { put(ymd(y, 12, 27), 'Christmas Day (day off)'); put(ymd(y, 12, 28), 'Boxing Day (day off)') }
  else if (x === 0) { put(ymd(y, 12, 27), 'Christmas Day (day off)') }
  else if (x === 5) { put(ymd(y, 12, 28), 'Boxing Day (day off)') }
  return h
}
