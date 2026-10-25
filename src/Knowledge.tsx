import { useEffect, useMemo, useRef, useState } from 'react'
import { logError } from './lib/errorlog.ts'
import { askAI } from './lib/ai.ts'
import { factsOf, hasThisWeek, loadBank, refill, speechesOf, talksOf, type BankKind, type BankRow } from './lib/bank.ts'
import { today } from './lib/dates.ts'
import {
  dailyIndex, goodreadsBooks, type BankSpeech, type BankTalk, FALLBACK_FACTS, SETTINGS, TOPICS, fmtMinutes, loadKnowledge, parseDialogue, parseFact, pickRandom, saveKnowledge, shuffled, speakMinutes, wordCount,
  type Dialogue, type Fact, type KItem, type KKind,
} from './lib/knowledge.ts'

type Sub = 'books' | 'speaking' | 'talk' | 'facts'
const MIGRATION_HINT = 'Could not load or save. Has 012_knowledge.sql been run in Supabase?'
/** Today's date, updating by itself after midnight (the door iPad stays open for days). */
function useToday() {
  const [d, setD] = useState(today())
  useEffect(() => { const id = setInterval(() => setD(today()), 60000); return () => clearInterval(id) }, [])
  return d
}
const ask = (prompt: string, system?: string) => askAI([{ role: 'user', text: prompt }], system)

function Seg<T extends string>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="sub-tabs" style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--ground)', borderRadius: 999, overflowX: 'auto', maxWidth: '100%' }}>
      {options.map(([k, l]) => <button key={k} onClick={() => onChange(k)} aria-pressed={value === k} style={{ flex: 'none', whiteSpace: 'nowrap', height: 40, padding: '0 18px', borderRadius: 999, border: 'none', fontWeight: 600, fontSize: 15, background: value === k ? 'var(--accent)' : 'transparent', color: value === k ? 'var(--on-accent)' : 'var(--ink)' }}>{l}</button>)}
    </div>
  )
}

