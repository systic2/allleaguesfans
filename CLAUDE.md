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

## Data Import & Management

### API-Football Integration
- **API Provider**: API-Football (v3.football.api-sports.io)
- **Supported Leagues**: K League 1 (ID: 292), K League 2 (ID: 293)
- **Season**: 2025 (current active season)
- **Rate Limiting**: Built-in retry logic and delay handling

### Database Schema
- **Primary Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Schema Files**: 
  - `01-drop-all-tables.sql` - Clean database reset
  - `02-create-all-tables.sql` - Complete schema creation with indexes and policies
- **Key Tables**: leagues, teams, players, fixtures, events, standings, lineups

### Import Scripts
- **Master Import**: `scripts/master-import-complete.ts` - Full data synchronization
- **Event Import Fix**: `scripts/fix-event-import-schema-mismatch.ts` - Resolves schema mismatches
- **Environment Check**: `scripts/env-check.ts` - Validates all required environment variables
- **Table Structure**: `scripts/check-events-table-structure.ts` - Database schema verification

### Environment Variables
#### Required for Scripts
```bash
# Supabase Configuration (supports both formats for cross-environment compatibility)
SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_URL=https://your-project.supabase.co  # Alternative format
SUPABASE_SERVICE_ROLE=your-service-role-key         # For admin operations
VITE_SUPABASE_ANON_KEY=your-anon-key               # For client operations

# API-Football Configuration  
API_FOOTBALL_KEY=your-api-football-key

# Optional
SEASON_YEAR=2025          # Target season for imports
NODE_ENV=production       # Environment indicator
```

#### Environment Variable Debugging
- Run `npx tsx scripts/env-check.ts` to validate all environment variables
- Supports both GitHub Actions and local development environments
- Provides masked output for sensitive keys with detailed diagnostics

### GitHub Actions CI/CD
- **Workflow**: `.github/workflows/data-sync.yml`
- **Schedule**: 
  - Daily sync: 2:00 AM UTC (11:00 AM KST) - Incremental updates
  - Weekly sync: Monday 3:00 AM UTC - Full data refresh
  - Manual trigger: Available via GitHub Actions UI
- **Features**:
  - Pre-flight environment validation
  - Error resilience with non-critical failure handling  
  - Detailed logging and status reporting
  - Workflow completion summary

### Data Import Troubleshooting

#### Common Issues & Solutions

**Environment Variable Errors:**
```bash
# Check environment setup
npx tsx scripts/env-check.ts

# Common fixes:
# 1. Ensure both SUPABASE_URL and VITE_SUPABASE_URL are set
# 2. Verify SUPABASE_SERVICE_ROLE has admin permissions
# 3. Check API_FOOTBALL_KEY validity
```

**Event Import Schema Issues:**
```bash
# Check database table structure
npx tsx scripts/check-events-table-structure.ts

# Fix schema mismatches (event_type vs type columns)
npx tsx scripts/fix-event-import-schema-mismatch.ts
```

**Database Connection Issues:**
```bash
# Test Supabase connection
npx tsx -e "
import { supa } from './scripts/lib/supabase.js';
console.log('✅ Connection test:', await supa.from('leagues').select('count').single());
"
```

### Import Process Flow
1. **Environment Validation** - Verify all required variables and connections
2. **Teams & Venues** - Import team information and stadium data  
3. **Players & Squads** - Import player profiles and team rosters
4. **Fixtures** - Import match schedules and results
5. **Events** - Import match events (goals, cards, substitutions)
6. **Standings** - Import league tables and rankings
7. **Statistics** - Import player and team statistics
8. **Quality Check** - Validate data integrity and completeness

### Performance Considerations
- **Rate Limiting**: API calls include automatic retry with exponential backoff
- **Batch Processing**: Large datasets processed in chunks to avoid timeouts
- **Foreign Key Validation**: Ensures referential integrity before inserting events
- **Duplicate Prevention**: Built-in duplicate detection and prevention mechanisms

## Script Reference

### Essential Data Scripts
```bash
# Full data import (recommended for initial setup)
SEASON_YEAR=2025 npx tsx scripts/master-import-complete.ts

# Environment validation (run before any script)
npx tsx scripts/env-check.ts

# Fix event import issues (if events are missing)
npx tsx scripts/fix-event-import-schema-mismatch.ts

# Check database table structure
npx tsx scripts/check-events-table-structure.ts

# Database schema setup (if needed)
psql -f 01-drop-all-tables.sql    # Reset database
psql -f 02-create-all-tables.sql  # Create schema
```

### Development Best Practices
```bash
# Pre-commit workflow
pnpm typecheck          # Type checking
pnpm lint:unused       # Clean unused imports  
pnpm build             # Production build test
pnpm test              # Run all tests

# Code quality checks
pnpm deps:check        # Find unused dependencies
pnpm exports:check     # Find unused exports
pnpm files:check       # Comprehensive dead code analysis

# Development server
pnpm dev               # Start development server with hot reload
```

### Debugging Commands
```bash
# Check API-Football connection
curl -H "x-apisports-key: $API_FOOTBALL_KEY" \
     "https://v3.football.api-sports.io/leagues?id=292&season=2025"

# Test Supabase connection
npx tsx -e "
import { supa } from './scripts/lib/supabase.js';
const { data, error } = await supa.from('teams').select('count');
console.log('Teams:', data, error);
"

# Monitor GitHub Actions logs
# Visit: https://github.com/your-repo/actions/workflows/data-sync.yml
```

## Important Notes
- **Never commit sensitive environment variables** to the repository
- **Always test scripts in development** before running in production
- **Monitor API rate limits** - API-Football has daily request limits
- **Database changes require schema updates** - Use SQL migration files
- **Korean language support** - Preserve Korean text in UI components
- **Environment compatibility** - Scripts support both local and CI/CD environments