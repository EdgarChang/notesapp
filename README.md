# Keepsake

A nightly check-in journal. The assistant asks six short questions, drafts the day
in three lines, and you keep what rings true.

Mobile-first: a single 452px column centred on larger screens.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Plain CSS: global design tokens plus CSS Modules per component |
| Data | Postgres via Supabase, owner-scoped with RLS |
| Auth | Supabase Auth, email and password |
| Media | Supabase Storage, private bucket, signed URLs (not yet wired) |
| LLM | Claude API via `@anthropic-ai/sdk`, server-side only. Haiku 4.5 for both calls |

No Tailwind. The design is specified as exact pixel values over CSS custom
properties, so tokens plus CSS Modules maps onto it directly. Tailwind would add a
translation layer of arbitrary-value classes without buying anything.

## Getting started

Requires Node 20 or newer.

```bash
npm install && npm run dev
```

Then open http://localhost:3000.

## Fonts

Montserrat, self-hosted. `app/fonts/Montserrat-Variable.woff2` is the upstream
variable TTF subsetted to Latin, Latin Ext-A, punctuation, arrows and geometric
shapes, then converted to woff2: 688KB down to 38KB with the 100-900 weight axis
intact. Licensed under the SIL Open Font License 1.1; the licence travels with
the font in `app/fonts/OFL.txt`.

## Layout

```
app/
  layout.tsx            root: html, fonts, globals
  tokens.css            resolved design tokens (single source of truth)
  globals.css           base, type roles, keyframes
  fonts.ts              Montserrat variable, self-hosted
  fonts/                subsetted woff2 + OFL licence
  components/           AppShell, TabBar, EntryCard, BackButton
  lib/                  queries, server actions, and the LLM seam
    queries.ts          all reads, server-only
    actions.ts          writes: saveCheckin, draftToday, recordPeople
    llm.ts              the provider seam: draftDay + fallback
  auth/                 callback and signout route handlers
  (app)/                screens that carry the tab bar
    page.tsx            Today
    timeline/page.tsx   Timeline
    insights/page.tsx   Insights
    entry/[id]/page.tsx Entry detail
  (flow)/               full-bleed screens with no tab bar
    checkin/            nightly check-in
    onboarding/         first-run setup
```

## Routes

| Route | Screen | Tab bar |
|---|---|---|
| `/` | Today | yes |
| `/timeline` | Timeline | yes |
| `/insights` | Insights | yes |
| `/entry/[id]` | Entry detail | yes |
| `/checkin` | Nightly check-in | no |
| `/onboarding` | First-run setup | no |

## Design source of truth

The design reference and build plan are held outside this repo, since they carry
internal brand material. `app/tokens.css` is the resolved output of both and is
the single source of truth for colour and type in the codebase.

The prototype's own palette has three text colours that fail WCAG AA. `--fg-brand`
is `#A62E4E` here rather than the prototype's `#FF5F7E` (2.92:1 on white), and the
other two are corrected at the token level too.

## Build order

Screens first against seeded data, backend second.

1. **Done.** Scaffold, fonts, tokens, 452px shell, tab bar.
2. **Done.** Home, against a seeded entries array.
3. **Done.** Check-in, against the prototype's hardcoded six-step script. No LLM yet.
4. **Done.** Entry detail, then Timeline, then Insights.
5. **Done.** Onboarding.
6. **Done.** Supabase project, schema, auth, RLS, then real queries.
7. **Done.** Claude drafts the day's summary and rewords each question for the
   person. Both calls use Haiku 4.5.
8. Media upload, then the weekly note job.

## How the check-in adapts

The order varies. Mood stays first, since it anchors the 1-5 scale and colours
how the rest of the night reads, and photo then summary stay last, since the
summary draws on everything before them. The four in between rotate on a shuffle
seeded from the user and the date, so it is stable for a whole check-in but
different from yesterday's.

One of those four is open-ended: write whatever you like about the day, in a
textarea rather than a single line. The entry then reads as a summary of your
other answers, followed by **your own words, unchanged, at the end**. The join is
what guarantees that, not the prompt.

Whatever you type into the summary box at the last step is read once more on
save, so a name added there still counts toward "Named Most Often". Extraction
otherwise runs at drafting time and would never see it. The call is skipped when
the summary comes through unedited.

The open text is passed to the model under its own key rather than alongside the
other answers, because the instruction not to summarise it was ignored when it
sat in the same list: the model folded it into the summary and the entry said
the same thing twice. It is used for the title, tags and people only.

One Haiku call per step returns both a reply to the answer just given and the
next question, reworded for this person. It receives their focus topics, recent
entry titles, the people they name, tonight's answers so far, and the questions
already asked, so it does not reuse a framing.

What it may not change: a step's `kind` or `field`, and the five mood chips. Each
maps to a stored column, and the chips are a 1-5 scale, so letting the model
reshape the flow could leave mood or gratitude never asked and quietly empty the
Insights screen.

There is no learning loop yet. `question_profiles.question_weights`,
`retired_questions` and `last_asked` exist in the schema and are never read or
written, so nothing records which questions land or retires one you never answer.
Adaptation comes only from the history above, recomputed each night.

## Known facades

What is real now: accounts, sessions, route protection, and entries. A check-in
writes a row, and every screen reads from the database.

What is not real yet:

- **No voice capture.** The gratitude step takes typed text. The simulated
  recorder is gone, so `voice_key`, `voice_transcript` and
  `voice_duration_seconds` stay null and entry detail never shows a player for a
  file that does not exist. Real capture needs `MediaRecorder`, a private
  Storage bucket, and a transcription provider, which is still an open decision.
- **Photos store no file.** The photo step posts a placeholder bubble with a
  fabricated filename and writes nothing, so `photo_key` stays null. Entry detail
  never shows a photo. Media upload is step 8.
- **`ANTHROPIC_API_KEY` gates both LLM calls.** Without it the check-in still
  works, but flatly: questions come from the written script, replies are the
  written one-liners, and the summary is composed from the user's own answers.
- **No learning loop.** See "How the check-in adapts" above.
  `question_profiles.recurring_people` is also unused now: "Named Most Often"
  counts `entries.people` instead, so revising or deleting a day corrects it.
- **No weekly note.** `weekly_notes` is never written, so the Insights statement
  card stays hidden and the chart, people and quotes are composed from entries
  directly. The scheduled job is step 8.
- **Email confirmation is off** for development, so anyone can register with an
  address they do not own. Turn it back on, with custom SMTP, before real users.
- **Timezone.** "Today" uses the server's date. A journal day is a calendar day
  in the writer's timezone, which `profiles` does not store yet.

## Empty states

The design assumes a populated account: a twelve day streak, 84 days kept, five
entries and a weekly note. It shows no empty state anywhere, so these were
written to fill the gap and are not from the design:

- Home's streak line changes with the real count, including zero, and the hero
  switches to "Today, kept" once the day is written
- "This Week" and the weekly note card are hidden when there is nothing to show
- Timeline and Insights each carry a one line message instead of empty furniture

## Missing from the design

- **No account or settings screen.** Sign-out is parked at the bottom of
  Insights because there is nowhere else for it, and the reminder time collected
  during onboarding cannot be changed afterwards.
- **No sign-in screen.** The one here follows the design system but was not
  designed.
