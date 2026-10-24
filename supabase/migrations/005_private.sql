-- Private area (Goals, Vision board, Money magic). Intentionally no seed data:
-- you type your own goals and figures in the app, so none are stored in this repo.
create table if not exists private_items (
  id text primary key,
  kind text not null check (kind in ('pillar','ladder','pin','countdown','money')),
  title text not null,
  sub text not null default '',
  cat text not null default '',
  num1 numeric not null default 0,
  num2 numeric not null default 0,
  day date,
  sort int not null default 0
);
alter table private_items enable row level security;
drop policy if exists household_all on private_items;
create policy household_all on private_items for all to authenticated using (true) with check (true);
grant select, insert, update, delete on private_items to authenticated;
