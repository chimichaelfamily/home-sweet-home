// Fetches a Goodreads shelf RSS feed for the app (browsers can't fetch it directly because of CORS).
// Only Goodreads review-list RSS links are allowed.
export default async function handler(req, res) {
  try {
    const u = new URL(String(req.query.url || ''))
    if (u.protocol !== 'https:' || !['www.goodreads.com', 'goodreads.com'].includes(u.hostname) || !u.pathname.startsWith('/review/list_rss/')) {
      res.status(400).send('Only a Goodreads shelf RSS link is allowed'); return
    }
    const page = Math.max(1, Math.min(20, Number(req.query.page) || 1))
    u.searchParams.set('page', String(page))
    const r = await fetch(u.toString(), { headers: { 'User-Agent': 'Mozilla/5.0 (home hub)' } })
    if (!r.ok) { res.status(502).send('Goodreads said ' + r.status); return }
    res.setHeader('Cache-Control', 's-maxage=600')
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
    res.status(200).send(await r.text())
  } catch {
    res.status(400).send('Bad link')
  }
}
