// Called once a day by Vercel Cron (see vercel.json). Runs a trivial query so Supabase counts the project as active.
export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL, anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) { res.status(200).json({ ok: true, note: 'no database configured' }); return }
  try {
    const r = await fetch(url + '/rest/v1/rpc/ping', { method: 'POST', headers: { apikey: anon, Authorization: 'Bearer ' + anon, 'Content-Type': 'application/json' }, body: '{}' })
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status })
  } catch { res.status(502).json({ ok: false }) }
}
