-- Keepsake initial schema.
-- Source: build plan section 5. Two deliberate departures from the design
-- handoff's "State management" section are noted inline.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created automatically on signup.
-- ---------------------------------------------------------------------------
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  -- Nullable: "Not now" in onboarding means no reminder, not a sentinel time.
  reminder_time time,
  -- "Playful" or "Brief". Drives the check-in question wording.
  assistant_tone text not null default 'Playful'
    check (assistant_tone in ('Playful', 'Brief')),
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- entries: one kept day.
-- ---------------------------------------------------------------------------
create table entries (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  entry_date             date not null,
  -- Mood is a smallint, not a string. The Insights chart plots it numerically
  -- and the check-in chips are an ordered scale, so text would force a
  -- string-to-number mapping on every chart query. Labels live in app code.
  mood                   smallint check (mood between 1 and 5),
  title                  text,
  summary_draft          text,        -- what the model wrote
  summary                text,        -- what the user kept
  gratitude              text,
  tags                   text[] not null default '{}',
  photo_key              text,
  voice_key              text,
  voice_transcript       text,
  voice_duration_seconds int,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- One entry per day is load-bearing for streaks and the calendar. Without
  -- this, a double submit silently creates two rows for one day and both break.
  unique (user_id, entry_date)
);

create index entries_user_date_idx on entries (user_id, entry_date desc);

-- ---------------------------------------------------------------------------
-- question_profiles: per-user adaptation state, one row per user.
-- ---------------------------------------------------------------------------
create table question_profiles (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  focus_topics      text[] not null default '{}',   -- from onboarding step 2
  question_weights  jsonb  not null default '{}',
  retired_questions text[] not null default '{}',   -- e.g. the screen-time question
  recurring_people  jsonb  not null default '{}',   -- {"Maya": 9, "Sam": 6}
  last_asked        jsonb  not null default '{}',
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- weekly_notes: the generated recap behind the Insights screen.
-- ---------------------------------------------------------------------------
create table weekly_notes (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  week_start       date not null,
  note             text not null,
  what_changed     text,
  mood_series      smallint[] not null default '{}',
  top_people       jsonb not null default '[]',
  gratitude_quotes jsonb not null default '[]',
  created_at       timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ---------------------------------------------------------------------------
-- Keep updated_at honest.
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger entries_set_updated_at
  before update on entries
  for each row execute function set_updated_at();

create trigger question_profiles_set_updated_at
  before update on question_profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Give every new auth user their profile and question profile up front, so the
-- app never has to handle a signed-in user with no rows.
--
-- security definer is required: this runs as the auth system inserts the user,
-- before any session exists for RLS to check. search_path is pinned to stop a
-- malicious schema on the caller's path from hijacking the function.
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;

  insert into public.question_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
