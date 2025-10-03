// src/lib/api.ts
// FIXED VERSION: Updated to match actual database schema
import { supabase } from "@/lib/supabaseClient";
import type { SearchRow } from "@/domain/types";
import { 
  getLeagueFixturesHybrid,
  getTeamFixturesHybrid
} from "@/lib/thesportsdb-fixtures";

// ---------- 공통 fetch 유틸 ----------
export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

// ---------- 도메인 라이트 타입 (3-API 통합 업데이트) ----------
export type LeagueLite = { 
  id: number; 
  slug: string; 
  name: string; 
  name_korean?: string | null;
  tier: number | null; 
  logo_url?: string | null;
  banner_url?: string | null;
  country_code?: string;
  primary_source?: string;
};
export type TeamLite = { 
  id: number; 
  name: string; 
  name_korean?: string | null;
  short_name: string | null; 
  crest_url: string | null;
  logo_url?: string | null;
  badge_url?: string | null;
  banner_url?: string | null;
  primary_source?: string;
};
export type PlayerLite = { 
  id: number; 
  name: string; 
  position: string | null; 
  photo_url: string | null; 
  team_id: number | null; 
  jersey_number?: number;
  nationality?: string | null;
  height?: string | null;
  primary_source?: string;
};

// ---------- API ----------
export async function fetchLeagues(): Promise<LeagueLite[]> {
  const { data, error } = await supabase
    .from("leagues")
    .select("idLeague, strLeague, strCountry, strBadge")
    .order("strLeague", { ascending: true });

  if (error) throw error;

  // 순수 TheSportsDB 스키마 기반 직접 매핑
  return (data ?? []).map((x) => ({
    id: x.idLeague === '4689' ? 249276 : x.idLeague === '4822' ? 250127 : parseInt(x.idLeague) || 0,
    slug: x.idLeague === '4689' ? 'k-league-1' : x.idLeague === '4822' ? 'k-league-2' : `league-${x.idLeague}`,
    name: String(x.strLeague),
    name_korean: null, // TheSportsDB에는 한국어 이름 없음
    tier: null,
    logo_url: x.strBadge,
    banner_url: null,
    country_code: x.strCountry,
    primary_source: "thesportsdb",
  }));
}

// ---------- 리그 상세 정보 ----------
export type LeagueDetail = {
  id: number;
  name: string;
  name_korean?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  slug: string;
  country: string | null;
  primary_source?: string;
  tier?: number | null;
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
  // slug 기반 매핑: k-league-1 -> 4689, k-league-2 -> 4822 (TheSportsDB IDs)
  let theSportsDBLeagueId: string;
  if (slug === 'k-league-1') {
    theSportsDBLeagueId = '4689';
  } else if (slug === 'k-league-2') {
    theSportsDBLeagueId = '4822';
  } else {
    // 기존 방식: league-4689 같은 형태
    theSportsDBLeagueId = slug.replace('league-', '');
  }
  
  const { data, error } = await supabase
    .from("leagues")
    .select("idLeague, strLeague, strCountry, strBadge")
    .eq("idLeague", theSportsDBLeagueId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.idLeague === '4689' ? 249276 : data.idLeague === '4822' ? 250127 : parseInt(data.idLeague) || 0,
    name: String(data.strLeague),
    name_korean: null, // TheSportsDB에는 한국어 이름 없음
    logo_url: data.strBadge,
    banner_url: null,
    slug: data.idLeague === '4689' ? 'k-league-1' : data.idLeague === '4822' ? 'k-league-2' : `league-${data.idLeague}`,
    country: data.strCountry as string | null,
    primary_source: "thesportsdb",
    tier: null,
    season: 2025, // 현재 시즌
  };
}

