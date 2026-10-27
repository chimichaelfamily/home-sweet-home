-- Job board: company address for saved jobs, and the private key the iPad "Save to job board" Share button uses.
alter table jobs add column if not exists address text not null default '';

create table if not exists app_keys (
  id text primary key,
  value text not null
);
alter table app_keys enable row level security;
drop policy if exists household_all on app_keys;
create policy household_all on app_keys for all to authenticated using (true) with check (true);
grant select, insert, update, delete on app_keys to authenticated;
grant select on app_keys to service_role;
