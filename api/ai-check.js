import { callGemini, modelList } from './_gemini.js'

// Open /api/ai-check in a browser to see whether the Gemini key works. Shows no secrets.
export default async function handler(req, res) {
  const out = { keySet: !!process.env.GEMINI_API_KEY, keyLength: (process.env.GEMINI_API_KEY || '').length, tried: [] }
  if (out.keySet) {
    for (const m of modelList()) {
      const r = await callGemini(m, { contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }] })
      out.tried.push({ model: m, status: r.status, message: r.message.slice(0, 200) })
      if (r.status === 200) { out.works = true; out.model = m; break }
    }
  }
  res.status(200).json(out)
}
