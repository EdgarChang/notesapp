# Keepsake

A nightly check-in journal. The assistant asks six short questions, drafts the day
in three lines, and you keep what rings true.

Mobile-first: a single 452px column centred on larger screens.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Plain CSS: global design tokens plus CSS Modules per component |
| Data | Postgres via Supabase, owner-scoped with RLS (not yet wired) |
| Auth | Supabase Auth (not yet wired) |
| Media | Supabase Storage, private bucket, signed URLs (not yet wired) |
| LLM | Claude API via `@anthropic-ai/sdk`, server routes only (not yet wired) |

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
  lib/                  seed data, shaped to the target schema
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

Screens first against seeded data, backend second. Steps 1 to 5 are done, so
every screen exists and reads from a seed module under `app/lib/`.

1. **Done.** Scaffold, fonts, tokens, 452px shell, tab bar.
2. **Done.** Home, against a seeded entries array.
3. **Done.** Check-in, against the prototype's hardcoded six-step script. No LLM yet.
4. **Done.** Entry detail, then Timeline, then Insights.
5. **Done.** Onboarding.
6. Supabase project, schema, auth, RLS, then real queries.
7. Claude API: question picker, then summary drafting.
8. Media upload, then the weekly note job.

## Known facades

These are expected until step 6 and are the whole of what is not real yet.

- Nothing persists. Check-in answers and summary edits are discarded on
  navigation, and onboarding does not save a name, topics or reminder time.
- No auth, so `/onboarding` is reachable only by URL. First-run detection needs
  a profile row to check against.
- Every screen reads from `app/lib/entries.ts`, `insights.ts`, `timeline.ts` or
  `onboarding.ts`. Swapping those for queries is step 6's job and should not
  require touching a screen.
- Voice recording is simulated: a toggle, an animated waveform and a canned
  transcript. Real capture needs `MediaRecorder` plus a transcription provider,
  which is still an open decision.
- Photos are flat placeholder tiles. There is no real imagery in the design
  bundle.
- On Timeline, 19 of the 24 kept days are filler with no entry record behind
  them, so they render kept but are not clickable.