export async function fetchLeagueStandings(leagueSlug: string, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<TeamStanding[]> {
  // PURE TheSportsDB Schema - slug에서 직접 TheSportsDB ID 매핑
  const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : leagueSlug === 'k-league-2' ? '4822' : leagueSlug.replace('league-', '');
  
  const { data, error } = await supabase
    .from("standings")
    .select(`
      idStanding,
      intRank,
      idTeam,
      strTeam,
      strBadge,
      idLeague,
      strLeague,
      strSeason,
      strForm,
      strDescription,
      intPlayed,
      intWin,
      intLoss,
      intDraw,
      intGoalsFor,
      intGoalsAgainst,
      intGoalDifference,
      intPoints,
      created_at
    `)
    .eq("idLeague", theSportsDBLeagueId)
    .eq("strSeason", String(season))
    .order("intRank", { ascending: true });

  if (error) throw error;

  // 문자열로 저장된 intRank를 숫자로 변환해서 정렬
  const sortedData = (data ?? []).sort((a: any, b: any) => {
    const rankA = parseInt(a.intRank) || 0;
    const rankB = parseInt(b.intRank) || 0;
    return rankA - rankB;
  });

  return sortedData.map((standing: any) => ({
    team_id: Number(standing.idTeam || 0),
    team_name: String(standing.strTeam || "Unknown"),
    short_name: null, // 별도로 가져와야 함
    crest_url: standing.strBadge, // TheSportsDB 팀 배지 URL
    rank: Number(standing.intRank || 0),
    points: Number(standing.intPoints || 0),
    played: Number(standing.intPlayed || 0),
    win: Number(standing.intWin || 0),
    draw: Number(standing.intDraw || 0),
    lose: Number(standing.intLoss || 0),
    goals_for: Number(standing.intGoalsFor || 0),
    goals_against: Number(standing.intGoalsAgainst || 0),
    goals_diff: Number(standing.intGoalDifference || 0),
    form: standing.strForm, // TheSportsDB 폼 데이터 (예: "DLWWL")
  }));
}

// Get teams directly from standings using PURE TheSportsDB schema
export async function fetchLeagueTeams(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<TeamLite[]> {
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);
  
  const { data, error } = await supabase
    .from("standings")
    .select(`
      idStanding,
      idTeam,
      strTeam,
      strBadge,
      idLeague,
      strSeason
    `)
    .eq("idLeague", theSportsDBLeagueId)
    .eq("strSeason", String(season));

  if (error) throw error;

  return (data ?? []).map((item: any) => ({
    id: Number(item.idTeam || 0),
    name: String(item.strTeam || "Unknown"),
    short_name: null, // 별도 teams 테이블에서 가져와야 함
    crest_url: item.strBadge, // TheSportsDB 팀 배지 URL
    logo_url: item.strBadge, // 동일한 배지 URL 사용
    badge_url: item.strBadge,
    banner_url: null,
    primary_source: "thesportsdb",
  }));
}

// ---------- 리그 통계 ----------
export type LeagueStats = {
  total_goals: number;
  total_matches: number;
  avg_goals_per_match: number;
  total_teams: number;
};

export async function fetchLeagueStats(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<LeagueStats> {
  // PURE TheSportsDB Schema - 순수 원본 JSON 키값 사용
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);
  
  const [standingsResult, fixturesResult] = await Promise.all([
    supabase
      .from("standings")
      .select("idStanding, intGoalsFor, intGoalsAgainst, intPlayed")
      .eq("idLeague", theSportsDBLeagueId)
      .eq("strSeason", String(season)),
    supabase
      .from("fixtures")
      .select("home_score, away_score")
      .eq("league_id", leagueId)
      .eq("season_year", season)
      .not("home_score", "is", null)
      .not("away_score", "is", null)
  ]);

  const totalTeams = standingsResult.data?.length || 0;
  const completedMatches = fixturesResult.data || [];
  const totalMatches = completedMatches.length;
  
  // TheSportsDB 순위 데이터에서 골 통계 계산
  const totalGoalsFromStandings = standingsResult.data?.reduce((sum, team) => 
    sum + (parseInt(team.intGoalsFor) || 0), 0) || 0;
  
  // Fixtures가 없는 경우 standings 데이터 사용
  const totalGoals = totalMatches > 0 
    ? completedMatches.reduce((sum, match) => sum + (match.home_score || 0) + (match.away_score || 0), 0)
    : totalGoalsFromStandings;

  // 매치 수 계산 (TheSportsDB 데이터 기반)
  const avgMatchesPerTeam = standingsResult.data && standingsResult.data.length > 0 
    ? standingsResult.data.reduce((sum, team) => sum + (parseInt(team.intPlayed) || 0), 0) / standingsResult.data.length
    : 0;

  return {
    total_goals: totalGoals,
    total_matches: totalMatches > 0 ? totalMatches : Math.round(avgMatchesPerTeam * totalTeams / 2),
    avg_goals_per_match: totalMatches > 0 ? Number((totalGoals / totalMatches).toFixed(2)) : 
                        avgMatchesPerTeam > 0 ? Number((totalGoals / (avgMatchesPerTeam * totalTeams / 2)).toFixed(2)) : 0,
    total_teams: totalTeams,
  };
}

// Placeholder types and functions for missing tables
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

// Since top_scorers table doesn't exist, return empty arrays
export async function fetchTopScorers(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025), limit: number = 10): Promise<TopScorer[]> {
  console.warn("top_scorers table not found, returning empty array");
  return [];
}

