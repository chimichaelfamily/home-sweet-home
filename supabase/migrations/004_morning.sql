-- Morning routine: affirmations, workout/YouTube links, Spotify songs (per person)
create table if not exists morning_items (
  id text primary key,
  person_id text not null references people(id),
  kind text not null check (kind in ('affirmation','link','song')),
  title text not null,
  sub text not null default '',
  url text not null default '',
  sort int not null default 0
);
alter table morning_items enable row level security;
drop policy if exists household_all on morning_items;
create policy household_all on morning_items for all to authenticated using (true) with check (true);
grant select, insert, update, delete on morning_items to authenticated;

insert into morning_items (id, person_id, kind, title, sort)
select p.id || '-aff-' || a.n, p.id, 'affirmation', a.t, a.n
from people p, (values
  (1, 'I am building a life of freedom, and every small step counts.'),
  (2, 'I am calm, capable and ready for today.'),
  (3, 'I make time for the things that matter to me.'),
  (4, 'I am proud of how far I have come.'),
  (5, 'Good things are coming, and I am ready for them.')
) as a(n, t)
where not exists (select 1 from morning_items);
