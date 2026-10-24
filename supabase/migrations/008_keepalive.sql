-- Tiny harmless function that a daily job calls so the free database never pauses for inactivity.
create or replace function public.ping() returns int language sql security definer set search_path = '' as 'select 1';
revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
