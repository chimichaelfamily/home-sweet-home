import { logError } from './lib/errorlog.ts'
import { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/backend.ts'
import { today, fmtShort } from './lib/dates.ts'
import { PLACES, SHELF, TYPES, productStatus, useBy } from './lib/products.ts'
import { photoToBase64, scanProduct } from './lib/ai.ts'

interface Product { id: string; name: string; type: string; place: string; opened: string; printed_expiry: string | null; shelf_months: number; use_by: string; used_up: boolean }
const KEY = 'home-sweet-home.products.v1'
async function load(): Promise<Product[]> {
  if (supabase) { const { data, error } = await supabase.from('products').select('*'); if (error) throw error; return (data ?? []) as Product[] }
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
async function persist(all: Product[], op: { upsert?: Product; remove?: string }) {
  if (supabase) {
    if (op.upsert) { const { error } = await supabase.from('products').upsert(op.upsert, { onConflict: 'id' }); if (error) throw error }
    if (op.remove) { const { error } = await supabase.from('products').delete().eq('id', op.remove); if (error) throw error }
    return
  }
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* ignore */ }
}
const toneStyle = (t: 'late' | 'soon' | 'ok') => t === 'late' ? { background: 'var(--late)', color: '#fff' } : t === 'soon' ? { border: '1.5px solid var(--late)', color: 'var(--late)' } : { background: 'var(--faint)', border: '1px solid var(--border)' }

export function Products() {
  const t = today()
  const [items, setItems] = useState<Product[]>([])
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState('All')
  const [form, setForm] = useState<null | { id?: string; name: string; type: string; place: string; opened: string; printed: string; months: string; note?: string }>(null)
  const [scanning, setScanning] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => { load().then(setItems).catch(() => { logError('Products: loading', 'Could not load. Has 007_products.sql been run?'); setErr('Could not load. Has 007_products.sql been run?') }) }, [])

  const save = (f: NonNullable<typeof form>) => {
    const months = Math.max(1, Number(f.months) || SHELF[f.type] || 12)
    const p: Product = { id: f.id ?? `prod-${Date.now().toString(36)}`, name: f.name.trim(), type: f.type, place: f.place, opened: f.opened, printed_expiry: f.printed || null, shelf_months: months, use_by: useBy(f.opened, months, f.printed || null), used_up: false }
    const next = items.some(x => x.id === p.id) ? items.map(x => x.id === p.id ? p : x) : [...items, p]
    setItems(next); setForm(null); persist(next, { upsert: p }).catch(() => { logError('Products: saving', 'Could not save. Has 007_products.sql been run?'); setErr('Could not save. Has 007_products.sql been run?') })
  }
  const remove = (id: string) => { const next = items.filter(x => x.id !== id); setItems(next); setForm(null); persist(next, { remove: id }).catch(() => setErr('Could not remove.')) }
  const blank = { name: '', type: 'Other', place: 'Kitchen', opened: t, printed: '', months: '' }
  const onPhoto = async (fl: FileList | null) => {
    if (!fl?.length) return
    setScanning(true); setErr('')
    try {
      const imgs = await Promise.all([...fl].slice(0, 3).map(f => photoToBase64(f)))
      const r = await scanProduct(imgs)
      const type = (TYPES as readonly string[]).includes(r.type ?? '') ? r.type! : 'Other'
      setForm({ ...blank, name: r.name ?? '', type, place: (PLACES as readonly string[]).includes(r.where ?? '') ? r.where! : 'Kitchen', printed: r.printed_expiry ?? '', months: String(r.shelf_months ?? SHELF[type]), note: r.notes ?? undefined })
    } catch (e) { setErr((e as Error).message + ' You can type it in instead.'); setForm(blank) } finally { setScanning(false); if (file.current) file.current.value = '' }
  }

  const list = items.filter(x => !x.used_up && (filter === 'All' || x.place === filter)).sort((a, b) => a.use_by.localeCompare(b.use_by))
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 30, fontWeight: 600 }}>Products</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{['All', ...PLACES].map(p => <button key={p} onClick={() => setFilter(p)} style={{ height: 40, padding: '0 14px', borderRadius: 999, fontWeight: 600, fontSize: 15, border: '1.5px solid var(--mborder)', background: filter === p ? 'var(--accent)' : 'transparent', color: filter === p ? 'var(--on-accent)' : 'var(--ink)' }}>{p}</button>)}</div>
        <div style={{ flex: 1, minWidth: 0 }} />
        <button className="btn small outline" style={{ whiteSpace: 'nowrap' }} onClick={() => setForm(blank)}>Type it in</button>
        <button className="btn small" style={{ whiteSpace: 'nowrap' }} disabled={scanning} onClick={() => file.current?.click()}>{scanning ? 'Reading…' : 'Scan product'}</button>
        <input ref={file} type="file" accept="image/*" capture="environment" multiple hidden onChange={e => onPhoto(e.target.files)} />
      </div>
      {err && <div style={{ fontSize: 15, color: 'var(--late)' }}>{err}</div>}
      <div className="card scroll" style={{ flex: 1, minHeight: 0, padding: '8px 24px' }}>
        {list.length === 0 && <div className="muted" style={{ padding: 20, fontSize: 17 }}>Nothing here yet. Tap Scan product and take a photo of the front label, or Type it in.</div>}
        {list.map(p => { const st = productStatus(p.use_by, t); return (
          <div key={p.id} onClick={() => setForm({ id: p.id, name: p.name, type: p.type, place: p.place, opened: p.opened, printed: p.printed_expiry ?? '', months: String(p.shelf_months) })} style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 66, borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 20, fontWeight: 600 }}>{p.name}</div><div className="muted" style={{ fontSize: 14 }}>{p.type} · {p.place} · opened {fmtShort(p.opened)}</div></div>
            <div style={{ width: 120, fontSize: 17, fontWeight: 600 }}>{fmtShort(p.use_by)}</div>
            <span style={{ fontSize: 14, fontWeight: 600, borderRadius: 999, padding: '5px 12px', ...toneStyle(st.tone) }}>{st.label}</span>
          </div>) })}
      </div>
      {form && (
        <div role="dialog" aria-label="Product" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
          <div className="card" style={{ width: 680, maxHeight: '92vh', overflow: 'auto', padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{form.id ? 'Edit product' : 'New product'}</div>
            {form.note && <div className="muted" style={{ fontSize: 14 }}>Gemini says: {form.note}. Please check the details.</div>}
            <label style={{ fontWeight: 600 }}>Name<input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{TYPES.map(x => <button key={x} onClick={() => setForm({ ...form, type: x, months: form.id ? form.months : String(SHELF[x]) })} style={{ height: 40, padding: '0 14px', borderRadius: 999, fontWeight: 600, border: '1.5px solid var(--mborder)', background: form.type === x ? 'var(--accent)' : 'transparent', color: form.type === x ? 'var(--on-accent)' : 'var(--ink)' }}>{x}</button>)}</div>
            <div style={{ display: 'flex', gap: 8 }}>{PLACES.map(x => <button key={x} onClick={() => setForm({ ...form, place: x })} style={{ height: 40, padding: '0 14px', borderRadius: 999, fontWeight: 600, border: '1.5px solid var(--mborder)', background: form.place === x ? 'var(--accent)' : 'transparent', color: form.place === x ? 'var(--on-accent)' : 'var(--ink)' }}>{x}</button>)}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ flex: 1, fontWeight: 600 }}>Opened on<input type="date" value={form.opened} onChange={e => setForm({ ...form, opened: e.target.value })} /></label>
              <label style={{ flex: 1, fontWeight: 600 }}>Printed expiry<input type="date" value={form.printed} onChange={e => setForm({ ...form, printed: e.target.value })} /></label>
              <label style={{ width: 150, fontWeight: 600 }}>Use within (months)<input type="number" min={1} value={form.months} onChange={e => setForm({ ...form, months: e.target.value })} /></label>
            </div>
            {form.opened && <div className="muted" style={{ fontSize: 15 }}>Use by: <b>{fmtShort(useBy(form.opened, Math.max(1, Number(form.months) || SHELF[form.type] || 12), form.printed || null))}</b> (the earlier of the opened date plus shelf life, or the printed date)</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              {form.id && <button className="btn small outline" onClick={() => remove(form.id!)}>Delete</button>}
              {form.id && <button className="btn small outline" onClick={() => { const p = items.find(x => x.id === form.id); if (p) { const u = { ...p, used_up: true }; const next = items.map(x => x.id === u.id ? u : x); setItems(next); setForm(null); persist(next, { upsert: u }).catch(() => setErr('Could not save.')) } }}>Used up</button>}
              <div style={{ flex: 1 }} />
              <button className="btn small outline" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn small" disabled={!form.name.trim() || !form.opened} onClick={() => save(form)}>Save product</button>
            </div>
          </div>
        </div>)}
    </div>
  )
}
