# GitHub Actions Troubleshooting Guide

## Overview
This guide addresses common GitHub Actions workflow failures encountered during automated data synchronization and provides systematic solutions.

## Common Error Patterns

### 1. PostgreSQL Constraint Violations

#### Error: 42830 - Missing Unique Constraint
```
ERROR: 42830: there is no unique constraint matching given keys for referenced table "leagues"
```

**Root Cause**: leagues table has single-column primary key but foreign keys expect composite key.

**Solution**:
```sql
\i scripts/fix-leagues-primary-key-safe.sql
```

**Prevention**: Ensure database schema matches expected foreign key structures.

#### Error: P0001 - Dependency Constraint
```
ERROR: P0001: cannot drop constraint leagues_pkey on table leagues because other objects depend on it
```

**Root Cause**: Attempting to modify primary key without handling foreign key dependencies.

**Solution**: Use safe migration script that handles dependencies:
```sql
\i scripts/fix-leagues-primary-key-safe.sql
```

### 2. Data Import Failures

#### Error: 42P10 - ON CONFLICT Specification
```
ERROR: 42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

**Root Cause**: UPSERT operations referencing non-existent unique constraints.

**Solution**:
1. Apply database migration first
2. Use corrected import logic
```bash
\i scripts/fix-leagues-primary-key-safe.sql
SEASON_YEAR=2025 npx tsx scripts/master-import-complete.ts
```

#### Error: 23503 - Foreign Key Violation
```
ERROR: 23503: insert or update on table "fixtures" violates foreign key constraint
Key (venue_id)=(1842) is not present in table "venues"
```

**Root Cause**: Missing reference data (venues, players, etc.).

**Solution**: Ensure proper import order and handle missing references gracefully.

### 3. Environment Configuration Issues

#### Missing Environment Variables
```
❌ Missing Supabase configuration
Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE
```

**Root Cause**: Environment variables not properly set in GitHub Actions.

**Solution**:
1. Verify GitHub Secrets configuration
2. Ensure variable names match script expectations
3. Check repository settings → Secrets and variables → Actions

#### API Rate Limiting
```
❌ Error: Request failed with status code 429
```

**Root Cause**: Exceeding API-Football rate limits.

**Solution**:
- Implement exponential backoff
- Add delays between requests
- Monitor API usage quotas

## Workflow Debugging

### 1. Log Analysis
```bash
# Check workflow logs for patterns
grep -i "error\|failed\|exception" workflow-logs.txt

# Filter specific error types
grep "42830\|P0001\|42P10" workflow-logs.txt

# Check environment setup
grep "environment\|variable" workflow-logs.txt
```

### 2. Manual Reproduction
```bash
# Reproduce locally
export SUPABASE_URL="your-url"
export SUPABASE_SERVICE_ROLE="your-key"
export API_FOOTBALL_KEY="your-key"

# Run same commands as workflow
npx tsx scripts/env-check.ts
SEASON_YEAR=2025 npx tsx scripts/master-import-complete.ts
```

### 3. Database State Verification
```sql
-- Check database state before workflow
\i scripts/diagnose-leagues-dependencies.sql

-- Verify schema integrity
SELECT table_name, constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')
ORDER BY table_name;
```

## Resolution Workflow

### For Constraint Violations (42830, P0001)
1. **Identify the Issue**
   ```bash
   # Check workflow logs for specific error codes
   ```

2. **Apply Database Migration**
   ```sql
   \i scripts/fix-leagues-primary-key-safe.sql
   ```

3. **Verify Fix**
   ```sql
   \i scripts/quick-verify-leagues-fix.sql
   ```

4. **Re-run Workflow**
   - Manually trigger GitHub Actions workflow
   - Monitor for resolved errors

### For Import Failures (42P10, 23503)
1. **Ensure Database Migration Complete**
   ```sql
   \i scripts/quick-verify-leagues-fix.sql
   ```

2. **Check Import Logic**
   ```bash
   # Test import with better error handling
   SEASON_YEAR=2025 npx tsx scripts/master-import-complete.ts
   ```

3. **Handle Missing References**
   - Identify missing venues, players, etc.
   - Update import logic to handle gracefully
   - Ensure proper import order

### For Environment Issues
1. **Validate GitHub Secrets**
   - Check repository settings
   - Verify secret names match expectations
   - Ensure secrets have proper permissions

2. **Test Environment Setup**
   ```bash
   # In workflow or locally
   npx tsx scripts/env-check.ts
   ```

3. **Debug Variable Access**
   ```yaml
   # Add to workflow for debugging
   - name: Debug Environment
     run: |
       echo "SUPABASE_URL length: ${#SUPABASE_URL}"
       echo "API_FOOTBALL_KEY length: ${#API_FOOTBALL_KEY}"
   ```

## Prevention Strategies

### 1. Database Schema Validation
- Include schema verification in workflow
- Test migrations in staging environment
- Maintain database schema documentation

### 2. Comprehensive Testing
```yaml
# Add to workflow
- name: Validate Database Schema
  run: |
    psql $DATABASE_URL -f scripts/quick-verify-leagues-fix.sql

- name: Test Environment
  run: |
    npx tsx scripts/env-check.ts
```

### 3. Error Handling
- Implement retry logic for transient failures
- Add meaningful error messages
- Include troubleshooting hints in error output

### 4. Monitoring
- Set up alerts for workflow failures
- Monitor API usage and rate limits
- Track database performance during imports

## Workflow Configuration Best Practices

### Environment Variables
```yaml
env:
  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}  # Fallback
  SUPABASE_SERVICE_ROLE: ${{ secrets.SUPABASE_SERVICE_ROLE }}
  API_FOOTBALL_KEY: ${{ secrets.API_FOOTBALL_KEY }}
  SEASON_YEAR: 2025
```

### Error Handling
```yaml
- name: Data Import
  run: |
    set -e  # Exit on error
    npx tsx scripts/env-check.ts
    SEASON_YEAR=2025 npx tsx scripts/master-import-complete.ts
  continue-on-error: false  # Fail workflow on error
```

### Conditional Execution
```yaml
- name: Apply Database Fixes
  run: |
    # Only run if migration needed
    if ! npx tsx scripts/quick-verify-leagues-fix.sql; then
      psql $DATABASE_URL -f scripts/fix-leagues-primary-key-safe.sql
    fi
```

## Emergency Procedures

### Workflow Stuck/Hanging
1. Cancel running workflow
2. Check for database locks
3. Verify API connectivity
4. Restart with clean state

### Data Corruption
1. Stop all workflows
2. Restore from backup
3. Investigate root cause
4. Apply fixes before resuming

### API Quota Exhausted
1. Check API usage dashboard
2. Implement rate limiting
3. Consider caching strategies
4. Plan import schedule around quotas

## Monitoring and Alerts

### Key Metrics
- Workflow success rate
- Import completion time
- Database constraint violations
- API error rates

### Alert Conditions
- Workflow failures > 2 consecutive runs
- Database errors increase > 50%
- Import time exceeds expected duration
- API quota utilization > 80%

### Dashboard Setup
- GitHub Actions workflow status
- Database health metrics
- API usage tracking
- Error rate monitoring