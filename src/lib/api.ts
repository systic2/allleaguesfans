// src/lib/api.ts
import { supabase } from "@/lib/supabaseClient";
import type { SearchRow } from "@/domain/types";

// ---------- 공통 fetch 유틸 ----------
export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}


// ---------- 도메인 라이트 타입 ----------
export type LeagueLite = { id: number; slug: string; name: string; tier: number | null };
export type TeamLite = { id: number; name: string; short_name: string | null; crest_url: string | null };
export type PlayerLite = { id: number; name: string; position: string | null; photo_url: string | null; team_id: number | null; jersey_number?: number };

// ---------- Supabase Query Result Types ----------
type StandingWithTeam = {
  team_id: number;
  rank: number;
  points: number;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals_for: number;
  goals_against: number;
  goals_diff: number;
  form: string | null;
  teams: {
    name: string;
    code: string | null;
    logo_url: string | null;
  };
};

type TeamSeasonWithTeam = {
  teams: {
    id: number;
    name: string;
    code: string | null;
    logo_url: string | null;
  }[];
};

type TeamRecord = {
  id: number;
  name: string;
  logo_url: string | null;
};

type GoalEvent = {
  player_id: number;
  team_id: number;
};

type PlayerRecord = {
  id: number;
  name: string;
};

type ChampionWithTeam = {
  season_year: number;
  teams: {
    name: string;
    logo_url: string | null;
  } | null;
};

// ---------- API ----------
export async function fetchLeagues(): Promise<LeagueLite[]> {
  // 🔧 새로운 스키마에 맞게 수정
  const { data, error } = await supabase
    .from("leagues")
    .select("id, name, country_name")
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((x) => ({
    id: Number(x.id),
    slug: `league-${x.id}`, // ID 기반으로 slug 생성
    name: String(x.name),
    tier: null, // DB에 없으므로 null 보정
  }));
}

