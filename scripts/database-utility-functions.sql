-- database-utility-functions.sql
-- Additional utility functions for database validation and statistics

-- =====================================================
-- Get Import Statistics Function
-- =====================================================

CREATE OR REPLACE FUNCTION get_import_stats(season INTEGER DEFAULT 2025)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'countries', (SELECT COUNT(*) FROM countries),
        'leagues', (SELECT COUNT(*) FROM leagues WHERE season_year = season),
        'teams', (SELECT COUNT(*) FROM teams WHERE season_year = season),
        'venues', (SELECT COUNT(*) FROM venues),
        'players', (SELECT COUNT(*) FROM players WHERE season_year = season),
        'fixtures', (SELECT COUNT(*) FROM fixtures WHERE season_year = season),
        'events', (SELECT COUNT(*) FROM events 
                  WHERE fixture_id IN (SELECT id FROM fixtures WHERE season_year = season)),
        'standings', (SELECT COUNT(*) FROM standings WHERE season_year = season),
        'player_statistics', (SELECT COUNT(*) FROM player_statistics WHERE season_year = season),
        'squads', (SELECT COUNT(*) FROM squads WHERE season_year = season)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Clean Orphaned Data Function
-- =====================================================

CREATE OR REPLACE FUNCTION clean_orphaned_data()
RETURNS TABLE(operation TEXT, records_cleaned INTEGER) AS $$
BEGIN
    -- Clean player statistics with invalid league references
    DELETE FROM player_statistics 
    WHERE (league_id, season_year) NOT IN (
        SELECT id, season_year FROM leagues
    );
    
    GET DIAGNOSTICS records_cleaned = ROW_COUNT;
    operation := 'player_statistics_orphaned_leagues';
    RETURN NEXT;
    
    -- Clean fixtures with invalid venue references
    UPDATE fixtures 
    SET venue_id = NULL 
    WHERE venue_id IS NOT NULL 
    AND venue_id NOT IN (SELECT id FROM venues);
    
    GET DIAGNOSTICS records_cleaned = ROW_COUNT;
    operation := 'fixtures_invalid_venues';
    RETURN NEXT;
    
    -- Clean events with invalid fixture references
    DELETE FROM events 
    WHERE fixture_id NOT IN (SELECT id FROM fixtures);
    
    GET DIAGNOSTICS records_cleaned = ROW_COUNT;
    operation := 'events_orphaned_fixtures';
    RETURN NEXT;
    
    -- Clean lineups with invalid fixture references
    DELETE FROM lineups 
    WHERE fixture_id NOT IN (SELECT id FROM fixtures);
    
    GET DIAGNOSTICS records_cleaned = ROW_COUNT;
    operation := 'lineups_orphaned_fixtures';
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Data Quality Report Function
-- =====================================================

