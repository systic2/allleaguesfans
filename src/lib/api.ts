// src/lib/api.ts
// FIXED VERSION: Updated to match actual database schema
import { supabase } from "@/lib/supabaseClient";
import type { SearchRow } from "@/domain/types";
import type { Match, Standing } from "@/types/domain"; // Added Match, Team, and Standing import
import type { TheSportsDBEvent } from './mappers/thesportsdb-mappers'; // NEW IMPORT


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
  // slug에서 내부 leagueId를 TheSportsDB ID로 변환 (기존 로직 유지)
  let theSportsDBLeagueId: string;
  if (leagueSlug === 'k-league-1') {
    theSportsDBLeagueId = '4689';
  } else if (leagueSlug === 'k-league-2') {
    theSportsDBLeagueId = '4822';
  } else {
    theSportsDBLeagueId = leagueSlug.replace('league-', '');
  }

  const { data, error } = await supabase
    .from("standings_v2") // <-- 변경: standings_v2 테이블 사용
    .select(`*`) // <-- 변경: 모든 컬럼을 선택 (Standing 도메인 모델과 일치)
    .eq("leagueId", theSportsDBLeagueId) // <-- 변경: leagueId 컬럼 사용
    .eq("season", String(season)) // <-- 변경: season 컬럼 사용
    .order("rank", { ascending: true }); // <-- 변경: rank 컬럼으로 정렬

  if (error) throw error;

  // standings_v2 (Standing 도메인 모델)의 데이터를 TeamStanding 타입으로 변환
  return (data ?? []).map((standing: any) => ({
    team_id: Number(standing.teamId || 0), // domain.teamId -> TeamStanding.team_id (number)
    team_name: String(standing.teamName || "Unknown"),
    short_name: null, // domain 모델에 short_name이 없으므로 null
    crest_url: standing.teamBadgeUrl, // domain.teamBadgeUrl -> TeamStanding.crest_url
    rank: Number(standing.rank || 0),
    points: Number(standing.points || 0),
    played: Number(standing.gamesPlayed || 0), // domain.gamesPlayed -> TeamStanding.played
    win: Number(standing.wins || 0),
    draw: Number(standing.draws || 0),
    lose: Number(standing.losses || 0), // domain.losses -> TeamStanding.lose
    goals_for: Number(standing.goalsFor || 0),
    goals_against: Number(standing.goalsAgainst || 0),
    goals_diff: Number(standing.goalDifference || 0), // domain.goalDifference -> TeamStanding.goals_diff
    form: standing.form,
  }));
}

// Get teams directly from standings using PURE TheSportsDB schema
export async function fetchLeagueTeams(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<TeamLite[]> {
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);
  
  const { data, error } = await supabase
    .from("standings_v2") // <-- 변경: standings_v2 테이블 사용
    .select(`
      teamId,       // <-- 변경: domain.teamId
      teamName,     // <-- 변경: domain.teamName
      teamBadgeUrl  // <-- 변경: domain.teamBadgeUrl
    `)
    .eq("leagueId", theSportsDBLeagueId) // <-- 변경: leagueId 컬럼 사용
    .eq("season", String(season)); // <-- 변경: season 컬럼 사용

  if (error) throw error;

  return (data ?? []).map((item: any) => ({
    id: Number(item.teamId || 0), // domain.teamId -> TeamLite.id
    name: String(item.teamName || "Unknown"), // domain.teamName -> TeamLite.name
    short_name: null, // domain 모델에 short_name이 없으므로 null
    crest_url: item.teamBadgeUrl, // domain.teamBadgeUrl -> TeamLite.crest_url
    logo_url: item.teamBadgeUrl, // 동일한 배지 URL 사용
    badge_url: item.teamBadgeUrl,
    banner_url: null,
    primary_source: "thesportsdb", // 이 정보는 standings_v2에 없으므로 고정
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
  // PURE TheSportsDB Schema - 순수 원본 JSON 키값 사용 (TheSportsDB ID 매핑은 기존 로직 유지)
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);
  
  const [standingsResult, fixturesResult] = await Promise.all([
    supabase
      .from("standings_v2") // <-- 변경: standings_v2 테이블 사용
      .select("leagueId, goalsFor, goalsAgainst, gamesPlayed") // <-- 변경: domain 모델의 필드명 사용
      .eq("leagueId", theSportsDBLeagueId) // <-- 변경: leagueId 컬럼 사용
      .eq("season", String(season)), // <-- 변경: season 컬럼 사용
    supabase
      .from("events_v2") // <-- 변경: events_v2 테이블 사용
      .select("homeScore, awayScore") // <-- 변경: Match 도메인 모델의 필드명 사용
      .eq("leagueId", String(leagueId)) // <-- 변경: leagueId 컬럼 사용 (number -> string)
      .eq("season", String(season)) // <-- 변경: season 컬럼 사용
      .eq("status", "FINISHED") // <-- 변경: Match 도메인 status 사용 (경기 완료된 경우만 집계)
  ]);

  const totalTeams = standingsResult.data?.length || 0;
  const completedMatches = fixturesResult.data || [];
  const totalMatches = completedMatches.length;
  
  // standings_v2 (domain 모델) 데이터에서 골 통계 계산 (기존 로직 유지)
  const totalGoalsFromStandings = standingsResult.data?.reduce((sum, team) => 
    sum + (team.goalsFor || 0), 0) || 0;
  
  // events_v2에서 가져온 데이터로 총 골 계산
  const totalGoals = totalMatches > 0 
    ? completedMatches.reduce((sum, match) => sum + (match.homeScore || 0) + (match.awayScore || 0), 0)
    : totalGoalsFromStandings;

  // 매치 수 계산 (standings_v2 데이터 기반)
  const avgMatchesPerTeam = standingsResult.data && standingsResult.data.length > 0 
    ? standingsResult.data.reduce((sum, team) => sum + (team.gamesPlayed || 0), 0) / standingsResult.data.length // <-- 변경: gamesPlayed 필드 사용
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

// Wrapper functions for backward compatibility - delegates to new player_statistics functions
export async function fetchTopScorers(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025), limit: number = 10): Promise<TopScorer[]> {
  // Convert API-Hub league ID to TheSportsDB league ID
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);

  // Fetch from player_statistics via top_scorers view
  const stats = await fetchTopScorersStats(theSportsDBLeagueId, String(season), limit);

  // Convert PlayerStatistics to TopScorer format
  return stats.map(stat => ({
    player_name: stat.strPlayer,
    team_name: stat.strTeam || '',
    goals: stat.goals || 0,
    assists: stat.assists || 0,
    matches: stat.appearances || 0
  }));
}

export async function fetchTopAssists(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025), limit: number = 10): Promise<TopAssist[]> {
  // Convert API-Hub league ID to TheSportsDB league ID
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);

  // Fetch from player_statistics via top_assisters view
  const stats = await fetchTopAssistersStats(theSportsDBLeagueId, String(season), limit);

  // Convert PlayerStatistics to TopAssist format
  return stats.map(stat => ({
    player_name: stat.strPlayer,
    team_name: stat.strTeam || '',
    assists: stat.assists || 0,
    goals: stat.goals || 0,
    matches: stat.appearances || 0
  }));
}

