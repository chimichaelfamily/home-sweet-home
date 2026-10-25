import { supabase } from './backend.ts'

export type KKind = 'book' | 'script' | 'fact'
export interface KItem { id: string; kind: KKind; title: string; sub: string; cat: string; body: string; num: number; num2: number; sort: number }
const KEY = 'home-sweet-home.knowledge.v1'

export async function loadKnowledge(): Promise<KItem[]> {
  if (supabase) {
    const { data, error } = await supabase.from('knowledge_items').select('*').order('sort')
    if (error) throw error
    return (data ?? []).map(r => ({ ...r, num: Number(r.num), num2: Number(r.num2) })) as KItem[]
  }
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
export async function saveKnowledge(all: KItem[], op: { upsert?: KItem; remove?: string }) {
  if (supabase) {
    if (op.upsert) { const { error } = await supabase.from('knowledge_items').upsert(op.upsert, { onConflict: 'id' }); if (error) throw error }
    if (op.remove) { const { error } = await supabase.from('knowledge_items').delete().eq('id', op.remove); if (error) throw error }
    return
  }
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* ignore */ }
}

export * from './ktext.ts'
