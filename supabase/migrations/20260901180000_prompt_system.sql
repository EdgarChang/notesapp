-- The prompt system from JOURNAL_SPEC.md.
--
-- Anchors are asked identically every day and feed the trend line. Rotating
-- prompts feed the memory. The two are stored separately because they have
-- different rules: anchor wording is frozen for longitudinal comparability,
-- while pool prompts rotate and their text will drift.

-- a001, "how was today" on 0 to 10, keeps its own column rather than living in
-- the jsonb: it is the trend line, queried across long ranges and charted, so
-- it earns an indexable column. The other anchors are read one entry at a time.
alter table entries drop constraint if exists entries_mood_check;

-- Existing 1-5 values rescale to the 0-10 Cantril range. Lossy, but there is no
-- honest way to invent the missing resolution, and comparability with survey
-- data is worth more than the old scale.
update entries set mood = round((mood - 1) * 2.5) where mood is not null and mood <= 5;

alter table entries add constraint entries_mood_check check (mood between 0 and 10);

-- The remaining anchors: { "a002": "tired", "a003": 7, "a004": ["Sam"] }
alter table entries add column if not exists anchor_responses jsonb not null default '{}';

-- [{ "prompt_id": "e003", "prompt_version": "1.0.0", "response_type":
--    "short_text", "text": "...", "skipped": false }]
alter table entries add column if not exists prompt_responses jsonb not null default '[]';

-- What was shown, when, and whether it was answered. This is what enforces the
-- 14 day no-repeat rule, and skipping is logged separately from never-shown
-- because repeated skipping is a signal to down-weight a prompt.
create table if not exists prompt_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  prompt_id  text not null,
  shown_on   date not null,
  answered   boolean not null default false,
  skipped    boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, prompt_id, shown_on)
);

create index if not exists prompt_history_user_prompt_idx
  on prompt_history (user_id, prompt_id, shown_on desc);
create index if not exists prompt_history_user_shown_idx
  on prompt_history (user_id, shown_on desc);

alter table prompt_history enable row level security;
alter table prompt_history force row level security;

create policy own_prompt_history on prompt_history
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- When the weekly tier fires for this user. 0 = Sunday, matching dayOfWeek().
alter table profiles add column if not exists weekly_prompt_day smallint not null default 0
  check (weekly_prompt_day between 0 and 6);
