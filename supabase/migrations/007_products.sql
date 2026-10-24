-- Products: things opened at home with a use-by date
create table if not exists products (
  id text primary key,
  name text not null,
  type text not null default 'Other',
  place text not null default 'Other',
  opened date not null,
  printed_expiry date,
  shelf_months int not null default 12,
  use_by date not null,
  used_up boolean not null default false
);
alter table products enable row level security;
drop policy if exists household_all on products;
create policy household_all on products for all to authenticated using (true) with check (true);
grant select, insert, update, delete on products to authenticated;
