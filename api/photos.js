import { requireUser } from './_gemini.js'

// Free photo search (Unsplash). Needs UNSPLASH_ACCESS_KEY in Vercel. Photos are hotlinked, with credit shown.
export default async function handler(req, res) {
  const key = process.env.UNSPLASH_ACCESS_KEY
  try {
    if (!(await requireUser(req, res))) return
    if (!key) { res.status(500).json({ error: 'Photo search is not set up yet (UNSPLASH_ACCESS_KEY is missing in Vercel).' }); return }
    if (req.query.track) { // Unsplash asks apps to report when a photo is used
      const u = new URL(String(req.query.track))
      if (u.hostname === 'api.unsplash.com') await fetch(u.toString(), { headers: { Authorization: 'Client-ID ' + key } })
      res.status(200).json({ ok: true }); return
    }
    const q = String(req.query.q || '').slice(0, 100)
    if (!q) { res.status(400).json({ error: 'Type what to look for.' }); return }
    const r = await fetch('https://api.unsplash.com/search/photos?per_page=12&orientation=landscape&content_filter=high&query=' + encodeURIComponent(q), { headers: { Authorization: 'Client-ID ' + key } })
    if (r.status === 403 || r.status === 429) { res.status(429).json({ error: 'Photo search limit reached for now. Try again in an hour.' }); return }
    if (!r.ok) { res.status(502).json({ error: 'Photo search failed (' + r.status + ').' }); return }
    const j = await r.json()
    res.status(200).json({ photos: (j.results || []).map(p => ({ id: p.id, thumb: p.urls.small, full: p.urls.regular, by: p.user?.name || '', link: p.links?.html || '', dl: p.links?.download_location || '' })) })
  } catch { res.status(500).json({ error: 'Photo search failed.' }) }
}