export async function fetchPlayersByTeam(teamId: number): Promise<PlayerLite[]> {
  try {
    // First try to get real squad data from API-Football
    const apiKey = import.meta.env.VITE_API_FOOTBALL_KEY;
    
    if (apiKey) {
      console.log(`🔍 Fetching squad data for team ${teamId} from API-Football...`);
      
      const response = await fetch(`https://v3.football.api-sports.io/players/squads?team=${teamId}`, {
        headers: {
          "x-rapidapi-key": apiKey
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.response && data.response.length > 0) {
          const squad = data.response[0];
          console.log(`✅ Found ${squad.players.length} players for ${squad.team.name}`);
          
          // Convert API-Football data to our PlayerLite format
          const apiPlayers = squad.players.map((player: any) => ({
            id: Number(player.id),
            name: String(player.name),
            position: convertAPIPositionToShort(player.position),
            photo_url: player.photo || null,
            team_id: teamId,
            jersey_number: player.number || null
          }));
          
          // Sort by jersey number, then by name
          return apiPlayers.sort((a: PlayerLite, b: PlayerLite) => {
            if (a.jersey_number && b.jersey_number) {
              return a.jersey_number - b.jersey_number;
            }
            if (a.jersey_number && !b.jersey_number) return -1;
            if (!a.jersey_number && b.jersey_number) return 1;
            return a.name.localeCompare(b.name);
          });
        }
      } else {
        console.log(`⚠️ API-Football request failed: ${response.status}`);
      }
    }
    
    // Fallback to database: try direct team query first, then events approach
    console.log(`🔄 Fallback: Using database players for team ${teamId}...`);
    
    // Try to get players directly by team_id first
    const { data: directPlayers, error: directError } = await supabase
      .from("players")
      .select("id, name, photo, position, jersey_number")
      .eq("team_id", teamId);
      
    if (!directError && directPlayers && directPlayers.length > 0) {
      console.log(`✅ Found ${directPlayers.length} players directly from team_id`);
      
      const playersData = directPlayers.map((player) => ({
        id: Number(player.id),
        name: String(player.name),
        position: player.position || 'MF',
        photo_url: (player.photo ?? null) as string | null,
        team_id: teamId,
        jersey_number: player.jersey_number || null
      })).sort((a, b) => {
        // Sort by jersey number first, then by name
        if (a.jersey_number && b.jersey_number) {
          return a.jersey_number - b.jersey_number;
        }
        if (a.jersey_number && !b.jersey_number) return -1;
        if (!a.jersey_number && b.jersey_number) return 1;
        return a.name.localeCompare(b.name);
      });
      
      return playersData;
    }
    
    // If direct team query didn't work, fall back to events approach
    console.log(`🔄 Fallback 2: Using events data for team ${teamId}...`);
    
    const { data, error } = await supabase
      .from("events")
      .select("player_id")
      .eq("team_id", teamId);
      
    if (error) throw error;
    
    // Get unique player IDs
    const uniquePlayerIds = [...new Set((data ?? []).map(event => event.player_id))];
    
    if (uniquePlayerIds.length === 0) {
      return [];
    }
    
    // Get player details
    const { data: playersData, error: playersError } = await supabase
      .from("players")
      .select("id, name, photo, position, jersey_number")
      .in("id", uniquePlayerIds);
      
    if (playersError) throw playersError;
    
    // Use database data if available, with fallback for missing fields
    const playersWithJersey = (playersData ?? []).map((player, index) => {
      // Use database position and jersey_number if available, otherwise generate
      const dbPosition = player.position;
      const dbJerseyNumber = player.jersey_number;
      
      // Fallback generation if database doesn't have position/jersey
      const { jerseyNumber, position } = assignJerseyAndPosition(player.name, index, Number(player.id));
      
      return {
        id: Number(player.id),
        name: String(player.name),
        position: dbPosition || position, // Use database position if available
        photo_url: (player.photo ?? null) as string | null,
        team_id: teamId,
        jersey_number: dbJerseyNumber || jerseyNumber // Use database jersey if available
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
    
    return playersWithJersey;
    
  } catch (error) {
    console.error("Error fetching players:", error);
    return [];
  }
}

// Helper function to convert API-Football position to short format
function convertAPIPositionToShort(apiPosition: string): string {
  if (!apiPosition) return 'MF';
  
  const pos = apiPosition.toLowerCase();
  
  if (pos.includes('goalkeeper')) return 'GK';
  if (pos.includes('defender')) return 'DF';
  if (pos.includes('midfielder')) return 'MF';
  if (pos.includes('attacker') || pos.includes('forward')) return 'FW';
  
  // Default fallback
  return 'MF';
}

// Helper function to assign jersey numbers and positions
function assignJerseyAndPosition(playerName: string, index: number, playerId?: number): { jerseyNumber: number; position: string } {
  const name = playerName.toLowerCase();
  
  // Generate a consistent seed based on player name for reproducible assignments
  const nameHash = playerName.split('').reduce((hash, char) => {
    return ((hash << 5) - hash) + char.charCodeAt(0);
  }, 0);
  
  // Use playerId if available for more consistency
  const seed = playerId ? playerId : Math.abs(nameHash);
  
  // Goalkeeper detection (first player or name patterns)
  if (index === 0 || name.includes('keeper') || name.includes('gk')) {
    return { jerseyNumber: 1, position: 'GK' };
  }
  
  // More realistic jersey number assignment for starting XI
  if (index < 11) {
    // Traditional formation positions with realistic jersey numbers
    const startingXI: Record<number, { jerseyNumbers: number[]; position: string }> = {
      0: { jerseyNumbers: [1], position: 'GK' },           // Goalkeeper
      1: { jerseyNumbers: [2, 12, 15], position: 'RB' },   // Right Back
      2: { jerseyNumbers: [3, 13, 23], position: 'LB' },   // Left Back  
      3: { jerseyNumbers: [4, 5, 14], position: 'CB' },    // Center Back
      4: { jerseyNumbers: [6, 24, 25], position: 'CB' },   // Center Back
      5: { jerseyNumbers: [8, 16, 18], position: 'DM' },   // Defensive Mid
      6: { jerseyNumbers: [10, 17, 20], position: 'CM' },  // Central Mid
      7: { jerseyNumbers: [7, 19, 21], position: 'AM' },   // Attacking Mid
      8: { jerseyNumbers: [11, 22, 26], position: 'RW' },  // Right Wing
      9: { jerseyNumbers: [9, 27, 29], position: 'ST' },   // Striker
      10: { jerseyNumbers: [7, 11, 28], position: 'LW' }   // Left Wing
    };
    
    const positionData = startingXI[index];
    if (positionData) {
      // Select jersey number based on seed for consistency
      const numberIndex = seed % positionData.jerseyNumbers.length;
      return {
        jerseyNumber: positionData.jerseyNumbers[numberIndex],
        position: positionData.position
      };
    }
  }
  
  // Substitute and squad players (more realistic distribution)
  const substitutePositions = [
    { range: [12, 23], positions: ['GK', 'DF', 'DF', 'MF'] },
    { range: [30, 50], positions: ['MF', 'FW', 'DF', 'GK'] },
    { range: [70, 99], positions: ['FW', 'MF', 'DF', 'GK'] }
  ];
  
  // Choose position group based on seed
  const groupIndex = seed % substitutePositions.length;
  const group = substitutePositions[groupIndex];
  const positionIndex = (seed + index) % group.positions.length;
  
  // Generate jersey number within range
  const [min, max] = group.range;
  const jerseyNumber = min + ((seed + index * 7) % (max - min + 1));
  
  return {
    jerseyNumber: Math.min(jerseyNumber, 99),
    position: group.positions[positionIndex]
  };
}

export async function fetchPlayer(id: number): Promise<PlayerLite | null> {
  const { data, error } = await supabase
    .from("players")
    .select("id, name, position, photo_url, team_id, nationality")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: Number(data.id),
    name: String(data.name),
    position: (data.position ?? null) as string | null,
    photo_url: (data.photo_url ?? null) as string | null,
    team_id: data.team_id == null ? null : Number(data.team_id)
  };
}

/**
 * 전역 검색 (리그/팀)
 * - 반환 타입은 프로젝트의 src/lib/types.ts에 정의된 SearchRow와 동일하게 맞춤
 * - team 결과는 team_id(=entity_id)를 필수로 포함
 */
export async function searchByName(q: string): Promise<SearchRow[]> {
  const qq = q.trim();
  if (!qq) return [];

  const [leagues, teams] = await Promise.all([
    supabase
      .from("leagues")
      .select("id, name, country_name")
      .ilike("name", `%${qq}%`)
      .limit(10),
    supabase
      .from("teams")
      .select("id, name, code, logo_url")
      .ilike("name", `%${qq}%`)
      .limit(10)
  ]);

  const rows: SearchRow[] = [];

  for (const x of leagues.data ?? []) {
    rows.push({
      type: "league",
      entity_id: Number(x.id),
      name: String(x.name),
      slug: `league-${x.id}` // ID 기반으로 slug 생성
    } as SearchRow);
  }
  for (const t of teams.data ?? []) {
    rows.push({
      type: "team",
      entity_id: Number(t.id),
      team_id: Number(t.id),
      name: String(t.name),
      short_name: (t.code ?? null) as string | null,
      crest_url: (t.logo_url ?? null) as string | null
    } as SearchRow);
  }

  return rows;
}

// ---------- 리그 상세 정보 ----------
export type LeagueDetail = {
  id: number;
  name: string;
  slug: string;
  country: string | null;
  season: number;
};

export type TeamStanding = {
  team_id: number;
  team_name: string;
  short_name: string | null;
  crest_url: string | null;
  rank: number;
  points: number;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals_for: number;
  goals_against: number;
  goals_diff: number;
  form: string | null;
};

export async function fetchLeagueBySlug(slug: string): Promise<LeagueDetail | null> {
  // slug에서 ID 추출 (league-292 => 292)
  const leagueId = slug.replace('league-', '');
  const { data, error } = await supabase
    .from("leagues")
    .select("id, name, country_name")
    .eq("id", leagueId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: Number(data.id),
    name: String(data.name),
    slug: `league-${data.id}`,
    country: data.country_name as string | null,
    season: 2025, // 현재 시즌으로 고정
  };
}

export async function fetchLeagueStandings(leagueId: number, season: number = 2025): Promise<TeamStanding[]> {
  const { data, error } = await supabase
    .from("standings")
    .select(`
      team_id,
      rank_position,
      points,
      all_played,
      all_win,
      all_draw,
      all_lose,
      all_goals_for,
      all_goals_against,
      goals_diff,
      form,
      teams!inner(name, code, logo_url)
    `)
    .eq("league_id", leagueId)
    .eq("season_year", season)
    .order("rank_position", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((standing: any) => ({
    team_id: Number(standing.team_id),
    team_name: String(standing.teams?.name || "Unknown"),
    short_name: (standing.teams?.code ?? null) as string | null,
    crest_url: (standing.teams?.logo_url ?? null) as string | null,
    rank: Number(standing.rank_position),
    points: Number(standing.points),
    played: Number(standing.all_played),
    win: Number(standing.all_win),
    draw: Number(standing.all_draw),
    lose: Number(standing.all_lose),
    goals_for: Number(standing.all_goals_for || 0),
    goals_against: Number(standing.all_goals_against || 0),
    goals_diff: Number(standing.goals_diff),
    form: (standing.form ?? null) as string | null,
  }));
}

export async function fetchLeagueTeams(leagueId: number, season: number = 2025): Promise<TeamLite[]> {
  const { data, error } = await supabase
    .from("team_seasons")
    .select(`
      teams!inner(id, name, code, logo_url)
    `)
    .eq("league_id", leagueId)
    .eq("season_year", season);

  if (error) throw error;

  return (data ?? []).map((item: TeamSeasonWithTeam) => ({
    id: Number(item.teams[0]?.id || 0),
    name: String(item.teams[0]?.name || "Unknown"),
    short_name: (item.teams[0]?.code ?? null) as string | null,
    crest_url: (item.teams[0]?.logo_url ?? null) as string | null,
  }));
}

// ---------- 추가 리그 통계 ----------
export type LeagueStats = {
  total_goals: number;
  total_matches: number;
  avg_goals_per_match: number;
  total_teams: number;
};



export type TopScorer = {
  player_name: string;
  team_name: string;
  goals: number;
  assists: number;
  matches: number;
};

export type TopAssist = {
  player_name: string;
  team_name: string;
  assists: number;
  goals: number;
  matches: number;
};

export type HistoricalChampion = {
  season_year: number;
  champion_name: string;
  champion_logo: string | null;
};

export async function fetchLeagueStats(leagueId: number, season: number = 2025): Promise<LeagueStats> {
  // 기본 통계 계산
  const [standingsResult, fixturesResult] = await Promise.all([
    supabase
      .from("standings")
      .select("*")
      .eq("league_id", leagueId)
      .eq("season_year", season),
    supabase
      .from("fixtures")
      .select("home_goals, away_goals")
      .eq("league_id", leagueId)
      .eq("season_year", season)
      .not("home_goals", "is", null)
      .not("away_goals", "is", null)
  ]);

  const totalTeams = standingsResult.data?.length || 0;
  const completedMatches = fixturesResult.data || [];
  const totalMatches = completedMatches.length;
  const totalGoals = completedMatches.reduce((sum, match) => 
    sum + (match.home_goals || 0) + (match.away_goals || 0), 0);

  return {
    total_goals: totalGoals,
    total_matches: totalMatches,
    avg_goals_per_match: totalMatches > 0 ? Number((totalGoals / totalMatches).toFixed(2)) : 0,
    total_teams: totalTeams,
  };
}



export async function fetchTopScorers(leagueId: number, season: number = 2025, limit: number = 10): Promise<TopScorer[]> {
  const { data, error } = await supabase
    .from("top_scorers")
    .select(`
      player_name,
      team_name,
      goals,
      assists,
      appearances
    `)
    .eq("league_id", leagueId)
    .eq("season_year", season)
    .order("rank_position", { ascending: true })
    .limit(limit);

  if (error) {
    console.warn("Failed to fetch top scorers:", error);
    return [];
  }

  return (data ?? []).map(scorer => ({
    player_name: String(scorer.player_name),
    team_name: String(scorer.team_name),
    goals: Number(scorer.goals),
    assists: Number(scorer.assists),
    matches: Number(scorer.appearances),
  }));
}

export async function fetchTopAssists(leagueId: number, season: number = 2025, limit: number = 10): Promise<TopAssist[]> {
  const { data, error } = await supabase
    .from("top_assists")
    .select(`
      player_name,
      team_name,
      assists,
      goals,
      appearances
    `)
    .eq("league_id", leagueId)
    .eq("season_year", season)
    .order("rank_position", { ascending: true })
    .limit(limit);

  if (error) {
    console.warn("Failed to fetch top assists:", error);
    return [];
  }

  return (data ?? []).map(assist => ({
    player_name: String(assist.player_name),
    team_name: String(assist.team_name),
    assists: Number(assist.assists),
    goals: Number(assist.goals),
    matches: Number(assist.appearances),
  }));
}

export async function fetchHistoricalChampions(leagueId: number): Promise<HistoricalChampion[]> {
  // 과거 시즌 우승팀 조회 (1위 팀들) - 관계형 쿼리 없이 단순하게
  const { data: standingsData, error: standingsError } = await supabase
    .from("standings")
    .select("season_year, team_id")
    .eq("league_id", leagueId)
    .eq("rank_position", 1)
    .order("season_year", { ascending: false })
    .limit(15); // 최근 15년

  if (standingsError) {
    console.warn("Failed to fetch historical champions standings:", standingsError);
    return [];
  }

  if (!standingsData || standingsData.length === 0) {
    return [];
  }

  // 팀 정보 별도 조회
  const teamIds = standingsData.map(item => item.team_id);
  const { data: teamsData, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, logo_url")
    .in("id", teamIds);

  if (teamsError) {
    console.warn("Failed to fetch teams data:", teamsError);
    return [];
  }

  // 데이터 결합
  return standingsData.map((standing: any) => {
    const team = (teamsData || []).find(t => t.id === standing.team_id);
    return {
      season_year: Number(standing.season_year),
      champion_name: String(team?.name || "Unknown"),
      champion_logo: (team?.logo_url ?? null) as string | null,
    };
  });
}

// ---------- Team 상세 정보 ----------
export type TeamDetails = {
  id: number;
  name: string;
  code: string | null;
  country: string;
  founded: number | null;
  logo_url: string | null;
  venue_name: string | null;
  venue_capacity: number | null;
  venue_city: string | null;
  current_position: number | null;
  points: number | null;
  matches_played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goals_for: number | null;
  goals_against: number | null;
};

export type TeamFixture = {
  id: number;
  date_utc: string;
  status_short: string;
  home_team: string;
  away_team: string;
  home_goals: number | null;
  away_goals: number | null;
  is_home: boolean;
  opponent_name: string;
  opponent_logo: string | null;
  result: 'W' | 'D' | 'L' | null;
};

export type TeamStatistics = {
  position: number;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  clean_sheets: number;
  failed_to_score: number;
  avg_goals_scored: number;
  avg_goals_conceded: number;
  form_last_5: string;
  home_record: { wins: number; draws: number; losses: number };
  away_record: { wins: number; draws: number; losses: number };
};

export async function fetchTeamDetails(teamId: number, season: number = 2025): Promise<TeamDetails | null> {
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select(`
      id, name, code, country_name, founded, logo_url
    `)
    .eq("id", teamId)
    .maybeSingle();

  if (teamError || !team) return null;

  // 현재 시즌 순위 정보
  const { data: standings } = await supabase
    .from("standings")
    .select("rank_position, points, all_played, all_win, all_draw, all_lose, all_goals_for, all_goals_against")
    .eq("team_id", teamId)
    .eq("season_year", season)
    .maybeSingle();

  return {
    id: Number(team.id),
    name: String(team.name),
    code: team.code,
    country: String(team.country_name || 'South Korea'),
    founded: team.founded ? Number(team.founded) : null,
    logo_url: team.logo_url,
    venue_name: null, // No venue data available in current schema
    venue_capacity: null,
    venue_city: null,
    current_position: standings?.rank_position || null,
    points: standings?.points || null,
    matches_played: standings?.all_played || null,
    wins: standings?.all_win || null,
    draws: standings?.all_draw || null,
    losses: standings?.all_lose || null,
    goals_for: standings?.all_goals_for || null,
    goals_against: standings?.all_goals_against || null,
  };
}

export async function fetchTeamFixtures(teamId: number, season: number = 2025, limit: number = 10): Promise<TeamFixture[]> {
  const { data, error } = await supabase
    .from("fixtures")
    .select(`
      id, date_utc, status_short, home_goals, away_goals,
      home_team_id, away_team_id,
      home_team:teams!fixtures_home_team_id_fkey(name, logo_url),
      away_team:teams!fixtures_away_team_id_fkey(name, logo_url)
    `)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq("season_year", season)
    .order("date_utc", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("Failed to fetch team fixtures:", error);
    return [];
  }

  return (data || []).map((fixture: any) => {
    const isHome = fixture.home_team_id === teamId;
    const homeTeam = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team;
    const awayTeam = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team;
    
    const opponent = isHome ? awayTeam : homeTeam;
    
    let result: 'W' | 'D' | 'L' | null = null;
    if (fixture.home_goals !== null && fixture.away_goals !== null) {
      if (fixture.home_goals === fixture.away_goals) {
        result = 'D';
      } else if (isHome) {
        result = fixture.home_goals > fixture.away_goals ? 'W' : 'L';
      } else {
        result = fixture.away_goals > fixture.home_goals ? 'W' : 'L';
      }
    }

    return {
      id: Number(fixture.id),
      date_utc: String(fixture.date_utc),
      status_short: String(fixture.status_short),
      home_team: String(homeTeam?.name || "Unknown"),
      away_team: String(awayTeam?.name || "Unknown"),
      home_goals: fixture.home_goals,
      away_goals: fixture.away_goals,
      is_home: isHome,
      opponent_name: String(opponent?.name || "Unknown"),
      opponent_logo: opponent?.logo_url || null,
      result,
    };
  });
}

export async function fetchTeamStatistics(teamId: number, season: number = 2025): Promise<TeamStatistics | null> {
  const { data: standings, error } = await supabase
    .from("standings")
    .select("*")
    .eq("team_id", teamId)
    .eq("season_year", season)
    .maybeSingle();

  if (error || !standings) return null;

  // 최근 경기 결과로 폼 계산
  const recentFixtures = await fetchTeamFixtures(teamId, season, 15);
  const form = recentFixtures
    .filter(f => f.result !== null) // Filter completed matches first
    .slice(0, 5) // Then take 5 completed matches
    .map(f => f.result)
    .join('');

  // 홈/원정 기록 계산 (실제 구현시에는 fixtures 데이터에서 계산)
  const homeRecord = { wins: Math.floor(standings.all_win * 0.6), draws: Math.floor(standings.all_draw * 0.5), losses: Math.floor(standings.all_lose * 0.4) };
  const awayRecord = { wins: standings.all_win - homeRecord.wins, draws: standings.all_draw - homeRecord.draws, losses: standings.all_lose - homeRecord.losses };

  return {
    position: Number(standings.rank_position),
    points: Number(standings.points),
    played: Number(standings.all_played),
    wins: Number(standings.all_win),
    draws: Number(standings.all_draw),
    losses: Number(standings.all_lose),
    goals_for: Number(standings.all_goals_for),
    goals_against: Number(standings.all_goals_against),
    goal_difference: Number(standings.goals_diff),
    clean_sheets: Math.floor(standings.all_played * 0.3), // 임시 계산
    failed_to_score: Math.floor(standings.all_played * 0.2), // 임시 계산
    avg_goals_scored: standings.all_played > 0 ? Number((standings.all_goals_for / standings.all_played).toFixed(2)) : 0,
    avg_goals_conceded: standings.all_played > 0 ? Number((standings.all_goals_against / standings.all_played).toFixed(2)) : 0,
    form_last_5: form || 'N/A',
    home_record: homeRecord,
    away_record: awayRecord,
  };
}

// ====== UPCOMING FIXTURES API ======

export interface UpcomingFixture {
  id: number;
  date_utc: string;
  status: string;
  round: string;
  home_team: {
    id: number;
    name: string;
    logo_url: string | null;
  };
  away_team: {
    id: number;
    name: string;
    logo_url: string | null;
  };
  venue?: string;
  league_id: number;
}

export async function fetchUpcomingFixtures(leagueId?: number, limit: number = 10): Promise<UpcomingFixture[]> {
  const today = new Date().toISOString().split('T')[0];
  
  let query = supabase
    .from("fixtures")
    .select(`
      id, date_utc, status_short, round, home_team_id, away_team_id, league_id,
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_url),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_url),
      venues(name)
    `)
    .gte("date_utc", today)
    .in("status_short", ["TBD", "NS", "PST"]) // Time To Be Defined, Not Started, Postponed
    .order("date_utc", { ascending: true })
    .limit(limit);

  if (leagueId) {
    query = query.eq("league_id", leagueId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching upcoming fixtures:", error);
    return [];
  }

  if (!data) return [];

  return data.map(fixture => ({
    id: Number(fixture.id),
    date_utc: String(fixture.date_utc),
    status: String(fixture.status_short),
    round: String(fixture.round),
    home_team: {
      id: Number(fixture.home_team_id),
      name: String(Array.isArray(fixture.home_team) ? (fixture.home_team as any)[0]?.name : (fixture.home_team as any)?.name || "Unknown"),
      logo_url: Array.isArray(fixture.home_team) ? (fixture.home_team as any)[0]?.logo_url : (fixture.home_team as any)?.logo_url || null,
    },
    away_team: {
      id: Number(fixture.away_team_id),
      name: String(Array.isArray(fixture.away_team) ? (fixture.away_team as any)[0]?.name : (fixture.away_team as any)?.name || "Unknown"),
      logo_url: Array.isArray(fixture.away_team) ? (fixture.away_team as any)[0]?.logo_url : (fixture.away_team as any)?.logo_url || null,
    },
    venue: Array.isArray(fixture.venues) ? (fixture.venues as any)[0]?.name : (fixture.venues as any)?.name || undefined,
    league_id: Number(fixture.league_id),
  }));
}

export async function fetchTeamUpcomingFixtures(teamId: number, limit: number = 5): Promise<UpcomingFixture[]> {
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from("fixtures")
    .select(`
      id, date_utc, status_short, round, home_team_id, away_team_id, league_id,
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_url),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_url),
      venues(name)
    `)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .gte("date_utc", today)
    .in("status_short", ["TBD", "NS", "PST"])
    .order("date_utc", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching team upcoming fixtures:", error);
    return [];
  }

  if (!data) return [];

  return data.map(fixture => ({
    id: Number(fixture.id),
    date_utc: String(fixture.date_utc),
    status: String(fixture.status_short),
    round: String(fixture.round),
    home_team: {
      id: Number(fixture.home_team_id),
      name: String(Array.isArray(fixture.home_team) ? (fixture.home_team as any)[0]?.name : (fixture.home_team as any)?.name || "Unknown"),
      logo_url: Array.isArray(fixture.home_team) ? (fixture.home_team as any)[0]?.logo_url : (fixture.home_team as any)?.logo_url || null,
    },
    away_team: {
      id: Number(fixture.away_team_id),
      name: String(Array.isArray(fixture.away_team) ? (fixture.away_team as any)[0]?.name : (fixture.away_team as any)?.name || "Unknown"),
      logo_url: Array.isArray(fixture.away_team) ? (fixture.away_team as any)[0]?.logo_url : (fixture.away_team as any)?.logo_url || null,
    },
    venue: Array.isArray(fixture.venues) ? (fixture.venues as any)[0]?.name : (fixture.venues as any)?.name || undefined,
    league_id: Number(fixture.league_id),
  }));
}

// API Football 호출 함수 (향후 사용)
export async function fetchAPIFootballUpcomingFixtures(leagueId: number, count: number = 5) {
  const API_KEY = process.env.API_FOOTBALL_KEY;
  if (!API_KEY) {
    console.log("API_FOOTBALL_KEY not available");
    return [];
  }

  try {
    const response = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${leagueId}&season=2025&next=${count}`, {
      headers: {
        "X-RapidAPI-Key": API_KEY,
        "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
      }
    });

    if (!response.ok) {
      console.log(`API Football request failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.response || [];
  } catch (error) {
    console.error("API Football request error:", error);
    return [];
  }
}

export async function fetchAPIFootballTBDFixtures(leagueId: number) {
  const API_KEY = process.env.API_FOOTBALL_KEY;
  if (!API_KEY) {
    console.log("API_FOOTBALL_KEY not available");
    return [];
  }

  try {
    const response = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${leagueId}&season=2025&status=TBD`, {
      headers: {
        "X-RapidAPI-Key": API_KEY,
        "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
      }
    });

    if (!response.ok) {
      console.log(`API Football TBD request failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.response || [];
  } catch (error) {
    console.error("API Football TBD request error:", error);
    return [];
  }
}
