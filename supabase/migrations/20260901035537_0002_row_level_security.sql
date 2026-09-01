-- Row Level Security for Keepsake.
--
-- This file is the security model. The publishable key ships in the browser
-- bundle and is public by design, so these policies are the only thing standing
-- between a stranger with that key and every user's private journal.
--
-- Two rules to keep in mind when editing:
--   1. Enabling RLS without a policy denies everything. That is the safe
--      direction, but it means "queries return nothing" is the expected first
--      symptom, not a bug.
--   2. The service_role key bypasses all of this. Any server route using it
--      must scope by user_id itself, because the database no longer will.

alter table profiles          enable row level security;
alter table entries           enable row level security;
alter table question_profiles enable row level security;
alter table weekly_notes      enable row level security;

-- Force the policies to apply to the table owner too. This is defence in depth,
-- not a guarantee. These tables are owned by `postgres`, which holds BYPASSRLS,
-- and BYPASSRLS beats FORCE. So a security definer function owned by postgres
-- still reads and writes across every user. handle_new_user in 0001 is exactly
-- that, and it is why signup can insert a profile row before a session exists.
-- Any such function has to scope by user_id itself.
alter table profiles          force row level security;
alter table entries           force row level security;
alter table question_profiles force row level security;
alter table weekly_notes      force row level security;

-- ---------------------------------------------------------------------------
-- profiles
--   using      -> which rows you can read
--   with check -> which rows you may write, so you cannot insert or move a row
--                 so that it belongs to someone else
-- ---------------------------------------------------------------------------
create policy own_profile on profiles
  for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- entries
-- ---------------------------------------------------------------------------
create policy own_entries on entries
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- question_profiles
-- ---------------------------------------------------------------------------
create policy own_question_profile on question_profiles
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- weekly_notes
--
-- Written by a scheduled job, not by the user, so reads are all the client
-- needs. Restricting to select means a compromised browser session cannot
-- fabricate or edit a recap.
-- ---------------------------------------------------------------------------
create policy read_own_weekly_notes on weekly_notes
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Verification, to run in the SQL editor after applying.
--
-- Expect four rows, all with rowsecurity = true:
--
--   select tablename, rowsecurity
--   from pg_tables
--   where schemaname = 'public'
--   order by tablename;
--
-- Expect one policy per table (two lines for weekly_notes if you later add a
-- write policy):
--
--   select tablename, policyname, cmd, roles
--   from pg_policies
--   where schemaname = 'public'
--   order by tablename;
--
-- Neither of these proves isolation. The only test that does is signing in as a
-- second account and confirming you cannot see the first account's entries.
-- ---------------------------------------------------------------------------
