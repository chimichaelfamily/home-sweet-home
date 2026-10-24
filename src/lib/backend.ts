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

export type CalLinks = { linh: string; michael: string }
const CAL_KEY = 'home-sweet-home.cal.v1'
export async function loadCalLinks(): Promise<CalLinks> {
  const out: CalLinks = { linh: '', michael: '' }
  if (supabase) {
    const { data } = await supabase.from('calendars').select('person_id,url')
    for (const r of data ?? []) if (r.person_id === 'linh' || r.person_id === 'michael') out[r.person_id as 'linh' | 'michael'] = r.url
    return out
  }
  try { return { ...out, ...JSON.parse(localStorage.getItem(CAL_KEY) || '{}') } } catch { return out }
}
export async function saveCalLink(person: 'linh' | 'michael', url: string, all: CalLinks) {
  if (supabase) { await supabase.from('calendars').upsert({ person_id: person, url }, { onConflict: 'person_id' }); return }
  try { localStorage.setItem(CAL_KEY, JSON.stringify({ ...all, [person]: url })) } catch { /* ignore */ }
}

export interface MItem { id: string; person_id: 'linh' | 'michael'; kind: 'affirmation' | 'link' | 'song'; title: string; sub: string; url: string; sort: number }
const M_KEY = 'home-sweet-home.morning.v1'
export function seedMorning(): MItem[] {
  const t = ['I am building a life of freedom, and every small step counts.', 'I am calm, capable and ready for today.', 'I make time for the things that matter to me.', 'I am proud of how far I have come.', 'Good things are coming, and I am ready for them.']
  return (['linh', 'michael'] as const).flatMap(p => t.map((title, i) => ({ id: `${p}-aff-${i + 1}`, person_id: p, kind: 'affirmation' as const, title, sub: '', url: '', sort: i + 1 })))
}
export async function loadMorning(): Promise<MItem[]> {
  if (supabase) { const { data } = await supabase.from('morning_items').select('*').order('sort'); return (data ?? []) as MItem[] }
  try { const r = localStorage.getItem(M_KEY); return r ? JSON.parse(r) : seedMorning() } catch { return seedMorning() }
}
export async function saveMorning(all: MItem[], op: { upsert?: MItem; remove?: string }) {
  if (supabase) {
    if (op.upsert) await supabase.from('morning_items').upsert(op.upsert, { onConflict: 'id' })
    if (op.remove) await supabase.from('morning_items').delete().eq('id', op.remove)
    return
  }
  try { localStorage.setItem(M_KEY, JSON.stringify(all)) } catch { /* ignore */ }
}

const BK = 'home-sweet-home.lastbackup'
export const lastBackup = (): string | null => { try { return localStorage.getItem(BK) } catch { return null } }
export const markBackup = (ymd: string) => { try { localStorage.setItem(BK, ymd) } catch { /* ignore */ } }
/** Everything in the database as one object: the core state plus the extra tables. */
export async function backupAll(core: unknown): Promise<unknown> {
  const out: Record<string, unknown> = { core, saved_at: new Date().toISOString() }
  if (supabase) {
    for (const t of ['morning_items', 'private_items', 'products', 'weekly_notes', 'calendars']) {
      const { data } = await supabase.from(t).select('*'); out[t] = data ?? []
    }
  } else {
    for (const [k, key] of [['morning_items', 'home-sweet-home.morning.v1'], ['private_items', 'home-sweet-home.private.v1'], ['products', 'home-sweet-home.products.v1'], ['weekly_notes', 'home-sweet-home.weekly.v1']]) {
      try { out[k] = JSON.parse(localStorage.getItem(key) || 'null') } catch { out[k] = null }
    }
  }
  return out
}
