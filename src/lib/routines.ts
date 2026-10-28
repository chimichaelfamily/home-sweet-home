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

/** MMO board stages. Each project keeps its own list (as JSON in the project's `cat`). Task num1 = stage id.
 *  Ids 0 (To do), 2 (Doing) and 1 (Done) match tasks made before stages were editable. Stage 1 is always "done". */
export interface Stage { id: number; name: string }
export const DONE_STAGE = 1
export const DEFAULT_STAGES: Stage[] = [{ id: 0, name: 'To do' }, { id: 2, name: 'Doing' }, { id: 1, name: 'Done' }]
export function parseStages(cat: string): Stage[] {
  try {
    const v = JSON.parse(cat)
    if (Array.isArray(v)) {
      const list = v.filter(s => s && Number.isInteger(s.id) && typeof s.name === 'string').map(s => ({ id: s.id as number, name: String(s.name) }))
      if (list.length >= 2 && list.some(s => s.id === DONE_STAGE)) return list
    }
  } catch { /* not set yet */ }
  return DEFAULT_STAGES
}
export const nextStageId = (list: Stage[]) => Math.max(2, ...list.map(s => s.id)) + 1
/** Which stage a task sits in; a stage that was removed falls back to the first stage. */
export const stageOf = (num1: number, list: Stage[]) => (list.some(s => s.id === num1) ? num1 : list[0].id)
