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
- `src/components/` - Reusable UI components (standings, fixtures, team lineups)
- `src/hooks/` - Custom React hooks (API utilities, data fetching)
- `src/styles/` - Global styles and component-specific styling
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

### Data Sources Integration
- **Primary Sources**: K League API, TheSportsDB, Highlightly API
- **Supported Leagues**: K League 1 (ID: 4001), K League 2 (ID: 4002)
- **Season**: 2025 (current active season)
- **Rate Limiting**: Built-in retry logic and delay handling

### Database Schema
- **Primary Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Schema Files**: 
  - `01-drop-all-tables.sql` - Clean database reset
  - `02-create-all-tables.sql` - Complete schema creation with indexes and policies
- **Key Tables**: leagues, teams, players, fixtures, events, standings, lineups

### Import Scripts
- **Primary Sync**: `scripts/sync-kleague-final.ts` - Complete K League data synchronization
- **Environment Check**: `scripts/env-check.ts` - Validates all required environment variables
- **Data Verification**: `scripts/final-verification.ts` - Comprehensive data quality validation
- **Schema Check**: `scripts/check-database-schema.ts` - Database schema verification
- **API Endpoints**: `scripts/fix-api-endpoints-simple.ts` - API endpoint configuration

### Environment Variables
#### Required for 3-API Integration System
```bash
# Supabase Configuration (supports both formats for cross-environment compatibility)
SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_URL=https://your-project.supabase.co  # Alternative format
SUPABASE_SERVICE_ROLE=your-service-role-key         # For admin operations
VITE_SUPABASE_ANON_KEY=your-anon-key               # For client operations

# 3-API Integration System Configuration
# K League Official API: No key required (free public API)
# TheSportsDB Premium API: Enhanced metadata and images
THESPORTSDB_API_KEY=your-thesportsdb-premium-key

# Highlightly API: Real-time live match data
HIGHLIGHTLY_API_KEY=your-highlightly-api-key

# Optional Configuration
SEASON_YEAR=2025          # Target season for imports
NODE_ENV=production       # Environment indicator
```

#### New Data Source Benefits
- **K League Official API**: 공식 정확한 데이터 (무료)
- **TheSportsDB**: 팀 로고, 선수 이미지, 풍부한 메타데이터
- **Highlightly API**: 실시간 라이브 매치 데이터, 하이라이트
- **Cost Optimization**: 100% 무료 K-League 데이터
- **Data Reliability**: 공식 소스로 정확성 확보

#### Environment Variable Debugging
- Run `npx tsx scripts/env-check.ts` to validate all environment variables
- Supports both GitHub Actions and local development environments
- Provides masked output for sensitive keys with detailed diagnostics

### GitHub Actions CI/CD (3-API Integration)
- **Primary Workflow**: `.github/workflows/triple-api-sync.yml`
- **Legacy Workflow**: `.github/workflows/data-sync.yml` (deprecated)
- **Enhanced Schedule**: 
  - Daily sync: 2:00 AM UTC (11:00 AM KST) - 3-API 통합 데이터 동기화
  - Weekly sync: Monday 3:00 AM UTC - 전체 3-API 데이터 재동기화
  - Live sync: Weekend 10-15 UTC (19-24 KST) - 실시간 라이브 매치 데이터
  - Manual trigger: Available via GitHub Actions UI
- **3-API Integration Features**:
  - Multi-API environment validation (K League + TheSportsDB + Highlightly)
  - Intelligent API fallback and error resilience
  - Real-time live match data synchronization
  - Comprehensive data quality validation across all APIs
  - Cost-optimized scheduling with peak-hour live updates

### Data Import Troubleshooting

#### Common Issues & Solutions

**Environment Variable Errors:**
```bash
# Check environment setup
npx tsx scripts/env-check.ts

# Common fixes:
# 1. Ensure both SUPABASE_URL and VITE_SUPABASE_URL are set
# 2. Verify SUPABASE_SERVICE_ROLE has admin permissions
```

**PostgreSQL Constraint Errors:**
```bash
# Error 42830: "there is no unique constraint matching given keys"
# Fix: Update leagues table primary key structure
\i scripts/fix-leagues-primary-key-safe.sql

# Error 42601: "syntax error at or near 'RAISE'"
# Fix: Use corrected script with proper PL/pgSQL blocks
\i scripts/fix-leagues-primary-key-corrected.sql

# Error P0001: "cannot drop constraint because other objects depend on it"
# Fix: Use safe migration with dependency handling
\i scripts/fix-leagues-primary-key-safe.sql

# Verify fixes
\i scripts/quick-verify-leagues-fix.sql
```

