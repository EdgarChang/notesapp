-- Advisor fixes for 0001 and 0002. No schema changes, three corrections:
--
--   1. auth.uid() was re-evaluated once per row in every policy.
--   2. set_updated_at ran with a caller-controlled search_path.
--   3. Both trigger functions were reachable over the REST API as rpc endpoints.

-- ---------------------------------------------------------------------------
-- 1. Wrap auth.uid() in a scalar subquery.
--
-- Postgres hoists (select auth.uid()) into an InitPlan evaluated once per
-- statement, instead of calling it for every candidate row. Identical
-- semantics. The difference shows up as soon as a user has more than a handful
-- of entries, and the Timeline and Insights queries are the ones that feel it.
-- ---------------------------------------------------------------------------
drop policy own_profile on profiles;
create policy own_profile on profiles
  for all
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy own_entries on entries;
create policy own_entries on entries
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy own_question_profile on question_profiles;
create policy own_question_profile on question_profiles
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy read_own_weekly_notes on weekly_notes;
create policy read_own_weekly_notes on weekly_notes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 2. Pin set_updated_at's search_path, the way handle_new_user already is.
--
-- An empty search_path means nothing resolves implicitly, so now() has to be
-- written as pg_catalog.now(). create or replace keeps the existing triggers
-- and privileges, so nothing below needs re-granting.
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Take the trigger functions off the REST API.
--
-- PostgREST exposes anything executable in the public schema, so both showed up
-- at /rest/v1/rpc/. Both return `trigger`, so a direct call errors out rather
-- than doing damage, but handle_new_user is security definer and there is no
-- reason for either to be callable.
--
-- Safe for the triggers: Postgres checks EXECUTE when a trigger is created, not
-- each time it fires.
-- ---------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at()  from public, anon, authenticated;
