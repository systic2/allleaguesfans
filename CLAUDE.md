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
- `/leagues`, `/leagues/:slug` – league list and league page (standings, fixtures, scorers, champions)
- `/teams/:id` – `TeamPageDB` (tabs via `?tab=overview|squad|fixtures|stats`)
- `/players/:id`, `/matches/:id`, `/search`

### Project Structure
- `src/app/` – router, layout, query client, shared app components (`GlobalSearch`, `CrestImg`, `Sidebar`); the per-route error boundary is in `layout/RootLayout.tsx`
- `src/pages/` – route components
- `src/components/` – page sections; `fm/` holds the league page boxes (`FMStandings`, `FMFixtures`, `FMPlayerStats`, `FMHistory`)
- `src/lib/api.ts` – most Supabase queries used by the pages
- `src/lib/thesportsdb-api.ts` – match details and team fixtures from `events_v2`
- `src/lib/highlightly-enhanced-fixtures-api.ts` – upcoming fixtures from the `v2_events_enhanced` view
- `src/lib/season.ts` – `getCurrentSeasonForFormat` (see Seasons below)
- `src/lib/mappers/` – pure parsing/aggregation functions used by the sync scripts (TheSportsDB mappers, timeline parsing, player-stats helpers); kept under `src/` so Vitest covers them
- `src/hooks/useTeamName.ts` – Korean team names (see below)
- `src/types/domain.ts`, `src/domain/types.ts` – domain types
- `scripts/sync/` – data sync (see Data Sync)
- `scripts/migrations/` – SQL migrations, applied by hand in the Supabase SQL Editor. Older files are mixed (duplicate numbers, some unnumbered); new ones continue the sequence (latest: 19)
- `scripts/one-off/`, `scripts/archive/` – old one-off scripts, not part of any pipeline

### Key Conventions
- **Team ids are strings.** `teams_v2.id` (and the team ids in `events_v2`, `standings_v2`, routes) is text and includes historical ids like `hist_*`; never `Number()` one. Some older types (`src/domain/types.ts`, parts of `api.ts`) still use numbers; use strings in new code.
- **Seasons**: K League (4689, 4822) uses single-year seasons (`'2026'`). The European leagues (4328 EPL, 4335 La Liga, 4332 Serie A, 4331 Bundesliga, 4334 Ligue 1) use split seasons stored as the start year (`'2025'` = 2025-26; the new season starts in July). Use `getCurrentSeasonForFormat(format)` instead of hard-coding a year (`highlightly-enhanced-fixtures-api.ts` still has old `2025` defaults). Team pages take the team's latest season from `fetchTeamDetails` (`currentSeason`).
- **Korean team names**: `teams_v2.nameKorean` is filled for every team (migration 19). Components call `const teamName = useTeamName()` and render `teamName(teamId, englishFallback)`; the hook loads all names once and falls back to the English name.
- **No fabricated data in new code.** Show `-` or an empty state when a value is not collected; do not invent ratings or placeholder stats. (Known leftovers: missing player-stat fields become `0` in `fetchPlayerDetail`, and migration 10 stores `0` for uncollected historical standings metrics.)
- Korean UI text; keep it Korean. Loading fallback text: "로딩중…".
- Path alias `@/` → `src/`.

## Agent Team Workflow (Claude Code + Codex CLI + Antigravity CLI)

For non-trivial fixes/features in this repo, use the three-role pipeline instead of a single agent doing everything end to end:

1. **Claude Code (implementer)** — investigates root cause, writes the actual code/config fix.
2. **Codex CLI (test writer)** — after the fix lands, invoke `codex exec -s workspace-write "<prompt>"` with the specific change described (what changed, why, which files) and ask it to write/extend the relevant Vitest tests under `src/tests/` and run them to confirm they pass. Keep its scope explicitly limited to the tests for that change.
3. **Independent verifier — Codex CLI second pass + Antigravity CLI (`agy`)** — after tests pass, run a second, independent `codex exec -s read-only --skip-git-repo-check "<prompt>"` review pass (fresh session, no memory of the implementation) with the diff and root-cause narrative, asking it to find bugs/missed edge cases/whether the fix addresses the root cause. Then cross-check with `agy -p "<prompt>" --dangerously-skip-permissions` (see note below) as a second independent model/vendor opinion on the same diff. Only move to commit/push once both come back clean (or concerns are addressed and re-verified).

