import { addDays } from './dates.ts'
import type { ProjItem } from './projectData.ts'

// Daily routine ticks and streaks (pure, so the tests can run without the database).
export const tickId = (stepId: string, day: string) => `tick-${stepId}-${day}`
/** Days in a row where every step in the group was ticked. Today counts once it is complete; an unfinished today does not break the streak. */
export function routineStreak(steps: ProjItem[], ticks: ProjItem[], todayYmd: string): number {
  if (!steps.length) return 0
  const done = new Set(ticks.map(t => `${t.title}|${t.day}`))
  const full = (d: string) => steps.every(s => done.has(`${s.id}|${d}`))
  let d = full(todayYmd) ? todayYmd : addDays(todayYmd, -1), n = 0
  while (full(d) && n < 3660) { n++; d = addDays(d, -1) }
  return n
}

