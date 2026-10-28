-- Job board: the closing date of an ad (from Seek's page or the ad's job data).
alter table jobs add column if not exists deadline date;
