-- Names mentioned in a day, stored on the entry that mentions them.
--
-- "Named Most Often" previously read a running tally in
-- question_profiles.recurring_people, incremented on every save. Because
-- entries upsert on (user_id, entry_date), revising a day counted its names
-- again, and deleting an entry never decremented. The tally drifted
-- permanently out of sync: one entry had produced a count of three.
--
-- Counts are now derived from these arrays, so revising or deleting an entry
-- corrects them automatically.
alter table entries add column if not exists people text[] not null default '{}';

create index if not exists entries_people_idx on entries using gin (people);

-- The old tally is no longer read. Clear it rather than leave wrong numbers
-- sitting in the table.
update question_profiles set recurring_people = '{}'::jsonb;
