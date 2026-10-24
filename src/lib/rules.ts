import { addDays, addMonths, diffDays } from './dates.ts'

export type Unit = 'days' | 'weeks' | 'months' | 'years'
export interface Rule {
  id: string
  name: string
  category: string
  action: string
  every_n: number
  unit: Unit
  applies_to: string
  keep: boolean
  last_done: string | null
  size: 'baby' | 'biggie'
}

export function nextDue(r: Pick<Rule, 'last_done' | 'every_n' | 'unit'>): string | null {
  if (!r.last_done) return null
  switch (r.unit) {
    case 'days': return addDays(r.last_done, r.every_n)
    case 'weeks': return addDays(r.last_done, 7 * r.every_n)
    case 'months': return addMonths(r.last_done, r.every_n)
    case 'years': return addMonths(r.last_done, 12 * r.every_n)
  }
}

export const cycleDays = (r: Pick<Rule, 'last_done' | 'every_n' | 'unit'>) => {
  const n = nextDue(r)
  return n && r.last_done ? diffDays(n, r.last_done) : 0
}

// Heads-ups from the agreed rules: a month ahead only for cycles over 60 days,
// two weeks ahead only for cycles over 30 days.
export function headsUps(r: Rule): { monthBefore: string | null; weeksBefore: string | null } {
  const due = nextDue(r)
  if (!due) return { monthBefore: null, weeksBefore: null }
  const c = cycleDays(r)
  return {
    monthBefore: c > 60 ? addMonths(due, -1) : null,
    weeksBefore: c > 30 ? addDays(due, -14) : null,
  }
}

export type Status = 'skipped' | 'notstarted' | 'overdue' | 'today' | 'soon' | 'ok'
export function status(r: Rule, today: string): Status {
  if (!r.keep) return 'skipped'
  const due = nextDue(r)
  if (!due) return 'notstarted'
  const d = diffDays(due, today)
  if (d < 0) return 'overdue'
  if (d === 0) return 'today'
  if (d <= 30) return 'soon'
  return 'ok'
}

export const daysLate = (r: Rule, today: string) => {
  const due = nextDue(r)
  return due ? Math.max(0, diffDays(today, due)) : 0
}
