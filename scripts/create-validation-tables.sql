-- scripts/create-validation-tables.sql
-- Database schema for real-time lineup validation system
-- Execute after main schema creation

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Validation Logs Table
-- Tracks all validation operations for monitoring and analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS validation_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id INTEGER NOT NULL,
    season_year INTEGER NOT NULL,
    validation_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Validation metrics
    total_players INTEGER NOT NULL DEFAULT 0,
    valid_players INTEGER NOT NULL DEFAULT 0,
    issues_detected INTEGER NOT NULL DEFAULT 0,
    data_quality_score INTEGER NOT NULL DEFAULT 0 CHECK (data_quality_score >= 0 AND data_quality_score <= 100),
    
    -- Performance metrics
    duration_ms INTEGER NOT NULL DEFAULT 0,
    api_calls_made INTEGER NOT NULL DEFAULT 0,
    api_rate_limit JSONB, -- Store rate limit info from API-Football
    
    -- Status and metadata
    validation_status VARCHAR(20) DEFAULT 'completed' CHECK (validation_status IN ('completed', 'failed', 'partial')),
    error_message TEXT,
    triggered_by VARCHAR(50) DEFAULT 'manual', -- 'manual', 'scheduled', 'webhook', 'alert'
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraint (soft reference)
    CONSTRAINT fk_validation_logs_team 
        FOREIGN KEY (team_id, season_year) 
        REFERENCES teams(id, season_year) 
        ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_validation_logs_team_season ON validation_logs(team_id, season_year);
CREATE INDEX IF NOT EXISTS idx_validation_logs_timestamp ON validation_logs(validation_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_validation_logs_quality_score ON validation_logs(data_quality_score);
CREATE INDEX IF NOT EXISTS idx_validation_logs_status ON validation_logs(validation_status);

-- ============================================================================
-- Validation Results Table
-- Stores detailed validation results for each player
-- ============================================================================

CREATE TABLE IF NOT EXISTS validation_results (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    validation_log_id UUID NOT NULL REFERENCES validation_logs(id) ON DELETE CASCADE,
    
    -- Player identification
    player_id INTEGER NOT NULL,
    player_name VARCHAR(255) NOT NULL,
    team_id INTEGER NOT NULL,
    season_year INTEGER NOT NULL,
    
    -- Validation comparison data
    jersey_number_db INTEGER,
    jersey_number_api INTEGER,
    position_db VARCHAR(50),
    position_api VARCHAR(50),
    
    -- Validation results
    validation_status VARCHAR(30) NOT NULL CHECK (validation_status IN (
        'valid', 'jersey_mismatch', 'position_mismatch', 
        'missing_from_api', 'missing_from_db', 'transfer_detected'
    )),
    confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.00 CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),
    
    -- Issues and recommendations
    issues JSONB DEFAULT '[]'::jsonb, -- Array of issue descriptions
    
    -- Timestamps
    last_validated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Soft foreign key to players table
    CONSTRAINT fk_validation_results_team 
        FOREIGN KEY (team_id, season_year) 
        REFERENCES teams(id, season_year) 
        ON DELETE CASCADE
);

-- Indexes for validation results
CREATE INDEX IF NOT EXISTS idx_validation_results_validation_log ON validation_results(validation_log_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_player ON validation_results(player_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_team_season ON validation_results(team_id, season_year);
CREATE INDEX IF NOT EXISTS idx_validation_results_status ON validation_results(validation_status);
CREATE INDEX IF NOT EXISTS idx_validation_results_confidence ON validation_results(confidence_score DESC);

-- ============================================================================
-- Validation Alerts Table
-- Stores alerts generated from validation issues
-- ============================================================================

CREATE TABLE IF NOT EXISTS validation_alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Alert classification
    alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN (
        'jersey_conflict', 'player_missing', 'mass_changes', 
        'data_quality', 'transfer_detected', 'api_failure'
    )),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Associated entities
    team_id INTEGER NOT NULL,
    team_name VARCHAR(255) NOT NULL,
    season_year INTEGER NOT NULL DEFAULT 2025,
    league_id INTEGER,
    
    -- Alert content
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb, -- Additional alert details
    
    -- Alert lifecycle
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(100), -- User or system that resolved the alert
    resolution_notes TEXT,
    
    -- Auto-resolution settings
    auto_resolvable BOOLEAN DEFAULT FALSE,
    auto_resolve_after_hours INTEGER, -- Auto-resolve after X hours if not manually resolved
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_validation_alerts_team 
        FOREIGN KEY (team_id, season_year) 
        REFERENCES teams(id, season_year) 
        ON DELETE CASCADE
);

