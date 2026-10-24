import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Op, State } from './types.ts'
import type { Rule } from './rules.ts'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
export const usingDatabase = !!supabase

// Demo data used until the database is connected: the 13 household rules, last-done dates as you entered them.
const R = (name: string, category: string, action: string, n: number, unit: Rule['unit'], last: string): Rule => ({
  id: crypto.randomUUID(), name, category, action, every_n: n, unit, applies_to: 'Both', keep: true, last_done: last, size: 'baby',
})
export const seedRules = (): Rule[] => [
  R('GP check-up', 'Health', 'Appointment', 12, 'months', '2025-09-01'),
  R('Dentist check-up and clean', 'Health', 'Appointment', 6, 'months', '2025-09-01'),
  R('Replace electric toothbrush head', 'Health', 'Replace', 3, 'months', '2026-10-23'),
  R('Clean hairbrushes and combs', 'Health', 'Clean', 1, 'months', '2026-09-01'),
  R('Replace underwear', 'Clothes', 'Replace', 6, 'months', '2026-10-24'),
  R('Replace makeup sponges', 'Clothes', 'Replace', 3, 'months', '2026-09-01'),
  R('Wash bed sheets and pillowcases', 'Bedroom', 'Clean', 1, 'weeks', '2026-10-24'),
  R('Replace bath towels', 'Bathroom', 'Replace', 2, 'years', '2026-01-01'),
  R('Replace loofah / bath sponge', 'Bathroom', 'Replace', 1, 'months', '2026-09-01'),
  R('Wash tea towels', 'Kitchen', 'Clean', 1, 'weeks', '2026-09-01'),
  R('Deep-clean fridge', 'Kitchen', 'Clean', 3, 'months', '2026-01-01'),
  R('Car service', 'Car', 'Service', 6, 'months', '2026-01-01'),
  R('Back up phones and photos', 'Admin', 'Service', 3, 'months', '2026-01-01'),
]
export const seedHabits = (): State['habits'] => (['linh', 'michael'] as const).flatMap(p =>
  ['AM skincare', 'Drink water', 'Vitamins', 'Stretch 10 min', 'PM skincare', 'Read before bed'].map((name, i) => ({ id: crypto.randomUUID(), person_id: p, name, sort: i + 1, active: true })))
export const emptyState = (): State => ({ rules: seedRules(), tasks: [], events: [], snoozes: [], habits: seedHabits(), habitLogs: [] })
const empty = emptyState

const LS = 'home-sweet-home.v1'
export async function load(): Promise<State> {
  if (!supabase) {
    try {
      const raw = localStorage.getItem(LS)
      if (raw) { const x = JSON.parse(raw) as State; return { ...x, habits: x.habits ?? seedHabits(), habitLogs: x.habitLogs ?? [] } }
    } catch { /* fall through to fresh data */ }
    return empty()
  }
  const [rules, tasks, events, snoozes, habits, logs] = await Promise.all([
    supabase.from('rules').select('*').order('created_at'),
    supabase.from('tasks').select('*').order('created_at'),
    supabase.from('point_events').select('*').order('created_at'),
    supabase.from('snoozes').select('*'),
    supabase.from('habits').select('*').order('sort'),
    supabase.from('habit_logs').select('*').gte('day', new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10)),
  ])
  const err = rules.error || tasks.error || events.error || snoozes.error
  if (err) throw new Error(err.message)
  return { rules: rules.data as Rule[], tasks: tasks.data as State['tasks'], events: events.data as State['events'], snoozes: snoozes.data as State['snoozes'], habits: (habits.error ? [] : habits.data) as State['habits'], habitLogs: (logs.error ? [] : logs.data) as State['habitLogs'] }
}

export async function save(state: State, ops: Op[]): Promise<string | null> {
  if (!supabase) {
    try { localStorage.setItem(LS, JSON.stringify(state)) } catch { /* private mode: keep going in memory */ }
    return null
  }
  for (const op of ops) {
    const t = supabase.from(op.table)
    const res =
      op.type === 'insert' ? await t.insert(op.row)
      : op.type === 'update' ? await t.update(op.patch).eq('id', op.id)
      : op.type === 'upsert' ? await t.upsert(op.row, { onConflict: op.onConflict })
      : await Object.entries(op.match).reduce((q, [k, v]) => q.eq(k, v), t.delete())
    if (res.error) return res.error.message
  }
  return null
}
