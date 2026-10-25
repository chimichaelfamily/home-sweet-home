-- Knowledge tab: books, public speaking scripts and saved facts.
create table if not exists knowledge_items (
  id text primary key,
  kind text not null check (kind in ('book','script','fact')),
  title text not null,
  sub text not null default '',
  cat text not null default '',
  body text not null default '',
  num numeric not null default 0,
  num2 numeric not null default 0,
  sort int not null default 0
);
alter table knowledge_items enable row level security;
drop policy if exists household_all on knowledge_items;
create policy household_all on knowledge_items for all to authenticated using (true) with check (true);
grant select, insert, update, delete on knowledge_items to authenticated;