export async function fetchHistoricalChampions(leagueId: number): Promise<HistoricalChampion[]> {
  // Get 1st place teams from standings_v2 for COMPLETED seasons only (exclude current season)
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);

  // Get current year to filter out ongoing season
  const currentYear = new Date().getFullYear();

  const { data: standingsData, error: standingsError } = await supabase
    .from("standings_v2") // <-- 변경: standings_v2 테이블 사용
    .select("season, teamName") // <-- 변경: domain 모델의 필드명 사용
    .eq("leagueId", theSportsDBLeagueId) // <-- 변경: leagueId 컬럼 사용
    .eq("rank", 1) // <-- 변경: intRank 대신 rank 컬럼 사용
    .lt("season", String(currentYear)) // <-- 변경: strSeason 대신 season 컬럼 사용
    .order("season", { ascending: false }) // <-- 변경: season 컬럼으로 정렬
    .limit(15);

  if (standingsError) {
    console.warn("Failed to fetch historical champions standings:", standingsError);
    return [];
  }

  if (!standingsData || standingsData.length === 0) {
    return [];
  }

  // standings_v2 (domain 모델)의 데이터를 HistoricalChampion 형식으로 변환
  return standingsData.map((standing: any) => ({
    season_year: Number(standing.season || 0), // domain.season -> HistoricalChampion.season_year
    champion_name: String(standing.teamName || "Unknown"), // domain.teamName -> HistoricalChampion.champion_name
    champion_logo: null, // domain 모델에 champion_logo 없음 (현재 스키마에 없음)
  }));
}

// ---------- Fixtures with corrected column names ----------
export interface UpcomingFixture {
  id: string;
  date_utc: string;
  status: string;
  round: string;
  home_team: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  away_team: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  venue?: string;
  league_id: string;
}

export async function fetchUpcomingFixtures(leagueId?: number, limit: number = 10): Promise<UpcomingFixture[]> {
  // Fallback to database query from events_v2
  const today = new Date().toISOString(); // Use ISOString for TIMESTAMPTZ comparison
  
  let query = supabase
    .from("events_v2") // <-- 변경: events_v2 테이블 사용
    .select(`*`) // <-- 변경: 모든 컬럼 선택 (Match 도메인 모델과 일치)
    .gte("date", today) // <-- 변경: date 컬럼 사용
    .in("status", ["SCHEDULED", "UNKNOWN", "POSTPONED"]) // <-- 변경: Match 도메인 status 사용
    .order("date", { ascending: true }) // <-- 변경: date 컬럼 사용
    .limit(limit);

  if (leagueId) {
    query = query.eq("leagueId", String(leagueId)); // <-- 변경: leagueId 컬럼 사용, number -> string 변환
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching upcoming fixtures from events_v2:", error);
    return [];
  }

  if (!data) return [];

  // Match (events_v2) 데이터를 UpcomingFixture 타입으로 변환
  return data.map(match => ({
    id: String(match.id), // Match.id (string) -> UpcomingFixture.id (string)
    date_utc: String(match.date), // Match.date -> UpcomingFixture.date_utc
    status: String(match.status), // Match.status -> UpcomingFixture.status
    round: String(match.round || 'N/A'), // Match.round -> UpcomingFixture.round
    home_team: {
      id: String(match.homeTeamId), // Match.homeTeamId -> UpcomingFixture.home_team.id (string)
      name: `Team ${match.homeTeamId}`, // 실제 팀 이름은 별도 룩업 필요
      logo_url: null,
    },
    away_team: {
      id: String(match.awayTeamId), // Match.awayTeamId -> UpcomingFixture.away_team.id (string)
      name: `Team ${match.awayTeamId}`, // 실제 팀 이름은 별도 룩업 필요
      logo_url: null,
    },
    venue: match.venueName || undefined, // Match.venueName -> UpcomingFixture.venue
    league_id: String(match.leagueId), // Match.leagueId -> UpcomingFixture.league_id (string)
  }));
}

// ====== ROUND-BASED FIXTURES API (FIXED) ======

export interface RoundFixture {
  id: string;
  date_utc: string;
  status_short: string;
  round: string;
  home_team: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  away_team: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  home_goals: number | null;
  away_goals: number | null;
  venue?: string;
  league_id: string;
}

/**
 * Get the latest completed round number for a league (FIXED)
 */
export async function getLatestCompletedRound(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<string | null> {
  const { data, error } = await supabase
    .from("events_v2") // <-- 변경: events_v2 테이블 사용
    .select("round, date") // <-- 변경: round, date 컬럼 사용
    .eq("leagueId", String(leagueId)) // <-- 변경: leagueId 컬럼 사용 (number -> string)
    .eq("season", String(season)) // <-- 변경: season 컬럼 사용
    .eq("status", "FINISHED") // <-- 변경: Match 도메인 status 사용, 점수 null 여부 대신
    .order("date", { ascending: false }) // <-- 변경: date 컬럼 사용
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0].round || null; // Match.round는 string | undefined
}

