import { supabase } from './backend.ts'

async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {}
  const { data } = await supabase.auth.getSession()
  return data.session ? { Authorization: 'Bearer ' + data.session.access_token } : {}
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'The AI is not available right now.')
  return j as T
}
export interface Msg { role: 'user' | 'model'; text: string }
export const askAI = async (messages: Msg[], system?: string) => (await post<{ text: string }>('/api/ai', { messages, system })).text
export const askBank = (kind: 'fact' | 'talk' | 'speech', avoid: string[], topics: string[] = []) => post<{ items: unknown[] }>('/api/bank', { kind, avoid, topics })
export interface Scan { name: string | null; type: string | null; where: string | null; printed_expiry: string | null; shelf_months: number | null; notes?: string | null }
export const scanProduct = (images: { mime: string; data: string }[]) => post<Scan>('/api/scan', { images })

/** Shrinks a photo to ~1024px JPEG base64 so uploads are quick on the iPad. */
export async function photoToBase64(file: File, max = 1024): Promise<{ mime: string; data: string }> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return { mime: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.8).split(',')[1] }
}
