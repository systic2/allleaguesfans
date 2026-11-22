# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Dev server**: `pnpm dev`
- **Build**: `pnpm build` (runs `tsc -b`, then `vite build`)
- **Type checking**: `pnpm typecheck`
- **Tests**: `pnpm test` (Vitest, jsdom, files in `src/tests/`)
- **Lint**: `pnpm lint:unused` (ESLint with `--fix`; removes unused imports)
- **Bundle analysis**: `pnpm analyze:bundle`
- **Data sync**: `pnpm sync:full` (runs `scripts/sync/orchestrator.ts`; needs the sync env vars below)
- **DB integrity check**: `pnpm test:integration` (queries the live DB with the service role key)

Uses **pnpm** (`pnpm-lock.yaml`). CI and the sync workflow use pnpm 10 and Node 22.

## Architecture Overview

### Technology Stack
- **React 19** + TypeScript (strict), **Vite**, **Tailwind CSS v4** (`@tailwindcss/postcss`)
- **React Router v7** with lazy-loaded routes (`src/app/router.tsx`)
- **TanStack Query v5** for all server state
- **Supabase** (PostgreSQL + PostgREST) as the only runtime backend; the browser reads with the anon key
- **Vitest** + Testing Library

### Routes (`src/app/router.tsx`)
- `/` – home (`HomePage`: favorite teams, today's matches, league top 4, this week, recent results; each section loads on its own and shows its as-of time from `sync_status` (except the favorite-teams section when no team is favorited), with "갱신 지연" after 4 hours)
- `/leagues`, `/leagues/:slug` – league list and league page (standings, fixtures, scorers, champions)
- `/teams`, `/teams/:id` – team list; team page `TeamPageDB` (tabs via `?tab=overview|squad|fixtures|stats`)
- `/players`, `/players/:id` – player list (reads `players_v2_current`) and player page
- `/matches`, `/matches/:id` – matches by date (`?date=YYYY-MM-DD`) and match page
- `/search`, `/favorites`; unknown paths render `NotFound`

### Project Structure
- `src/app/` – router, layout, query client, shared app components (`GlobalSearch`, `CrestImg`, `Sidebar`); the per-route error boundary is in `layout/RootLayout.tsx`
- `src/pages/` – route components
- `src/components/` – page sections; `fm/` holds the league page boxes (`FMStandings`, `FMFixtures`, `FMPlayerStats`, `FMHistory`)
- `src/components/MatchRow.tsx` – the match row shared by the home and matches pages
- `src/lib/api.ts` – most Supabase queries used by the pages
- `src/lib/thesportsdb-api.ts` – match details, team fixtures and upcoming fixtures from `events_v2`
- `src/lib/season.ts` – `getCurrentSeasonForFormat` (see Seasons below)
- `src/lib/dates.ts` – KST date helpers (`kstDate`, `kstDateTime`, `shiftDate`, …); use them in new code (some older components, e.g. `FMFixtures`, `UpcomingFixtures`, `TeamPageDB`, still format in the browser's timezone)
- `src/lib/favorites.ts`, `src/hooks/useFavorites.ts` – league/team/player favorites, no login; kept in this browser's `localStorage` (`alf:favorites:v1`), or in memory for the tab when storage is unavailable
- `src/lib/mappers/` – pure parsing/aggregation functions used by the sync scripts (TheSportsDB mappers, timeline parsing, player-stats helpers); kept under `src/` so Vitest covers them
- `src/hooks/useTeamName.ts` – Korean team names (see below)
- `src/types/domain.ts`, `src/domain/types.ts` – domain types
- `scripts/sync/` – data sync (see Data Sync)
- `scripts/migrations/` – SQL migrations, applied by hand in the Supabase SQL Editor. Older files are mixed (duplicate numbers, some unnumbered); new ones continue the sequence (latest: 25)
- `scripts/one-off/`, `scripts/archive/` – old one-off scripts, not part of any pipeline

### Key Conventions
- **Team ids are strings.** `teams_v2.id` (and the team ids in `events_v2`, `standings_v2`, routes) is text and includes historical ids like `hist_*`; never `Number()` one. Some older types (`src/domain/types.ts`, parts of `api.ts`) still use numbers; use strings in new code.
- **Seasons**: K League (4689, 4822) uses single-year seasons (`'2026'`). The European leagues (4328 EPL, 4335 La Liga, 4332 Serie A, 4331 Bundesliga, 4334 Ligue 1) use split seasons stored as the start year (`'2025'` = 2025-26; the new season starts in July). Use `getCurrentSeasonForFormat(format)` instead of hard-coding a year. Team pages take the team's latest season from `fetchTeamDetails` (`currentSeason`).
- **Korean team names**: `teams_v2.nameKorean` is filled for every team (migration 19). Components call `const teamName = useTeamName()` and render `teamName(teamId, englishFallback)`; the hook loads all names once and falls back to the English name.
- **No fabricated data in new code.** Show `-` or an empty state when a value is not collected; do not invent ratings or placeholder stats. (Known leftovers: missing player-stat fields become `0` in `fetchPlayerDetail`, and migration 10 stores `0` for uncollected historical standings metrics.)
- Korean UI text; keep it Korean. Loading fallback text: "로딩중…".
- Path alias `@/` → `src/`.

## Agent Team Workflow (Claude Code + Codex CLI + Antigravity CLI)

For non-trivial fixes/features, use three roles instead of one agent doing everything:

1. **Claude Code (implementer)** – finds the root cause and writes the code/config fix.
2. **Codex CLI (test writer)**, after the fix lands – `codex exec -s workspace-write "<prompt>" </dev/null`. Describe the change (what, why, which files) and ask it to write or extend the Vitest tests under `src/tests/` and run them. Limit it to the tests for that change.
3. **Independent reviewers**, after the tests pass, run in parallel – a fresh `codex exec -s read-only --skip-git-repo-check "<prompt>" </dev/null` and `agy -p "<prompt>" --dangerously-skip-permissions </dev/null`, each given the diff and the root-cause story and asked for bugs, missed edge cases, and whether the fix addresses the cause. Commit and push only when both come back clean (fix findings and review again).

CLI notes (`codex` and `agy` are installed and signed in on this machine):
- Pass prompts inline and redirect stdin from `/dev/null` so a run started from Claude Code never waits on stdin.
- `agy` in print mode silently refuses shell commands (`git diff`, …) and returns "no output produced". `--dangerously-skip-permissions` is acceptable only for read-only review prompts; for unattended edits use `--mode=accept-edits`. `agy -p` runs are allowed by the user-approved `Bash(agy -p:*)` rule in the untracked `.claude/settings.local.json`; do not work around a denial.
- `.claude/settings.local.json` is gitignored now but was tracked in older commits, so checking out or pulling across those commits can delete or overwrite it; back it up before switching branches.
- **Do not use the Gemini CLI (`gemini`).** Since 2026-06-18 it accepts only API-key auth, and the local key has no billing account, so every call returns 429 (confirmed 2026-08-09). Adding billing is the user's decision.

## Data Sync

### Pipeline
`.github/workflows/data-sync.yml` runs the sync; runs never overlap (concurrency group `data-sync`).
- **Hourly start:** Supabase pg_cron job `dispatch-data-sync` (migration 25) calls `workflow_dispatch` at minute 7, using a fine-grained token (Actions read/write on this repo only) stored in Supabase Vault as `github_actions_dispatch_token`. Confirmed working from 2026-11-21 05:07 UTC. When the token expires, create a new one and replace the Vault value.
- **Fallback:** the workflow's own schedule `30 */6 * * *`, because GitHub delays scheduled runs (on 2026-11-20 the hourly schedule fired only every 6-8 hours). A fallback run may run right after a dispatched one (harmless, upserts), but it can replace a pending manual run.
- **Rosters first:** each run starts with `import-team-players.ts --if-older-than-days=7`, which re-fetches each team whose newest `players_v2` row is at least 7 days old or that has none (manual dispatch with `import_rosters` re-fetches every team). A team that fails keeps its previous roster; if it was due (7+ days old or empty) it is retried next run, otherwise only once it becomes due; the sync still runs, and the run is marked failed.
- Then `pnpm sync:full` (`scripts/sync/orchestrator.ts`) runs these steps in order, recording each in `sync_runs`:

1. **Standings and teams** from TheSportsDB → `standings_v2`, `teams_v2`
2. **Events** (fixtures and results) from TheSportsDB → `events_v2`
3. **K League player stats** (`lib/kleague-player-stats.ts`): goal/assist rankings from kleague.com `/record/rankSort.do` → `player_statistics`. kleague.com player ids differ from `players_v2` (TheSportsDB) ids; the step also links them in `kleague_player_links` (migration 22) when exactly one player on the same team has the same English name, or, failing that, exactly one K League roster player has the birth date from the kleague.com player page (cached in `kleague_player_birthdates`, migration 23) and shares a name word (same team) or, on another team, has every word (at least two) of one name in the other; the app reads stats through those links
4. **European player stats** (`lib/europe-player-stats.ts`): TheSportsDB v2 `event_timeline` per finished match, cached in `event_timelines` (migration 18), aggregated → `player_statistics`. Bounded per run (600 requests, 12-minute deadline, fair share per league); stats for a league are written only once every finished match is cached.

Any failed step makes the script exit 1, so the workflow run shows as failed.

Manual backfill, not run by the workflow: `import-historical-champions-euro.ts` (European champions history in `standings_v2`).

### Environment Variables
Sync scripts (`scripts/sync/lib/supabase.ts`):
- `SUPABASE_URL` (or `VITE_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE` – service role key; only for scripts, never in the frontend
- `THESPORTSDB_API_KEY` – TheSportsDB premium key (v1 and v2 APIs)

Frontend (`src/lib/supabaseClient.ts`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

GitHub Actions maps the repo secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SERVICE_ROLE`) and `THESPORTSDB_API_KEY` to these names.

### Database
- Tables the app uses: `teams_v2`, `standings_v2`, `events_v2`, `player_statistics`, `players_v2`, `kleague_player_links`, `leagues`.
- Views the app uses: `top_scorers`, `top_assisters`, `players_v2_current` (migration 24: each team's latest roster snapshot, the same rule as `src/lib/roster-snapshot.ts`; read by `/players` and the global search) and `sync_status` (migration 21: last successful time per sync step from `sync_runs`; the home page's as-of times).
- `v2_events_enhanced` still exists in the DB, but the app no longer reads it.
- RLS is on; anon can only read (migration 16). Views use `security_invoker` (migrations 17, 21, 24). `event_timelines` and `kleague_player_birthdates` are service-role only; anon can read only `step`, `startedAt`, `finishedAt` and `ok` of `sync_runs` (not `id` or `error`).
- New schema changes go in a new numbered file in `scripts/migrations/`. The user applies them by hand in the Supabase SQL Editor, so make them safe to re-run, and don't merge code that needs a migration before it is applied.
- Production data writes need the user's permission. For read-only checks use the anon key.

### Script Imports
Scripts run with `tsx`. Existing scripts import TypeScript modules with a `.js` extension (`import { supa } from './lib/supabase.js'`), which tsx resolves to the `.ts` file; follow the surrounding file's style.

## Build & Deployment
- Vercel deploys `main` to production on every merge; pull requests get preview deployments.
- `vercel.json` rewrites every non-`/assets/` path to `/` for client-side routing and sets cache and security headers.
- `.github/workflows/ci-cd.yml` runs typecheck, tests and build on pushes to `main`, PRs into `main`, and manual dispatch. `keepalive.yml` runs weekly so GitHub does not disable the scheduled workflows after 60 days without activity (this keeps the 6-hour fallback alive).

## Development Workflow
1. Work on a feature branch; open a PR into `main`.
2. Use the three-role pipeline above for non-trivial changes.
3. Before committing: `pnpm typecheck`, `pnpm lint:unused`, `pnpm test`, `pnpm build`.
4. After merging, check the change on the production site (allleaguesfans.vercel.app).
5. Never commit secrets (`.env*` files are ignored). List env variable names only, never their values.