export async function fetchTopAssists(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025), limit: number = 10): Promise<TopAssist[]> {
  console.warn("top_assists table not found, returning empty array");
  return [];
}

export async function fetchHistoricalChampions(leagueId: number): Promise<HistoricalChampion[]> {
  // Get 1st place teams from standings for different seasons using TheSportsDB schema
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);
  
  const { data: standingsData, error: standingsError } = await supabase
    .from("standings")
    .select("strSeason, strTeam")
    .eq("idLeague", theSportsDBLeagueId)
    .eq("intRank", 1)
    .order("strSeason", { ascending: false })
    .limit(15);

  if (standingsError) {
    console.warn("Failed to fetch historical champions standings:", standingsError);
    return [];
  }

  if (!standingsData || standingsData.length === 0) {
    return [];
  }

  // TheSportsDB schema provides team data directly in standings
  return standingsData.map((standing: any) => ({
    season_year: Number(standing.strSeason || 0),
    champion_name: String(standing.strTeam || "Unknown"),
    champion_logo: null, // Not available in current schema
  }));
}

// ---------- Fixtures with corrected column names ----------
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
  // If leagueId is provided, try TheSportsDB first
  if (leagueId) {
    try {
      const thesportsdbFixtures = await getLeagueFixturesHybrid(leagueId, 'upcoming');
      
      if (thesportsdbFixtures.length > 0) {
        // Convert TheSportsDBEvent to UpcomingFixture format
        return thesportsdbFixtures.slice(0, limit).map((fixture) => ({
          id: parseInt(fixture.idEvent),
          date_utc: fixture.dateEvent,
          status: fixture.strStatus || 'TBD',
          round: `Round ${fixture.intRound}`,
          home_team: {
            id: parseInt(fixture.idHomeTeam || '0'),
            name: fixture.strHomeTeam || 'TBD',
            logo_url: null, // TheSportsDB doesn't provide team logos in fixtures
          },
          away_team: {
            id: parseInt(fixture.idAwayTeam || '0'),
            name: fixture.strAwayTeam || 'TBD',
            logo_url: null,
          },
          venue: fixture.strVenue || 'TBD',
          league_id: leagueId,
        }));
      }
    } catch (error) {
      console.warn('TheSportsDB upcoming fixtures failed, falling back to database:', error);
    }
  }

  // Fallback to database query
  const today = new Date().toISOString().split('T')[0];
  
  let query = supabase
    .from("fixtures")
    .select(`
      id, match_date, status, round, home_team_id, away_team_id, league_id,
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_url),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_url),
      venue_name
    `)
    .gte("match_date", today)
    .in("status", ["TBD", "NS", "PST", "scheduled"]) // Updated status values
    .order("match_date", { ascending: true })
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
    date_utc: String(fixture.match_date),
    status: String(fixture.status),
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
    venue: fixture.venue_name || undefined,
    league_id: Number(fixture.league_id),
  }));
}

// ====== ROUND-BASED FIXTURES API (FIXED) ======

export interface RoundFixture {
  id: number;
  date_utc: string;
  status_short: string;
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
  home_goals: number | null;
  away_goals: number | null;
  venue?: string;
  league_id: number;
}

/**
 * Get the latest completed round number for a league (FIXED)
 */
