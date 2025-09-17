# Database Migration Guide

## Overview
This guide covers the database migration scripts created to resolve PostgreSQL constraint violations and GitHub Actions data sync errors.

## Problem Summary
The original issues encountered were:
- **PostgreSQL Error 42830**: Missing composite primary key in leagues table
- **PostgreSQL Error P0001**: Cannot drop constraint due to dependencies
- **PostgreSQL Error 42P10**: ON CONFLICT specification errors
- **GitHub Actions failures**: Data sync workflow errors due to constraint violations

## Migration Scripts

### 1. `fix-leagues-primary-key-safe.sql`
**Purpose**: Comprehensive migration script that safely updates the leagues table primary key structure.

**Features**:
- Analyzes foreign key dependencies before making changes
- Creates automatic backups of affected tables
- Temporarily removes foreign key constraints
- Removes duplicate records safely
- Creates composite primary key (id, season_year)
- Recreates foreign key constraints with proper structure
- Includes verification and cleanup procedures

**Usage**:
```sql
\i scripts/fix-leagues-primary-key-safe.sql
```

**Expected Output**:
```
=== ANALYZING FOREIGN KEY DEPENDENCIES ===
✅ Backed up leagues table: X records
🔧 Temporarily dropping foreign key constraints...
✅ Removed X duplicate records
✅ Added composite primary key (id, season_year)
✅ Added X foreign key constraints
🎉 LEAGUES PRIMARY KEY FIX COMPLETED!
```

### 2. `quick-verify-leagues-fix.sql`
**Purpose**: Verification script to confirm migration success.

**Checks**:
- Primary key structure (should be composite: id, season_year)
- Foreign key constraint status
- Duplicate record detection
- Sample data display

**Usage**:
```sql
\i scripts/quick-verify-leagues-fix.sql
```

**Expected Results**:
- Primary Key Check: ✅ CORRECT
- Foreign Key Check: ✅ CORRECT
- Duplicate Check: ✅ CLEAN

### 3. `diagnose-leagues-dependencies.sql`
**Purpose**: Diagnostic script to analyze current database state and dependencies.

**Analysis Includes**:
- Foreign key dependencies on leagues table
- Current primary key structure
- Composite key references
- Sample data structure
- Referencing table structures
- Constraint removal order strategy

**Usage**:
```sql
\i scripts/diagnose-leagues-dependencies.sql
```

### 4. `fix-import-upsert-logic.ts`
**Purpose**: TypeScript utilities for safe database operations with improved UPSERT logic.

**Functions**:
- `safeVenueUpsert()`: Handle venue data with conflict resolution
- `safeStandingsUpsert()`: Standings UPSERT with composite key support
- `safeEventsUpsert()`: Event data handling with fixture validation
- `safePlayerStatsUpsert()`: Player statistics with league validation
- `safeBatchUpsert()`: Batch operations with error handling

**Usage**:
```typescript
import { safeStandingsUpsert } from './fix-import-upsert-logic.js';
await safeStandingsUpsert(standingsData);
```

## Migration Process

### Step 1: Diagnosis
```sql
-- Check current state
\i scripts/diagnose-leagues-dependencies.sql
\i scripts/quick-verify-leagues-fix.sql
```

### Step 2: Migration
```sql
-- Apply safe migration
\i scripts/fix-leagues-primary-key-safe.sql
```

### Step 3: Verification
```sql
-- Verify success
\i scripts/quick-verify-leagues-fix.sql
```

### Step 4: Data Import
```bash
# Run master import with fixed database
SEASON_YEAR=2025 npx tsx scripts/master-import-complete.ts
```

## Error Resolution

### PostgreSQL Error Codes

#### 42830: Missing Unique Constraint
```
ERROR: there is no unique constraint matching given keys for referenced table "leagues"
```
**Solution**: Apply `fix-leagues-primary-key-safe.sql` to create composite primary key.

#### P0001: Dependency Constraint
```
ERROR: cannot drop constraint leagues_pkey on table leagues because other objects depend on it
```
**Solution**: Use `fix-leagues-primary-key-safe.sql` which handles dependencies safely.

#### 42P10: ON CONFLICT Specification
```
ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification
```
**Solution**: Ensure database migration is complete, then retry import operations.

## Safety Features

### Backup Creation
All migration scripts create automatic backups:
- `leagues_backup_safe` - Complete leagues table backup
- `teams_backup_safe` - Teams table backup (if exists)
- `fixtures_backup_safe` - Fixtures table backup (if exists)

### Rollback Capability
If migration fails:
1. Backup tables are preserved
2. Manual intervention guidance provided
3. Original state can be restored from backups

### Dependency Management
- Automatic foreign key constraint discovery
- Safe temporary removal and recreation
- Proper constraint ordering
- Validation of constraint recreation

## Verification Commands

### Check Migration Status
```sql
-- Quick verification
\i scripts/quick-verify-leagues-fix.sql

-- Detailed analysis
\i scripts/diagnose-leagues-dependencies.sql

-- Manual check
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'leagues';
```

### Validate Data Import
```bash
# Check for remaining errors
SEASON_YEAR=2025 npx tsx scripts/master-import-complete.ts 2>&1 | grep -i error

# Test specific imports
npx tsx scripts/env-check.ts
```

## Best Practices

1. **Always diagnose before migrating**
2. **Verify migration success before importing data**
3. **Keep backups until migration is fully validated**
4. **Test in development environment first**
5. **Monitor GitHub Actions for resolved errors**

## Troubleshooting

### Migration Fails
- Check backup tables exist
- Review error messages for specific issues
- Use diagnostic scripts to understand current state
- Consider manual intervention if automated fixes fail

### Import Still Fails After Migration
- Verify migration completed successfully
- Check for additional schema issues
- Review API-Football data structure changes
- Validate environment variables and connections

### Performance Issues
- Monitor migration execution time
- Check for table locks during migration
- Ensure adequate database resources
- Consider running during low-traffic periods