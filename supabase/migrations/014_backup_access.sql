-- Lets the weekly GitHub backup read every table (read only).
grant usage on schema public to service_role;
grant select on all tables in schema public to service_role;
alter default privileges in schema public grant select on tables to service_role;