CREATE OR REPLACE FUNCTION generate_data_quality_report(season INTEGER DEFAULT 2025)
RETURNS TABLE(
    category TEXT,
    metric TEXT,
    value INTEGER,
    status TEXT,
    recommendation TEXT
) AS $$
BEGIN
    -- Teams per league
    RETURN QUERY
    SELECT 
        'Coverage'::TEXT as category,
        'Teams per league'::TEXT as metric,
        COUNT(*)::INTEGER as value,
        CASE 
            WHEN COUNT(*) >= 10 THEN 'GOOD'::TEXT
            WHEN COUNT(*) >= 5 THEN 'FAIR'::TEXT
            ELSE 'POOR'::TEXT
        END as status,
        'K League typically has 12-14 teams per league'::TEXT as recommendation
    FROM teams 
    WHERE season_year = season 
    GROUP BY league_id;
    
    -- Fixtures with events coverage
    RETURN QUERY
    SELECT 
        'Quality'::TEXT as category,
        'Fixtures with events (%)'::TEXT as metric,
        (COUNT(DISTINCT e.fixture_id) * 100 / NULLIF(COUNT(DISTINCT f.id), 0))::INTEGER as value,
        CASE 
            WHEN (COUNT(DISTINCT e.fixture_id) * 100 / NULLIF(COUNT(DISTINCT f.id), 0)) >= 80 THEN 'GOOD'::TEXT
            WHEN (COUNT(DISTINCT e.fixture_id) * 100 / NULLIF(COUNT(DISTINCT f.id), 0)) >= 50 THEN 'FAIR'::TEXT
            ELSE 'POOR'::TEXT
        END as status,
        'Completed fixtures should have match events'::TEXT as recommendation
    FROM fixtures f
    LEFT JOIN events e ON f.id = e.fixture_id
    WHERE f.season_year = season AND f.status_short IN ('FT', 'AET', 'PEN');
    
    -- Players with statistics coverage
    RETURN QUERY
    SELECT 
        'Quality'::TEXT as category,
        'Players with statistics (%)'::TEXT as metric,
        (COUNT(DISTINCT ps.player_id) * 100 / NULLIF(COUNT(DISTINCT p.id), 0))::INTEGER as value,
        CASE 
            WHEN (COUNT(DISTINCT ps.player_id) * 100 / NULLIF(COUNT(DISTINCT p.id), 0)) >= 70 THEN 'GOOD'::TEXT
            WHEN (COUNT(DISTINCT ps.player_id) * 100 / NULLIF(COUNT(DISTINCT p.id), 0)) >= 40 THEN 'FAIR'::TEXT
            ELSE 'POOR'::TEXT
        END as status,
        'Most active players should have statistics'::TEXT as recommendation
    FROM players p
    LEFT JOIN player_statistics ps ON p.id = ps.player_id AND p.season_year = ps.season_year
    WHERE p.season_year = season;
    
    -- Venues coverage
    RETURN QUERY
    SELECT 
        'Coverage'::TEXT as category,
        'Fixtures with venues (%)'::TEXT as metric,
        (COUNT(*) FILTER (WHERE venue_id IS NOT NULL) * 100 / COUNT(*))::INTEGER as value,
        CASE 
            WHEN (COUNT(*) FILTER (WHERE venue_id IS NOT NULL) * 100 / COUNT(*)) >= 90 THEN 'GOOD'::TEXT
            WHEN (COUNT(*) FILTER (WHERE venue_id IS NOT NULL) * 100 / COUNT(*)) >= 70 THEN 'FAIR'::TEXT
            ELSE 'POOR'::TEXT
        END as status,
        'Most fixtures should have venue information'::TEXT as recommendation
    FROM fixtures 
    WHERE season_year = season;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Fix Data Inconsistencies Function
-- =====================================================

CREATE OR REPLACE FUNCTION fix_data_inconsistencies()
RETURNS TABLE(operation TEXT, status TEXT, details TEXT) AS $$
DECLARE
    record_count INTEGER;
