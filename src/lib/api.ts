// src/lib/api.ts
// FIXED VERSION: Updated to match actual database schema
import { supabase } from "@/lib/supabaseClient";
import type { SearchRow } from "@/domain/types";
import { 
  getLeagueFixturesHybrid,
  getTeamFixturesHybrid,
  type TheSportsDBEvent 
} from "@/lib/thesportsdb-fixtures";

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

// ---------- API ----------
export async function fetchLeagues(): Promise<LeagueLite[]> {
  const { data, error } = await supabase
    .from("leagues")
    .select("id, name, country_code, season_year")
    .order("name", { ascending: true });

  if (error) throw error;

  // 중복 제거: 같은 id에 대해 최신 시즌만 유지
  const uniqueLeagues = new Map<number, any>();
  
  (data ?? []).forEach((league) => {
    const existing = uniqueLeagues.get(league.id);
    if (!existing || (league.season_year || 0) > (existing.season_year || 0)) {
      uniqueLeagues.set(league.id, league);
    }
  });

  return Array.from(uniqueLeagues.values()).map((x) => ({
    id: Number(x.id),
    slug: `league-${x.id}`,
    name: String(x.name),
    tier: null,
  }));
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
  const leagueId = slug.replace('league-', '');
  const { data, error } = await supabase
    .from("leagues")
    .select("id, name, country_code, season_year")
    .eq("id", leagueId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: Number(data.id),
    name: String(data.name),
    slug: `league-${data.id}`,
    country: data.country_code as string | null,
    season: 2025,
  };
}

export async function fetchLeagueStandings(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<TeamStanding[]> {
  // FIXED: Use actual column names from the database
  const { data, error } = await supabase
    .from("standings")
    .select(`
      team_id,
      position,
      points,
      played,
      won,
      drawn,
      lost,
      goals_for,
      goals_against,
      goal_difference,
      form,
      teams!inner(name, code, logo_url)
    `)
    .eq("league_id", leagueId)
    .eq("season_year", season)
    .order("position", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((standing: any) => ({
    team_id: Number(standing.team_id),
    team_name: String(standing.teams?.name || "Unknown"),
    short_name: (standing.teams?.code ?? null) as string | null,
    crest_url: (standing.teams?.logo_url ?? null) as string | null,
    rank: Number(standing.position),
    points: Number(standing.points),
    played: Number(standing.played),
    win: Number(standing.won),
    draw: Number(standing.drawn),
    lose: Number(standing.lost),
    goals_for: Number(standing.goals_for || 0),
    goals_against: Number(standing.goals_against || 0),
    goals_diff: Number(standing.goal_difference),
    form: (standing.form ?? null) as string | null,
  }));
}

// Alternative approach: Get teams directly from standings since team_seasons table doesn't exist
export async function fetchLeagueTeams(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<TeamLite[]> {
  const { data, error } = await supabase
    .from("standings")
    .select(`
      teams!inner(id, name, code, logo_url)
    `)
    .eq("league_id", leagueId)
    .eq("season_year", season);

  if (error) throw error;

  return (data ?? []).map((item: any) => ({
    id: Number(item.teams?.id || 0),
    name: String(item.teams?.name || "Unknown"),
    short_name: (item.teams?.code ?? null) as string | null,
    crest_url: (item.teams?.logo_url ?? null) as string | null,
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
  // FIXED: Use actual column names
  const [standingsResult, fixturesResult] = await Promise.all([
    supabase
      .from("standings")
      .select("*")
      .eq("league_id", leagueId)
      .eq("season_year", season),
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
  const totalGoals = completedMatches.reduce((sum, match) => 
    sum + (match.home_score || 0) + (match.away_score || 0), 0);

  return {
    total_goals: totalGoals,
    total_matches: totalMatches,
    avg_goals_per_match: totalMatches > 0 ? Number((totalGoals / totalMatches).toFixed(2)) : 0,
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
  // Get 1st place teams from standings for different seasons
  const { data: standingsData, error: standingsError } = await supabase
    .from("standings")
    .select("season_year, team_id")
    .eq("league_id", leagueId)
    .eq("position", 1)
    .order("season_year", { ascending: false })
    .limit(15);

  if (standingsError) {
    console.warn("Failed to fetch historical champions standings:", standingsError);
    return [];
  }

  if (!standingsData || standingsData.length === 0) {
    return [];
  }

  // Get team information
  const teamIds = standingsData.map(item => item.team_id);
  const { data: teamsData, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, logo_url")
    .in("id", teamIds);

  if (teamsError) {
    console.warn("Failed to fetch teams data:", teamsError);
    return [];
  }

  // Combine data
  return standingsData.map((standing: any) => {
    const team = (teamsData || []).find(t => t.id === standing.team_id);
    return {
      season_year: Number(standing.season_year),
      champion_name: String(team?.name || "Unknown"),
      champion_logo: (team?.logo_url ?? null) as string | null,
    };
  });
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
        return thesportsdbFixtures.slice(0, limit).map((fixture: TheSportsDBEvent) => ({
          id: parseInt(fixture.idEvent),
          date_utc: fixture.dateEvent,
          status: fixture.strStatus,
          round: `Round ${fixture.intRound}`,
          home_team: {
            id: parseInt(fixture.idHomeTeam),
            name: fixture.strHomeTeam,
            logo_url: null, // TheSportsDB doesn't provide team logos in fixtures
          },
          away_team: {
            id: parseInt(fixture.idAwayTeam),
            name: fixture.strAwayTeam,
            logo_url: null,
          },
          venue: fixture.strVenue,
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
      .select("id, name, country_code, season_year")
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
      slug: `league-${x.id}`
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
      return thesportsdbFixtures.slice(0, limit).map((fixture: TheSportsDBEvent) => ({
        id: parseInt(fixture.idEvent),
        date_utc: fixture.dateEvent,
        status: fixture.strStatus,
        round: `Round ${fixture.intRound}`,
        home_team: {
          id: parseInt(fixture.idHomeTeam),
          name: fixture.strHomeTeam,
          logo_url: null, // TheSportsDB doesn't provide team logos in fixtures
        },
        away_team: {
          id: parseInt(fixture.idAwayTeam),
          name: fixture.strAwayTeam,
          logo_url: null,
        },
        venue: fixture.strVenue,
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
        return thesportsdbFixtures.slice(0, limit).map((fixture: TheSportsDBEvent) => ({
          id: parseInt(fixture.idEvent),
          date_utc: fixture.dateEvent,
          status_short: fixture.strStatus,
          round: `Round ${fixture.intRound}`,
          home_team: {
            id: parseInt(fixture.idHomeTeam),
            name: fixture.strHomeTeam,
            logo_url: null,
          },
          away_team: {
            id: parseInt(fixture.idAwayTeam),
            name: fixture.strAwayTeam,
            logo_url: null,
          },
          home_goals: fixture.intHomeScore,
          away_goals: fixture.intAwayScore,
          venue: fixture.strVenue,
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
      return thesportsdbFixtures.slice(0, limit).map((fixture: TheSportsDBEvent) => ({
        id: parseInt(fixture.idEvent),
        date_utc: fixture.dateEvent,
        status_short: fixture.strStatus,
        round: `Round ${fixture.intRound}`,
        home_team: {
          id: parseInt(fixture.idHomeTeam),
          name: fixture.strHomeTeam,
          logo_url: null,
        },
        away_team: {
          id: parseInt(fixture.idAwayTeam),
          name: fixture.strAwayTeam,
          logo_url: null,
        },
        home_goals: fixture.intHomeScore,
        away_goals: fixture.intAwayScore,
        venue: fixture.strVenue,
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
