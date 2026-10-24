import type { Rule } from './rules.ts'
import type { Habit, HabitLog } from './habits.ts'
export type Size = 'baby' | 'biggie'
export type Who = 'linh' | 'michael' | 'both'
export const POINTS: Record<Size, number> = { baby: 1, biggie: 3 }
export const SIZE_LABEL: Record<Size, string> = { baby: 'Baby', biggie: 'Biggie' }

export interface Task {
  id: string
  title: string
  size: Size
  category: string | null
  assignee: 'linh' | 'michael' | null
  due_date: string
  source: string
  done_at: string | null
  done_by: Who | null
}
export interface PEvent {
  id: string
  person_id: 'linh' | 'michael'
  points: number
  title: string
  category: string | null
  size: Size
  shared: boolean
  task_id: string | null
  rule_id: string | null
  batch: string
  prev_last_done: string | null
  created_at: string
  undone_at: string | null
}
export interface State {
  rules: Rule[]
  tasks: Task[]
  events: PEvent[]
  snoozes: { rule_id: string; until: string }[]
  habits: Habit[]
  habitLogs: HabitLog[]
}
export type Op =
  | { table: string; type: 'insert'; row: Record<string, unknown> }
  | { table: string; type: 'update'; id: string; patch: Record<string, unknown> }
  | { table: string; type: 'upsert'; row: Record<string, unknown>; onConflict: string }
  | { table: string; type: 'delete'; match: Record<string, string> }
export const PEOPLE = { linh: 'Linh Chi', michael: 'Michael' } as const
