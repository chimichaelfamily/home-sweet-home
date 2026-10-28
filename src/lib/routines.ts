import { addDays, fromYmd } from './dates.ts'
import type { ProjItem } from './projectData.ts'

// Daily routine ticks, weekly plans and streaks (pure, so the tests can run without the database).
export const tickId = (stepId: string, day: string) => `tick-${stepId}-${day}`

/** Week columns, Monday first. A step's days are kept as bits in num1: Mon = 1, Tue = 2 … Sun = 64. 0 means every day. */
export const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const ALL_DAYS = 127
export const dayIndex = (ymd: string) => (fromYmd(ymd).getDay() + 6) % 7
export const daysOf = (s: ProjItem) => (s.num1 > 0 ? s.num1 : ALL_DAYS) & ALL_DAYS
export const onDay = (s: ProjItem, ymd: string) => (daysOf(s) & (1 << dayIndex(ymd))) !== 0
export const toggleDay = (mask: number, i: number) => { const m = (mask > 0 ? mask : ALL_DAYS) ^ (1 << i); return m === 0 ? 0 : m }
/** "Every day", "Mon, Wed, Fri", "Weekdays", "Weekends". */
export function daysLabel(mask: number) {
  const m = mask > 0 ? mask & ALL_DAYS : ALL_DAYS
  if (m === ALL_DAYS) return 'Every day'
  if (m === 31) return 'Weekdays'
  if (m === 96) return 'Weekends'
  return WEEK.filter((_, i) => m & (1 << i)).join(', ')
}

/** Days in a row where every step planned for that day was ticked. Days with nothing planned are skipped.
 *  Today counts once it is complete; an unfinished today does not break the streak. */
export function routineStreak(steps: ProjItem[], ticks: ProjItem[], todayYmd: string): number {
  if (!steps.length) return 0
  const done = new Set(ticks.map(t => `${t.title}|${t.day}`))
  const planned = (d: string) => steps.filter(s => onDay(s, d))
  const full = (d: string) => planned(d).every(s => done.has(`${s.id}|${d}`))
  let d = planned(todayYmd).length && full(todayYmd) ? todayYmd : addDays(todayYmd, -1), n = 0
  for (let i = 0; i < 3660; i++) {
    const p = planned(d)
    if (p.length) { if (!full(d)) break; n++ }
    d = addDays(d, -1)
  }
  return n
}

/** Kanban column of an MMO task: num1 0 = To do, 2 = Doing, 1 = Done (1 was "done" before the board existed). */
export type Col = 'todo' | 'doing' | 'done'
export const colOf = (num1: number): Col => (num1 === 1 ? 'done' : num1 === 2 ? 'doing' : 'todo')
export const numOf = (c: Col) => (c === 'done' ? 1 : c === 'doing' ? 2 : 0)
