// Shared helpers for the Gemini server functions. The key lives in Vercel as GEMINI_API_KEY (never in the browser).
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest'

// Only signed-in household members may use the AI (stops strangers spending the free quota).
export async function requireUser(req, res) {
  const url = process.env.VITE_SUPABASE_URL, anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) return true // demo deployment without a database
  const token = (req.headers.authorization || '').replace(/^Bearer /, '')
  if (!token) { res.status(401).json({ error: 'Please sign in again.' }); return false }
  const r = await fetch(url + '/auth/v1/user', { headers: { apikey: anon, Authorization: 'Bearer ' + token } })
  if (!r.ok) { res.status(401).json({ error: 'Please sign in again.' }); return false }
  return true
}

export async function gemini({ system, contents, json }) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw Object.assign(new Error('GEMINI_API_KEY is not set in Vercel yet.'), { status: 500 })
  const body = { contents }
  if (system) body.systemInstruction = { parts: [{ text: system }] }
  if (json) body.generationConfig = { responseMimeType: 'application/json' }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body),
  })
  if (r.status === 429) throw Object.assign(new Error('The free AI limit was reached for now. Try again in a little while.'), { status: 429 })
  if (!r.ok) throw Object.assign(new Error('The AI service returned an error (' + r.status + ').'), { status: 502 })
  const j = await r.json()
  const text = (j.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('').trim()
  if (!text) throw Object.assign(new Error('The AI gave an empty answer. Try again.'), { status: 502 })
  return text
}