export async function getLatestCompletedRound(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<string | null> {
  const { data, error } = await supabase
    .from("fixtures")
    .select("round, match_date")
    .eq("league_id", leagueId)
    .eq("season_year", season)
    .in("status", ["FT", "AET", "PEN"]) // Finished statuses
    .not("home_score", "is", null)
    .not("away_score", "is", null)
    .order("match_date", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0].round;
}

/**
 * Get the next upcoming round number for a league (FIXED)
 */
export async function getNextUpcomingRound(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<string | null> {
  const { data, error } = await supabase
    .from("fixtures")
    .select("round, match_date")
    .eq("league_id", leagueId)
    .eq("season_year", season)
    .in("status", ["TBD", "NS", "PST", "scheduled"])
    .order("match_date", { ascending: true })
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0].round;
}

/**
 * Fetch all fixtures from a specific round (FIXED)
 */
export async function fetchFixturesByRound(
  leagueId: number, 
  round: string, 
  season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)
): Promise<RoundFixture[]> {
  const { data, error } = await supabase
    .from("fixtures")
    .select(`
      id, match_date, status, round, home_team_id, away_team_id, league_id,
      home_score, away_score,
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_url),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_url),
      venue_name
    `)
    .eq("league_id", leagueId)
    .eq("round", round)
    .eq("season_year", season)
    .order("match_date", { ascending: true });

  if (error) {
    console.error("Error fetching fixtures by round:", error);
    return [];
  }

  if (!data) return [];

  return data.map(fixture => ({
    id: Number(fixture.id),
    date_utc: String(fixture.match_date),
    status_short: String(fixture.status),
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
    home_goals: fixture.home_score,
    away_goals: fixture.away_score,
    venue: fixture.venue_name || undefined,
    league_id: Number(fixture.league_id),
  }));
}

/**
 * Fetch recent completed fixtures from the latest completed round
 */
