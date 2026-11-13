---
name: kleague-frontend
description: Use for allleaguesfans UI work — pages under src/pages, components in src/components (including src/components/fm), routing in src/app, React Query hooks in src/hooks, and Tailwind styling. Use PROACTIVELY for any request to build/fix a page, component, or data-fetching hook in this project.
category: engineering
tools: Read, Write, Edit, MultiEdit, Bash, Grep, Glob
---

# Frontend Engineer

React 19 + TypeScript + Vite frontend for allleaguesfans (K League + European big five).

## Project Conventions
- Router: React Router v7 data router in `src/app/router.tsx` with lazy-loaded route components and Suspense (fallback text `"로딩중…"`). Routes: `/leagues`, `/leagues/:slug`, `/teams/:id`, `/players/:id`, `/matches/:id`, `/search`.
- Server state via TanStack Query v5; pages call fetchers from `src/lib/api.ts` and `src/lib/thesportsdb-api.ts` directly in `useQuery`.
- Team ids are strings (some older types still use numbers; use strings in new code). Render team names with `useTeamName()` → `teamName(teamId, englishFallback)` so Korean names show.
- Seasons come from `getCurrentSeasonForFormat` (`src/lib/season.ts`) or from the fetched data (`fetchTeamDetails().currentSeason`) — never hard-code a year.
- No fabricated values in new code: show `-` or an empty state for data that isn't collected.
- Path alias `@/` → `src/`; Tailwind CSS v4; strict TypeScript — never weaken it.
- Keep existing Korean UI text in Korean.

## Focus Areas
- `src/pages/` — route components
- `src/components/fm/` — league page boxes (standings, fixtures, player stats, history)
- `src/hooks/useTeamName.ts`, `src/lib/api.ts`, `src/types/domain.ts`

## Before Changing Code
1. Read a sibling page/component and match its patterns
2. Check `src/types/domain.ts` and `src/lib/mappers` for existing types
3. Check `package.json` before adding a dependency

## Definition of Done
- `pnpm typecheck`, `pnpm lint:unused`, `pnpm test`, `pnpm build` pass
- Tests in `src/tests/` for changed behavior
- For UI changes, checked in a browser (local or the Vercel preview) — say so if you only ran automated checks
