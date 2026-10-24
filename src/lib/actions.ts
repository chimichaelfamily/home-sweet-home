// All the app's rules live here as plain functions: easy to test, no screen code mixed in.
import { isoToYmd, today } from './dates.ts'
import { type Op, type PEvent, type Size, type State, type Task, type Who, POINTS } from './types.ts'
import type { Rule } from './rules.ts'

export const uid = () => crypto.randomUUID()
type Result = { state: State; ops: Op[]; batch?: string }

export function addTask(s: State, title: string, size: Size): Result {
  const t: Task = { id: uid(), title: title.trim(), size, category: null, assignee: null, due_date: today(), source: 'manual', done_at: null, done_by: null }
  return { state: { ...s, tasks: [...s.tasks, t] }, ops: [{ table: 'tasks', type: 'insert', row: { ...t } }] }
}

export function complete(s: State, kind: 'task' | 'rule', id: string, who: Who): Result {
  const batch = uid()
  const now = new Date().toISOString()
  let title = '', category: string | null = null, size: Size = 'baby'
  let task: Task | undefined, rule: Rule | undefined
  const ops: Op[] = []
  let state = s
  if (kind === 'task') {
    task = s.tasks.find(t => t.id === id)
    if (!task || task.done_at) return { state: s, ops: [] }
    ;({ title, category, size } = task)
    state = { ...s, tasks: s.tasks.map(t => (t.id === id ? { ...t, done_at: now, done_by: who } : t)) }
    ops.push({ table: 'tasks', type: 'update', id, patch: { done_at: now, done_by: who } })
  } else {
    rule = s.rules.find(r => r.id === id)
    if (!rule) return { state: s, ops: [] }
    ;({ name: title, category, size } = rule)
    state = { ...s, rules: s.rules.map(r => (r.id === id ? { ...r, last_done: today() } : r)), snoozes: s.snoozes.filter(z => z.rule_id !== id) }
    ops.push({ table: 'rules', type: 'update', id, patch: { last_done: today() } })
    ops.push({ table: 'snoozes', type: 'delete', match: { rule_id: id } })
  }
  const people: ('linh' | 'michael')[] = who === 'both' ? ['linh', 'michael'] : [who]
  const events: PEvent[] = people.map(p => ({
    id: uid(), person_id: p, points: POINTS[size], title, category, size, shared: who === 'both',
    task_id: task?.id ?? null, rule_id: rule?.id ?? null, batch, prev_last_done: rule?.last_done ?? null,
    created_at: now, undone_at: null,
  }))
  for (const e of events) ops.push({ table: 'point_events', type: 'insert', row: { ...e } })
  return { state: { ...state, events: [...state.events, ...events] }, ops, batch }
}

export function undo(s: State, batch: string): Result {
  const evs = s.events.filter(e => e.batch === batch && !e.undone_at)
  if (!evs.length) return { state: s, ops: [] }
  const now = new Date().toISOString()
  const ops: Op[] = evs.map(e => ({ table: 'point_events', type: 'update' as const, id: e.id, patch: { undone_at: now } }))
  let tasks = s.tasks, rules = s.rules
  const e0 = evs[0]
  if (e0.task_id) {
    tasks = tasks.map(t => (t.id === e0.task_id ? { ...t, done_at: null, done_by: null } : t))
    ops.push({ table: 'tasks', type: 'update', id: e0.task_id, patch: { done_at: null, done_by: null } })
  }
  if (e0.rule_id) {
    rules = rules.map(r => (r.id === e0.rule_id ? { ...r, last_done: e0.prev_last_done } : r))
    ops.push({ table: 'rules', type: 'update', id: e0.rule_id, patch: { last_done: e0.prev_last_done } })
  }
  return { state: { ...s, tasks, rules, events: s.events.map(e => (e.batch === batch ? { ...e, undone_at: now } : e)) }, ops }
}

export function snooze(s: State, ruleId: string, until: string): Result {
  const rest = s.snoozes.filter(z => z.rule_id !== ruleId)
  return {
    state: { ...s, snoozes: [...rest, { rule_id: ruleId, until }] },
    ops: [{ table: 'snoozes', type: 'upsert', row: { rule_id: ruleId, until }, onConflict: 'rule_id' }],
  }
}

export function updateRule(s: State, id: string, patch: Partial<Rule>): Result {
  return { state: { ...s, rules: s.rules.map(r => (r.id === id ? { ...r, ...patch } : r)) }, ops: [{ table: 'rules', type: 'update', id, patch }] }
}

export function addRule(s: State, r: Omit<Rule, 'id'>): Result {
  const rule: Rule = { ...r, id: uid() }
  return { state: { ...s, rules: [...s.rules, rule] }, ops: [{ table: 'rules', type: 'insert', row: { ...rule } }] }
}

export const monthPoints = (s: State, month: string) => {
  const tot = { linh: 0, michael: 0 }
  for (const e of s.events) if (!e.undone_at && isoToYmd(e.created_at).slice(0, 7) === month) tot[e.person_id] += e.points
  return tot
}

export function toggleHabit(s: State, habitId: string, day: string): Result {
  const has = s.habitLogs.some(l => l.habit_id === habitId && l.day === day)
  if (has) return { state: { ...s, habitLogs: s.habitLogs.filter(l => !(l.habit_id === habitId && l.day === day)) }, ops: [{ table: 'habit_logs', type: 'delete', match: { habit_id: habitId, day } }] }
  return { state: { ...s, habitLogs: [...s.habitLogs, { habit_id: habitId, day }] }, ops: [{ table: 'habit_logs', type: 'insert', row: { habit_id: habitId, day } }] }
}
export function addHabit(s: State, person: 'linh' | 'michael', name: string): Result {
  const sort = Math.max(0, ...s.habits.filter(h => h.person_id === person).map(h => h.sort)) + 1
  const h = { id: uid(), person_id: person, name: name.trim(), sort, active: true }
  return { state: { ...s, habits: [...s.habits, h] }, ops: [{ table: 'habits', type: 'insert', row: { ...h } }] }
}
export function updateHabit(s: State, id: string, patch: { name?: string; active?: boolean }): Result {
  return { state: { ...s, habits: s.habits.map(h => (h.id === id ? { ...h, ...patch } : h)) }, ops: [{ table: 'habits', type: 'update', id, patch }] }
}