export async function fetchRecentRoundFixtures(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<RoundFixture[]> {
  const latestRound = await getLatestCompletedRound(leagueId, season);
  if (!latestRound) return [];
  
  return fetchFixturesByRound(leagueId, latestRound, season);
}

/**
 * Fetch upcoming fixtures from the next round
 */
export async function fetchUpcomingRoundFixtures(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<RoundFixture[]> {
  const nextRound = await getNextUpcomingRound(leagueId, season);
  if (!nextRound) return [];
  
  return fetchFixturesByRound(leagueId, nextRound, season);
}

// Re-export search function (this should work as-is)
export async function searchByName(q: string): Promise<SearchRow[]> {
  const qq = q.trim();
  if (!qq) return [];

  const [leagues, teams] = await Promise.all([
    supabase
      .from("leagues")
      .select("idLeague, strLeague, strCountry, highlightly_id")
      .ilike("strLeague", `%${qq}%`)
      .limit(10),
    supabase
      .from("teams")
      .select("idTeam, strTeam, strBadge")
      .ilike("strTeam", `%${qq}%`)
      .limit(10)
  ]);

  const rows: SearchRow[] = [];

  for (const x of leagues.data ?? []) {
    rows.push({
      type: "league",
      entity_id: x.highlightly_id || parseInt(x.idLeague.replace(/[^0-9]/g, '')) || 0,
      name: String(x.strLeague),
      slug: x.highlightly_id === 249276 ? 'k-league-1' : x.highlightly_id === 250127 ? 'k-league-2' : `league-${x.idLeague}`
    } as SearchRow);
  }
  for (const t of teams.data ?? []) {
    const teamId = parseInt(t.idTeam.replace(/[^0-9]/g, '')) || 0;
    rows.push({
      type: "team",
      entity_id: teamId,
      team_id: teamId,
      name: String(t.strTeam),
      short_name: null, // TheSportsDB에는 short name 없음
      crest_url: (t.strBadge ?? null) as string | null
    } as SearchRow);
  }

  return rows;
}

// Legacy functions for compatibility - need to implement properly for team pages
export async function fetchPlayersByTeam(teamId: number): Promise<PlayerLite[]> {
  console.warn("fetchPlayersByTeam needs implementation with correct schema");
  return [];
}

export async function fetchPlayer(id: number): Promise<PlayerLite | null> {
  console.warn("fetchPlayer needs implementation with correct schema");
  return null;
}

// Team-related types and functions (placeholder - need to implement based on actual schema)
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

export async function fetchTeamDetails(teamId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<TeamDetails | null> {
  console.warn("fetchTeamDetails needs implementation with correct schema");
  return null;
}

export async function fetchTeamFixtures(teamId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025), limit: number = 10): Promise<TeamFixture[]> {
  console.warn("fetchTeamFixtures needs implementation with correct schema");
  return [];
}

export async function fetchTeamStatistics(teamId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<TeamStatistics | null> {
  console.warn("fetchTeamStatistics needs implementation with correct schema");
  return null;
}

export async function fetchTeamUpcomingFixtures(teamId: number, limit: number = 5): Promise<UpcomingFixture[]> {
  // Try TheSportsDB first
  try {
    const thesportsdbFixtures = await getTeamFixturesHybrid(teamId, 'upcoming');
    
    if (thesportsdbFixtures.length > 0) {
      // Convert TheSportsDBEvent to UpcomingFixture format
      return thesportsdbFixtures.slice(0, limit).map((fixture) => ({
        id: parseInt(fixture.idEvent),
        date_utc: fixture.dateEvent,
        status: fixture.strStatus || 'TBD',
        round: `Round ${fixture.intRound}`,
        home_team: {
          id: parseInt(fixture.idHomeTeam || '0'),
          name: fixture.strHomeTeam || 'TBD',
          logo_url: null, // TheSportsDB doesn't provide team logos in fixtures
        },
        away_team: {
          id: parseInt(fixture.idAwayTeam || '0'),
          name: fixture.strAwayTeam || 'TBD',
          logo_url: null,
        },
        venue: fixture.strVenue || 'TBD',
        league_id: parseInt(fixture.idLeague),
      }));
    }
  } catch (error) {
    console.warn('TheSportsDB team upcoming fixtures failed, falling back to database:', error);
  }

  // Fallback to database query
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from("fixtures")
    .select(`
      id, match_date, status, round, home_team_id, away_team_id, league_id,
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_url),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_url),
      venue_name
    `)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .gte("match_date", today)
    .in("status", ["TBD", "NS", "PST", "scheduled"])
    .order("match_date", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching team upcoming fixtures:", error);
    return [];
  }

  if (!data) return [];

  return data.map(fixture => ({
    id: Number(fixture.id),
    date_utc: String(fixture.match_date),
    status: String(fixture.status),
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
    venue: fixture.venue_name || undefined,
    league_id: Number(fixture.league_id),
  }));
}

// New function for fetching recent fixtures with TheSportsDB hybrid strategy
export async function fetchRecentFixtures(leagueId?: number, limit: number = 10): Promise<RoundFixture[]> {
  // If leagueId is provided, try TheSportsDB first
  if (leagueId) {
    try {
      const thesportsdbFixtures = await getLeagueFixturesHybrid(leagueId, 'previous');
      
      if (thesportsdbFixtures.length > 0) {
        // Convert TheSportsDBEvent to RoundFixture format
        return thesportsdbFixtures.slice(0, limit).map((fixture) => ({
          id: parseInt(fixture.idEvent),
          date_utc: fixture.dateEvent,
          status_short: fixture.strStatus || 'TBD',
          round: `Round ${fixture.intRound}`,
          home_team: {
            id: parseInt(fixture.idHomeTeam || '0'),
            name: fixture.strHomeTeam || 'TBD',
            logo_url: null,
          },
          away_team: {
            id: parseInt(fixture.idAwayTeam || '0'),
            name: fixture.strAwayTeam || 'TBD',
            logo_url: null,
          },
          home_goals: fixture.intHomeScore,
          away_goals: fixture.intAwayScore,
          venue: fixture.strVenue || 'TBD',
          league_id: leagueId,
        }));
      }
    } catch (error) {
      console.warn('TheSportsDB recent fixtures failed, falling back to database:', error);
    }
  }

  // Fallback to database query
  const today = new Date().toISOString().split('T')[0];
  
  let query = supabase
    .from("fixtures")
    .select(`
      id, match_date, status, round, home_team_id, away_team_id, league_id,
      home_score, away_score,
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_url),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_url),
      venue_name
    `)
    .lt("match_date", today)
    .in("status", ["FT", "AET", "PEN"]) // Finished statuses
    .order("match_date", { ascending: false })
    .limit(limit);

  if (leagueId) {
    query = query.eq("league_id", leagueId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching recent fixtures:", error);
    return [];
  }

  if (!data) return [];

  return data.map(fixture => ({
    id: Number(fixture.id),
    date_utc: String(fixture.match_date),
    status_short: String(fixture.status),
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
    home_goals: fixture.home_score,
    away_goals: fixture.away_score,
    venue: fixture.venue_name || undefined,
    league_id: Number(fixture.league_id),
  }));
}

// New function for fetching team recent fixtures with TheSportsDB hybrid strategy
export async function fetchTeamRecentFixtures(teamId: number, limit: number = 5): Promise<RoundFixture[]> {
  // Try TheSportsDB first
  try {
    const thesportsdbFixtures = await getTeamFixturesHybrid(teamId, 'previous');
    
    if (thesportsdbFixtures.length > 0) {
      // Convert TheSportsDBEvent to RoundFixture format
      return thesportsdbFixtures.slice(0, limit).map((fixture) => ({
        id: parseInt(fixture.idEvent),
        date_utc: fixture.dateEvent,
        status_short: fixture.strStatus || 'TBD',
        round: `Round ${fixture.intRound}`,
        home_team: {
          id: parseInt(fixture.idHomeTeam || '0'),
          name: fixture.strHomeTeam || 'TBD',
          logo_url: null,
        },
        away_team: {
          id: parseInt(fixture.idAwayTeam || '0'),
          name: fixture.strAwayTeam || 'TBD',
          logo_url: null,
        },
        home_goals: fixture.intHomeScore,
        away_goals: fixture.intAwayScore,
        venue: fixture.strVenue || 'TBD',
        league_id: parseInt(fixture.idLeague),
      }));
    }
  } catch (error) {
    console.warn('TheSportsDB team recent fixtures failed, falling back to database:', error);
  }

  // Fallback to database query
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from("fixtures")
    .select(`
      id, match_date, status, round, home_team_id, away_team_id, league_id,
      home_score, away_score,
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_url),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_url),
      venue_name
    `)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .lt("match_date", today)
    .in("status", ["FT", "AET", "PEN"]) // Finished statuses
    .order("match_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching team recent fixtures:", error);
    return [];
  }

  if (!data) return [];

  return data.map(fixture => ({
    id: Number(fixture.id),
    date_utc: String(fixture.match_date),
    status_short: String(fixture.status),
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
    home_goals: fixture.home_score,
    away_goals: fixture.away_score,
    venue: fixture.venue_name || undefined,
    league_id: Number(fixture.league_id),
  }));
}

// ---------- TheSportsDB Events API Functions (Pure Schema) ----------

// TheSportsDB Events API Types (Pure Original JSON Structure)
export interface TheSportsDBEvent {
  idEvent: string;
  idAPIfootball?: string;
  strEvent: string;
  strEventAlternate?: string;
  strFilename?: string;
  strSport?: string;
  idLeague: string;
  strLeague: string;
  strLeagueBadge?: string;
  strSeason: string;
  strDescriptionEN?: string;
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore?: string;
  intRound?: string;
  intAwayScore?: string;
  intSpectators?: string;
  strOfficial?: string;
  strTimestamp?: string;
  dateEvent: string;
  dateEventLocal?: string;
  strTime?: string;
  strTimeLocal?: string;
  strGroup?: string;
  idHomeTeam?: string;
  strHomeTeamBadge?: string;
  idAwayTeam?: string;
  strAwayTeamBadge?: string;
  intScore?: string;
  intScoreVotes?: string;
  strResult?: string;
  idVenue?: string;
  strVenue?: string;
  strCountry?: string;
  strCity?: string;
  strPoster?: string;
  strSquare?: string;
  strFanart?: string;
  strThumb?: string;
  strBanner?: string;
  strMap?: string;
  strTweet1?: string;
  strTweet2?: string;
  strTweet3?: string;
  strVideo?: string;
  strStatus?: string;
  strPostponed?: string;
  strLocked?: string;
}

/**
 * Fetch league events from pure TheSportsDB events table
 */
export async function fetchLeagueEvents(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<TheSportsDBEvent[]> {
  // Map internal league IDs to TheSportsDB league IDs
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("idLeague", theSportsDBLeagueId)
    .eq("strSeason", String(season))
    .order("dateEvent", { ascending: true });

  if (error) {
    console.error("Error fetching league events:", error);
    return [];
  }

  return data || [];
}

/**
 * Fetch upcoming fixtures from events table
 */
export async function fetchUpcomingEvents(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025), limit: number = 10): Promise<TheSportsDBEvent[]> {
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("idLeague", theSportsDBLeagueId)
    .eq("strSeason", String(season))
    .gte("dateEvent", today)
    .in("strStatus", ["Not Started", "TBD", "scheduled"])
    .order("dateEvent", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching upcoming events:", error);
    return [];
  }

  return data || [];
}

/**
 * Fetch recent/completed fixtures from events table
 */
export async function fetchRecentEvents(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025), limit: number = 10): Promise<TheSportsDBEvent[]> {
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("idLeague", theSportsDBLeagueId)
    .eq("strSeason", String(season))
    .lt("dateEvent", today)
    .eq("strStatus", "Match Finished")
    .order("dateEvent", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching recent events:", error);
    return [];
  }

  return data || [];
}

/**
 * Fetch events by round from events table
 */
export async function fetchEventsByRound(leagueId: number, round: string, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<TheSportsDBEvent[]> {
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("idLeague", theSportsDBLeagueId)
    .eq("strSeason", String(season))
    .eq("intRound", round)
    .order("dateEvent", { ascending: true });

  if (error) {
    console.error("Error fetching events by round:", error);
    return [];
  }

  return data || [];
}

/**
 * Fetch team events from events table
 */
export async function fetchTeamEvents(teamName: string, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025), limit: number = 10): Promise<TheSportsDBEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("strSeason", String(season))
    .or(`strHomeTeam.eq.${teamName},strAwayTeam.eq.${teamName}`)
    .order("dateEvent", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching team events:", error);
    return [];
  }

  return data || [];
}

// ========== NEW TEAM PAGE API FUNCTIONS (TheSportsDB Schema) ==========

import type { TeamFromDB, TeamStandings, EventFromDB, EventLiveData, FormResult } from "@/domain/types";

/**
 * Fetch team details from teams table by idTeam
 */
export async function fetchTeamFromDB(idTeam: string): Promise<TeamFromDB | null> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('idTeam', idTeam)
    .maybeSingle();

  if (error) {
    console.error('Error fetching team from DB:', error);
    throw error;
  }

  return data;
}

