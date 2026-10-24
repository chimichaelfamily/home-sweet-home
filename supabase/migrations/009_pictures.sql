-- Pictures: faces for the two of you, and photos for affirmations and vision cards
alter table people add column if not exists avatar text not null default '';
alter table morning_items add column if not exists img text not null default '';
alter table private_items add column if not exists img text not null default '';
