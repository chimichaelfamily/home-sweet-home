import { addDays, diffDays, fromYmd, pad } from './dates.ts'
export interface Habit { id: string; person_id: 'linh' | 'michael'; name: string; sort: number; active: boolean }
export interface HabitLog { habit_id: string; day: string }

// Streak = days in a row ending today. If today isn't ticked yet, yesterday still keeps the streak alive.
export function streak(days: Set<string>, today: string): number {
  let d = days.has(today) ? today : addDays(today, -1)
  let n = 0
  while (days.has(d)) { n++; d = addDays(d, -1) }
  return n
}
export function longestInMonth(days: Set<string>, month: string, upTo: string): number {
  const last = Math.min(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate(), Number(upTo.slice(0, 7) === month ? upTo.slice(8, 10) : 31))
  let best = 0, cur = 0
  for (let i = 1; i <= last; i++) {
    if (days.has(`${month}-${pad(i)}`)) { cur++; best = Math.max(best, cur) } else cur = 0
  }
  return best
}
export const daysInMonth = (month: string) => new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
export const addMonthKey = (month: string, n: number) => {
  const d = fromYmd(month + '-01'); d.setMonth(d.getMonth() + n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
export const monthLabel = (month: string) => fromYmd(month + '-01').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
export const sinceDays = (a: string, b: string) => diffDays(a, b)

const CODES: [number[], string][] = [
  [[0], 'Clear'], [[1, 2], 'Partly cloudy'], [[3], 'Cloudy'], [[45, 48], 'Fog'],
  [[51, 53, 55, 56, 57], 'Drizzle'], [[61, 63, 65, 66, 67, 80, 81, 82], 'Rain'],
  [[71, 73, 75, 77, 85, 86], 'Snow'], [[95, 96, 99], 'Thunderstorms'],
]
export const weatherText = (code: number) => CODES.find(([c]) => c.includes(code))?.[1] ?? 'Mixed'