/**
 * Fetch team standings data for a specific team
 */
export async function fetchTeamStandingsData(
  idLeague: string,
  season: string,
  teamName: string
): Promise<TeamStandings | null> {
  const { data, error } = await supabase
    .from('standings')
    .select('*')
    .eq('idLeague', idLeague)
    .eq('strSeason', season) // Fixed: use strSeason instead of season
    .eq('strTeam', teamName)
    .maybeSingle();

  if (error) {
    console.error('Error fetching team standings:', error);
    return null; // Non-critical, return null instead of throwing
  }

  return data;
}

/**
 * Fetch events for a specific team
 */
export async function fetchTeamEventsData(
  teamName: string,
  season: string,
  limit?: number
): Promise<EventFromDB[]> {
  let query = supabase
    .from('events')
    .select('*')
    .eq('strSeason', season)
    .or(`strHomeTeam.eq.${teamName},strAwayTeam.eq.${teamName}`)
    .order('dateEvent', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching team events:', error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch live data for a specific event from events_highlightly_enhanced
 */
export async function fetchEventLiveData(idEvent: string): Promise<EventLiveData | null> {
  const { data, error } = await supabase
    .from('events_highlightly_enhanced')
    .select('*')
    .eq('idEvent', idEvent)
    .maybeSingle();

  // No error if not found - not all events have live data
  if (error) {
    console.warn('No live data found for event:', idEvent);
    return null;
  }

  return data;
}

/**
 * Calculate form guide (W/D/L) from recent team events
 */
export async function fetchTeamFormGuide(
  teamName: string,
  season: string,
  limit: number = 5
): Promise<FormResult[]> {
  const events = await fetchTeamEventsData(teamName, season, limit);

  return events
    .filter(event => event.intHomeScore !== null && event.intAwayScore !== null)
    .map(event => {
      const isHome = event.strHomeTeam === teamName;
      const teamScore = isHome ? event.intHomeScore : event.intAwayScore;
      const oppScore = isHome ? event.intAwayScore : event.intHomeScore;

      if (teamScore! > oppScore!) return 'W';
      if (teamScore! < oppScore!) return 'L';
      return 'D';
    });
}

/**
 * Fetch upcoming events for a team
 */
export async function fetchTeamUpcomingEventsData(
  teamName: string,
  season: string,
  limit: number = 5
): Promise<EventFromDB[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('strSeason', season)
    .or(`strHomeTeam.eq.${teamName},strAwayTeam.eq.${teamName}`)
    .gte('dateEvent', today)
    .order('dateEvent', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching team upcoming events:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch recent completed events for a team
 */
export async function fetchTeamRecentEventsData(
  teamName: string,
  season: string,
  limit: number = 5
): Promise<EventFromDB[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('strSeason', season)
    .or(`strHomeTeam.eq.${teamName},strAwayTeam.eq.${teamName}`)
    .lt('dateEvent', today)
    .not('intHomeScore', 'is', null)
    .not('intAwayScore', 'is', null)
    .order('dateEvent', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching team recent events:', error);
    return [];
  }

  return data || [];
}
