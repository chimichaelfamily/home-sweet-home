import assert from 'node:assert/strict'
import { addMonths, diffDays, today } from './dates.ts'
import { nextDue, status, daysLate, headsUps, type Rule } from './rules.ts'

const mk = (last: string, n: number, unit: Rule['unit']): Rule => ({
  id: 'x', name: 'x', category: 'x', action: 'x', every_n: n, unit, applies_to: 'Both', keep: true, last_done: last, size: 'baby',
})
const T = '2026-10-24'
assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
assert.equal(addMonths('2026-10-23', 3), '2027-01-23')
assert.equal(diffDays('2026-10-24', '2026-03-01'), 237)
// The 13 rules from the household workbook, checked against the numbers worked out by hand.
assert.equal(nextDue(mk('2025-09-01', 6, 'months')), '2026-03-01')
assert.equal(daysLate(mk('2025-09-01', 6, 'months'), T), 237)
assert.equal(daysLate(mk('2026-01-01', 3, 'months'), T), 206)
assert.equal(daysLate(mk('2026-01-01', 6, 'months'), T), 115)
assert.equal(daysLate(mk('2025-09-01', 12, 'months'), T), 53)
assert.equal(daysLate(mk('2026-09-01', 1, 'weeks'), T), 46)
assert.equal(daysLate(mk('2026-09-01', 1, 'months'), T), 23)
assert.equal(status(mk('2026-10-24', 1, 'weeks'), T), 'soon')
assert.equal(nextDue(mk('2026-01-01', 2, 'years')), '2028-01-01')
assert.equal(status(mk('2026-01-01', 2, 'years'), T), 'ok')
// heads-ups: 7-day cycle gets none; 3-month cycle gets both
assert.deepEqual(headsUps(mk('2026-10-24', 1, 'weeks')), { monthBefore: null, weeksBefore: null })
assert.deepEqual(headsUps(mk('2026-09-01', 3, 'months')), { monthBefore: '2026-11-01', weeksBefore: '2026-11-17' })
console.log('rules tests passed')

// ---- actions ----
import { addTask, complete, undo, monthPoints } from './actions.ts'
import type { State } from './types.ts'
const base: State = { rules: [mk('2025-09-01', 6, 'months')], tasks: [], events: [], snoozes: [], habits: [], habitLogs: [] }
let r = addTask(base, 'Clean the oven', 'biggie')
assert.equal(r.state.tasks.length, 1)
const tid = r.state.tasks[0].id
let c = complete(r.state, 'task', tid, 'both')
assert.equal(c.state.events.length, 2)
assert.deepEqual(monthPoints(c.state, today().slice(0, 7)), { linh: 3, michael: 3 })
let u = undo(c.state, c.batch!)
assert.equal(u.state.tasks[0].done_at, null)
assert.deepEqual(monthPoints(u.state, today().slice(0, 7)), { linh: 0, michael: 0 })
// ticking a rule moves last_done to today and undo puts the old date back
let rr = complete(base, 'rule', base.rules[0].id, 'linh')
assert.notEqual(rr.state.rules[0].last_done, '2025-09-01')
assert.equal(undo(rr.state, rr.batch!).state.rules[0].last_done, '2025-09-01')
console.log('actions tests passed')

// ---- habits ----
import { streak, longestInMonth } from './habits.ts'
import { toggleHabit, addHabit } from './actions.ts'
const dset = (...d: string[]) => new Set(d)
assert.equal(streak(dset('2026-10-22', '2026-10-23', '2026-10-24'), '2026-10-24'), 3)
assert.equal(streak(dset('2026-10-22', '2026-10-23'), '2026-10-24'), 2) // today not ticked yet keeps the streak
assert.equal(streak(dset('2026-10-21'), '2026-10-24'), 0)
assert.equal(longestInMonth(dset('2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05'), '2026-10', '2026-10-24'), 3)
let h = addHabit(base, 'linh', ' Walk ')
const hid = h.state.habits[0].id
assert.equal(h.state.habits[0].name, 'Walk')
let tg = toggleHabit(h.state, hid, '2026-10-24')
assert.equal(tg.state.habitLogs.length, 1)
assert.equal(toggleHabit(tg.state, hid, '2026-10-24').state.habitLogs.length, 0)
console.log('habit tests passed')
