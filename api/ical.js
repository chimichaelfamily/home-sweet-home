// Vercel function: fetches a private Google Calendar iCal link for the iPad
// (browsers can't fetch it directly because of CORS). Only Google hosts allowed.
export default async function handler(req, res) {
  try {
    const u = new URL(String(req.query.url || ''))
    if (u.protocol !== 'https:' || u.hostname !== 'calendar.google.com') {
      res.status(400).send('Only Google Calendar links are allowed')
      return
    }
    const r = await fetch(u.toString())
    if (!r.ok) { res.status(502).send('Google said ' + r.status); return }
    res.setHeader('Cache-Control', 's-maxage=120')
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.status(200).send(await r.text())
  } catch {
    res.status(400).send('Bad link')
  }
}
