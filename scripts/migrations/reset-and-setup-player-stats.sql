-- Step 1: Clear existing player statistics (incorrect data)
TRUNCATE TABLE player_statistics;

-- Step 2: Create accumulation function
CREATE OR REPLACE FUNCTION upsert_player_stats(
  p_id_player TEXT,
  p_str_player TEXT,
  p_id_team TEXT,
  p_str_team TEXT,
  p_id_league TEXT,
  p_str_season TEXT,
  p_goals INTEGER,
  p_assists INTEGER,
  p_yellow_cards INTEGER,
  p_red_cards INTEGER,
  p_appearances INTEGER
) RETURNS void AS $$
BEGIN
  INSERT INTO player_statistics (
    "idPlayer",
    "strPlayer",
    "idTeam",
    "strTeam",
    "idLeague",
    "strSeason",
    goals,
    assists,
    yellow_cards,
    red_cards,
    appearances,
    last_updated
  ) VALUES (
    p_id_player,
    p_str_player,
    p_id_team,
    p_str_team,
    p_id_league,
    p_str_season,
    p_goals,
    p_assists,
    p_yellow_cards,
    p_red_cards,
    p_appearances,
    NOW()
  )
  ON CONFLICT ("idPlayer", "idLeague", "strSeason")
  DO UPDATE SET
    goals = player_statistics.goals + EXCLUDED.goals,
    assists = player_statistics.assists + EXCLUDED.assists,
    yellow_cards = player_statistics.yellow_cards + EXCLUDED.yellow_cards,
    red_cards = player_statistics.red_cards + EXCLUDED.red_cards,
    appearances = player_statistics.appearances + EXCLUDED.appearances,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION upsert_player_stats TO service_role;
GRANT EXECUTE ON FUNCTION upsert_player_stats TO anon;
GRANT EXECUTE ON FUNCTION upsert_player_stats TO authenticated;

-- Step 4: Verify setup
SELECT 'Setup complete! Ready for data sync.' as status;
