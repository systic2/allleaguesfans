-- ============================================
-- 모든 테이블 삭제 쿼리
-- 주의: 이 스크립트는 모든 데이터를 삭제합니다!
-- ============================================

-- 1. 트리거 삭제
DROP TRIGGER IF EXISTS update_players_modtime ON players;
DROP TRIGGER IF EXISTS update_teams_modtime ON teams;
DROP TRIGGER IF EXISTS update_squads_modtime ON squads;
DROP TRIGGER IF EXISTS update_coaches_modtime ON coaches;
DROP TRIGGER IF EXISTS update_team_stats_modtime ON team_statistics;
DROP TRIGGER IF EXISTS update_player_stats_modtime ON player_statistics;
DROP TRIGGER IF EXISTS update_injuries_modtime ON injuries;
DROP TRIGGER IF EXISTS update_venues_modtime ON venues;

-- 2. 함수 삭제
DROP FUNCTION IF EXISTS update_modified_column();

-- 3. 의존관계가 있는 테이블부터 순서대로 삭제
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS trophies CASCADE;
DROP TABLE IF EXISTS transfers CASCADE;
DROP TABLE IF EXISTS injuries CASCADE;
DROP TABLE IF EXISTS player_statistics CASCADE;
DROP TABLE IF EXISTS fixture_statistics CASCADE;
DROP TABLE IF EXISTS standings CASCADE;
DROP TABLE IF EXISTS team_statistics CASCADE;
DROP TABLE IF EXISTS squads CASCADE;
DROP TABLE IF EXISTS coaches CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS lineups CASCADE;
DROP TABLE IF EXISTS fixtures CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS venues CASCADE;
DROP TABLE IF EXISTS leagues CASCADE;
DROP TABLE IF EXISTS seasons CASCADE;
DROP TABLE IF EXISTS countries CASCADE;

-- 4. 시퀀스 삭제 (SERIAL 컬럼으로 자동 생성된 것들)
DROP SEQUENCE IF EXISTS squads_id_seq CASCADE;
DROP SEQUENCE IF EXISTS team_statistics_id_seq CASCADE;
DROP SEQUENCE IF EXISTS standings_id_seq CASCADE;
DROP SEQUENCE IF EXISTS fixture_statistics_id_seq CASCADE;
DROP SEQUENCE IF EXISTS player_statistics_id_seq CASCADE;
DROP SEQUENCE IF EXISTS injuries_id_seq CASCADE;
DROP SEQUENCE IF EXISTS transfers_id_seq CASCADE;
DROP SEQUENCE IF EXISTS trophies_id_seq CASCADE;
DROP SEQUENCE IF EXISTS predictions_id_seq CASCADE;
DROP SEQUENCE IF EXISTS coaches_id_seq CASCADE;
DROP SEQUENCE IF EXISTS events_id_seq CASCADE;
DROP SEQUENCE IF EXISTS lineups_id_seq CASCADE;
DROP SEQUENCE IF EXISTS fixtures_id_seq CASCADE;
DROP SEQUENCE IF EXISTS players_id_seq CASCADE;
DROP SEQUENCE IF EXISTS teams_id_seq CASCADE;
DROP SEQUENCE IF EXISTS venues_id_seq CASCADE;
DROP SEQUENCE IF EXISTS leagues_id_seq CASCADE;
DROP SEQUENCE IF EXISTS seasons_id_seq CASCADE;
DROP SEQUENCE IF EXISTS countries_id_seq CASCADE;

-- 5. 타입 삭제 (있다면)
DROP TYPE IF EXISTS fixture_status CASCADE;
DROP TYPE IF EXISTS event_type CASCADE;
DROP TYPE IF EXISTS player_position CASCADE;

-- 완료 메시지
SELECT 'All tables have been dropped successfully!' as status;