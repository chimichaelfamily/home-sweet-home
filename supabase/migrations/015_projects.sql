-- Personal Project tab (behind Face ID).
-- Chi: skincare / body / diet routines with daily ticks, and MMO business ideas with goals and tasks.
-- Michael: job ads collected once a day by /api/jobs (Adzuna), with the searches editable in the app.

create table if not exists project_items (
  id text primary key,
  owner text not null check (owner in ('chi','michael')),
  kind text not null check (kind in ('step','tick','idea','goal','task')),
  title text not null default '',
  sub text not null default '',
  cat text not null default '',
  num1 numeric not null default 0,
  day date,
  sort int not null default 0
);
alter table project_items enable row level security;
drop policy if exists household_all on project_items;
create policy household_all on project_items for all to authenticated using (true) with check (true);
grant select, insert, update, delete on project_items to authenticated;

-- What to search for. Edit these in the app (Personal Project → Michael → Searches).
create table if not exists job_searches (
  id text primary key,
  what text not null,
  place text not null default 'Melbourne',
  sort int not null default 0
);
alter table job_searches enable row level security;
drop policy if exists household_all on job_searches;
create policy household_all on job_searches for all to authenticated using (true) with check (true);
grant select, insert, update, delete on job_searches to authenticated;
insert into job_searches (id, what, place, sort) values
  ('s-video', 'videographer', 'Melbourne', 1),
  ('s-photo', 'photographer', 'Melbourne', 2),
  ('s-social', 'social media marketing', 'Melbourne', 3)
on conflict (id) do nothing;

-- One row per job ad. status: new, saved, applied, hidden.
create table if not exists jobs (
  id text primary key,
  title text not null,
  company text not null default '',
  place text not null default '',
  pay text not null default '',
  url text not null,
  posted date,
  search text not null default '',
  kind text not null default '',
  first_seen date not null default current_date,
  status text not null default 'new' check (status in ('new','saved','applied','hidden'))
);
alter table jobs enable row level security;
drop policy if exists household_all on jobs;
create policy household_all on jobs for all to authenticated using (true) with check (true);
grant select, insert, update, delete on jobs to authenticated;

-- The daily job collector uses the service key.
grant select on job_searches to service_role;
grant select, insert, update, delete on jobs to service_role;
-- Remembers when the collector last ran, so the app can show "Updated 7:02pm".
create table if not exists job_runs (id int primary key, ran_at timestamptz not null, found int not null default 0, note text not null default '');
alter table job_runs enable row level security;
drop policy if exists household_read on job_runs;
create policy household_read on job_runs for select to authenticated using (true);
grant select on job_runs to authenticated;
grant select, insert, update on job_runs to service_role;
