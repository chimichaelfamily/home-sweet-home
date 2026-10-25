-- Third calendar link ('chi'). The calendars table pointed only at the two people rows; allow any key.
alter table calendars drop constraint if exists calendars_person_id_fkey;
