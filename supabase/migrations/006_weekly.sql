-- Weekly newsletter: Claude's note pasted back for each week (week = Monday's date)
create table if not exists weekly_notes (
  week date primary key,
  body text not null default ''
);
alter table weekly_notes enable row level security;
drop policy if exists household_all on weekly_notes;
create policy household_all on weekly_notes for all to authenticated using (true) with check (true);
grant select, insert, update, delete on weekly_notes to authenticated;