**ON CONFLICT Specification Errors:**
```bash
# Error 42P10: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
# 1. First ensure database schema is up to date
\i scripts/fix-leagues-primary-key-safe.sql

# 2. Use improved import logic with proper conflict handling
npx tsx scripts/fix-import-upsert-logic.ts

# 3. Verify constraint structure
\i scripts/diagnose-leagues-dependencies.sql
```

**Database Connection Issues:**
```bash
# Test Supabase connection
npx tsx -e "
import { supa } from './scripts/lib/supabase.js';
console.log('✅ Connection test:', await supa.from('leagues').select('count').single());
"
```

**TypeScript Import Errors (ERR_MODULE_NOT_FOUND):**
```bash
# Error: Cannot find module './file.js' imported from './script.ts'
# Root Cause: TypeScript files imported with .js extension

# Common error pattern:
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/path/to/script.js' 
# imported from /path/to/another-script.ts

# Fix: Use .ts extension for TypeScript imports
# ❌ Wrong:
import { func } from "./module.js";

# ✅ Correct:
import { func } from "./module.ts";

# Quick fix command to find and check import issues:
grep -r "import.*\.js['\"]" scripts/ --include="*.ts"

# Verify fix with test import:
npx tsx -e "import { yourFunction } from './scripts/your-file.ts'; console.log('✅ Import successful');"
```

**Common TypeScript Import Fixes:**
```bash
# 1. Scripts directory imports
# Files: master-import-complete.ts, master-import-improved.ts, etc.
# Fix: Change .js to .ts in import statements

# 2. Library imports in scripts/lib/
# Fix: Update supabase.js → supabase.ts, kleague-api.js → kleague-api.ts

# 3. Src directory imports from scripts
# Fix: Update relative paths to use .ts extension

# Prevention: Always use .ts extension for TypeScript file imports
# GitHub Actions runs tsx which requires correct TypeScript import syntax
```

### Database Migration and Error Resolution Guide

#### Step-by-Step Fix Process
When encountering GitHub Actions data sync errors or PostgreSQL constraint violations:

1. **Diagnose the Problem**
   ```bash
   # Check current database state
   \i scripts/diagnose-leagues-dependencies.sql
   \i scripts/quick-verify-leagues-fix.sql
   ```

2. **Apply Safe Migration**
   ```bash
   # Fix leagues table primary key structure (resolves 42830, P0001 errors)
   \i scripts/fix-leagues-primary-key-safe.sql
   ```

3. **Verify Migration Success**
   ```bash
   # Ensure migration completed successfully
   \i scripts/quick-verify-leagues-fix.sql
   # Expected results: "CORRECT", "CORRECT", "CLEAN"
   ```

4. **Run Data Import**
   ```bash
   # Execute master import with fixed database structure
   SEASON_YEAR=2025 npx tsx scripts/sync-kleague-final.ts
   ```

5. **Validate Results**
   ```bash
   # Check GitHub Actions logs for resolved errors
   # No more 42830, P0001, or 42P10 errors should occur
   ```

#### Error Resolution Map
- **42830**: leagues table missing composite primary key → `fix-leagues-primary-key-safe.sql`
- **42601**: RAISE statement syntax error → `fix-leagues-primary-key-corrected.sql`  
- **P0001**: Constraint dependency error → `fix-leagues-primary-key-safe.sql`
- **42P10**: ON CONFLICT specification error → Apply migration first, then retry import
- **ERR_MODULE_NOT_FOUND**: TypeScript import with .js extension → Change .js to .ts in import statements

### Import Process Flow
1. **Environment Validation** - Verify all required variables and connections
2. **Database Migration** - Apply any necessary schema fixes using migration scripts
3. **Teams & Venues** - Import team information and stadium data  
4. **Players & Squads** - Import player profiles and team rosters
5. **Fixtures** - Import match schedules and results
6. **Events** - Import match events (goals, cards, substitutions)
7. **Standings** - Import league tables and rankings
8. **Statistics** - Import player and team statistics
9. **Quality Check** - Validate data integrity and completeness

