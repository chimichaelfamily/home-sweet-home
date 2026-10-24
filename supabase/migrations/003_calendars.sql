-- Calendar links (each person pastes their private iCal link in Settings)
create table if not exists calendars (
  person_id text primary key references people(id),
  url text not null default ''
);
alter table calendars enable row level security;
drop policy if exists household_all on calendars;
create policy household_all on calendars for all to authenticated using (true) with check (true);
grant select, insert, update, delete on calendars to authenticated;
