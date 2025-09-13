# API Football → Supabase Import Guide

## 🎯 Current Status: ✅ WORKING PROPERLY

API Football 데이터가 Supabase에 정상적으로 들어가고 있습니다.

### 📊 Current Database Status
- **Leagues**: 2 (K League 1, K League 2)
- **Seasons**: 4 (2024, 2025 for both leagues)
- **Teams**: 26 (12 K1 + 14 K2)
- **Players**: 1,421 players imported
- **Squad Memberships**: 2,896 records
- **Standings**: 39 records
- **Fixtures**: 0 (see notes below)

## 🔧 Environment Configuration

### Required Environment Variables (.env)
```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://whoszwxxwgmpdfckmcgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_URL=https://whoszwxxwgmpdfckmcgh.supabase.co
SUPABASE_SERVICE_ROLE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_LOGO_BUCKET=logos

# API Football Configuration
API_FOOTBALL_KEY=cf3c7f305e193b6d6fd3fa9c7160cb27
API_FOOTBALL_K1_ID=292  # K League 1
API_FOOTBALL_K2_ID=293  # K League 2

# Optional: Override season (defaults to current year)
SEASON_YEAR=2024
```

## 🚀 Import Scripts Usage

### 1. Basic League and Team Setup
```bash
# Generate seed files from API Football
npx tsx scripts/seed-api-football-kleague.ts

# Import leagues and teams to Supabase
npx tsx scripts/supabase-import-kleague.ts
```

### 2. Player and Squad Data
```bash
# Import all players and squad memberships
npx tsx scripts/import-squads.ts

# For specific season
SEASON_YEAR=2024 npx tsx scripts/import-squads.ts
```

### 3. Fixtures and Match Data
```bash
# Import fixtures, lineups, and events
npx tsx scripts/import-fixtures.ts

# For specific season
SEASON_YEAR=2024 npx tsx scripts/import-fixtures.ts
```

### 4. League Standings
```bash
# Import current standings
npx tsx scripts/import-standings.ts

# For specific season
SEASON_YEAR=2024 npx tsx scripts/import-standings.ts
```

### 5. Comprehensive Import (Recommended)
```bash
# Import all data types (players, fixtures, standings)
npx tsx scripts/master-import.ts
```

## 🔍 Verification and Debugging

### Check Database Status
```bash
# Comprehensive database verification
npx tsx scripts/final-verification.ts

# Simple database status check
npx tsx scripts/test-database.ts

# Debug API responses
npx tsx scripts/debug-api-response.ts

# Debug import process
npx tsx scripts/debug-import.ts
```

## 📋 Database Schema

### Core Tables
- **leagues**: League information (K1, K2)
- **seasons**: Season data by league and year
- **teams**: Team details with logos
- **team_seasons**: Team-league-season relationships
- **players**: Player profiles
- **squad_memberships**: Player-team assignments by season
- **fixtures**: Match schedules and results
- **standings**: League tables and rankings
- **lineups**: Match lineups
- **lineup_players**: Individual player lineup data
- **events**: Match events (goals, cards, etc.)

### Data Relationships
```
leagues → seasons → team_seasons → teams
                 → fixtures → events
                 → standings
teams → squad_memberships → players
fixtures → lineups → lineup_players → players
```

## ⚠️ Known Issues and Solutions

### 1. Missing Fixtures for Current Season (2025)
**Issue**: 2025 season may not have started yet, so fixtures might be empty or future-dated.
**Solution**: Use 2024 season data or wait for 2025 season to begin.

### 2. Rate Limiting
**Issue**: API Football has rate limits.
**Solution**: Scripts include automatic delays and retry logic.

### 3. Standings Conflicts
**Issue**: Duplicate key errors when re-importing standings.
**Solution**: Use the master import script which clears existing standings before import.

### 4. Season Configuration
**Issue**: Scripts default to current year (2025) which may not have complete data.
**Solution**: Set `SEASON_YEAR=2024` for complete historical data.

## 🎯 Recommended Workflow

### Initial Setup
1. Ensure environment variables are configured
2. Run basic setup: `npx tsx scripts/supabase-import-kleague.ts`
3. Run comprehensive import: `npx tsx scripts/master-import.ts`
4. Verify data: `npx tsx scripts/final-verification.ts`

### Regular Updates
```bash
# Daily updates for current season
SEASON_YEAR=2025 npx tsx scripts/import-fixtures.ts
SEASON_YEAR=2025 npx tsx scripts/import-standings.ts

# Weekly squad updates (for transfers)
SEASON_YEAR=2025 npx tsx scripts/import-squads.ts
```

## 🔧 Troubleshooting

### Common Commands
```bash
# Check API connection
curl -H "x-apisports-key: YOUR_API_KEY" https://v3.football.api-sports.io/status

# Check Supabase connection
npx tsx -e "import {supa} from './scripts/lib/supabase.js'; supa.from('leagues').select('*').limit(1).then(console.log)"

# Reset specific table (careful!)
npx tsx -e "import {supa} from './scripts/lib/supabase.js'; supa.from('TABLE_NAME').delete().gte('id', 0).then(console.log)"
```

### Debug Mode
Add console.log statements to any script for detailed debugging:
```typescript
console.log('API Response:', JSON.stringify(data, null, 2))
console.log('Insert result:', insertResult)
```

## 📈 Performance Notes

- Player imports: ~1,400 players in ~30 seconds
- Squad memberships: ~2,900 records in ~1 minute
- Fixtures: Varies by season (0-500+ fixtures)
- API calls are rate-limited to ~10 requests/second
- Total import time: ~5-10 minutes for complete dataset

## ✅ Success Indicators

The system is working properly when:
- ✅ leagues: 2 records
- ✅ seasons: 4+ records
- ✅ teams: 26 records  
- ✅ players: 1,000+ records
- ✅ squad_memberships: 2,000+ records
- ✅ Data connectivity tests pass

## 🆘 Support

If imports fail:
1. Check environment variables
2. Verify API key validity
3. Check Supabase connection
4. Run debug scripts to identify specific issues
5. Check API Football service status

All scripts include error handling and will show specific error messages for troubleshooting.