### Performance Considerations
- **Rate Limiting**: API calls include automatic retry with exponential backoff
- **Batch Processing**: Large datasets processed in chunks to avoid timeouts
- **Foreign Key Validation**: Ensures referential integrity before inserting events
- **Duplicate Prevention**: Built-in duplicate detection and prevention mechanisms

## Script Reference

### Essential Data Scripts
```bash
# Full data import (recommended for initial setup)
SEASON_YEAR=2025 npx tsx scripts/sync-kleague-final.ts

# Environment validation (run before any script)
npx tsx scripts/env-check.ts

# Database schema setup (if needed)
psql -f 01-drop-all-tables.sql    # Reset database
psql -f 02-create-all-tables.sql  # Create schema

# Database integrity fixes (run if encountering constraint errors)
\i scripts/fix-leagues-primary-key-safe.sql        # Fix leagues primary key structure
\i scripts/quick-verify-leagues-fix.sql            # Verify migration results
\i scripts/diagnose-leagues-dependencies.sql       # Analyze dependencies
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

# TypeScript import validation (prevent GitHub Actions errors)
grep -r "import.*\.js['\"]" scripts/ --include="*.ts"  # Should return no results
npx tsx scripts/env-check.ts                           # Test environment setup

# Development server
pnpm dev               # Start development server with hot reload
```

### TypeScript Import Guidelines
```bash
# ✅ ALWAYS use .ts extension for TypeScript imports
import { func } from "./module.ts";
import { helper } from "./lib/utility.ts";
import { api } from "../src/lib/client.ts";

# ❌ NEVER use .js extension for TypeScript files (causes GitHub Actions errors)
import { func } from "./module.js";     # Will fail in tsx
import { helper } from "./lib/utility.js";  # Runtime module not found

# Validation commands to run before committing scripts:
1. Check for problematic imports: grep -r "import.*\.js['\"]" scripts/ --include="*.ts"
2. Test import syntax: npx tsx -e "import { testFunc } from './scripts/your-script.ts';"
3. Validate environment: npx tsx scripts/env-check.ts

# Quick fix for import errors:
find scripts/ -name "*.ts" -exec sed -i 's/\.js["'"'"']/\.ts["'"'"']/g' {} \;
```

### Debugging Commands
```bash
# Test Supabase connection
npx tsx -e "
import { supa } from './scripts/lib/supabase.js';
const { data, error } = await supa.from('teams').select('count');
console.log('Teams:', data, error);
"

# Monitor GitHub Actions logs
# Visit: https://github.com/your-repo/actions/workflows/data-sync.yml
```

### Data Quality Improvements
- **Duplicate Resolution**: Clean imports prevent player name duplicates
- **Data Source Consistency**: Single source of truth eliminates "Jeon Jin-woo" vs "Jinwoo" issues
- **Verification Scripts**: Automated duplicate detection and data integrity checks

## Recent Changes & Cleanup (2025-09-21)

### Widget Removal and Code Cleanup
- **Widget Components Removed**: All widget-related components have been removed from the codebase
  - Removed: `APIFootballGamesWidget`, `LiveStandingsWidget`, widget hooks, and related utilities
  - Simplified: `EnhancedFixturesSection` → `FixturesSection` (removed tab functionality)
  - Simplified: `EnhancedStandingsSection` → `StandingsSection` (removed widget integration)

### Dependency Optimization
- **Removed Unused Dependencies**: Cleaned up development dependencies for better performance
  - Removed: `@tailwindcss/postcss` (initially), `depcheck`, `knip`, `ts-prune`
  - Added: `glob` for script compatibility
  - **Note**: `@tailwindcss/postcss` was restored as it's required for TailwindCSS v4 build process

### Build Configuration
- **PostCSS Configuration**: Fixed build issues related to TailwindCSS v4
  - TailwindCSS v4 requires `@tailwindcss/postcss` package for production builds
  - Updated `postcss.config.js` to properly reference the PostCSS plugin

### Code Quality Improvements
- **Removed Unused Code**: Cleaned up unused imports, variables, and functions
  - Fixed TypeScript compilation errors
  - Improved maintainability and reduced bundle size
  - Removed obsolete package.json scripts for deleted tools

## Important Notes
- **Never commit sensitive environment variables** to the repository
- **Always test scripts in development** before running in production
- **Monitor API rate limits** - External APIs have daily request limits
- **Database changes require schema updates** - Use SQL migration files
- **Korean language support** - Preserve Korean text in UI components
- **Environment compatibility** - Scripts support both local and CI/CD environments
