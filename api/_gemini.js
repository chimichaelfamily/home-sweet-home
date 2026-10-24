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

const FALLBACKS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash']
export const modelList = () => [...new Set([process.env.GEMINI_MODEL, ...FALLBACKS].filter(Boolean))]

export async function callGemini(model, body) {
  const key = process.env.GEMINI_API_KEY
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({}))
  return { status: r.status, json: j, message: j?.error?.message || '' }
}

export async function gemini({ system, contents, json }) {
  if (!process.env.GEMINI_API_KEY) throw Object.assign(new Error('GEMINI_API_KEY is not set in Vercel yet (or the project was not redeployed after adding it).'), { status: 500 })
  const body = { contents }
  if (system) body.systemInstruction = { parts: [{ text: system }] }
  if (json) body.generationConfig = { responseMimeType: 'application/json' }
  let last = null
  const seen = new Set()
  for (const model of modelList()) {
    let r = await callGemini(model, body)
    for (let n = 0; n < 2 && (r.status === 503 || r.status === 500); n++) { await new Promise(ok => setTimeout(ok, 2500)); r = await callGemini(model, body) } // Google is briefly busy: retry
    if (r.status === 200) {
      const text = (r.json.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('').trim()
      if (!text) throw Object.assign(new Error('The AI gave an empty answer (it may have blocked the request). Try rephrasing.'), { status: 502 })
      return text
    }
    if (!last || r.status !== 404) last = r
    seen.add(r.status)
    if (r.status === 400 && /API key/i.test(r.message)) break
    if (r.status === 403 || r.status === 401) break
    // 404 (model name not available) or 5xx: try the next model
  }
  if (seen.has(429) && !seen.has(503)) throw Object.assign(new Error('The free AI limit (quota) is used up for now. Try again later, or check your limits at aistudio.google.com.'), { status: 429 })
  const busy = last.status === 503 ? ' Google\'s AI is busy right now. Wait a minute and try again.' : ''
  const keyHint = [400, 401, 403].includes(last.status) ? ' Check the key in Vercel: it must be a Gemini key from aistudio.google.com.' : ''
  const hint = busy || keyHint
  throw Object.assign(new Error(`Gemini said ${last.status}: ${last.message || 'no details'}.${hint}`), { status: 502 })
}
