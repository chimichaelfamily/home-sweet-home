import { gemini, requireUser } from './_gemini.js'

const PROMPT = `You read photos of household products (food, sauces, skincare, medicine, cleaning) for a shelf-life tracker.
Return ONLY JSON: {"name": string, "type": one of ["Sauce","Cleanser","Moisturiser","Serum","Sunscreen","Spice","Oil","Medicine","Other"],
"where": one of ["Fridge","Pantry","Kitchen","Bathroom","Other"], "printed_expiry": "YYYY-MM-DD" or null,
"shelf_months": integer months the product is good for AFTER OPENING (read the jar symbol like "6M" or "12M" if visible, otherwise a sensible estimate) or null,
"notes": short string about anything you were unsure of}.
Use null when you cannot see something. Never invent a printed expiry date.`

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return }
  try {
    if (!(await requireUser(req, res))) return
    const imgs = Array.isArray(req.body?.images) ? req.body.images.slice(0, 3) : []
    if (!imgs.length) { res.status(400).json({ error: 'No photo' }); return }
    const parts = [{ text: PROMPT }, ...imgs.map(i => ({ inline_data: { mime_type: String(i.mime || 'image/jpeg'), data: String(i.data) } }))]
    const text = await gemini({ contents: [{ role: 'user', parts }], json: true })
    let out
    try { out = JSON.parse(text.replace(/^```json|```$/g, '')) } catch { res.status(502).json({ error: 'Could not read the photo. Try again or type it in.' }); return }
    res.status(200).json(out)
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Something went wrong' })
  }
}
