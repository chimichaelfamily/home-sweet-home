-- Habits: run once in Supabase > SQL Editor, after 001.
create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  person_id text not null references people(id),
  name text not null,
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists habit_logs (
  habit_id uuid not null references habits(id) on delete cascade,
  day date not null,
  primary key (habit_id, day)
);

alter table habits enable row level security;
alter table habit_logs enable row level security;

do $$
declare t text;
begin
  foreach t in array array['habits','habit_logs'] loop
    execute format('drop policy if exists household_all on %I', t);
    execute format('create policy household_all on %I for all to authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

insert into habits (person_id, name, sort)
select p.id, h.name, h.sort
from people p
cross join (values ('AM skincare',1),('Drink water',2),('Vitamins',3),('Stretch 10 min',4),('PM skincare',5),('Read before bed',6)) as h(name, sort)
where not exists (select 1 from habits);
