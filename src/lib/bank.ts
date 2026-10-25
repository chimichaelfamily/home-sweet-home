// The weekly practice bank: Gemini writes a batch of facts, chats and speeches once a week; each day the app shows one.
import { supabase } from './backend.ts'
import { askBank } from './ai.ts'
import { mondayOf } from './weekly.ts'
import { today } from './dates.ts'
import { TOPICS, shuffled, type BankSpeech, type BankTalk, type Fact } from './ktext.ts'

export type BankKind = 'fact' | 'talk' | 'speech'
export interface BankRow { id: string; kind: BankKind; week: string; data: unknown; created_at?: string }
const KEY = 'home-sweet-home.bank.v1'

export async function loadBank(): Promise<BankRow[]> {
  if (supabase) { const { data, error } = await supabase.from('knowledge_bank').select('*').order('created_at'); if (error) throw error; return (data ?? []) as BankRow[] }
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
async function saveRows(all: BankRow[], rows: BankRow[]) {
  if (supabase) { const { error } = await supabase.from('knowledge_bank').upsert(rows, { onConflict: 'id', ignoreDuplicates: true }); if (error) throw error; return }
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* ignore */ }
}

const textOf = (r: BankRow) => { const d = r.data as Record<string, unknown>; return String(d.text ?? d.topic ?? d.title ?? '') }

/** Asks Gemini for a new batch of one kind and saves it. `manual` adds another batch even if this week already has one. */
export async function refill(kind: BankKind, all: BankRow[], manual = false): Promise<BankRow[]> {
  const week = mondayOf(today())
  const avoid = all.filter(r => r.kind === kind).map(textOf)
  const { items } = await askBank(kind, avoid, kind === 'talk' ? shuffled(TOPICS, 5) : [])
  const stamp = manual ? `-${Date.now().toString(36)}` : ''
  const rows: BankRow[] = items.map((data, i) => ({ id: `${kind}-${week}${stamp}-${i}`, kind, week, data }))
  const next = [...all.filter(r => !rows.some(x => x.id === r.id)), ...rows]
  await saveRows(next, rows)
  return next
}
export const hasThisWeek = (all: BankRow[], kind: BankKind) => all.some(r => r.kind === kind && r.week === mondayOf(today()))

export const factsOf = (all: BankRow[]): Fact[] => all.filter(r => r.kind === 'fact').map(r => { const d = r.data as Fact; return { text: d.text, why: d.why ?? '', cat: d.cat ?? 'Any' } })
export const talksOf = (all: BankRow[]): BankTalk[] => all.filter(r => r.kind === 'talk').map(r => { const d = r.data as BankTalk; return { topic: d.topic ?? 'Small talk', setting: d.setting ?? '', lines: d.lines, tip: d.tip ?? '', phrases: Array.isArray(d.phrases) ? d.phrases : [] } })
export const speechesOf = (all: BankRow[]): BankSpeech[] => all.filter(r => r.kind === 'speech').map(r => { const d = r.data as BankSpeech; return { title: d.title, occasion: d.occasion ?? '', text: d.text, focus: d.focus ?? '' } })
