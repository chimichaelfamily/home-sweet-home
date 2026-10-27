# Home Sweet Home

A door-mounted household hub for Linh Chi and Michael (iPad Pro 11", landscape).

Phase 1: home to-do list (Baby +1 / Biggie +3), "who did it" with undo, points race,
reminders from household rules (with snooze), settings (themes, rules, backup).

Until Supabase is connected the app runs in demo mode and saves on the device only.

- `npm run dev` runs it locally, `npm test` checks the rules and points logic, `npm run build` builds it.
- `supabase/migrations/001_init.sql` creates the tables and loads the 13 household rules.

## Personal projects tab (Face ID)
- Run `supabase/migrations/015_projects.sql` in the Supabase SQL editor.
- Michael's job board collects ads every evening at 7pm Melbourne time (Vercel Cron, see `vercel.json` and `api/jobs.js`)
  from Google's job search (ads from Seek, LinkedIn, Indeed and company sites) through SerpApi's free plan.
  Add these in Vercel → Settings → Environment Variables, then redeploy:
  `SERPAPI_KEY` (free at serpapi.com → Your account → API key) and `SUPABASE_SERVICE_KEY` (Supabase → Project Settings → API → service_role).
- Run `supabase/migrations/016_job_share.sql` for the iPad Share button and company addresses (Projects → Michael → Edit shows the Share button setup).
  Optional: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` add Adzuna ads while its free test calls last.