/**
 * Get the next upcoming round number for a league (FIXED)
 */
export async function getNextUpcomingRound(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<string | null> {
  const { data, error } = await supabase
    .from("events_v2") // <-- 변경: events_v2 테이블 사용
    .select("round, date") // <-- 변경: round, date 컬럼 사용
    .eq("leagueId", String(leagueId)) // <-- 변경: leagueId 컬럼 사용 (number -> string)
    .eq("season", String(season)) // <-- 변경: season 컬럼 사용
    .in("status", ["SCHEDULED", "UNKNOWN", "POSTPONED"]) // <-- 변경: Match 도메인 status 사용
    .order("date", { ascending: true }) // <-- 변경: date 컬럼 사용
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

    return data[0].round || null; // Match.round는 string | undefined

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

      .from("events_v2") // <-- 변경: events_v2 테이블 사용

      .select(`*`) // <-- 변경: 모든 컬럼 선택 (Match 도메인 모델과 일치)

      .eq("leagueId", String(leagueId)) // <-- 변경: leagueId 컬럼 사용 (number -> string)

      .eq("round", round) // <-- 변경: round 컬럼 사용

      .eq("season", String(season)) // <-- 변경: season 컬럼 사용

      .order("date", { ascending: true }); // <-- 변경: date 컬럼 사용

  

    if (error) {

      console.error("Error fetching fixtures by round from events_v2:", error);

      return [];

    }

  

    if (!data) return [];

  

    // Match (events_v2) 데이터를 RoundFixture 타입으로 변환

    return data.map(match => ({

      id: String(match.id), // Match.id (string) -> RoundFixture.id (string)

      date_utc: String(match.date), // Match.date -> RoundFixture.date_utc

      status_short: String(match.status), // Match.status -> RoundFixture.status_short

      round: String(match.round || 'N/A'), // Match.round -> RoundFixture.round

      home_team: {

        id: String(match.homeTeamId), // Match.homeTeamId -> RoundFixture.home_team.id (string)

        name: `Team ${match.homeTeamId}`, // 실제 팀 이름은 별도 룩업 필요

        logo_url: null,

      },

      away_team: {

        id: String(match.awayTeamId), // Match.awayTeamId -> RoundFixture.away_team.id (string)

        name: `Team ${match.awayTeamId}`, // 실제 팀 이름은 별도 룩업 필요

        logo_url: null,

      },

      home_goals: match.homeScore, // Match.homeScore -> RoundFixture.home_goals

      away_goals: match.awayScore, // Match.awayScore -> RoundFixture.away_goals

      venue: match.venueName || undefined, // Match.venueName -> RoundFixture.venue

      league_id: String(match.leagueId), // Match.leagueId -> RoundFixture.league_id (string)

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
export async function fetchPlayersByTeam(teamId: string, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<TeamPlayer[]> {
  const { data: playersData, error: playersError } = await supabase
    .from('players')
    .select('idPlayer, strPlayer, strTeam, idTeam, strPosition, strNumber')
    .eq('idTeam', teamId)
    .order('strNumber', { ascending: true, nullsFirst: false });

  if (playersError) {
    console.error('Error fetching players:', playersError);
    return [];
  }

  if (!playersData || playersData.length === 0) {
    return [];
  }

  // Fetch all player statistics for the team for the current season
  const { data: statsData, error: statsError } = await supabase
    .from('player_statistics')
    .select('idPlayer, goals, assists, appearances, yellow_cards, red_cards')
    .eq('idTeam', teamId)
    .eq('strSeason', String(season));

  if (statsError) {
    console.warn('Error fetching player statistics:', statsError);
    // Continue without statistics if there's an error
  }

  const playerStatsMap = new Map<string, Partial<PlayerStatistics>>();
  if (statsData) {
    statsData.forEach(stat => {
      playerStatsMap.set(stat.idPlayer, stat);
    });
  }

  // Combine player data with their statistics
  return playersData.map(player => {
    const stats = playerStatsMap.get(player.idPlayer) || {};
    return {
      ...player,
      goals: stats.goals ?? 0,
      assists: stats.assists ?? 0,
      appearances: stats.appearances ?? 0,
      yellow_cards: stats.yellow_cards ?? 0,
      red_cards: stats.red_cards ?? 0,
    };
  });
}

// Player Details for Profile Page
export type PlayerDetail = {
  id: string;
  name: string;
  teamName: string;
  teamId: string;
  position: string;
  jerseyNumber: string;
  photoUrl: string | null;
  
  // Biographical (Mocked/Placeholder if missing)
  nationality: string;
  height: string;
  weight: string;
  age: number;
  birthDate: string;
  preferredFoot: 'Left' | 'Right' | 'Both';
  
  // Real Season Statistics (from DB)
  stats: {
    appearances: number;
    minutesPlayed: number;
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    penaltiesScored: number;
    penaltiesMissed: number;
    ownGoals: number;
    rating: number; // Mocked for now as it's not in DB
  };
};

export async function fetchPlayerDetail(playerId: number): Promise<PlayerDetail | null> {
  const { data: player, error } = await supabase
    .from('players')
    .select('*')
    .eq('idPlayer', String(playerId))
    .maybeSingle();

  if (error || !player) {
    console.error("Player not found:", error);
    return null;
  }

  // Fetch Stats
  const { data: stats } = await supabase
    .from('player_statistics')
    .select('*')
    .eq('idPlayer', String(playerId))
    .eq('strSeason', '2025') // Current Season
    .maybeSingle();

  const pos = player.strPosition || 'M';

  return {
    id: player.idPlayer,
    name: player.strPlayer,
    teamName: player.strTeam,
    teamId: player.idTeam,
    position: pos,
    jerseyNumber: player.strNumber || '-',
    photoUrl: null, // No photo in DB currently
    
    // Placeholders
    nationality: 'Korea Republic',
    height: '180 cm',
    weight: '75 kg',
    age: 24, // Mocked
    birthDate: '2001-01-01', // Mocked
    preferredFoot: 'Right',

    stats: {
      appearances: stats?.appearances || 0,
      minutesPlayed: stats?.minutes_played || 0,
      goals: stats?.goals || 0,
      assists: stats?.assists || 0,
      yellowCards: stats?.yellow_cards || 0,
      redCards: stats?.red_cards || 0,
      penaltiesScored: stats?.penalties_scored || 0,
      penaltiesMissed: stats?.penalties_missed || 0,
      ownGoals: stats?.own_goals || 0,
      rating: (Math.random() * (8.5 - 6.0) + 6.0), // Random rating between 6.0 and 8.5
    },
  };
}

// Update fetchPlayer to use fetchPlayerDetail for compatibility
export async function fetchPlayer(id: number): Promise<PlayerLite | null> {
  const detail = await fetchPlayerDetail(id);
  if (!detail) return null;
  return {
    id: Number(detail.id),
    name: detail.name,
    position: detail.position,
    photo_url: detail.photoUrl,
    team_id: Number(detail.teamId),
    jersey_number: Number(detail.jerseyNumber),
    primary_source: 'db'
  };
}

// Team-related types and functions (placeholder - need to implement based on actual schema)
export type TeamDetails = {
  id: string; // From teams_v2.id
  name: string; // From teams_v2.name
  nameKorean: string | null; // From teams_v2.nameKorean
  badgeUrl: string | null; // From teams_v2.badgeUrl
  strStadium?: string | null; // From teams_v2.strStadium
  intFormedYear?: string | null; // From teams_v2.intFormedYear

  // From standings_v2 (if available for current season)
  current_position?: number | null;
  points?: number | null;
  matches_played?: number | null; // gamesPlayed
  wins?: number | null;
  draws?: number | null;
  losses?: number | null;
  goals_for?: number | null;
  goals_against?: number | null;
  goal_difference?: number | null;
  currentLeagueId?: string;
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

export async function fetchTeamDetails(teamId: string, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<TeamDetails | null> {
  const { data: teamData, error: teamError } = await supabase
    .from('teams_v2')
    .select('id, name, nameKorean, badgeUrl, strStadium, intFormedYear')
    .eq('id', teamId)
    .maybeSingle();

  if (teamError) {
    console.error('Error fetching team from teams_v2:', teamError);
    return null;
  }
  if (!teamData) {
    return null;
  }

  // Attempt to fetch current standing for the team in either K League 1 or K League 2
  // Prioritize K League 1 if both exist for a team, or just pick one if in multiple
  const { data: standingData, error: standingError } = await supabase
    .from('standings_v2')
    .select('rank, points, gamesPlayed, wins, draws, losses, goalsFor, goalsAgainst, goalDifference, leagueId')
    .eq('teamId', teamId)
    .eq('season', String(season))
    .in('leagueId', ['4689', '4822']) // K League 1 (4689) or K League 2 (4822)
    .order('leagueId', { ascending: true }) // Prioritize K League 1 if team is in both
    .limit(1)
    .maybeSingle();

  if (standingError) {
    console.warn(`Error fetching standing for team ${teamId}:`, standingError);
    // Continue without standing data
  }

  return {
    id: teamData.id,
    name: teamData.name,
    nameKorean: teamData.nameKorean,
    badgeUrl: teamData.badgeUrl,
    strStadium: teamData.strStadium,
    intFormedYear: teamData.intFormedYear,
    current_position: standingData?.rank ?? null,
    points: standingData?.points ?? null,
    matches_played: standingData?.gamesPlayed ?? null,
    wins: standingData?.wins ?? null,
    draws: standingData?.draws ?? null,
    losses: standingData?.losses ?? null,
    goals_for: standingData?.goalsFor ?? null,
    goals_against: standingData?.goalsAgainst ?? null,
    goal_difference: standingData?.goalDifference ?? null,
    currentLeagueId: standingData?.leagueId ?? null,
  };
}

export async function fetchTeamFixtures(_teamId: number, _season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025), _limit: number = 10): Promise<TeamFixture[]> {
  console.warn("fetchTeamFixtures needs implementation with correct schema");
  return [];
}

export async function fetchTeamStatistics(_teamId: number, _season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<TeamStatistics | null> {
  console.warn("fetchTeamStatistics needs implementation with correct schema");
  return null;
}

export async function fetchTeamUpcomingFixtures(teamId: string, limit: number = 5): Promise<UpcomingFixture[]> {
  // Fallback to database query from events_v2
  const today = new Date().toISOString(); // Use ISOString for TIMESTAMPTZ comparison
  
  const { data, error } = await supabase
    .from("events_v2") // <-- 변경: events_v2 테이블 사용
    .select(`*`) // <-- 변경: 모든 컬럼 선택 (Match 도메인 모델과 일치)
    .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`) // <-- 변경: homeTeamId, awayTeamId 컬럼 사용
    .gte("date", today) // <-- 변경: date 컬럼 사용
    .in("status", ["SCHEDULED", "UNKNOWN", "POSTPONED"]) // <-- 변경: Match 도메인 status 사용
    .order("date", { ascending: true }) // <-- 변경: date 컬럼 사용
    .limit(limit);

  if (error) {
    console.error("Error fetching team upcoming fixtures from events_v2:", error);
    return [];
  }

  if (!data) return [];

  // Match (events_v2) 데이터를 UpcomingFixture 타입으로 변환
  return data.map(match => ({
    id: String(match.id), // Match.id (string) -> UpcomingFixture.id (string)
    date_utc: String(match.date), // Match.date -> UpcomingFixture.date_utc
    status: String(match.status), // Match.status -> UpcomingFixture.status
    round: String(match.round || 'N/A'), // Match.round -> UpcomingFixture.round
    home_team: {
      id: String(match.homeTeamId), // Match.homeTeamId -> UpcomingFixture.home_team.id (string)
      name: `Team ${match.homeTeamId}`, // 실제 팀 이름은 별도 룩업 필요
      logo_url: null,
    },
    away_team: {
      id: String(match.awayTeamId), // Match.awayTeamId -> UpcomingFixture.away_team.id (string)
      name: `Team ${match.awayTeamId}`, // 실제 팀 이름은 별도 룩업 필요
      logo_url: null,
    },
    venue: match.venueName || undefined, // Match.venueName -> UpcomingFixture.venue
    league_id: String(match.leagueId), // Match.leagueId -> UpcomingFixture.league_id (string)
  }));
}

// New function for fetching recent fixtures with TheSportsDB hybrid strategy
export async function fetchRecentFixtures(leagueId?: number, limit: number = 10): Promise<RoundFixture[]> {
  // Fallback to database query from events_v2
  const today = new Date().toISOString(); // Use ISOString for TIMESTAMPTZ comparison
  
  let query = supabase
    .from("events_v2") // <-- 변경: events_v2 테이블 사용
    .select(`*`) // <-- 변경: 모든 컬럼 선택 (Match 도메인 모델과 일치)
    .lt("date", today) // <-- 변경: date 컬럼 사용
    .eq("status", "FINISHED") // <-- 변경: Match 도메인 status 사용
    .order("date", { ascending: false }) // <-- 변경: date 컬럼 사용
    .limit(limit);

  if (leagueId) {
    query = query.eq("leagueId", String(leagueId)); // <-- 변경: leagueId 컬럼 사용, number -> string 변환
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching recent fixtures from events_v2:", error);
    return [];
  }

  if (!data) return [];

  // Match (events_v2) 데이터를 RoundFixture 타입으로 변환
  return data.map(match => ({
    id: String(match.id), // Match.id (string) -> RoundFixture.id (string)
    date_utc: String(match.date), // Match.date -> RoundFixture.date_utc
    status_short: String(match.status), // Match.status -> RoundFixture.status_short
    round: String(match.round || 'N/A'), // Match.round -> RoundFixture.round
    home_team: {
      id: String(match.homeTeamId), // Match.homeTeamId -> RoundFixture.home_team.id (string)
      name: `Team ${match.homeTeamId}`, // 실제 팀 이름은 별도 룩업 필요
      logo_url: null,
    },
    away_team: {
      id: String(match.awayTeamId), // Match.awayTeamId -> RoundFixture.away_team.id (string)
      name: `Team ${match.awayTeamId}`, // 실제 팀 이름은 별도 룩업 필요
      logo_url: null,
    },
    home_goals: match.homeScore, // Match.homeScore -> RoundFixture.home_goals
    away_goals: match.awayScore, // Match.awayScore -> RoundFixture.away_goals
    venue: match.venueName || undefined, // Match.venueName -> RoundFixture.venue
    league_id: String(match.leagueId), // Match.leagueId -> RoundFixture.league_id (string)
  }));
}

// New function for fetching team recent fixtures with TheSportsDB hybrid strategy
export async function fetchTeamRecentFixtures(teamId: string, limit: number = 5): Promise<RoundFixture[]> {
  // Fallback to database query from events_v2
  const today = new Date().toISOString(); // Use ISOString for TIMESTAMPTZ comparison
  
  const { data, error } = await supabase
    .from("events_v2") // <-- 변경: events_v2 테이블 사용
    .select(`*`) // <-- 변경: 모든 컬럼 선택 (Match 도메인 모델과 일치)
    .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`) // <-- 변경: homeTeamId, awayTeamId 컬럼 사용
    .lt("date", today) // <-- 변경: date 컬럼 사용
    .eq("status", "FINISHED") // <-- 변경: Match 도메인 status 사용
    .order("date", { ascending: false }) // <-- 변경: date 컬럼 사용
    .limit(limit);

  if (error) {
    console.error("Error fetching team recent fixtures from events_v2:", error);
    return [];
  }

  if (!data) return [];

  // Match (events_v2) 데이터를 RoundFixture 타입으로 변환
  return data.map(match => ({
    id: String(match.id), // Match.id (string) -> RoundFixture.id (string)
    date_utc: String(match.date), // Match.date -> RoundFixture.date_utc
    status_short: String(match.status), // Match.status -> RoundFixture.status_short
    round: String(match.round || 'N/A'), // Match.round -> RoundFixture.round
    home_team: {
      id: String(match.homeTeamId), // Match.homeTeamId -> RoundFixture.home_team.id (string)
      name: `Team ${match.homeTeamId}`, // 실제 팀 이름은 별도 룩업 필요
      logo_url: null,
    },
    away_team: {
      id: String(match.awayTeamId), // Match.awayTeamId -> RoundFixture.away_team.id (string)
      name: `Team ${match.awayTeamId}`, // 실제 팀 이름은 별도 룩업 필요
      logo_url: null,
    },
    home_goals: match.homeScore, // Match.homeScore -> RoundFixture.home_goals
    away_goals: match.awayScore, // Match.awayScore -> RoundFixture.away_goals
    venue: match.venueName || undefined, // Match.venueName -> RoundFixture.venue
    league_id: String(match.leagueId), // Match.leagueId -> RoundFixture.league_id (string)
  }));
}

// TheSportsDBEvent type is now imported from mappers/thesportsdb-mappers.ts

/**
 * Fetch league events from pure TheSportsDB events table
 */
export async function fetchLeagueEvents(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<TheSportsDBEvent[]> {
  // Map internal league IDs to TheSportsDB league IDs (existing logic)
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);

  const { data, error } = await supabase
    .from("events_v2") // <-- 변경: events_v2 테이블 사용
    .select("*") // <-- 변경: 모든 컬럼을 선택 (Match 도메인 모델과 일치)
    .eq("leagueId", theSportsDBLeagueId) // <-- 변경: leagueId 컬럼 사용
    .eq("season", String(season)) // <-- 변경: season 컬럼 사용
    .order("date", { ascending: true }); // <-- 변경: date 컬럼 사용

  if (error) {
    console.error("Error fetching league events from events_v2:", error);
    return [];
  }

  if (!data) return [];

  // Match (events_v2) 데이터를 TheSportsDBEvent 타입으로 변환
  return data.map(match => ({
    idEvent: String(match.id), // Match.id -> TheSportsDBEvent.idEvent
    strEvent: `Match: ${match.homeTeamId} vs ${match.awayTeamId}`, // 더미 값, 실제 이벤트 이름은 sourceIds에서 추출 필요
    idLeague: String(match.leagueId),
    strSeason: String(match.season),
    intRound: String(match.round || 'N/A'),
    dateEvent: String(match.date).split('T')[0], // Match.date (ISO) -> TheSportsDBEvent.dateEvent (YYYY-MM-DD)
    strTime: String(match.date).split('T')[1]?.split('Z')[0] || '00:00:00', // Match.date (ISO) -> TheSportsDBEvent.strTime
    strStatus: String(match.status), // Match.status -> TheSportsDBEvent.strStatus
    idHomeTeam: String(match.homeTeamId),
    idAwayTeam: String(match.awayTeamId),
    intHomeScore: match.homeScore !== undefined && match.homeScore !== null ? String(match.homeScore) : undefined,
    intAwayScore: match.awayScore !== undefined && match.awayScore !== null ? String(match.awayScore) : undefined,
    strVenue: match.venueName || undefined,
    // 기타 TheSportsDBEvent 필드들은 현재 Match 모델에 없으므로 null 또는 기본값 처리
    // 예: strHomeTeam, strAwayTeam, strLeague, strBadge 등
    // 실제 사용 시 프론트엔드에서 필요한 필드에 대해 추가적인 룩업 또는 데이터 보강 필요
  }));
}

/**
 * Fetch upcoming fixtures from events table
 */
export async function fetchUpcomingEvents(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025), limit: number = 10): Promise<TheSportsDBEvent[]> {
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);
  const today = new Date().toISOString(); // Use ISOString for TIMESTAMPTZ comparison

  const { data, error } = await supabase
    .from("events_v2") // <-- 변경: events_v2 테이블 사용
    .select("*") // <-- 변경: 모든 컬럼을 선택 (Match 도메인 모델과 일치)
    .eq("leagueId", theSportsDBLeagueId) // <-- 변경: leagueId 컬럼 사용
    .eq("season", String(season)) // <-- 변경: season 컬럼 사용
    .gte("date", today) // <-- 변경: date 컬럼 사용
    .in("status", ["SCHEDULED", "UNKNOWN", "POSTPONED"]) // <-- 변경: Match 도메인 status 사용
    .order("date", { ascending: true }) // <-- 변경: date 컬럼 사용
    .limit(limit);

  if (error) {
    console.error("Error fetching upcoming events from events_v2:", error);
    return [];
  }

  if (!data) return [];

  // Match (events_v2) 데이터를 TheSportsDBEvent 타입으로 변환
  return data.map(match => ({
    idEvent: String(match.id),
    strEvent: `Match: ${match.homeTeamId} vs ${match.awayTeamId}`, // 더미 값, 실제 이벤트 이름은 sourceIds에서 추출 필요
    idLeague: String(match.leagueId),
    strSeason: String(match.season),
    intRound: String(match.round || 'N/A'),
    dateEvent: String(match.date).split('T')[0],
    strTime: String(match.date).split('T')[1]?.split('Z')[0] || '00:00:00',
    strStatus: String(match.status),
    idHomeTeam: String(match.homeTeamId),
    idAwayTeam: String(match.awayTeamId),
    intHomeScore: match.homeScore !== undefined && match.homeScore !== null ? String(match.homeScore) : undefined,
    intAwayScore: match.awayScore !== undefined && match.awayScore !== null ? String(match.awayScore) : undefined,
    strVenue: match.venueName || undefined,
  }));
}

/**
 * Fetch recent/completed fixtures from events table
 */
export async function fetchRecentEvents(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025), limit: number = 10): Promise<TheSportsDBEvent[]> {
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);
  const today = new Date().toISOString(); // Use ISOString for TIMESTAMPTZ comparison

  const { data, error } = await supabase
    .from("events_v2") // <-- 변경: events_v2 테이블 사용
    .select("*") // <-- 변경: 모든 컬럼을 선택 (Match 도메인 모델과 일치)
    .eq("leagueId", theSportsDBLeagueId) // <-- 변경: leagueId 컬럼 사용
    .eq("season", String(season)) // <-- 변경: season 컬럼 사용
    .lt("date", today) // <-- 변경: date 컬럼 사용
    .eq("status", "FINISHED") // <-- 변경: Match 도메인 status 사용
    .order("date", { ascending: false }) // <-- 변경: date 컬럼 사용
    .limit(limit);

  if (error) {
    console.error("Error fetching recent events from events_v2:", error);
    return [];
  }

  if (!data) return [];

  // Match (events_v2) 데이터를 TheSportsDBEvent 타입으로 변환
  return data.map(match => ({
    idEvent: String(match.id),
    strEvent: `Match: ${match.homeTeamId} vs ${match.awayTeamId}`, // 더미 값, 실제 이벤트 이름은 sourceIds에서 추출 필요
    idLeague: String(match.leagueId),
    strSeason: String(match.season),
    intRound: String(match.round || 'N/A'),
    dateEvent: String(match.date).split('T')[0],
    strTime: String(match.date).split('T')[1]?.split('Z')[0] || '00:00:00',
    strStatus: String(match.status),
    idHomeTeam: String(match.homeTeamId),
    idAwayTeam: String(match.awayTeamId),
    intHomeScore: match.homeScore !== undefined && match.homeScore !== null ? String(match.homeScore) : undefined,
    intAwayScore: match.awayScore !== undefined && match.awayScore !== null ? String(match.awayScore) : undefined,
    strVenue: match.venueName || undefined,
  }));
}

/**
 * Fetch events by round from events table
 */
export async function fetchEventsByRound(leagueId: number, round: string, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<TheSportsDBEvent[]> {
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);

  const { data, error } = await supabase
    .from("events_v2") // <-- 변경: events_v2 테이블 사용
    .select("*") // <-- 변경: 모든 컬럼을 선택 (Match 도메인 모델과 일치)
    .eq("leagueId", theSportsDBLeagueId) // <-- 변경: leagueId 컬럼 사용
    .eq("season", String(season)) // <-- 변경: season 컬럼 사용
    .eq("round", round) // <-- 변경: round 컬럼 사용
    .order("date", { ascending: true }); // <-- 변경: date 컬럼 사용

  if (error) {
    console.error("Error fetching events by round from events_v2:", error);
    return [];
  }

  if (!data) return [];

  // Match (events_v2) 데이터를 TheSportsDBEvent 타입으로 변환
  return data.map(match => ({
    idEvent: String(match.id),
    strEvent: `Match: ${match.homeTeamId} vs ${match.awayTeamId}`, // 더미 값, 실제 이벤트 이름은 sourceIds에서 추출 필요
    idLeague: String(match.leagueId),
    strSeason: String(match.season),
    intRound: String(match.round || 'N/A'),
    dateEvent: String(match.date).split('T')[0],
    strTime: String(match.date).split('T')[1]?.split('Z')[0] || '00:00:00',
    strStatus: String(match.status),
    idHomeTeam: String(match.homeTeamId),
    idAwayTeam: String(match.awayTeamId),
    intHomeScore: match.homeScore !== undefined && match.homeScore !== null ? String(match.homeScore) : undefined,
    intAwayScore: match.awayScore !== undefined && match.awayScore !== null ? String(match.awayScore) : undefined,
    strVenue: match.venueName || undefined,
  }));
}

/**
 * Fetch team events from events table
 */
export async function fetchTeamEvents(teamId: string, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025), limit: number = 10): Promise<TheSportsDBEvent[]> {
  const { data, error } = await supabase
    .from("events_v2") // <-- 변경: events_v2 테이블 사용
    .select("*") // <-- 변경: 모든 컬럼을 선택 (Match 도메인 모델과 일치)
    .eq("season", String(season)) // <-- 변경: season 컬럼 사용
    .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`) // <-- 변경: homeTeamId, awayTeamId 컬럼 사용, teamName -> teamId
    .order("date", { ascending: false }) // <-- 변경: date 컬럼 사용
    .limit(limit);

  if (error) {
    console.error("Error fetching team events from events_v2:", error);
    return [];
  }

  if (!data) return [];

  // Match (events_v2) 데이터를 TheSportsDBEvent 타입으로 변환
  return data.map(match => ({
    idEvent: String(match.id),
    strEvent: `Match: ${match.homeTeamId} vs ${match.awayTeamId}`,
    idLeague: String(match.leagueId),
    strSeason: String(match.season),
    intRound: String(match.round || 'N/A'),
    dateEvent: String(match.date).split('T')[0],
    strTime: String(match.date).split('T')[1]?.split('Z')[0] || '00:00:00',
    strStatus: String(match.status),
    idHomeTeam: String(match.homeTeamId),
    idAwayTeam: String(match.awayTeamId),
    intHomeScore: match.homeScore !== undefined && match.homeScore !== null ? String(match.homeScore) : undefined,
    intAwayScore: match.awayScore !== undefined && match.awayScore !== null ? String(match.awayScore) : undefined,
    strVenue: match.venueName || undefined,
  }));
}

// ========== NEW TEAM PAGE API FUNCTIONS (TheSportsDB Schema) ==========

import type { TeamFromDB, EventLiveData, FormResult } from "@/domain/types";

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
): Promise<Standing | null> {
  const { data, error } = await supabase
    .from('standings_v2') // <-- standings_v2 table
    .select('*') // <-- Selects columns matching Standing domain model
    .eq('leagueId', idLeague)
    .eq('season', season)
    .eq('teamName', teamName)
    .maybeSingle();

  if (error) {
    console.error('Error fetching team standings from standings_v2:', error);
    return null; 
  }

  if (!data) return null;

  // Map to Standing domain model
  return {
    leagueId: data.leagueId,
    teamId: data.teamId,
    season: data.season,
    rank: Number(data.rank || 0),
    teamName: data.teamName || "Unknown",
    teamBadgeUrl: data.teamBadgeUrl,
    gamesPlayed: Number(data.gamesPlayed || 0),
    wins: Number(data.wins || 0),
    draws: Number(data.draws || 0),
    losses: Number(data.losses || 0),
    points: Number(data.points || 0),
    goalsFor: Number(data.goalsFor || 0),
    goalsAgainst: Number(data.goalsAgainst || 0),
    goalDifference: Number(data.goalDifference || 0),
    form: data.form,
    description: data.description,
    lastUpdated: data.lastUpdated || new Date().toISOString(),
  };
}

/**
 * Fetch events for a specific team
 */
export async function fetchTeamEventsData(
  teamId: string, // <-- teamName 대신 teamId 사용
  season: string,
  limit?: number
): Promise<Match[]> { // <-- EventFromDB[] 대신 Match[] 반환
  let query = supabase
    .from('events_v2') // <-- 변경: events_v2 테이블 사용
    .select('*') // <-- Match 도메인 모델과 일치
    .eq('season', season) // <-- 변경: season 컬럼 사용
    .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`) // <-- 변경: homeTeamId, awayTeamId 컬럼 사용
    .order('date', { ascending: false }); // <-- 변경: date 컬럼 사용

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching team events from events_v2:', error);
    throw error;
  }

  return data || []; // 이미 Match[] 형태이므로 추가 매핑 불필요
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
  teamId: string, // <-- teamName 대신 teamId 사용
  season: string,
  limit: number = 5
): Promise<FormResult[]> {
  const events = await fetchTeamEventsData(teamId, season, limit);

  return events
    .filter(event => event.homeScore !== undefined && event.awayScore !== undefined && event.homeScore !== null && event.awayScore !== null) // <-- 변경: Match 모델의 필드명 사용
    .map(event => {
      const isHome = event.homeTeamId === teamId; // <-- 변경: homeTeamId로 비교
      const teamScore = isHome ? event.homeScore : event.awayScore; // <-- 변경: Match 모델의 필드명 사용
      const oppScore = isHome ? event.awayScore : event.homeScore; // <-- 변경: Match 모델의 필드명 사용

      if (teamScore! > oppScore!) return 'W';
      if (teamScore! < oppScore!) return 'L';
      return 'D';
    });
}