-- Indexes for alerts
CREATE INDEX IF NOT EXISTS idx_validation_alerts_team ON validation_alerts(team_id, season_year);
CREATE INDEX IF NOT EXISTS idx_validation_alerts_type_severity ON validation_alerts(alert_type, severity);
CREATE INDEX IF NOT EXISTS idx_validation_alerts_unresolved ON validation_alerts(resolved, created_at DESC) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_validation_alerts_created ON validation_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_validation_alerts_league ON validation_alerts(league_id) WHERE league_id IS NOT NULL;

-- ============================================================================
-- Transfer Flags Table
-- Tracks potential transfers and player status changes
-- ============================================================================

CREATE TABLE IF NOT EXISTS transfer_flags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Player identification
    player_id INTEGER NOT NULL,
    player_name VARCHAR(255) NOT NULL,
    
    -- Transfer details
    previous_team_id INTEGER,
    current_team_id INTEGER,
    season_year INTEGER NOT NULL DEFAULT 2025,
    
    -- Status change information
    status_change VARCHAR(20) NOT NULL CHECK (status_change IN (
        'transfer', 'loan', 'retirement', 'return', 'new_signing', 'release'
    )),
    detection_method VARCHAR(30) NOT NULL CHECK (detection_method IN (
        'api_comparison', 'missing_from_squad', 'manual_flag', 'lineup_analysis'
    )),
    confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.00 CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),
    
    -- Flag status
    flag_status VARCHAR(20) DEFAULT 'pending_review' CHECK (flag_status IN (
        'pending_review', 'confirmed', 'false_positive', 'investigating'
    )),
    
    -- Additional data
    metadata JSONB DEFAULT '{}'::jsonb, -- Store detection details
    notes TEXT, -- Manual notes from reviewers
    
    -- Review information
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    flagged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for transfer flags
CREATE INDEX IF NOT EXISTS idx_transfer_flags_player ON transfer_flags(player_id);
CREATE INDEX IF NOT EXISTS idx_transfer_flags_teams ON transfer_flags(previous_team_id, current_team_id);
CREATE INDEX IF NOT EXISTS idx_transfer_flags_status ON transfer_flags(flag_status, flagged_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_flags_season ON transfer_flags(season_year);
CREATE INDEX IF NOT EXISTS idx_transfer_flags_confidence ON transfer_flags(confidence_score DESC);

-- ============================================================================
-- Correction History Table
-- Tracks all automatic corrections applied to data
-- ============================================================================

CREATE TABLE IF NOT EXISTS correction_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Target of correction
    player_id INTEGER NOT NULL,
    player_name VARCHAR(255) NOT NULL,
    team_id INTEGER NOT NULL,
    season_year INTEGER NOT NULL,
    
    -- Correction details
    correction_type VARCHAR(30) NOT NULL CHECK (correction_type IN (
        'jersey_number', 'position', 'add_player', 'flag_transfer', 
        'update_name', 'update_photo', 'archive_player'
    )),
    
    -- Before/after values
    previous_value JSONB,
    new_value JSONB,
    
    -- Correction metadata
    triggered_by UUID REFERENCES validation_logs(id), -- Which validation triggered this
    correction_method VARCHAR(20) DEFAULT 'automatic' CHECK (correction_method IN ('automatic', 'manual', 'batch')),
    confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    
    -- Status tracking
    correction_status VARCHAR(20) DEFAULT 'applied' CHECK (correction_status IN (
        'applied', 'failed', 'rolled_back', 'pending'
    )),
    error_message TEXT,
    
    -- Audit information
    applied_by VARCHAR(100) DEFAULT 'system',
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    rollback_reason TEXT,
    rolled_back_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for correction history
CREATE INDEX IF NOT EXISTS idx_correction_history_player ON correction_history(player_id);
CREATE INDEX IF NOT EXISTS idx_correction_history_team_season ON correction_history(team_id, season_year);
CREATE INDEX IF NOT EXISTS idx_correction_history_type ON correction_history(correction_type);
CREATE INDEX IF NOT EXISTS idx_correction_history_validation ON correction_history(triggered_by);
CREATE INDEX IF NOT EXISTS idx_correction_history_applied ON correction_history(applied_at DESC);

-- ============================================================================
-- Validation Configuration Table
-- Stores validation rules and thresholds
-- ============================================================================

CREATE TABLE IF NOT EXISTS validation_config (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Configuration scope
    config_scope VARCHAR(20) NOT NULL CHECK (config_scope IN ('global', 'league', 'team')),
    entity_id INTEGER, -- league_id or team_id depending on scope
    season_year INTEGER NOT NULL DEFAULT 2025,
    
    -- Configuration settings
    config_key VARCHAR(100) NOT NULL,
    config_value JSONB NOT NULL,
    config_description TEXT,
    
    -- Validation settings
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 100, -- Higher priority configs override lower ones
    
    -- Timestamps
    effective_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    effective_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'system',
    
    -- Ensure unique config keys per scope
    UNIQUE(config_scope, entity_id, season_year, config_key)
);

-- Indexes for configuration
CREATE INDEX IF NOT EXISTS idx_validation_config_scope ON validation_config(config_scope, entity_id);
CREATE INDEX IF NOT EXISTS idx_validation_config_key ON validation_config(config_key);
CREATE INDEX IF NOT EXISTS idx_validation_config_active ON validation_config(is_active, effective_from, effective_until);

-- ============================================================================
-- Insert Default Configuration
-- ============================================================================

INSERT INTO validation_config (config_scope, entity_id, season_year, config_key, config_value, config_description) VALUES 
-- Global validation thresholds
('global', NULL, 2025, 'data_quality_threshold', '{"warning": 80, "critical": 70}', 'Data quality score thresholds for alerts'),
('global', NULL, 2025, 'name_similarity_threshold', '{"minimum": 0.6, "strong_match": 0.8}', 'Player name matching confidence thresholds'),
('global', NULL, 2025, 'validation_frequency', '{"hours": 24, "on_match_day": 4}', 'How often to run validations'),
('global', NULL, 2025, 'auto_correction_rules', '{"jersey_numbers": true, "positions": true, "add_missing": false, "flag_transfers": true}', 'Which corrections to apply automatically'),
('global', NULL, 2025, 'alert_escalation', '{"critical_immediate": true, "high_after_hours": 2, "medium_after_hours": 12}', 'Alert escalation timing'),
('global', NULL, 2025, 'rate_limits', '{"api_calls_per_minute": 10, "concurrent_validations": 3}', 'API rate limiting configuration'),

-- K League 1 specific settings
('league', 292, 2025, 'transfer_window_dates', '{"winter": {"start": "2025-01-01", "end": "2025-02-28"}, "summer": {"start": "2025-07-01", "end": "2025-08-31"}}', 'Transfer window periods for enhanced monitoring'),
('league', 292, 2025, 'match_day_validation', '{"hours_before": 2, "real_time_during": true, "hours_after": 1}', 'Enhanced validation around match days'),

-- K League 2 specific settings  
('league', 293, 2025, 'transfer_window_dates', '{"winter": {"start": "2025-01-01", "end": "2025-02-28"}, "summer": {"start": "2025-07-01", "end": "2025-08-31"}}', 'Transfer window periods for enhanced monitoring'),
('league', 293, 2025, 'match_day_validation', '{"hours_before": 2, "real_time_during": true, "hours_after": 1}', 'Enhanced validation around match days')

ON CONFLICT (config_scope, entity_id, season_year, config_key) DO NOTHING;

-- ============================================================================
-- Views for Easy Querying
-- ============================================================================

-- Latest validation results per team
CREATE OR REPLACE VIEW latest_team_validations AS
SELECT DISTINCT ON (vl.team_id, vl.season_year)
    vl.id as validation_id,
    vl.team_id,
    vl.season_year,
    vl.validation_timestamp,
    vl.total_players,
    vl.valid_players,
    vl.issues_detected,
    vl.data_quality_score,
    vl.validation_status,
    t.name as team_name
FROM validation_logs vl
LEFT JOIN teams t ON t.id = vl.team_id AND t.season_year = vl.season_year
WHERE vl.validation_status = 'completed'
ORDER BY vl.team_id, vl.season_year, vl.validation_timestamp DESC;

-- Active unresolved alerts
CREATE OR REPLACE VIEW active_alerts AS
SELECT 
    va.*,
    CASE 
        WHEN va.auto_resolvable AND va.auto_resolve_after_hours IS NOT NULL 
             AND va.created_at + (va.auto_resolve_after_hours * INTERVAL '1 hour') < NOW()
        THEN TRUE 
        ELSE FALSE 
    END as should_auto_resolve
FROM validation_alerts va
WHERE va.resolved = FALSE
ORDER BY 
    CASE va.severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
    END,
    va.created_at DESC;

-- Transfer activity summary
CREATE OR REPLACE VIEW transfer_activity_summary AS
SELECT 
    tf.season_year,
    tf.status_change,
    tf.flag_status,
    COUNT(*) as count,
    ROUND(AVG(tf.confidence_score), 2) as avg_confidence
FROM transfer_flags tf
WHERE tf.flagged_at >= NOW() - INTERVAL '30 days'
GROUP BY tf.season_year, tf.status_change, tf.flag_status
ORDER BY tf.season_year DESC, count DESC;

-- ============================================================================
-- Functions for Maintenance
-- ============================================================================

-- Function to clean up old validation logs (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_validation_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM validation_logs 
    WHERE created_at < NOW() - (retention_days * INTERVAL '1 day');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-resolve alerts based on configuration
CREATE OR REPLACE FUNCTION auto_resolve_alerts()
RETURNS INTEGER AS $$
DECLARE
    resolved_count INTEGER;
BEGIN
    UPDATE validation_alerts 
    SET 
        resolved = TRUE,
        resolved_at = NOW(),
        resolved_by = 'auto_resolver',
        resolution_notes = 'Auto-resolved after configured timeout'
    WHERE 
        resolved = FALSE 
        AND auto_resolvable = TRUE 
        AND auto_resolve_after_hours IS NOT NULL
        AND created_at + (auto_resolve_after_hours * INTERVAL '1 hour') < NOW();
    
    GET DIAGNOSTICS resolved_count = ROW_COUNT;
    
    RETURN resolved_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Triggers for Maintenance
-- ============================================================================

-- Update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at columns
CREATE TRIGGER trigger_validation_alerts_updated_at
    BEFORE UPDATE ON validation_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_transfer_flags_updated_at
    BEFORE UPDATE ON transfer_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_validation_config_updated_at
    BEFORE UPDATE ON validation_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on sensitive tables
ALTER TABLE validation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_config ENABLE ROW LEVEL SECURITY;

-- Create policies for read access (adjust based on your auth system)
CREATE POLICY "Allow read access to validation logs" ON validation_logs
    FOR SELECT USING (true);

CREATE POLICY "Allow read access to validation results" ON validation_results
    FOR SELECT USING (true);

CREATE POLICY "Allow read access to validation alerts" ON validation_alerts
    FOR SELECT USING (true);

CREATE POLICY "Allow read access to transfer flags" ON transfer_flags
    FOR SELECT USING (true);

CREATE POLICY "Allow read access to correction history" ON correction_history
    FOR SELECT USING (true);

CREATE POLICY "Allow read access to validation config" ON validation_config
    FOR SELECT USING (true);

-- Create policies for write access (restrict to service role)
CREATE POLICY "Allow service role to write validation logs" ON validation_logs
    FOR ALL USING (current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role');

CREATE POLICY "Allow service role to write validation results" ON validation_results
    FOR ALL USING (current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role');

CREATE POLICY "Allow service role to write validation alerts" ON validation_alerts
    FOR ALL USING (current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role');

CREATE POLICY "Allow service role to write transfer flags" ON transfer_flags
    FOR ALL USING (current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role');

CREATE POLICY "Allow service role to write correction history" ON correction_history
    FOR ALL USING (current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role');

CREATE POLICY "Allow service role to write validation config" ON validation_config
    FOR ALL USING (current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role');

-- ============================================================================
-- Completion Message
-- ============================================================================

-- Add a comment to track schema version
COMMENT ON TABLE validation_logs IS 'Real-time lineup validation system v1.0 - Created for allleaguesfans K League data validation';

-- Log the creation
DO $$
BEGIN
    RAISE NOTICE 'Validation system tables created successfully';
    RAISE NOTICE 'Tables: validation_logs, validation_results, validation_alerts, transfer_flags, correction_history, validation_config';
    RAISE NOTICE 'Views: latest_team_validations, active_alerts, transfer_activity_summary';
    RAISE NOTICE 'Functions: cleanup_old_validation_logs(), auto_resolve_alerts()';
END $$;