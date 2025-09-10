# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands
- **Dev server**: `pnpm dev` (runs Vite development server)
- **Build**: `pnpm build` (includes typecheck + Vite build)
- **Type checking**: `pnpm typecheck` (runs `tsc -b`)
- **Linting**: `pnpm lint:unused` (ESLint with unused imports cleanup)
- **Testing**: `vitest` (Vitest test runner with jsdom environment)

### Code Quality & Analysis
- **Dependency check**: `pnpm deps:check` (uses depcheck for unused dependencies)
- **Exports analysis**: `pnpm exports:check` (uses ts-prune to find unused exports)
- **Dead code detection**: `pnpm files:check` (uses knip for comprehensive analysis)
- **Bundle analysis**: `pnpm analyze:bundle` (sets ANALYZE=1 and builds with rollup-plugin-visualizer)

### Package Management
- Uses **pnpm** as the package manager (pnpm-lock.yaml present)
- All scripts should be run with `pnpm` prefix

## Architecture Overview

### Technology Stack
- **React 19** with TypeScript in strict mode
- **React Router DOM v7** for client-side routing with lazy loading
- **TanStack React Query v5** for server state management
- **Supabase** as the backend/database service
- **Tailwind CSS v4** for styling
- **Vite** as the build tool with SWC for Fast Refresh
- **Vitest** for testing with jsdom environment
- **Zod v4** for schema validation

### Project Structure
- `src/app/` - Core application setup (router, layout, query client, shared components)
- `src/pages/` - Route components (leagues, teams, players, search)
- `src/lib/` - Utilities and API layer (Supabase client, common fetch functions)
- `src/domain/` - Type definitions for core entities
- `src/features/` - Feature-specific code and APIs
- `src/components/` - Reusable UI components
- `src/tests/` - Test files and setup

### Key Patterns

#### Routing & Code Splitting
- Uses React Router v7 with lazy-loaded route components
- All page components are dynamically imported with Suspense
- Korean fallback loading text: "로딩중…"

#### State Management
- React Query for server state with centralized query client
- Supabase client configured with environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- Local component state for UI-only concerns

#### TypeScript Configuration
- Composite TypeScript setup with `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- Strict type checking enabled
- Path alias `@/` maps to `src/` directory

#### API Layer Design
- Centralized API functions in `src/lib/api.ts`
- Generic `getJson()` and `postJson()` utilities for HTTP requests
- Domain-specific "Lite" types for API responses
- Supabase queries with proper error handling and type mapping

#### Code Quality Configuration
- ESLint v9 flat config with TypeScript, React, and React Hooks plugins
- Unused imports plugin for automatic cleanup
- Different rule sets for different directories (scripts, pages, tests)
- `@typescript-eslint/no-explicit-any` disabled for pages/features during development

### Database & Search
- Uses Supabase PostgreSQL with typed queries
- Global search implementation supporting leagues and teams
- Search results use discriminated union types (`SearchRow`)
- Korean language support in UI text

### Testing Setup
- Vitest with jsdom environment
- Testing Library React for component testing
- Setup file at `src/tests/setup.ts`
- Test files use `.test.ts` or `.test.tsx` extensions

### Build & Deployment
- Vite configuration with bundle analyzer (rollup-plugin-visualizer)
- Environment-specific sourcemaps (disabled in production)
- Vercel deployment configuration (`vercel.json`)

## Development Workflow

1. Always run `pnpm typecheck` before committing changes
2. Use `pnpm lint:unused` to clean up unused imports
3. Run dependency checks periodically with quality analysis commands
4. Korean text is used in UI components - preserve language consistency
5. Follow existing naming patterns for components and files