export function Knowledge() {
  const [sub, setSub] = useState<Sub>('books')
  const [items, setItems] = useState<KItem[]>([])
  const [err, setErr] = useState('')
  useEffect(() => { loadKnowledge().then(setItems).catch(e => { logError('Knowledge: loading', e); setErr(MIGRATION_HINT) }) }, [])
  const upsert = (it: KItem) => {
    const next = items.some(x => x.id === it.id) ? items.map(x => (x.id === it.id ? it : x)) : [...items, it]
    setItems(next); saveKnowledge(next, { upsert: it }).catch(e => { logError('Knowledge: saving', e); setErr(MIGRATION_HINT) })
  }
  const remove = (id: string) => {
    const next = items.filter(x => x.id !== id); setItems(next)
    saveKnowledge(next, { remove: id }).catch(e => { logError('Knowledge: removing', e); setErr('Could not remove.') })
  }
  const make = (kind: KKind, f: Partial<KItem>): KItem => {
    const same = items.filter(x => x.kind === kind)
    return { id: `${kind}-${Date.now().toString(36)}`, kind, title: '', sub: '', cat: '', body: '', num: 0, num2: 0, sort: (same[same.length - 1]?.sort ?? 0) + 1, ...f }
  }
  const upsertMany = (list: KItem[]) => {
    const ids = new Set(list.map(x => x.id))
    const next = [...items.filter(x => !ids.has(x.id)), ...list]
    setItems(next); saveKnowledge(next, { many: list }).catch(e => { logError('Knowledge: importing', e); setErr(MIGRATION_HINT) })
  }
  const of = (k: KKind) => items.filter(x => x.kind === k)
  // weekly practice bank
  const [bank, setBank] = useState<BankRow[]>([])
  const [bankMsg, setBankMsg] = useState('')
  const [filling, setFilling] = useState(false)
  const started = useRef(false)
  const fill = async (kinds: BankKind[], start: BankRow[], manual: boolean) => {
    setFilling(true); setBankMsg(''); let all = start
    for (const k of kinds) {
      try { all = await refill(k, all, manual); setBank(all) }
      catch (e) { setBankMsg((e as Error).message.includes('knowledge_bank') ? 'Run 013_knowledge_bank.sql in Supabase to keep a weekly bank.' : 'Could not fill the weekly bank right now. It will try again later.') }
    }
    setFilling(false)
  }
  useEffect(() => {
    if (started.current) return; started.current = true
    loadBank().then(rows => { setBank(rows); const need = (['fact', 'talk', 'speech'] as BankKind[]).filter(k => !hasThisWeek(rows, k)); if (need.length) fill(need, rows, false) })
      .catch(() => setBankMsg('Run 013_knowledge_bank.sql in Supabase to keep a weekly bank.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const facts = useMemo(() => factsOf(bank), [bank]), talks = useMemo(() => talksOf(bank), [bank]), speeches = useMemo(() => speechesOf(bank), [bank])
  const show = (s: Sub) => ({ display: sub === s ? 'block' : 'none' } as const)
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="mc-head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 36, fontWeight: 600 }}>Knowledge</div>
        <Seg<Sub> options={[['books', 'Books'], ['speaking', 'Public speaking'], ['talk', 'Small talk'], ['facts', 'Random facts']]} value={sub} onChange={setSub} />
      </div>
      {err && <div style={{ fontSize: 14, color: 'var(--late)' }}>{err}</div>}
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <div style={show('books')}><Books books={of('book')} upsert={upsert} remove={remove} make={make} upsertMany={upsertMany} /></div>
        <div style={show('speaking')}><Scripts scripts={of('script')} upsert={upsert} remove={remove} make={make} bank={speeches} /></div>
        <div style={show('talk')}><SmallTalk bank={talks} /></div>
        <div style={show('facts')}><Facts bank={facts} /></div>
        {sub !== 'books' && (
          <div className="muted" style={{ fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
            <span>Practice bank: {facts.length} facts · {talks.length} chats · {speeches.length} speeches. A new batch is added every week.</span>
            <button className="btn small outline" style={{ height: 32, fontSize: 13 }} disabled={filling} onClick={() => fill(sub === 'facts' ? ['fact'] : sub === 'talk' ? ['talk'] : ['speech'], bank, true)}>{filling ? 'Adding…' : 'Add more now'}</button>
            {bankMsg && <span style={{ color: 'var(--late)' }}>{bankMsg}</span>}
          </div>)}
      </div>
    </div>
  )
}

interface Ops { upsert: (i: KItem) => void; remove: (id: string) => void; make: (k: KKind, f: Partial<KItem>) => KItem }

// ================= Books =================
const STATUSES: [string, string][] = [['reading', 'Reading'], ['want', 'Want to read'], ['done', 'Finished']]
function Books({ books, upsert, remove, make, upsertMany }: { books: KItem[]; upsertMany: (l: KItem[]) => void } & Ops) {
  const file = useRef<HTMLInputElement>(null)
  const [imp, setImp] = useState('')
  const importCsv = async (f: File | undefined) => {
    if (!f) return
    const list = goodreadsBooks(await f.text())
    if (!list.length) { setImp('That file does not look like a Goodreads export.'); return }
    const key = (t: string, a: string) => (t + '|' + a).toLowerCase().trim()
    const have = new Map(books.map(b => [key(b.title, b.sub), b]))
    let added = 0, updated = 0; let sort = Math.max(0, ...books.map(b => b.sort))
    const out: KItem[] = list.map((g, i) => {
      const old = have.get(key(g.title, g.author))
      if (old) { updated++; return { ...old, cat: g.status, num2: g.rating || old.num2, num: g.status === 'done' ? 100 : old.num, body: old.body || g.review } }
      added++; return { id: `book-gr-${Date.now().toString(36)}-${i}`, kind: 'book', title: g.title, sub: g.author, cat: g.status, body: g.review, num: g.status === 'done' ? 100 : 0, num2: g.rating, sort: ++sort }
    })
    upsertMany(out); setImp(`Imported from Goodreads: ${added} new, ${updated} updated.`)
  }
  const [tab, setTab] = useState('reading')
  const [title, setTitle] = useState(''); const [author, setAuthor] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const list = books.filter(b => (b.cat || 'want') === tab)
  const cur = books.find(b => b.id === open)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Seg options={STATUSES.map(([k, l]) => [k, `${l} (${books.filter(b => (b.cat || 'want') === k).length})`] as [string, string])} value={tab} onChange={setTab} />
      <div className="card" style={{ padding: '6px 22px' }}>
        {list.length === 0 && <div className="muted" style={{ padding: '18px 0', fontSize: 16 }}>Nothing here yet. Add a book below.</div>}
        {list.map(b => (
          <div key={b.id} className="row" role="button" onClick={() => setOpen(b.id)} style={{ minHeight: 64, cursor: 'pointer' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 600 }}>{b.cat === 'done' && <span aria-label="Read" style={{ color: 'var(--accent)', marginRight: 6 }}>★</span>}{b.title}</div>
              <div className="muted" style={{ fontSize: 14 }}>{b.sub || 'Unknown author'}{b.cat === 'done' && b.num2 > 0 ? ` · ${'★'.repeat(b.num2)}` : ''}</div>
            </div>
            {b.cat === 'reading' && <div style={{ width: 110 }}><div style={{ height: 8, borderRadius: 8, background: 'var(--faint)' }}><div style={{ height: 8, borderRadius: 8, width: `${b.num}%`, background: 'var(--accent)' }} /></div><div className="muted" style={{ fontSize: 12, textAlign: 'right' }}>{Math.round(b.num)}%</div></div>}
            {b.body.trim() && <span className="muted" style={{ fontSize: 13 }}>notes</span>}
          </div>
        ))}
      </div>
      <form className="card" style={{ display: 'flex', gap: 8, padding: 14, flexWrap: 'wrap' }} onSubmit={e => { e.preventDefault(); if (title.trim()) { upsert(make('book', { title: title.trim(), sub: author.trim(), cat: tab })); setTitle(''); setAuthor('') } }}>
        <input type="text" placeholder="Book title" value={title} onChange={e => setTitle(e.target.value)} style={{ flex: '2 1 200px', minWidth: 0 }} />
        <input type="text" placeholder="Author" value={author} onChange={e => setAuthor(e.target.value)} style={{ flex: '1 1 150px', minWidth: 0 }} />
        <button className="btn small" type="submit">Add book</button>
      </form>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn small outline" onClick={() => file.current?.click()}>Import from Goodreads</button>
        <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={e => { importCsv(e.target.files?.[0]); e.target.value = '' }} />
        <span className="muted" style={{ fontSize: 13 }}>{imp || 'On goodreads.com: My Books → Import and export → Export library, then choose that file here.'}</span>
      </div>
      {cur && <BookDialog key={cur.id} book={cur} onClose={() => setOpen(null)} onSave={upsert} onDelete={() => { if (confirm(`Delete "${cur.title}"?`)) { remove(cur.id); setOpen(null) } }} />}
    </div>
  )
}

function BookDialog({ book, onSave, onDelete, onClose }: { book: KItem; onSave: (b: KItem) => void; onDelete: () => void; onClose: () => void }) {
  const [d, setD] = useState<KItem>({ ...book, cat: book.cat || 'want' })
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  const ideas = async () => {
    setBusy(true); setMsg('')
    try {
      const a = await ask(`Give me the 4 to 5 key ideas from the book "${d.title}"${d.sub ? ` by ${d.sub}` : ''}, one short line each, then one line starting "Speaking tip:" on how it could improve my communication. If you do not know this book well, say so plainly instead of guessing.`)
      setD({ ...d, body: (d.body.trim() ? d.body.trim() + '\n\n' : '') + 'Key ideas (AI, double-check):\n' + a })
    } catch (e) { logError('Knowledge: book ideas', e); setMsg((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="overlay" onClick={onClose}><div className="dialog" style={{ width: 640, maxHeight: '92dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
      <input type="text" aria-label="Title" value={d.title} onChange={e => setD({ ...d, title: e.target.value })} style={{ fontSize: 24, fontWeight: 600 }} />
      <input type="text" aria-label="Author" placeholder="Author" value={d.sub} onChange={e => setD({ ...d, sub: e.target.value })} />
      <Seg options={STATUSES} value={d.cat} onChange={v => setD({ ...d, cat: v, num: v === 'done' ? 100 : d.num })} />
      {d.cat === 'reading' && <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>Progress<input type="range" min={0} max={100} value={d.num} onChange={e => setD({ ...d, num: Number(e.target.value) })} style={{ flex: 1 }} /><b style={{ width: 44 }}>{Math.round(d.num)}%</b></label>}
      {d.cat === 'done' && <div style={{ display: 'flex', gap: 6 }} aria-label="Rating">{[1, 2, 3, 4, 5].map(n => <button key={n} aria-label={`${n} stars`} onClick={() => setD({ ...d, num2: d.num2 === n ? 0 : n })} style={{ border: 'none', background: 'none', fontSize: 30, color: n <= d.num2 ? 'var(--accent)' : 'var(--border)' }}>★</button>)}</div>}
      <textarea aria-label="Notes" rows={8} placeholder="Your notes and favourite lines" value={d.body} onChange={e => setD({ ...d, body: e.target.value })} style={{ width: '100%', borderRadius: 16, border: '2px solid var(--border)', padding: 12, fontSize: 16, fontFamily: 'inherit', background: 'var(--card)', color: 'var(--ink)' }} />
      {msg && <div style={{ fontSize: 14, color: 'var(--late)' }}>{msg}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn small outline" onClick={onDelete}>Delete</button>
        <button className="btn small outline" disabled={busy || !d.title.trim()} onClick={ideas}>{busy ? 'Thinking…' : 'Key ideas (AI)'}</button>
        <div style={{ flex: 1 }} />
        <button className="btn small ghost" onClick={onClose}>Cancel</button>
        <button className="btn small" disabled={!d.title.trim()} onClick={() => { onSave({ ...d, title: d.title.trim() }); onClose() }}>Save</button>
      </div>
    </div></div>
  )
}

// ================= Public speaking =================
const OCCASIONS = ['Presentation', 'Toast or speech', 'Pitch', 'Interview answer', 'Team update', 'Other']
function Scripts({ scripts, upsert, remove, make, bank }: { scripts: KItem[]; bank: BankSpeech[] } & Ops) {
  const [open, setOpen] = useState<string | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  const [full, setFull] = useState(false)
  const [prompt, setPrompt] = useState(false)
  const day = useToday()
  useEffect(() => { setPick(null) }, [day])
  const idx = pick ?? dailyIndex(day, 'speech', bank.length)
  const piece = bank[idx]
  const cur = scripts.find(s => s.id === open)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {piece && (
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="muted" style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5 }}>{pick === null ? "TODAY'S PRACTICE" : 'PRACTICE PIECE'} · {piece.occasion.toUpperCase()}</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{piece.title}</div>
          <div style={{ fontSize: 17, lineHeight: 1.55, whiteSpace: 'pre-wrap', ...(full ? {} : { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }}>{piece.text}</div>
          <button onClick={() => setFull(!full)} style={{ alignSelf: 'flex-start', border: 'none', background: 'none', padding: 0, color: 'var(--accent)', fontWeight: 600 }}>{full ? 'Show less' : 'Show all'}</button>
          {piece.focus && <div style={{ fontSize: 15 }}><b>Focus: </b>{piece.focus}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn small" onClick={() => setPrompt(true)}>Practise</button>
            <button className="btn small outline" onClick={() => upsert(make('script', { title: piece.title, cat: OCCASIONS.includes(piece.occasion) ? piece.occasion : 'Other', body: piece.text, num: 1 }))}>Save to my scripts</button>
            {bank.length > 1 && <button className="btn small outline" onClick={() => { let n = idx; while (n === idx) n = Math.floor(Math.random() * bank.length); setPick(n); setFull(false) }}>Another</button>}
          </div>
          {prompt && <Teleprompter text={piece.text} onClose={() => setPrompt(false)} />}
        </div>)}
      <div className="muted" style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, marginTop: 4 }}>MY SCRIPTS</div>
      <div className="card" style={{ padding: '6px 22px' }}>
        {scripts.length === 0 && <div className="muted" style={{ padding: '18px 0', fontSize: 16 }}>No scripts yet. Write your first one, then practise it in the teleprompter.</div>}
        {scripts.map(s => { const w = wordCount(s.body); return (
          <div key={s.id} className="row" role="button" onClick={() => setOpen(s.id)} style={{ minHeight: 64, cursor: 'pointer' }}>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 19, fontWeight: 600 }}>{s.title || 'Untitled'}</div><div className="muted" style={{ fontSize: 14 }}>{s.cat || 'Other'} · {w} words · about {fmtMinutes(speakMinutes(w))}</div></div>
          </div>) })}
      </div>
      <div><button className="btn small" onClick={() => { const n = make('script', { title: 'New script', cat: OCCASIONS[0], num: 5 }); upsert(n); setOpen(n.id) }}>+ New script</button></div>
      {cur && <ScriptEditor key={cur.id} script={cur} onClose={() => setOpen(null)} onSave={upsert} onDelete={() => { if (confirm(`Delete "${cur.title}"?`)) { remove(cur.id); setOpen(null) } }} />}
    </div>
  )
}

function ScriptEditor({ script, onSave, onDelete, onClose }: { script: KItem; onSave: (s: KItem) => void; onDelete: () => void; onClose: () => void }) {
  const [d, setD] = useState<KItem>(script)
  const [ai, setAi] = useState(''); const [aiKind, setAiKind] = useState<'feedback' | 'polish' | ''>('')
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  const [prompter, setPrompter] = useState(false)
  const words = wordCount(d.body); const mins = speakMinutes(words)
  const run = async (kind: 'feedback' | 'polish') => {
    setBusy(true); setMsg(''); setAi(''); setAiKind(kind)
    const base = `This is my ${d.cat || 'speech'} script${d.num ? ` (target ${d.num} minutes)` : ''}. Write in Australian English.\n\n${d.body}`
    try {
      setAi(await ask(kind === 'feedback'
        ? `${base}\n\nGive me coaching feedback: what works, the 3 most important things to improve (structure, clarity, filler words, opening and closing), and whether the length suits the target. Be specific and kind. Plain text, short lines.`
        : `${base}\n\nRewrite it to be clearer and more engaging while keeping my voice, my meaning and roughly the same length. Use short spoken sentences. Return only the rewritten script.`))
    } catch (e) { logError('Knowledge: script AI', e); setMsg((e as Error).message) } finally { setBusy(false) }
  }
  const save = () => { onSave({ ...d, title: d.title.trim() || 'Untitled' }); onClose() }
  return (
    <div className="overlay" onClick={() => { onSave(d); onClose() }}><div className="dialog" style={{ width: 860, maxHeight: '94dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input type="text" aria-label="Title" value={d.title} onChange={e => setD({ ...d, title: e.target.value })} style={{ flex: '2 1 220px', fontSize: 22, fontWeight: 600 }} />
        <select aria-label="Occasion" value={d.cat} onChange={e => setD({ ...d, cat: e.target.value })} style={{ flex: '1 1 160px' }}>{OCCASIONS.map(o => <option key={o}>{o}</option>)}</select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Target min<input type="number" min={1} value={d.num || ''} onChange={e => setD({ ...d, num: Number(e.target.value) || 0 })} style={{ width: 80 }} /></label>
      </div>
      <textarea aria-label="Script" rows={12} placeholder="Write or paste your script here" value={d.body} onChange={e => setD({ ...d, body: e.target.value })} style={{ width: '100%', borderRadius: 16, border: '2px solid var(--border)', padding: 14, fontSize: 18, lineHeight: 1.5, fontFamily: 'inherit', background: 'var(--card)', color: 'var(--ink)' }} />
      <div className="muted" style={{ fontSize: 15 }}>{words} words · about {fmtMinutes(mins)} at a calm pace{d.num > 0 && words > 0 ? (mins > d.num * 1.1 ? ` · ${fmtMinutes(mins - d.num)} over your target` : mins < d.num * 0.8 ? ` · ${fmtMinutes(d.num - mins)} under your target` : ' · right on target') : ''}</div>
      {msg && <div style={{ fontSize: 14, color: 'var(--late)' }}>{msg}</div>}
      {busy && <div className="muted" style={{ fontSize: 15 }}>Thinking…</div>}
      {ai && (
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1 }} className="muted">{aiKind === 'feedback' ? 'COACHING FEEDBACK' : 'POLISHED VERSION'}</div>
          <div style={{ fontSize: 16, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{ai}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {aiKind === 'polish' && <button className="btn small" onClick={() => { setD({ ...d, body: ai }); setAi('') }}>Use this version</button>}
            <button className="btn small outline" onClick={() => setAi('')}>Dismiss</button>
          </div>
        </div>)}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn small" disabled={!d.body.trim()} onClick={() => setPrompter(true)}>Practise</button>
        <button className="btn small outline" disabled={busy || !d.body.trim()} onClick={() => run('feedback')}>Get feedback</button>
        <button className="btn small outline" disabled={busy || !d.body.trim()} onClick={() => run('polish')}>Polish it</button>
        <div style={{ flex: 1 }} />
        <button className="btn small outline" onClick={onDelete}>Delete</button>
        <button className="btn small" onClick={save}>Save</button>
      </div>
      {prompter && <Teleprompter text={d.body} onClose={() => setPrompter(false)} />}
    </div></div>
  )
}

function Teleprompter({ text, onClose }: { text: string; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(40) // pixels a second
  const [secs, setSecs] = useState(0)
  const [size, setSize] = useState(36)
  useEffect(() => {
    if (!playing) return
    let raf = 0; let last = performance.now(); let acc = 0
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now; acc += speed * dt
      const el = box.current
      if (el && acc >= 1) { el.scrollTop += Math.floor(acc); acc -= Math.floor(acc) }
      setSecs(s => s + dt)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed])
  const mm = Math.floor(secs / 60), ss = Math.floor(secs % 60)
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#111', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div ref={box} onClick={() => setPlaying(p => !p)} style={{ flex: 1, overflowY: 'auto', padding: '30vh 7vw 60vh', fontSize: size, lineHeight: 1.5, fontWeight: 500, whiteSpace: 'pre-wrap' }}>{text}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: '#1c1c1e', flexWrap: 'wrap' }}>
        <button className="btn small" onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Start scrolling'}</button>
        <label style={{ color: '#ddd', display: 'flex', alignItems: 'center', gap: 6 }}>Speed<input type="range" min={10} max={140} value={speed} onChange={e => setSpeed(Number(e.target.value))} /></label>
        <label style={{ color: '#ddd', display: 'flex', alignItems: 'center', gap: 6 }}>Text<input type="range" min={24} max={64} value={size} onChange={e => setSize(Number(e.target.value))} /></label>
        <span style={{ color: '#ddd', fontVariantNumeric: 'tabular-nums' }}>{mm}:{String(ss).padStart(2, '0')}</span>
        <div style={{ flex: 1 }} />
        <button className="btn small outline" onClick={() => { if (box.current) box.current.scrollTop = 0; setSecs(0); setPlaying(false) }}>Restart</button>
        <button className="btn small outline" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}

// ================= Small talk =================
function SmallTalk({ bank }: { bank: BankTalk[] }) {
  const [topic, setTopic] = useState('')
  const [setting, setSetting] = useState('')
  const [convo, setConvo] = useState<Dialogue | null>(null)
  const [daily, setDaily] = useState(false)
  const day = useToday(); const shownDay = useRef('')
  const fromBank = (t: BankTalk, isDaily: boolean) => { setTopic(t.topic); setSetting(t.setting); setConvo({ lines: t.lines, tip: t.tip, phrases: t.phrases }); setShown(new Set()); setMode('read'); setDaily(isDaily); setErr('') }
  useEffect(() => { if (bank.length && shownDay.current !== day) { shownDay.current = day; fromBank(bank[dailyIndex(day, 'talk', bank.length)], true) } }, [bank, day]) // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const [mode, setMode] = useState<'read' | 'first' | 'second'>('read')
  const [shown, setShown] = useState<Set<number>>(new Set())
  const [ideas, setIdeas] = useState<string[]>(() => shuffled(TOPICS, 6))
  const recent = useRef<string[]>([])
  const generate = async (t: string, st: string) => {
    setTopic(t); setSetting(st); setBusy(true); setErr(''); setShown(new Set()); setMode('read'); setDaily(false)
    try {
      const raw = await ask(`Write a natural, friendly small-talk conversation between two people ${st}. Topic: ${t}. Use Australian English, an easy casual tone, 8 to 10 short lines in total, with each person asking a question and sharing something so the chat keeps flowing.
Format every line exactly as "Name: text" using only two first names. Then add one line starting "TIP:" with one communication skill this conversation shows. Then one line starting "PHRASES:" with 3 handy phrases separated by |. No other text.`)
      const d = parseDialogue(raw)
      if (d.lines.length < 4) throw new Error('The AI answered in an unexpected way. Try again.')
      setConvo(d)
    } catch (e) { logError('Knowledge: small talk', e); setErr((e as Error).message); setConvo(null) } finally { setBusy(false) }
  }
  const surprise = () => {
    if (bank.length > 1) { const cur = bank.findIndex(b => b.topic === topic); let n = cur; while (n === cur) n = Math.floor(Math.random() * bank.length); fromBank(bank[n], false); return }
    const t = pickRandom(TOPICS, recent.current); recent.current = [...recent.current.slice(-12), t]
    generate(t, pickRandom(SETTINGS))
  }
  const names = useMemo(() => { const n: string[] = []; for (const l of convo?.lines ?? []) if (!n.includes(l.who)) n.push(l.who); return n }, [convo])
  const hidden = (i: number) => { if (!convo || mode === 'read' || shown.has(i)) return false; return convo.lines[i].who === names[mode === 'first' ? 0 : 1] }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="muted" style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5 }}>{daily ? "TODAY'S TOPIC" : 'TOPIC'}</div>
        <div style={{ fontSize: 26, fontWeight: 600 }}>{topic || 'Pick a topic or tap Surprise me'}</div>
        {setting && <div className="muted" style={{ fontSize: 15 }}>Two people {setting}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn small" disabled={busy} onClick={surprise}>{busy ? 'Writing…' : 'Surprise me'}</button>
          {topic && <button className="btn small outline" disabled={busy} onClick={() => generate(topic, pickRandom(SETTINGS, [setting]))}>Same topic, new chat (AI)</button>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {ideas.map(t => <button key={t} disabled={busy} onClick={() => generate(t, pickRandom(SETTINGS))} style={{ height: 36, padding: '0 14px', borderRadius: 999, border: '1.5px solid var(--mborder)', background: topic === t ? 'var(--accent)' : 'transparent', color: topic === t ? 'var(--on-accent)' : 'var(--ink)', fontSize: 14, fontWeight: 600 }}>{t}</button>)}
          <button aria-label="More topics" className="btn small outline" style={{ height: 36 }} onClick={() => setIdeas(shuffled(TOPICS, 6))}>More topics</button>
        </div>
      </div>
      {err && <div style={{ fontSize: 15, color: 'var(--late)' }}>{err}</div>}
      {convo && (
        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Seg<'read' | 'first' | 'second'> options={[['read', 'Read it'], ['first', `Practise as ${names[0]}`], ['second', `Practise as ${names[1] ?? 'B'}`]]} value={mode} onChange={m => { setMode(m); setShown(new Set()) }} />
          {convo.lines.map((l, i) => {
            const right = l.who !== names[0]; const hide = hidden(i)
            return (
              <div key={i} style={{ display: 'flex', justifyContent: right ? 'flex-end' : 'flex-start' }}>
                <div role={hide ? 'button' : undefined} onClick={() => hide && setShown(new Set(shown).add(i))} style={{ maxWidth: '82%', padding: '10px 14px', borderRadius: 18, cursor: hide ? 'pointer' : 'default', background: right ? 'var(--accent)' : 'var(--ground)', color: right ? 'var(--on-accent)' : 'var(--ink)', borderBottomRightRadius: right ? 6 : 18, borderBottomLeftRadius: right ? 18 : 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, opacity: .75 }}>{l.who}</div>
                  <div style={{ fontSize: 17, lineHeight: 1.4 }}>{hide ? 'Your turn. Say it out loud, then tap to check.' : l.text}</div>
                </div>
              </div>)
          })}
          {convo.tip && <div style={{ fontSize: 15, marginTop: 6 }}><b>Skill: </b>{convo.tip}</div>}
          {convo.phrases.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{convo.phrases.map(p => <span key={p} className="pill" style={{ background: 'var(--ground)', border: '1px solid var(--border)', fontSize: 14 }}>{p}</span>)}</div>}
        </div>)}
    </div>
  )
}

// ================= Random facts =================
function Facts({ bank }: { bank: Fact[] }) {
  const [fact, setFact] = useState<Fact | null>(null)
  const [daily, setDaily] = useState(false)
  const [busy, setBusy] = useState(false); const [note, setNote] = useState('')
  const seen = useRef<string[]>([])
  const day = useToday(); const shownDay = useRef('')
  useEffect(() => { if (bank.length && shownDay.current !== day) { shownDay.current = day; const f = bank[dailyIndex(day, 'fact', bank.length)]; setFact(f); setDaily(true); seen.current.push(f.text) } }, [bank, day])
  const next = async () => {
    setNote(''); setDaily(false)
    const pool = bank.filter(f => f.text !== fact?.text)
    if (pool.length) {
      const fresh = pool.filter(f => !seen.current.includes(f.text)); const from = fresh.length ? fresh : pool
      const f = from[Math.floor(Math.random() * from.length)]; setFact(f); seen.current.push(f.text); return
    }
    setBusy(true)
    try {
      const raw = await ask(`Tell me one surprising, true and well-documented fact. Do not repeat any of these: ${seen.current.slice(-12).join(' | ') || 'none yet'}. If you are not certain a fact is true, choose a different one.
Format: one line starting "FACT:" (at most 2 sentences) and one line starting "WHY:" (one sentence on why it is true or interesting). No other text.`)
      const f = parseFact(raw, 'Any'); setFact(f); seen.current.push(f.text)
    } catch {
      const f = pickRandom(FALLBACK_FACTS, FALLBACK_FACTS.filter(x => seen.current.includes(x.text)))
      setFact({ ...f, cat: 'Any' }); seen.current.push(f.text); setNote('The AI is busy, so this one is from the built-in list.')
    } finally { setBusy(false) }
  }
  return (
    <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 200 }}>
      {fact ? (
        <>
          {daily && <div className="muted" style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5 }}>TODAY'S FACT</div>}
          <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.3 }}>{fact.text}</div>
          {fact.why && <div className="muted" style={{ fontSize: 17, lineHeight: 1.5 }}>{fact.why}</div>}
          {note && <div className="muted" style={{ fontSize: 13 }}>{note}</div>}
        </>
      ) : <div className="muted" style={{ fontSize: 18 }}>Tap the button for a random fact you can share in a conversation.</div>}
      <div style={{ marginTop: 'auto' }}>
        <button className="btn small" disabled={busy} onClick={next}>{busy ? 'Finding one…' : fact ? 'Another fact' : 'Show me a fact'}</button>
      </div>
    </div>
  )
}
