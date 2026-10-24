import { addDays, fromYmd, isoToYmd } from './dates.ts'
import { nextDue, status } from './rules.ts'
import { streak } from './habits.ts'
import type { State } from './types.ts'

export interface PersonWeek { points: number; tasks: number; habitPct: number; perfectDays: number; bestStreak: number }
export interface Weekly {
  from: string; to: string
  people: { linh: PersonWeek; michael: PersonWeek }
  open: string[]; overdue: string[]; comingUp: { name: string; due: string }[]
  leader: 'linh' | 'michael' | 'tie'
}
export const mondayOf = (ymd: string) => addDays(ymd, -((fromYmd(ymd).getDay() + 6) % 7))

/** Week summary for the 7 days ending on `to` (inclusive). */
export function weekly(s: State, to: string): Weekly {
  const from = addDays(to, -6)
  const inWeek = (d: string) => d >= from && d <= to
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i))
  const mk = (p: 'linh' | 'michael'): PersonWeek => {
    const ev = s.events.filter(e => e.person_id === p && !e.undone_at && inWeek(isoToYmd(e.created_at)))
    const hs = s.habits.filter(h => h.person_id === p && h.active)
    const done = (id: string) => new Set(s.habitLogs.filter(l => l.habit_id === id).map(l => l.day))
    const sets = hs.map(h => done(h.id))
    let total = 0, perfect = 0
    for (const d of days) { const c = sets.filter(x => x.has(d)).length; total += c; if (hs.length && c === hs.length) perfect++ }
    return { points: ev.reduce((a, e) => a + e.points, 0), tasks: ev.length, habitPct: hs.length ? Math.round(total / (7 * hs.length) * 100) : 0, perfectDays: perfect, bestStreak: Math.max(0, ...sets.map(x => streak(x, to))) }
  }
  const linh = mk('linh'), michael = mk('michael')
  const snoozed = new Set(s.snoozes.filter(z => z.until > to).map(z => z.rule_id))
  return {
    from, to, people: { linh, michael },
    leader: linh.points === michael.points ? 'tie' : linh.points > michael.points ? 'linh' : 'michael',
    open: s.tasks.filter(t => !t.done_at).map(t => t.title),
    overdue: s.rules.filter(r => status(r, to) === 'overdue' && !snoozed.has(r.id)).map(r => r.name),
    comingUp: s.rules.map(r => ({ name: r.name, due: nextDue(r) })).filter((x): x is { name: string; due: string } => !!x.due && x.due > to && x.due <= addDays(to, 7)),
  }
}
