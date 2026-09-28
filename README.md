# After-School Tracker

A family app that pays two kids pocket money (in coins, 1 coin = ₦1) for completing an after-school routine, tracked as a shared-PC PWA. Ported from a design prototype — see the design handoff doc for the full spec (business rules, screens, design tokens) that this was built from.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- Supabase (Postgres + Auth), via `@supabase/ssr`
- Vitest for the rules engine's unit tests

## First-time setup

1. **Install deps** (already done if you're reading this from the scaffolded repo): `npm install`
2. **Create a Supabase project** at [supabase.com](https://supabase.com) if you don't have one.
3. **Run the schema**: open the project's SQL Editor and run `supabase/migration.sql` (or `supabase db push` if you have the CLI linked).
4. **Environment variables**: copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY` — same page, `service_role` secret (only needed to run the weekly cron fold job locally).
   - `PIN_SESSION_SECRET` — any random string (`openssl rand -base64 32`); signs the short-lived "grown-up unlocked" cookie.
   - `CRON_SECRET` — any random string; the weekly fold route rejects requests without `Authorization: Bearer <this>`.
5. **PWA icons**: add `public/icon-192.png` and `public/icon-512.png` (a checkmark-on-gold-circle icon per the design tokens). The app builds and runs without them, but installs won't have a proper home-screen icon until they're added.
6. `npm run dev` and open http://localhost:3000. First visit redirects to `/login` — enter your email, click the magic link it sends you. Signing in for the first time creates your family (default PIN `1234` — change it from Grown-up corner → Change PIN) and two default kids (edit their names from Grown-up corner → Edit names).

## Scripts

- `npm run dev` / `npm run build` / `npm run start`
- `npm run test` — runs `src/lib/rules.test.ts` (the business-rules engine)
- `npm run lint`

## Architecture notes

- **`src/lib/rules.ts`** is the entire business-rules engine, ported 1:1 from the design prototype's logic class — pure functions, no I/O, fully unit-tested. This is the source of truth for streaks, coins, badges, levels, and prizes; read it before changing any of that logic.
- **`src/lib/view-model.ts`** turns rules.ts output + raw kid/prize data into the plain objects the screen components render.
- **`src/lib/actions/tracker.ts`** holds every Server Action. Every grown-up action (`markExplanation`, `markWeekPaid`, `fixTick`, `changePin`, `editKid`, `upsertPrize`, `markPrizeGiven`) re-checks a short-lived signed cookie (`src/lib/pin-session.ts`) set only after a server-side `bcrypt.compare` against the family's PIN hash — never trust client-side "unlocked" UI state for these.
- **`src/app/api/cron/fold-week`** is the weekly rollover (Monday 00:05 WAT via `vercel.json`'s cron schedule) — folds a finished week into `kid_stats`/`week_history`. Idempotent via `weeks.folded_at`.
- Auth is Supabase magic-link, parent-only; kids never sign in, they just pick a name on the "Who's checking in?" screen while the parent's browser session stays signed in.