BEGIN
    -- Fix missing player names (use firstname + lastname if name is null)
    UPDATE players 
    SET name = COALESCE(firstname, '') || ' ' || COALESCE(lastname, '')
    WHERE name IS NULL AND (firstname IS NOT NULL OR lastname IS NOT NULL);
    
    GET DIAGNOSTICS record_count = ROW_COUNT;
    operation := 'fix_missing_player_names';
    status := CASE WHEN record_count > 0 THEN 'FIXED' ELSE 'NO_ISSUES' END;
    details := 'Fixed ' || record_count || ' players with missing names';
    RETURN NEXT;
    
    -- Fix team names consistency (remove extra spaces, proper casing)
    UPDATE teams 
    SET name = TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g'))
    WHERE name ~ '\s{2,}' OR name ~ '^\s|\s$';
    
    GET DIAGNOSTICS record_count = ROW_COUNT;
    operation := 'fix_team_name_formatting';
    status := CASE WHEN record_count > 0 THEN 'FIXED' ELSE 'NO_ISSUES' END;
    details := 'Fixed formatting for ' || record_count || ' team names';
    RETURN NEXT;
    
    -- Fix fixture dates that are in the future but marked as finished
    UPDATE fixtures 
    SET status_short = 'NS', status_long = 'Not Started', elapsed = NULL
    WHERE date_utc > NOW() AND status_short IN ('FT', 'AET', 'PEN');
    
    GET DIAGNOSTICS record_count = ROW_COUNT;
    operation := 'fix_future_finished_fixtures';
    status := CASE WHEN record_count > 0 THEN 'FIXED' ELSE 'NO_ISSUES' END;
    details := 'Fixed ' || record_count || ' fixtures with incorrect status';
    RETURN NEXT;
    
    -- Fix standings with negative points (shouldn't happen in football)
    UPDATE standings 
    SET points = 0 
    WHERE points < 0;
    
    GET DIAGNOSTICS record_count = ROW_COUNT;
    operation := 'fix_negative_standings_points';
    status := CASE WHEN record_count > 0 THEN 'FIXED' ELSE 'NO_ISSUES' END;
    details := 'Fixed ' || record_count || ' standings with negative points';
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Performance Analysis Function
-- =====================================================

CREATE OR REPLACE FUNCTION analyze_query_performance()
RETURNS TABLE(
    table_name TEXT,
    estimated_rows BIGINT,
    index_usage TEXT,
    recommendation TEXT
) AS $$
BEGIN
    -- Analyze table sizes and suggest optimizations
    RETURN QUERY
    SELECT 
        schemaname || '.' || tablename as table_name,
        n_tup_ins as estimated_rows,
        CASE 
            WHEN seq_scan > idx_scan THEN 'LOW - More sequential than index scans'
            WHEN idx_scan > seq_scan * 10 THEN 'HIGH - Good index usage'
            ELSE 'MEDIUM - Moderate index usage'
        END as index_usage,
        CASE 
            WHEN seq_scan > idx_scan AND n_tup_ins > 1000 THEN 'Consider adding indexes for common queries'
            WHEN n_tup_del + n_tup_upd > n_tup_ins * 0.3 THEN 'Consider VACUUM ANALYZE due to high update/delete ratio'
            ELSE 'Performance looks acceptable'
        END as recommendation
    FROM pg_stat_user_tables 
    WHERE schemaname = 'public'
    ORDER BY n_tup_ins DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Backup Important Data Function
-- =====================================================

CREATE OR REPLACE FUNCTION backup_critical_data(season INTEGER DEFAULT 2025)
RETURNS TABLE(
    backup_table TEXT,
    record_count BIGINT,
    backup_status TEXT
) AS $$
BEGIN
    -- This function creates backup views of critical data
    -- Useful before running major data updates
    
    EXECUTE format('CREATE OR REPLACE VIEW backup_leagues_%s AS 
        SELECT * FROM leagues WHERE season_year = %s', season, season);
    
    backup_table := format('backup_leagues_%s', season);
    SELECT COUNT(*) INTO record_count FROM leagues WHERE season_year = season;
    backup_status := 'CREATED';
    RETURN NEXT;
    
    EXECUTE format('CREATE OR REPLACE VIEW backup_teams_%s AS 
        SELECT * FROM teams WHERE season_year = %s', season, season);
    
    backup_table := format('backup_teams_%s', season);
    SELECT COUNT(*) INTO record_count FROM teams WHERE season_year = season;
    backup_status := 'CREATED';
    RETURN NEXT;
    
    EXECUTE format('CREATE OR REPLACE VIEW backup_players_%s AS 
        SELECT * FROM players WHERE season_year = %s', season, season);
    
    backup_table := format('backup_players_%s', season);
    SELECT COUNT(*) INTO record_count FROM players WHERE season_year = season;
    backup_status := 'CREATED';
    RETURN NEXT;
    
    EXECUTE format('CREATE OR REPLACE VIEW backup_fixtures_%s AS 
        SELECT * FROM fixtures WHERE season_year = %s', season, season);
    
    backup_table := format('backup_fixtures_%s', season);
    SELECT COUNT(*) INTO record_count FROM fixtures WHERE season_year = season;
    backup_status := 'CREATED';
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Initialize Utility Functions
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Database utility functions created!';
    RAISE NOTICE '============================================';
    RAISE NOTICE '📊 get_import_stats(season) - Get import statistics';
    RAISE NOTICE '🧹 clean_orphaned_data() - Remove orphaned records';
    RAISE NOTICE '📋 generate_data_quality_report(season) - Quality analysis';
    RAISE NOTICE '🔧 fix_data_inconsistencies() - Fix common issues';
    RAISE NOTICE '⚡ analyze_query_performance() - Performance analysis';
    RAISE NOTICE '💾 backup_critical_data(season) - Create backups';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Usage examples:';
    RAISE NOTICE '  SELECT * FROM get_import_stats(2025);';
    RAISE NOTICE '  SELECT * FROM validate_data_integrity();';
    RAISE NOTICE '  SELECT * FROM generate_data_quality_report(2025);';
END $$;