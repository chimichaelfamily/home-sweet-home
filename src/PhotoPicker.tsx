import { useRef, useState } from 'react'
import { fileToDataUrl } from './lib/photos.ts'
import { supabase } from './lib/backend.ts'
import { logError } from './lib/errorlog.ts'

interface P { id: string; thumb: string; full: string; by: string; link: string; dl: string }
async function headers(): Promise<Record<string, string>> {
  if (!supabase) return {}
  const { data } = await supabase.auth.getSession()
  return data.session ? { Authorization: 'Bearer ' + data.session.access_token } : {}
}

export function PhotoPicker({ initial = '', onPick, onClose }: { initial?: string; onPick: (img: string) => void; onClose: () => void }) {
  const [q, setQ] = useState(initial)
  const [res, setRes] = useState<P[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const search = async () => {
    if (!q.trim()) return
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/photos?q=' + encodeURIComponent(q), { headers: await headers() })
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Search failed')
      setRes(j.photos); if (!j.photos.length) setErr('No photos found. Try another word.')
    } catch (e) { logError('Photo search', e); setErr((e as Error).message) } finally { setBusy(false) }
  }
  const choose = async (p: P) => {
    fetch('/api/photos?track=' + encodeURIComponent(p.dl), { headers: await headers() }).catch(() => { /* credit ping only */ })
    onPick(p.full)
  }
  return (
    <div className="overlay" onClick={onClose}><div className="dialog" style={{ width: 760, maxHeight: '92vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ fontSize: 28, fontWeight: 600, flex: 1 }}>Choose a photo</div><button className="btn small outline" onClick={onClose}>Close</button></div>
      <form style={{ display: 'flex', gap: 8 }} onSubmit={e => { e.preventDefault(); search() }}>
        <input type="text" placeholder="Search, e.g. calm ocean, cosy home, wedding flowers" value={q} onChange={e => setQ(e.target.value)} />
        <button className="btn small" type="submit" disabled={busy}>{busy ? 'Searching…' : 'Search'}</button>
      </form>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn small outline" onClick={() => file.current?.click()}>Use a photo from this iPad</button>
        <button className="btn small outline" onClick={() => onPick('')}>No photo</button>
        <input ref={file} type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) onPick(await fileToDataUrl(f, 1000)) }} />
      </div>
      {err && <div style={{ fontSize: 14 }}>{err}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {res.map(p => <button key={p.id} onClick={() => choose(p)} style={{ border: 'none', padding: 0, background: 'none', textAlign: 'left' }}><img src={p.thumb} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 14, display: 'block' }} /><div className="muted" style={{ fontSize: 11 }}>Photo: {p.by} / Unsplash</div></button>)}
      </div>
    </div></div>
  )
}