/**
 * Fetch upcoming events for a team
 */
export async function fetchTeamUpcomingEventsData(
  teamId: string, // <-- teamName 대신 teamId 사용
  season: string,
  limit: number = 5
): Promise<Match[]> { // <-- EventFromDB[] 대신 Match[] 반환
  const today = new Date().toISOString(); // Use ISOString for TIMESTAMPTZ comparison

  const { data, error } = await supabase
    .from('events_v2') // <-- 변경: events_v2 테이블 사용
    .select('*') // <-- Match 도메인 모델과 일치
    .eq('season', season) // <-- 변경: season 컬럼 사용
    .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`) // <-- 변경: homeTeamId, awayTeamId 컬럼 사용
    .gte('date', today) // <-- 변경: date 컬럼 사용
    .in('status', ["SCHEDULED", "UNKNOWN", "POSTPONED"]) // <-- 변경: Match 도메인 status 사용
    .order('date', { ascending: true }) // <-- 변경: date 컬럼 사용
    .limit(limit);

  if (error) {
    console.error('Error fetching team upcoming events from events_v2:', error);
    return [];
  }

  return data || []; // 이미 Match[] 형태이므로 추가 매핑 불필요
}

/**
 * Fetch recent completed events for a team
 */
export async function fetchTeamRecentEventsData(
  teamId: string, // <-- teamName 대신 teamId 사용
  season: string,
  limit: number = 5
): Promise<Match[]> { // <-- EventFromDB[] 대신 Match[] 반환
  const today = new Date().toISOString(); // Use ISOString for TIMESTAMPTZ comparison

  const { data, error } = await supabase
    .from('events_v2') // <-- 변경: events_v2 테이블 사용
    .select('*') // <-- Match 도메인 모델과 일치
    .eq('season', season) // <-- 변경: season 컬럼 사용
    .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`) // <-- 변경: homeTeamId, awayTeamId 컬럼 사용
    .lt('date', today) // <-- 변경: date 컬럼 사용
    .eq('status', "FINISHED") // <-- 변경: Match 도메인 status 사용 (점수 null 여부 대신)
    .order('date', { ascending: false }) // <-- 변경: date 컬럼 사용
    .limit(limit);

  if (error) {
    console.error('Error fetching team recent events from events_v2:', error);
    return [];
  }

  return data || []; // 이미 Match[] 형태이므로 추가 매핑 불필요
}

