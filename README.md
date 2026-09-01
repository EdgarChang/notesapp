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
2. Home, against a seeded entries array.
3. Check-in, against the prototype's hardcoded six-step script. No LLM yet.
4. Entry detail, then Timeline, then Insights.
5. Onboarding.
6. Supabase project, schema, auth, RLS, then real queries.
7. Claude API: question picker, then summary drafting.
8. Media upload, then the weekly note job.
