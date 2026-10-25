// Pure helpers for the Knowledge tab (no database code, so tests can import them).
// ---- small helpers ----
export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)
/** Comfortable public speaking pace is about 130 words a minute. */
export const speakMinutes = (words: number) => words / 130
export const fmtMinutes = (m: number) => (m < 1 ? `${Math.max(1, Math.round(m * 60))} sec` : `${Math.round(m * 10) / 10} min`)
export const pickRandom = <T,>(arr: T[], avoid: T[] = []): T => {
  const pool = arr.filter(x => !avoid.includes(x)); const from = pool.length ? pool : arr
  return from[Math.floor(Math.random() * from.length)]
}
export const shuffled = <T,>(arr: T[], n: number): T[] => [...arr].sort(() => Math.random() - 0.5).slice(0, n)

// ---- small talk ----
export const TOPICS = [
  'Weekend plans', 'A recent trip', 'Favourite local coffee', 'The weather this week', 'A show everyone is watching', 'Working from home vs the office',
  'Best meal you have had lately', 'Learning a new skill', 'Pets', 'Moving to a new suburb', 'Hobbies that got out of hand', 'Public transport stories',
  'Cooking something new', 'Fitness and walking', 'A book or podcast you loved', 'Holidays coming up', 'Growing up in different places', 'Language learning',
  'Gardening and plants', 'A funny thing that happened this week', 'Favourite season', 'Best way to switch off', 'Music from your teenage years', 'Markets and food stalls',
  'Weekend day trips from Melbourne', 'Footy and sport', 'Starting a side project', 'A tiny home upgrade', 'Festivals and events', 'The best advice you were given',
  'Mornings: early bird or night owl', 'Photography', 'Favourite childhood food', 'Cafés versus cooking at home', 'Technology you could not live without', 'Volunteering and giving back',
  'Birthdays and traditions', 'Lunar New Year and family traditions', 'Beach or mountains', 'What you would do with an extra day',
]
export const SETTINGS = [
  'at a networking event', "at a friend's barbecue", 'in the office kitchen', 'at a family dinner', 'while waiting for a coffee', 'on a flight',
  "meeting a friend's partner for the first time", 'at farewell drinks', 'at a community class', 'in a queue at the market',
]
export interface Dialogue { lines: { who: string; text: string }[]; tip: string; phrases: string[] }
export function parseDialogue(raw: string): Dialogue {
  const lines: Dialogue['lines'] = []; let tip = ''; let phrases: string[] = []
  for (const l0 of raw.split('\n')) {
    const l = l0.replace(/[*_#>]/g, '').trim(); if (!l) continue
    let m = l.match(/^TIP:\s*(.+)$/i); if (m) { tip = m[1]; continue }
    m = l.match(/^PHRASES:\s*(.+)$/i); if (m) { phrases = m[1].split('|').map(x => x.trim()).filter(Boolean); continue }
    m = l.match(/^([^:]{1,24}):\s*(.+)$/); if (m) lines.push({ who: m[1].trim(), text: m[2].trim() })
  }
  return { lines, tip, phrases }
}

// ---- random facts ----
export const FACT_CATS = ['Any', 'Science', 'History', 'Nature', 'Space', 'Human body', 'Language', 'Food', 'Money habits', 'Vietnam and Asia']
export const FALLBACK_FACTS: { text: string; why: string }[] = [
  { text: 'Honey found in ancient Egyptian tombs, thousands of years old, was still safe to eat.', why: 'Its low water content and natural acidity stop bacteria from growing.' },
  { text: 'Octopuses have three hearts and blue blood.', why: 'Their copper-based blood carries oxygen well in cold, low-oxygen water.' },
  { text: 'Bananas are botanically berries, but strawberries are not.', why: 'Botanists define a berry by how the fruit develops from a single flower ovary.' },
  { text: 'A day on Venus is longer than its year.', why: 'Venus spins so slowly that one rotation takes longer than one orbit of the Sun.' },
  { text: 'Wombats produce cube-shaped droppings.', why: 'The shape stops them rolling away, which helps them mark territory.' },
  { text: 'Oxford University is older than the Aztec Empire.', why: 'Teaching in Oxford began in the 1090s, long before Tenochtitlan was founded.' },
  { text: 'Sharks existed before trees did.', why: 'Sharks are about 400 million years old, while the first trees appeared a little later.' },
  { text: 'The shortest war in recorded history, between Britain and Zanzibar in 1896, lasted under an hour.', why: 'The Sultan\'s forces were outgunned and the fighting ended in roughly 40 minutes.' },
  { text: 'Vietnam is one of the world\'s largest coffee producers.', why: 'Its highlands suit robusta beans, which are used in a lot of instant and espresso blends.' },
  { text: 'The Eiffel Tower can grow taller by several centimetres in summer.', why: 'The iron expands when it heats up in the sun.' },
  { text: 'Your stomach lining replaces itself every few days.', why: 'Strong acid constantly damages the surface, so new cells replace the old ones quickly.' },
  { text: 'Compound interest has been called the most powerful force in finance because growth builds on earlier growth.', why: 'Small, regular amounts left alone for decades end up far larger than the total you put in.' },
]
export interface Fact { text: string; why: string; cat: string }
export function parseFact(raw: string, cat: string): Fact {
  let text = '', why = ''
  for (const l0 of raw.split('\n')) {
    const l = l0.replace(/[*_#>]/g, '').trim(); if (!l) continue
    let m = l.match(/^FACT:\s*(.+)$/i); if (m) { text = m[1]; continue }
    m = l.match(/^WHY:\s*(.+)$/i); if (m) { why = m[1]; continue }
  }
  if (!text) text = raw.replace(/[*_#>]/g, '').trim()
  return { text, why, cat }
}

// ---- Goodreads import (My Books → Import and export → Export library) ----
/** Reads CSV text into rows of cells, handling quotes, commas and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(x => x.trim()))
}
export interface GrBook { title: string; author: string; status: 'reading' | 'want' | 'done'; rating: number; review: string; dateRead: string }
export function goodreadsBooks(csv: string): GrBook[] {
  const rows = parseCsv(csv.replace(/^﻿/, ''))
  if (rows.length < 2) return []
  const h = rows[0].map(x => x.trim().toLowerCase())
  const col = (name: string) => h.indexOf(name)
  const iT = col('title'), iA = col('author'), iR = col('my rating'), iS = col('exclusive shelf'), iV = col('my review'), iD = col('date read')
  if (iT < 0) return []
  return rows.slice(1).map(r => {
    const shelf = (r[iS] ?? '').trim().toLowerCase()
    return {
      title: (r[iT] ?? '').trim(),
      author: iA >= 0 ? (r[iA] ?? '').trim() : '',
      status: shelf === 'read' ? 'done' : shelf === 'currently-reading' ? 'reading' : 'want',
      rating: Math.max(0, Math.min(5, Number(r[iR]) || 0)),
      review: iV >= 0 ? (r[iV] ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim() : '',
      dateRead: iD >= 0 ? (r[iD] ?? '').trim() : '',
    } as GrBook
  }).filter(b => b.title)
}

// ---- weekly practice bank ----
export interface BankTalk { topic: string; setting: string; lines: { who: string; text: string }[]; tip: string; phrases: string[] }
export interface BankSpeech { title: string; occasion: string; text: string; focus: string }
/** Same pick all day, a different one tomorrow. */
export function dailyIndex(day: string, kind: string, n: number): number {
  let h = 0; for (const ch of day + kind) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return n ? h % n : 0
}