/**
 * Team Player Information Interface
 * Matches actual database schema: idPlayer, strPlayer, strTeam, idTeam, strPosition, strNumber
 */
export interface TeamPlayer {
  idPlayer: string;
  strPlayer: string; // Player name
  strTeam: string; // Team name
  idTeam: string; // Team ID
  strPosition: string | null; // Position
  strNumber: string | null; // Jersey number
  // Stats from player_statistics
  goals?: number;
  assists?: number;
  appearances?: number;
  yellow_cards?: number;
  red_cards?: number;
}

/**
 * Fetch team players (squad/roster) from database
 * @param idTeam - Team ID (TheSportsDB format)
 * @returns Array of team players
 */
export async function fetchTeamPlayers(idTeam: string): Promise<TeamPlayer[]> {
  const { data, error} = await supabase
    .from('players')
    .select('idPlayer, strPlayer, strTeam, idTeam, strPosition, strNumber')
    .eq('idTeam', idTeam)
    .order('strNumber', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Error fetching team players:', error);
    return [];
  }

  return data || [];
}

/**
 * Player Statistics Interfaces
 */
export interface PlayerStatistics {
  idPlayer: string;
  strPlayer: string;
  idTeam: string;
  strTeam: string;
  idLeague: string;
  strSeason: string;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  appearances: number;
  own_goals: number;
  penalties_scored: number;
  goals_per_game?: number;
  assists_per_game?: number;
}

