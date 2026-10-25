// Fills the weekly practice bank for the Knowledge tab: facts, small talk conversations and practice speeches.
// The app calls this once a week per kind and saves the results in the database.
import { gemini, requireUser } from './_gemini.js'

const CATS = ['Science', 'History', 'Nature', 'Space', 'Human body', 'Language', 'Food', 'Money habits', 'Vietnam and Asia']
const SETTINGS = ['at a networking event', "at a friend's barbecue", 'in the office kitchen', 'at a family dinner', 'while waiting for a coffee', 'on a flight', "meeting a friend's partner for the first time", 'at farewell drinks', 'at a community class', 'in a queue at the market']

function prompt(kind, avoid, topics) {
  const no = avoid.length ? `\nDo not repeat any of these: ${avoid.slice(-40).join(' | ')}` : ''
  if (kind === 'fact') return `Return ONLY a JSON array of 10 surprising, true, well-documented facts spread across these categories: ${CATS.join(', ')}.
Each item: {"text": string (at most 2 sentences), "why": string (one sentence on why it is true or interesting), "cat": one of the categories}.
Only include facts you are certain are true. Australian English.${no}`
  if (kind === 'talk') return `Return ONLY a JSON array of 5 small-talk practice conversations in Australian English, casual and friendly.
Use these topics, one each: ${topics.join('; ')}. Pick a setting for each from: ${SETTINGS.join('; ')}.
Each item: {"topic": string, "setting": string, "lines": [{"who": first name, "text": string}] with 8 to 10 short lines between exactly two people who each ask questions and share something, "tip": one communication skill the chat shows, "phrases": [3 handy short phrases]}.${no}`
  return `Return ONLY a JSON array of 4 short practice speeches to read aloud, 120 to 180 words each, in Australian English, warm and natural.
Vary the occasions, for example: opening a work presentation, a birthday or wedding toast, a short team update, a 60-second self-introduction, telling a personal story, thanking someone.
Each item: {"title": string, "occasion": string, "text": string (the speech itself, short spoken sentences), "focus": one delivery tip to practise with it}.${no}`
}

const ok = {
  fact: x => x && typeof x.text === 'string' && x.text.length > 10,
  talk: x => x && Array.isArray(x.lines) && x.lines.length >= 4 && x.lines.every(l => l && typeof l.who === 'string' && typeof l.text === 'string'),
  speech: x => x && typeof x.text === 'string' && x.text.length > 80 && typeof x.title === 'string',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return }
  try {
    if (!(await requireUser(req, res))) return
    const kind = String(req.body?.kind || '')
    if (!ok[kind]) { res.status(400).json({ error: 'Unknown kind' }); return }
    const avoid = Array.isArray(req.body?.avoid) ? req.body.avoid.map(String).slice(-40) : []
    const topics = Array.isArray(req.body?.topics) ? req.body.topics.map(String).slice(0, 5) : []
    const text = await gemini({ contents: [{ role: 'user', parts: [{ text: prompt(kind, avoid, topics) }] }], json: true })
    let arr
    try { arr = JSON.parse(text.replace(/^```json|```$/g, '')) } catch { res.status(502).json({ error: 'The AI answered in an unexpected way.' }); return }
    if (!Array.isArray(arr)) arr = arr.items || arr.facts || arr.conversations || arr.speeches || []
    res.status(200).json({ items: arr.filter(ok[kind]) })
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Something went wrong' })
  }
}
