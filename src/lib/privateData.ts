import { supabase } from './backend.ts'

export type Kind = 'pillar' | 'ladder' | 'step' | 'pin' | 'countdown' | 'money'
export interface PItem { id: string; kind: Kind; title: string; sub: string; cat: string; num1: number; num2: number; day: string | null; sort: number; img?: string }
const KEY = 'home-sweet-home.private.v1'
export async function loadPrivate(): Promise<PItem[]> {
  if (supabase) {
    const { data, error } = await supabase.from('private_items').select('*').order('sort')
    if (error) throw error
    return (data ?? []).map(r => ({ ...r, num1: Number(r.num1), num2: Number(r.num2) })) as PItem[]
  }
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
export async function savePrivate(all: PItem[], op: { upsert?: PItem; remove?: string }) {
  if (supabase) {
    if (op.upsert) { const { error } = await supabase.from('private_items').upsert(op.upsert, { onConflict: 'id' }); if (error) throw error }
    if (op.remove) { const { error } = await supabase.from('private_items').delete().eq('id', op.remove); if (error) throw error }
    return
  }
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* ignore */ }
}

export { monthsTo, daysUntil, money } from './pmath.ts'

// ---- Face ID / Touch ID lock (a passkey on this iPad; checked on the iPad only) ----
const CRED = 'home-sweet-home.passkey'
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)))
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))
export const lockSupported = () => typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials
export const lockRegistered = () => { try { return !!localStorage.getItem(CRED) } catch { return false } }
export async function lockRegister(): Promise<void> {
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rp: { name: 'Home sweet home' },
    user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'household', displayName: 'Household' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
    timeout: 60000,
  } }) as PublicKeyCredential | null
  if (!cred) throw new Error('cancelled')
  localStorage.setItem(CRED, b64(cred.rawId))
}
export async function lockUnlock(): Promise<void> {
  const id = localStorage.getItem(CRED); if (!id) throw new Error('not set up')
  const r = await navigator.credentials.get({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    allowCredentials: [{ type: 'public-key', id: unb64(id) }],
    userVerification: 'required', timeout: 60000,
  } })
  if (!r) throw new Error('cancelled')
}
export function lockReset() { try { localStorage.removeItem(CRED) } catch { /* ignore */ } }