/**
 * Fetch top scorers for a league from player_statistics
 * @param idLeague - League ID (TheSportsDB format string like '4689')
 * @param season - Season year (e.g., '2025')
 * @param limit - Maximum number of results
 * @returns Array of top scorers with statistics
 */
export async function fetchTopScorersStats(
  idLeague: string,
  season: string,
  limit: number = 10
): Promise<PlayerStatistics[]> {
  const { data, error } = await supabase
    .from('top_scorers')
    .select('*')
    .eq('idLeague', idLeague)
    .eq('strSeason', season)
    .limit(limit);

  if (error) {
    console.error('Error fetching top scorers:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch top assisters for a league from player_statistics
 * @param idLeague - League ID (TheSportsDB format string like '4689')
 * @param season - Season year (e.g., '2025')
 * @param limit - Maximum number of results
 * @returns Array of top assisters with statistics
 */
export async function fetchTopAssistersStats(
  idLeague: string,
  season: string,
  limit: number = 10
): Promise<PlayerStatistics[]> {
  const { data, error } = await supabase
    .from('top_assisters')
    .select('*')
    .eq('idLeague', idLeague)
    .eq('strSeason', season)
    .limit(limit);

  if (error) {
    console.error('Error fetching top assisters:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch all player statistics for a league
 * @param idLeague - League ID (TheSportsDB format)
 * @param season - Season year (e.g., '2025')
 * @returns Array of player statistics
 */
export async function fetchPlayerStatistics(
  idLeague: string,
  season: string
): Promise<PlayerStatistics[]> {
  const { data, error } = await supabase
    .from('player_statistics')
    .select('*')
    .eq('idLeague', idLeague)
    .eq('strSeason', season)
    .order('goals', { ascending: false });

  if (error) {
    console.error('Error fetching player statistics:', error);
    return [];
  }

  return data || [];
}
