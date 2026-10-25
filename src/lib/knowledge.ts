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
export async function saveKnowledge(all: KItem[], op: { upsert?: KItem; remove?: string; many?: KItem[] }) {
  if (supabase) {
    if (op.many?.length) { const { error } = await supabase.from('knowledge_items').upsert(op.many, { onConflict: 'id' }); if (error) throw error }
    if (op.upsert) { const { error } = await supabase.from('knowledge_items').upsert(op.upsert, { onConflict: 'id' }); if (error) throw error }
    if (op.remove) { const { error } = await supabase.from('knowledge_items').delete().eq('id', op.remove); if (error) throw error }
    return
  }
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* ignore */ }
}

export * from './ktext.ts'

// ---- Goodreads: one-off CSV import and an automatic daily sync from the shelf RSS feed ----
import type { GrBook } from './ktext.ts'
import { parseGoodreadsRss } from './ktext.ts'

/** Adds new books and updates status/rating of ones already here. Your notes in the app are never overwritten. */
export async function importGoodreadsList(list: GrBook[]): Promise<{ added: number; updated: number }> {
  const items = await loadKnowledge()
  const books = items.filter(x => x.kind === 'book')
  const key = (t: string, a: string) => (t + '|' + a).toLowerCase().replace(/\s+/g, ' ').trim()
  const have = new Map(books.map(b => [key(b.title, b.sub), b]))
  let added = 0, updated = 0; let sort = Math.max(0, ...books.map(b => b.sort))
  const out: KItem[] = []
  list.forEach((g, i) => {
    const old = have.get(key(g.title, g.author))
    if (old) {
      const next = { ...old, cat: g.status, num2: g.rating || old.num2, num: g.status === 'done' ? 100 : old.num, body: old.body || g.review }
      if (next.cat !== old.cat || next.num2 !== old.num2 || next.body !== old.body) { updated++; out.push(next) }
      return
    }
    added++
    const b: KItem = { id: `book-gr-${Date.now().toString(36)}-${i}`, kind: 'book', title: g.title, sub: g.author, cat: g.status, body: g.review, num: g.status === 'done' ? 100 : 0, num2: g.rating, sort: ++sort }
    have.set(key(g.title, g.author), b); out.push(b)
  })
  if (out.length) {
    const ids = new Set(out.map(x => x.id))
    await saveKnowledge([...items.filter(x => !ids.has(x.id)), ...out], { many: out })
    window.dispatchEvent(new Event('hsh-knowledge'))
  }
  return { added, updated }
}

const GR_KEY = 'home-sweet-home.goodreads.v1', GR_SYNC = 'home-sweet-home.goodreads.sync'
export async function getGoodreadsUrl(): Promise<string> {
  if (supabase) { const { data } = await supabase.from('calendars').select('url').eq('person_id', 'goodreads').maybeSingle(); return data?.url ?? '' }
  try { return localStorage.getItem(GR_KEY) || '' } catch { return '' }
}
export async function setGoodreadsUrl(url: string) {
  if (supabase) { const { error } = await supabase.from('calendars').upsert({ person_id: 'goodreads', url }, { onConflict: 'person_id' }); if (error) throw error; return }
  try { localStorage.setItem(GR_KEY, url) } catch { /* ignore */ }
}
export const lastGoodreadsSync = () => { try { return localStorage.getItem(GR_SYNC) || '' } catch { return '' } }
export async function syncGoodreads(url: string): Promise<{ added: number; updated: number; seen: number }> {
  const all: GrBook[] = []
  for (let page = 1; page <= 10; page++) {
    const r = await fetch(`/api/goodreads?url=${encodeURIComponent(url)}&page=${page}`)
    if (!r.ok) throw new Error(page === 1 ? 'Goodreads did not answer. Check the RSS link.' : 'Stopped part way.')
    const list = parseGoodreadsRss(await r.text())
    if (!list.length) break
    all.push(...list)
    if (list.length < 100) break
  }
  const res = await importGoodreadsList(all)
  try { localStorage.setItem(GR_SYNC, new Date().toISOString()) } catch { /* ignore */ }
  return { ...res, seen: all.length }
}
/** Called when the app opens: syncs at most twice a day. */
export async function autoSyncGoodreads() {
  const last = lastGoodreadsSync()
  if (last && Date.now() - Date.parse(last) < 12 * 3600 * 1000) return
  const url = await getGoodreadsUrl().catch(() => '')
  if (url) await syncGoodreads(url).catch(() => { /* try again next time */ })
}
