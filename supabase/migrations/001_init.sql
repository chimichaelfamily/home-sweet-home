-- Home Sweet Home: first tables. Run once in Supabase > SQL Editor.
-- Every table is locked (row level security) and only a signed-in household login can use it.

create table if not exists people (
  id text primary key,            -- 'linh' or 'michael'
  name text not null,
  initial text not null
);

create table if not exists rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  action text not null default 'Replace',
  every_n integer not null check (every_n > 0),
  unit text not null check (unit in ('days','weeks','months','years')),
  applies_to text not null default 'Both',
  keep boolean not null default true,
  last_done date,
  size text not null default 'baby' check (size in ('baby','biggie')),
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  size text not null check (size in ('baby','biggie')),
  category text,
  assignee text references people(id),
  due_date date not null default current_date,
  source text not null default 'manual',  -- manual | calendar
  done_at timestamptz,
  done_by text,                            -- linh | michael | both
  created_at timestamptz not null default now()
);

-- One row per person per completed job. undone_at is set when someone taps Undo.
create table if not exists point_events (
  id uuid primary key default gen_random_uuid(),
  person_id text not null references people(id),
  points integer not null,
  title text not null,
  category text,
  size text not null,
  shared boolean not null default false,
  task_id uuid references tasks(id) on delete set null,
  rule_id uuid references rules(id) on delete set null,
  batch text not null,
  prev_last_done date,
  created_at timestamptz not null default now(),
  undone_at timestamptz
);

create table if not exists snoozes (
  rule_id uuid primary key references rules(id) on delete cascade,
  until date not null
);

alter table people enable row level security;
alter table rules enable row level security;
alter table tasks enable row level security;
alter table point_events enable row level security;
alter table snoozes enable row level security;

do $$
declare t text;
begin
  foreach t in array array['people','rules','tasks','point_events','snoozes'] loop
    execute format('drop policy if exists household_all on %I', t);
    execute format('create policy household_all on %I for all to authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

insert into people (id, name, initial) values ('linh','Linh Chi','L'), ('michael','Michael','M')
on conflict (id) do nothing;

insert into rules (name, category, action, every_n, unit, last_done) values
 ('GP check-up','Health','Appointment',12,'months','2025-09-01'),
 ('Dentist check-up and clean','Health','Appointment',6,'months','2025-09-01'),
 ('Replace electric toothbrush head','Health','Replace',3,'months','2026-10-23'),
 ('Clean hairbrushes and combs','Health','Clean',1,'months','2026-09-01'),
 ('Replace underwear','Clothes','Replace',6,'months','2026-10-24'),
 ('Replace makeup sponges','Clothes','Replace',3,'months','2026-09-01'),
 ('Wash bed sheets and pillowcases','Bedroom','Clean',1,'weeks','2026-10-24'),
 ('Replace bath towels','Bathroom','Replace',2,'years','2026-01-01'),
 ('Replace loofah / bath sponge','Bathroom','Replace',1,'months','2026-09-01'),
 ('Wash tea towels','Kitchen','Clean',1,'weeks','2026-09-01'),
 ('Deep-clean fridge','Kitchen','Clean',3,'months','2026-01-01'),
 ('Car service','Car','Service',6,'months','2026-01-01'),
 ('Back up phones and photos','Admin','Service',3,'months','2026-01-01');
