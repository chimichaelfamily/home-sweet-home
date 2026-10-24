import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { supabase } from './lib/backend.ts'
import { fileToDataUrl } from './lib/photos.ts'
import { logError } from './lib/errorlog.ts'
import { PEOPLE } from './lib/types.ts'

type Who = 'linh' | 'michael'
const KEY = 'hsh.avatars'
let cache: Record<Who, string> = (() => { try { return { linh: '', michael: '', ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { linh: '', michael: '' } } })()
const subs = new Set<() => void>()
const emit = () => subs.forEach(f => f())
const setCache = (c: Record<Who, string>) => { cache = c; try { localStorage.setItem(KEY, JSON.stringify(c)) } catch { /* ignore */ } emit() }
export async function refreshAvatars() {
  if (!supabase) return
  const { data, error } = await supabase.from('people').select('id,avatar')
  if (error || !data) return // column may not exist yet (009 not run): keep what we have
  const next = { ...cache }
  for (const r of data) if (r.id === 'linh' || r.id === 'michael') next[r.id as Who] = r.avatar ?? ''
  setCache(next)
}
export async function setAvatar(who: Who, dataUrl: string) {
  setCache({ ...cache, [who]: dataUrl })
  if (supabase) { const { error } = await supabase.from('people').update({ avatar: dataUrl }).eq('id', who); if (error) { logError('Faces: saving', error.message + ' Has 009_pictures.sql been run?'); throw error } }
}
const useAvatars = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => cache)

export function Face({ who, size = 44 }: { who: Who; size?: number }) {
  const src = useAvatars()[who]
  const base = { width: size, height: size, borderRadius: '50%', flex: 'none' as const, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: `${Math.max(2, size / 22)}px solid ${who === 'linh' ? 'var(--accent)' : 'var(--blue-bd)'}` }
  return src
    ? <span style={base}><img src={src} alt={PEOPLE[who]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></span>
    : <span style={{ ...base, background: who === 'linh' ? 'var(--accent)' : 'var(--blue-bg)', color: who === 'linh' ? 'var(--on-accent)' : 'var(--blue-tx)', fontWeight: 700, fontSize: size * 0.42 }}>{PEOPLE[who][0]}</span>
}

export function FaceSettings() {
  const [msg, setMsg] = useState('')
  const refs = { linh: useRef<HTMLInputElement>(null), michael: useRef<HTMLInputElement>(null) }
  useEffect(() => { refreshAvatars() }, [])
  const pick = async (who: Who, f: FileList | null) => {
    if (!f?.[0]) return
    try { await setAvatar(who, await fileToDataUrl(f[0], 256, true)); setMsg('Saved.') } catch { setMsg('Could not save the photo. Has 009_pictures.sql been run? See Errors.') }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
      <div style={{ fontSize: 30, fontWeight: 600 }}>Faces</div>
      {(['linh', 'michael'] as const).map(w => (
        <div key={w} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Face who={w} size={72} />
          <div style={{ flex: 1, fontSize: 20, fontWeight: 600 }}>{PEOPLE[w]}</div>
          <button className="btn small" onClick={() => refs[w].current?.click()}>Choose photo</button>
          <button className="btn small outline" onClick={() => setAvatar(w, '').then(() => setMsg('Removed.')).catch(() => setMsg('Could not remove.'))}>Remove</button>
          <input ref={refs[w]} type="file" accept="image/*" hidden onChange={e => { pick(w, e.target.files); e.target.value = '' }} />
        </div>
      ))}
      {msg && <div style={{ fontSize: 14 }}>{msg}</div>}
    </div>
  )
}