**Gemini CLI (`gemini`) is currently unusable — do not use it.** Google removed "Sign in with Google" / OAuth for Gemini CLI on 2026-06-18 (including paid AI Pro/Ultra subscriber logins); only API-key auth remains, and the local key has no billing account attached, so every call 429s on the free-tier quota (confirmed 2026-08-09). Attaching billing to the key at aistudio.google.com/apikey would fix it, but that's a user decision, not something to do silently.

**Antigravity CLI (`agy`) is the working Google-account-based replacement** (`agy --version` confirms it's installed and already authenticated on this machine). Headless usage: `agy -p "<prompt>"`. In headless/print mode, `agy` soft-denies shell commands (e.g. `git show`, `git diff`) by default and returns "no output produced" instead of prompting — for a read-only review pass, add `--dangerously-skip-permissions` (safe here because the review prompt only asks it to read files/git history, never to edit). If `agy` is asked to make edits unattended, use `--mode=accept-edits` instead of the skip-permissions flag.

`codex` and `agy` are both pre-authenticated on this machine and confirmed working as of 2026-08-09 (verified during the K League 2026-season sync fix, see git log). `gemini` is on PATH but non-functional until its API key gets a billing account.


## Data Sync

### Pipeline
`.github/workflows/data-sync.yml` runs `pnpm sync:full` every hour (and on manual dispatch; runs never overlap). `scripts/sync/orchestrator.ts` does, in order:

1. **Standings and teams** from TheSportsDB → `standings_v2`, `teams_v2`
2. **Events** (fixtures and results) from TheSportsDB → `events_v2`
3. **K League player stats** (`lib/kleague-player-stats.ts`): goal/assist rankings from kleague.com `/record/rankSort.do` → `player_statistics`
4. **European player stats** (`lib/europe-player-stats.ts`): TheSportsDB v2 `event_timeline` per finished match, cached in `event_timelines` (migration 18), aggregated → `player_statistics`. Bounded per run (600 requests, 12-minute deadline, fair share per league); stats for a league are written only once every finished match is cached.

Any failed step makes the script exit 1 so the workflow run shows as failed.

Manual backfills, not run by the workflow: `import-historical-champions-euro.ts` (`standings_v2` history) and `import-team-players.ts`. `import-historical-standings.ts` is outdated: it still writes the old `standings` table, which migration 05 dropped.

### Environment Variables
Sync scripts (`scripts/sync/lib/supabase.ts`):
- `SUPABASE_URL` (or `VITE_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE` – service role key; only for scripts, never in the frontend
- `THESPORTSDB_API_KEY` – TheSportsDB premium key (v1 and v2 APIs)

Frontend (`src/lib/supabaseClient.ts`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

GitHub Actions maps the repo secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SERVICE_ROLE`) and `THESPORTSDB_API_KEY` to these names.

### Database
- Tables the app uses: `teams_v2`, `standings_v2`, `events_v2`, `player_statistics`, `players_v2`, `leagues`, plus the `v2_events_enhanced` view and `top_scorers` / `top_assisters`.
- RLS is on; anon can only read (migration 16). Views use `security_invoker` (migration 17). `event_timelines` is service-role only.
- New schema changes go in a new numbered file in `scripts/migrations/` and are applied manually in the Supabase SQL Editor. Make migrations safe to re-run.

### Script Imports
Scripts run with `tsx`. Existing scripts import TypeScript modules with a `.js` extension (`import { supa } from './lib/supabase.js'`), which tsx resolves to the `.ts` file; follow the surrounding file's style.

## Build & Deployment
- Vercel deploys `main` to production on every merge; pull requests get preview deployments.
- `vercel.json` rewrites every non-`/assets/` path to `/` for client-side routing and sets cache and security headers.
- `.github/workflows/ci-cd.yml` runs typecheck, tests and build on pushes to `main`, PRs into `main`, and manual dispatch. `keepalive.yml` runs weekly so GitHub does not disable the hourly sync schedule.

## Development Workflow
1. Work on a feature branch; open a PR into `main`.
2. Before committing: `pnpm typecheck`, `pnpm lint:unused`, `pnpm test`, `pnpm build`.
3. After merging, check the change on the production site.
4. Never commit secrets (`.env*` files are ignored).
