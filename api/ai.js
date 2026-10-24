import { gemini, requireUser } from './_gemini.js'

const SYSTEM = `You are the friendly helper inside a couple's home hub app (Linh Chi and Michael, Melbourne, Australia).
Be warm, practical and brief. Use plain text with short lines, no markdown tables.
For money, give general information only, never personal financial advice. For health, suggest seeing a professional when unsure.`

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return }
  try {
    if (!(await requireUser(req, res))) return
    const msgs = Array.isArray(req.body?.messages) ? req.body.messages.slice(-20) : []
    if (!msgs.length) { res.status(400).json({ error: 'No message' }); return }
    const contents = msgs.map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: String(m.text).slice(0, 8000) }] }))
    const text = await gemini({ system: SYSTEM + (req.body?.system ? '\n' + String(req.body.system).slice(0, 2000) : ''), contents })
    res.status(200).json({ text })
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Something went wrong' })
  }
}
