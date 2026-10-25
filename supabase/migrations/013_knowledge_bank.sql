-- Weekly practice bank for the Knowledge tab (facts, small talk, practice speeches), filled by the app with Gemini.
create table if not exists knowledge_bank (
  id text primary key,
  kind text not null check (kind in ('fact','talk','speech')),
  week text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table knowledge_bank enable row level security;
drop policy if exists household_all on knowledge_bank;
create policy household_all on knowledge_bank for all to authenticated using (true) with check (true);
grant select, insert, update, delete on knowledge_bank to authenticated;
