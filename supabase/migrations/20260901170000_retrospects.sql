-- A generated look back over a range of days.
--
-- Cached rather than produced on every visit: a year of entries is a large
-- prompt and several seconds of waiting, and the answer only changes when the
-- entries do.
create table if not exists retrospects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  range_start  date not null,
  range_end    date not null,
  -- Count plus the latest updated_at across the range. Editing an entry without
  -- adding one still changes this, so a stale retrospect is detectable.
  fingerprint  text not null,
  headline     text not null,
  narrative    text not null,
  -- [{ "date": "2026-08-30", "what": "...", "why": "..." }]
  moments      jsonb not null default '[]',
  created_at   timestamptz not null default now(),
  unique (user_id, range_start, range_end)
);

create index if not exists retrospects_user_range_idx
  on retrospects (user_id, range_end desc);

alter table retrospects enable row level security;
alter table retrospects force row level security;

create policy own_retrospects on retrospects
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
