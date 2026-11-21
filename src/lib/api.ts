// src/lib/api.ts
// FIXED VERSION: Updated to match actual database schema and v2 tables
import { supabase } from "@/lib/supabaseClient";
import type { SearchRow, TeamFromDB, FormResult } from "@/domain/types";
import type { Match, Standing } from "@/types/domain"; 
import type { MatchWithTeams } from "@/lib/thesportsdb-api";
import { findTeamIdsByAlias } from "@/lib/team-aliases";
import { LEAGUE_SLUGS, leagueIdsByKoreanName, leagueNameKo, leagueSlugFor, supportedLeagueIds } from "@/lib/leagues";
import { POSITION_GROUPS, STAFF_POSITIONS, type PositionGroup } from "@/lib/positions";
import { statusesOf, type MatchPhase } from "@/lib/match-status";
import { kstDate, kstDayRange } from "@/lib/dates";

const DEFAULT_SEASON = String(import.meta.env.VITE_SEASON_YEAR || new Date().getFullYear());

export function normalizeSeason(season: string): string {
  // Normalize '2025-2026' to '2025' to match DB format
  if (season && season.includes('-')) {
    return season.split('-')[0];
  }
  return season;
}

// Internal numeric league IDs (used across the app/router) map to TheSportsDB's
// string league IDs, which is what every events_v2/standings_v2 query filters on.
function toTheSportsDBLeagueId(leagueId: number): string {
  if (leagueId === 249276) return '4689';
  if (leagueId === 250127) return '4822';
  return String(leagueId);
}

// ---------- 공통 fetch 유틸 ----------
export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

// ---------- 도메인 라이트 타입 ----------
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
  current_season?: string; // Added field for dynamic season display
};
export type TeamLite = { id: number; name: string; name_korean?: string | null; short_name: string | null; crest_url: string | null; logo_url?: string | null; badge_url?: string | null; banner_url?: string | null; primary_source?: string; };

// ---------- API ----------
export async function fetchLeagues(): Promise<LeagueLite[]> {
  const { data, error } = await supabase
    .from("leagues")
    .select("idLeague, strLeague, strCountry, strBadge, strCurrentSeason") // Added strCurrentSeason
    .order("strLeague", { ascending: true });
    
  if (error) throw error;
  
  return (data ?? []).map((x) => ({
    id: x.idLeague === '4689' ? 249276 : x.idLeague === '4822' ? 250127 : parseInt(x.idLeague) || 0,
    slug: x.idLeague === '4689' ? 'k-league-1' : 
          x.idLeague === '4822' ? 'k-league-2' : 
          x.idLeague === '4328' ? 'premier-league' : 
          x.idLeague === '4335' ? 'la-liga' : 
          x.idLeague === '4332' ? 'serie-a' : 
          x.idLeague === '4331' ? 'bundesliga' : 
          x.idLeague === '4334' ? 'ligue-1' : 
          `league-${x.idLeague}`,
    name: String(x.strLeague), 
    name_korean: leagueNameKo(leagueSlugFor(String(x.idLeague))), 
    tier: null, 
    logo_url: x.strBadge, 
    banner_url: null, 
    country_code: x.strCountry, 
    primary_source: "thesportsdb",
    // Postgres NULL comes through as `null`, not `undefined`; coerce so callers relying
    // on a `= DEFAULT_SEASON` default parameter (which only triggers on `undefined`) work.
    current_season: x.strCurrentSeason ?? undefined
  }));
}

export type LeagueDetail = { id: number; name: string; name_korean?: string | null; logo_url?: string | null; banner_url?: string | null; slug: string; country: string | null; primary_source?: string; tier?: number | null; season: string; current_season?: string; };
// teams_v2.id 는 텍스트('hist_…' 포함)라 문자열로 둔다. 기록 값이 null 이면 수집되지 않은 값(과거 우승팀 행 등)
export type TeamStanding = { team_id: string; team_name: string; short_name: string | null; crest_url: string | null; rank: number; points: number | null; played: number | null; win: number | null; draw: number | null; lose: number | null; goals_for: number | null; goals_against: number | null; goals_diff: number | null; form: string | null; };

// DB 의 NULL(수집 안 됨)은 0 으로 바꾸지 않고 null 로 둔다
function toCount(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

// 리그 slug·한글 이름은 src/lib/leagues.ts. 기존 호출부를 위해 다시 내보낸다
export { leagueSlugFor } from "@/lib/leagues";

export async function fetchLeagueBySlug(slug: string): Promise<LeagueDetail | null> {
  const theSportsDBLeagueId = Object.keys(LEAGUE_SLUGS).find(id => LEAGUE_SLUGS[id] === slug) ?? slug.replace('league-', '');
  
  const { data, error } = await supabase.from("leagues").select("idLeague, strLeague, strCountry, strBadge, strCurrentSeason").eq("idLeague", theSportsDBLeagueId).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.idLeague === '4689' ? 249276 : data.idLeague === '4822' ? 250127 : parseInt(data.idLeague) || 0,
    name: String(data.strLeague), name_korean: leagueNameKo(leagueSlugFor(String(data.idLeague))), logo_url: data.strBadge, banner_url: null, slug: leagueSlugFor(String(data.idLeague)), country: data.strCountry as string | null, primary_source: "thesportsdb", tier: null, season: DEFAULT_SEASON, current_season: data.strCurrentSeason ?? undefined
  };
}

// TheSportsDB's strForm field is sourced from their own standings snapshot and is
// sometimes empty for lower-tier leagues (confirmed empty for K League 2's current
// season while K League 1 is populated) even though we have fresher, complete match
// results in events_v2. Derive a fallback "recent 5" form from real results for any
// team whose standings_v2.form came back empty, without touching teams that already
// have real data from TheSportsDB.
async function computeFormFallback(theSportsDBLeagueId: string, season: string, teamIds: string[]): Promise<Map<string, string>> {
  const formMap = new Map<string, string>();
  if (teamIds.length === 0) return formMap;

  // Form is supplementary display data — a network-level failure here (as opposed to a
  // Supabase-reported query error, already handled below) must not take down the whole
  // standings fetch for every league, including ones that didn't need this fallback.
  try {
    const { data, error } = await supabase
      .from("events_v2")
      .select("homeTeamId, awayTeamId, homeScore, awayScore, date")
      .eq("leagueId", theSportsDBLeagueId)
      .eq("season", season)
      .in("status", ["FINISHED", "FT", "AET", "PEN"])
      .not("homeScore", "is", null)
      .not("awayScore", "is", null)
      .order("date", { ascending: false });
    if (error || !data) return formMap;

    const idSet = new Set(teamIds);
    const results = new Map<string, FormResult[]>();

    for (const match of data) {
      const homeId = String(match.homeTeamId);
      const awayId = String(match.awayTeamId);
      const homeScore = Number(match.homeScore);
      const awayScore = Number(match.awayScore);
      if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) continue;

      if (idSet.has(homeId)) {
        const list = results.get(homeId) ?? [];
        if (list.length < 5) list.push(homeScore > awayScore ? 'W' : homeScore < awayScore ? 'L' : 'D');
        results.set(homeId, list);
      }
      if (idSet.has(awayId)) {
        const list = results.get(awayId) ?? [];
        if (list.length < 5) list.push(awayScore > homeScore ? 'W' : awayScore < homeScore ? 'L' : 'D');
        results.set(awayId, list);
      }
    }

    for (const [teamId, list] of results) {
      if (list.length > 0) formMap.set(teamId, list.join(''));
    }
  } catch (err) {
    console.error("Error computing form fallback from events_v2:", err);
  }
  return formMap;
}

export async function fetchLeagueStandings(leagueSlug: string, season: string = DEFAULT_SEASON): Promise<TeamStanding[]> {
  let theSportsDBLeagueId: string;
  if (leagueSlug === 'k-league-1') theSportsDBLeagueId = '4689';
  else if (leagueSlug === 'k-league-2') theSportsDBLeagueId = '4822';
  else if (leagueSlug === 'premier-league') theSportsDBLeagueId = '4328';
  else if (leagueSlug === 'la-liga') theSportsDBLeagueId = '4335';
  else if (leagueSlug === 'serie-a') theSportsDBLeagueId = '4332';
  else if (leagueSlug === 'bundesliga') theSportsDBLeagueId = '4331';
  else if (leagueSlug === 'ligue-1') theSportsDBLeagueId = '4334';
  else theSportsDBLeagueId = leagueSlug.replace('league-', '');

  const normalized = normalizeSeason(season);
  const { data, error } = await supabase.from("standings_v2").select(`*`).eq("leagueId", theSportsDBLeagueId).eq("season", normalized).order("rank", { ascending: true });
  if (error) throw error;

  const rows = data ?? [];
  const teamIdsMissingForm = rows.filter((standing) => !standing.form).map((standing) => String(standing.teamId));
  const fallbackForm = await computeFormFallback(theSportsDBLeagueId, normalized, teamIdsMissingForm);

  return rows.map((standing) => ({
    team_id: String(standing.teamId ?? ''), team_name: String(standing.teamName || "Unknown"), short_name: null, crest_url: standing.teamBadgeUrl, rank: Number(standing.rank || 0), points: toCount(standing.points), played: toCount(standing.gamesPlayed), win: toCount(standing.wins), draw: toCount(standing.draws), lose: toCount(standing.losses), goals_for: toCount(standing.goalsFor), goals_against: toCount(standing.goalsAgainst), goals_diff: toCount(standing.goalDifference), form: standing.form || fallbackForm.get(String(standing.teamId)) || null,
  }));
}

export async function fetchLeagueTeams(leagueId: number, season: string = DEFAULT_SEASON): Promise<TeamLite[]> {
  const theSportsDBLeagueId = toTheSportsDBLeagueId(leagueId);
  const normalized = normalizeSeason(season);
  const { data, error } = await supabase.from("standings_v2").select(`teamId, teamName, teamBadgeUrl`).eq("leagueId", theSportsDBLeagueId).eq("season", normalized);
  if (error) throw error;
  return (data ?? []).map((item) => ({ id: Number(item.teamId || 0), name: String(item.teamName || "Unknown"), short_name: null, crest_url: item.teamBadgeUrl, logo_url: item.teamBadgeUrl, badge_url: item.teamBadgeUrl, banner_url: null, primary_source: "thesportsdb", }));
}

export type LeagueStats = { total_goals: number; total_matches: number; avg_goals_per_match: number; total_teams: number; };

export async function fetchLeagueStats(leagueId: number, season: string = DEFAULT_SEASON): Promise<LeagueStats> {
  const theSportsDBLeagueId = toTheSportsDBLeagueId(leagueId);
  const normalized = normalizeSeason(season);
  const [standingsResult, fixturesResult] = await Promise.all([
    supabase.from("standings_v2").select("leagueId, goalsFor, goalsAgainst, gamesPlayed").eq("leagueId", theSportsDBLeagueId).eq("season", normalized),
    supabase.from("events_v2").select("homeScore, awayScore").eq("leagueId", theSportsDBLeagueId).eq("season", normalized).eq("status", "FINISHED")
  ]);
  const totalTeams = standingsResult.data?.length || 0;
  const completedMatches = fixturesResult.data || [];
  const totalMatches = completedMatches.length;
  const totalGoalsFromStandings = standingsResult.data?.reduce((sum, team) => sum + (team.goalsFor || 0), 0) || 0;
  const totalGoals = totalMatches > 0 ? completedMatches.reduce((sum, match) => sum + (match.homeScore || 0) + (match.awayScore || 0), 0) : totalGoalsFromStandings;
  const avgMatchesPerTeam = standingsResult.data && standingsResult.data.length > 0 ? standingsResult.data.reduce((sum, team) => sum + (team.gamesPlayed || 0), 0) / standingsResult.data.length : 0;
  return { total_goals: totalGoals, total_matches: totalMatches > 0 ? totalMatches : Math.round(avgMatchesPerTeam * totalTeams / 2), avg_goals_per_match: totalMatches > 0 ? Number((totalGoals / totalMatches).toFixed(2)) : avgMatchesPerTeam > 0 ? Number((totalGoals / (avgMatchesPerTeam * totalTeams / 2)).toFixed(2)) : 0, total_teams: totalTeams };
}

// 순위 기준 값(득점·도움)은 뷰가 0 보다 큰 행만 주므로 항상 숫자, 나머지 값은 수집되지 않으면 null
export type TopScorer = { player_name: string; team_id: string; team_name: string; goals: number; assists: number | null; matches: number | null; };
export type TopAssist = { player_name: string; team_id: string; team_name: string; assists: number; goals: number | null; matches: number | null; };
export type HistoricalChampion = { season_year: number; champion_team_id: string; champion_name: string; champion_logo: string | null; };

export async function fetchTopScorers(leagueId: number, season: string = DEFAULT_SEASON, limit: number = 10): Promise<TopScorer[]> {
  const theSportsDBLeagueId = toTheSportsDBLeagueId(leagueId);
  const normalized = normalizeSeason(season);
  const stats = await fetchTopScorersStats(theSportsDBLeagueId, normalized, limit);
  return stats.map(stat => ({ player_name: stat.strPlayer, team_id: String(stat.idTeam ?? ''), team_name: stat.strTeam || '', goals: stat.goals ?? 0, assists: stat.assists ?? null, matches: stat.appearances ?? null }));
}

export async function fetchTopAssists(leagueId: number, season: string = DEFAULT_SEASON, limit: number = 10): Promise<TopAssist[]> {
  const theSportsDBLeagueId = toTheSportsDBLeagueId(leagueId);
  const normalized = normalizeSeason(season);
  const stats = await fetchTopAssistersStats(theSportsDBLeagueId, normalized, limit);
  return stats.map(stat => ({ player_name: stat.strPlayer, team_id: String(stat.idTeam ?? ''), team_name: stat.strTeam || '', assists: stat.assists ?? 0, goals: stat.goals ?? null, matches: stat.appearances ?? null }));
}

export async function fetchHistoricalChampions(leagueId: number, currentSeason?: string): Promise<HistoricalChampion[]> {
  const theSportsDBLeagueId = toTheSportsDBLeagueId(leagueId);
  // Split-format leagues (EPL, La Liga, etc.) store season as the split's start year,
  // e.g. "2025" for the 2025-2026 season, which stays the active season through June of
  // the following calendar year. Using new Date().getFullYear() as the "current" cutoff
  // would fail to exclude that still-active season from Jan-Jun. Prefer the league's own
  // current_season (already resolved by fetchLeagueBySlug/getCurrentSeasonForFormat) and
  // only fall back to the calendar year when it isn't available yet.
  const excludeFrom = currentSeason || String(new Date().getFullYear());
  const { data: standingsData, error: standingsError } = await supabase.from("standings_v2").select("season, teamId, teamName").eq("leagueId", theSportsDBLeagueId).eq("rank", 1).lt("season", excludeFrom).order("season", { ascending: false }).limit(15);
  if (standingsError) { console.warn("Failed to fetch historical champions standings:", standingsError); return []; }
  if (!standingsData || standingsData.length === 0) return [];
  return standingsData.map((standing) => ({ season_year: Number(standing.season || 0), champion_team_id: String(standing.teamId ?? ''), champion_name: String(standing.teamName || "Unknown"), champion_logo: null }));
}

export interface UpcomingFixture { id: string; date_utc: string; status: string; round: string; home_team: { id: string; name: string; logo_url: string | null; }; away_team: { id: string; name: string; logo_url: string | null; }; venue?: string; league_id: string; }

export async function fetchUpcomingFixtures(leagueId?: number, limit: number = 10): Promise<UpcomingFixture[]> {
  const today = new Date().toISOString(); 
  let query = supabase.from("events_v2").select(`*`).gte("date", today).in("status", ["SCHEDULED", "UNKNOWN", "POSTPONED"]).order("date", { ascending: true }).limit(limit);
  if (leagueId) {
    const dbId = toTheSportsDBLeagueId(leagueId);
    query = query.eq("leagueId", dbId);
  }
  const { data, error } = await query;
  if (error) { console.error("Error fetching upcoming fixtures from events_v2:", error); return []; }
  if (!data) return [];
  return data.map(match => ({
    id: String(match.id), date_utc: String(match.date), status: String(match.status), round: String(match.round || 'N/A'),
    home_team: { id: String(match.homeTeamId), name: `Team ${match.homeTeamId}`, logo_url: null },
    away_team: { id: String(match.awayTeamId), name: `Team ${match.awayTeamId}`, logo_url: null },
    venue: match.venueName || undefined, league_id: String(match.leagueId),
  }));
}

export interface RoundFixture { id: string; date_utc: string; status_short: string; round: string; home_team: { id: string; name: string; logo_url: string | null; }; away_team: { id: string; name: string; logo_url: string | null; }; home_goals: number | null; away_goals: number | null; venue?: string; league_id: string; }

export async function getLatestCompletedRound(leagueId: number, season: string = DEFAULT_SEASON): Promise<string | null> {
  const theSportsDBLeagueId = toTheSportsDBLeagueId(leagueId);
  const normalized = normalizeSeason(season);
  const { data, error } = await supabase.from("events_v2").select("round, date").eq("leagueId", theSportsDBLeagueId).eq("season", normalized).in("status", ["FINISHED", "FT", "AET", "PEN"]).order("date", { ascending: false }).limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0].round || null;
}

export async function getNextUpcomingRound(leagueId: number, season: string = DEFAULT_SEASON): Promise<string | null> {
  const theSportsDBLeagueId = toTheSportsDBLeagueId(leagueId);
  const normalized = normalizeSeason(season);
  const { data, error } = await supabase.from("events_v2").select("round, date").eq("leagueId", theSportsDBLeagueId).eq("season", normalized).in("status", ["SCHEDULED", "UNKNOWN", "POSTPONED", "NS"]).order("date", { ascending: true }).limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0].round || null;
}

export async function getCurrentLiveRound(leagueId: number, season: string = DEFAULT_SEASON): Promise<string | null> {
  const theSportsDBLeagueId = toTheSportsDBLeagueId(leagueId);
  const normalized = normalizeSeason(season);
  const { data, error } = await supabase.from("events_v2").select("round, date").eq("leagueId", theSportsDBLeagueId).eq("season", normalized).in("status", ['IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT']).order("date", { ascending: true }).limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0].round || null;
}

export async function fetchFixturesByRound(leagueId: number, round: string, season: string = DEFAULT_SEASON): Promise<MatchWithTeams[]> {
  const theSportsDBLeagueId = toTheSportsDBLeagueId(leagueId);
  const normalized = normalizeSeason(season);
  const { data, error } = await supabase.from("events_v2").select(`
    *,
    homeTeam:teams_v2!homeTeamId(id, name, badgeUrl),
    awayTeam:teams_v2!awayTeamId(id, name, badgeUrl)
  `).eq("leagueId", theSportsDBLeagueId).eq("round", round).eq("season", normalized).order("date", { ascending: true });
  if (error) { console.error("Error fetching fixtures by round from events_v2:", error); return []; }
  if (!data) return [];
  return data as MatchWithTeams[];
}

export async function getAllRounds(leagueId: number, season: string = DEFAULT_SEASON): Promise<string[]> {
  const theSportsDBLeagueId = toTheSportsDBLeagueId(leagueId);
  const normalized = normalizeSeason(season);
  const { data, error } = await supabase
    .from("events_v2")
    .select("round")
    .eq("leagueId", theSportsDBLeagueId)
    .eq("season", normalized)
    .neq("round", "0") // Exclude round '0'
    .order("round", { ascending: true });

  if (error) {
    console.error("Error fetching all rounds:", error);
    return [];
  }

  // Extract unique rounds and sort them numerically if possible, otherwise alphabetically
  const uniqueRounds = Array.from(new Set(data?.map(item => item.round))).filter((r): r is string => r !== null);
  
  // Attempt to sort numerically, fallback to string sort
  return uniqueRounds.sort((a, b) => {
    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });
}

export async function fetchRecentRoundFixtures(leagueId: number, season: string = DEFAULT_SEASON): Promise<MatchWithTeams[]> {
  const latestRound = await getLatestCompletedRound(leagueId, season);
  if (!latestRound) return [];
  return fetchFixturesByRound(leagueId, latestRound, season);
}

export async function fetchUpcomingRoundFixtures(leagueId: number, season: string = DEFAULT_SEASON): Promise<MatchWithTeams[]> {
  const nextRound = await getNextUpcomingRound(leagueId, season);
  if (!nextRound) return [];
  return fetchFixturesByRound(leagueId, nextRound, season);
}

/** 팀 ID → 한글 이름 (nameKorean 이 있는 팀만). 화면 표시용으로 한 번 불러와 캐시한다. */
export async function fetchTeamKoreanNames(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('teams_v2').select('id, nameKorean').not('nameKorean', 'is', null);
  // 오류를 빈 결과로 바꾸면 staleTime: Infinity 캐시에 남아 다시 시도하지 않으므로 그대로 던진다
  if (error) throw error;
  return Object.fromEntries((data ?? []).map(row => [String(row.id), String(row.nameKorean)]));
}

export async function searchByName(q: string): Promise<SearchRow[]> {
  // LIKE 와일드카드(% _ *)와 따옴표·백슬래시는 공백으로 바꾼다. 나머지(. : , 괄호)는 값 전체를 따옴표로 감싸 그대로 찾는다
  const qq = q.trim().replace(/[%_*"\\]/g, ' ').trim();
  if (!qq) return [];
  const pattern = `%${qq}%`;
  const quoted = (value: string) => `"${value}"`;
  // 화면의 팀 데이터(teams_v2)에서 영문·한글 이름으로 찾는다.
  // 한글 이름은 띄어쓰기를 무시하고('전북현대' → '전북 현대 모터스'), 줄임말('맨유')은 별칭 목록으로 찾는다
  const teamFilters = [`name.ilike.${quoted(pattern)}`, `nameKorean.ilike.${quoted(pattern)}`];
  const letters = Array.from(qq).filter(ch => /[\p{L}\p{N}]/u.test(ch));
  // 팀 이름보다 긴 입력은 정규식·요청 주소만 키우므로 건너뛴다
  if (letters.length > 1 && letters.length <= 30) teamFilters.push(`nameKorean.imatch."${letters.join(' *')}"`);
  const aliasIds = findTeamIdsByAlias(qq);
  if (aliasIds.length > 0) teamFilters.push(`id.in.(${aliasIds.map(quoted).join(',')})`);
  // 리그는 영문 이름과 한글 이름('프리미어리그') 모두로 찾는다
  const leagueFilters = [`strLeague.ilike.${quoted(pattern)}`];
  const koreanLeagueIds = leagueIdsByKoreanName(qq);
  if (koreanLeagueIds.length > 0) leagueFilters.push(`idLeague.in.(${koreanLeagueIds.map(quoted).join(',')})`);
  // 포함 검색은 순서 없이 30건만 오므로, 이름이 정확히 같은 팀·선수는 따로 받아 앞에 둔다 (src/lib/search.ts 가 정렬)
  // 선수는 /players 목록과 같이 이전 명단에만 있는 행을 뺀 players_v2_current(migration 24)에서 찾는다
  const [leagues, teams, players, exactTeams, exactPlayers] = await Promise.all([
    supabase.from("leagues").select("idLeague, strLeague, strCountry, highlightly_id").or(leagueFilters.join(',')).limit(30),
    supabase.from("teams_v2").select("id, name, nameKorean, badgeUrl").or(teamFilters.join(',')).limit(30),
    supabase.from("players_v2_current").select("idPlayer, strPlayer, idTeam, strTeam, strThumb, strNationality, dateBorn").ilike("strPlayer", pattern).limit(30),
    supabase.from("teams_v2").select("id, name, nameKorean, badgeUrl").or(`name.ilike.${quoted(qq)},nameKorean.ilike.${quoted(qq)}`).limit(10),
    supabase.from("players_v2_current").select("idPlayer, strPlayer, idTeam, strTeam, strThumb, strNationality, dateBorn").ilike("strPlayer", qq).limit(10),
  ]);
  // 조회 오류를 '결과 없음'으로 보이지 않게 던진다
  const failed = [leagues, teams, players, exactTeams, exactPlayers].find(result => result.error);
  if (failed?.error) throw failed.error;

  const uniqueBy = <T,>(items: T[], key: (item: T) => string) => [...new Map(items.map(item => [key(item), item])).values()];
  const rows: SearchRow[] = [];
  for (const x of leagues.data ?? []) {
    const slug = leagueSlugFor(String(x.idLeague));
    const nameKo = leagueNameKo(slug);
    rows.push({ type: "league", entity_id: x.highlightly_id || parseInt(x.idLeague.replace(/[^0-9]/g, '')) || 0, name: nameKo ?? String(x.strLeague), name_en: nameKo ? String(x.strLeague) : null, slug, country: x.strCountry ?? null } as SearchRow);
  }
  for (const t of uniqueBy([...(exactTeams.data ?? []), ...(teams.data ?? [])], t => String(t.id))) {
    // teams_v2.id 는 텍스트라 'hist_…' 같은 ID 도 있으므로 주소에는 원래 문자열을 쓴다
    rows.push({ type: "team", entity_id: parseInt(String(t.id)) || 0, team_id: String(t.id), name: String(t.nameKorean || t.name), name_en: t.nameKorean ? String(t.name) : null, short_name: null, crest_url: (t.badgeUrl ?? null) as string | null } as SearchRow);
  }
  for (const p of uniqueBy([...(exactPlayers.data ?? []), ...(players.data ?? [])], p => String(p.idPlayer))) {
    const playerId = parseInt(p.idPlayer.replace(/[^0-9]/g, '')) || 0;
    rows.push({
      type: "player",
      entity_id: playerId,
      name: String(p.strPlayer),
      team_id: p.idTeam ? String(p.idTeam) : undefined,
      team_name: p.strTeam,
      crest_url: p.strThumb,
      nationality: p.strNationality ?? null,
      birth_date: p.dateBorn ?? null,
    } as SearchRow);
  }
  return rows;
}

export interface TeamPlayer {
  idPlayer: string; strPlayer: string; strTeam: string; idTeam: string; strPosition: string | null; strNumber: string | null;
  strNationality: string | null; dateBorn: string | null;
  /** players_v2 행을 마지막으로 수집한 시각 (선수단 기준일) */
  updatedAt: string | null;
  goals: number | null; assists: number | null; appearances: number | null; yellow_cards: number | null; red_cards: number | null;
}

const KLEAGUE_LEAGUE_IDS = ['4689', '4822'];

/** kleague_player_links 에서 column 값이 ids 에 있는 연결을 읽는다. 연결은 부가 정보라 읽지 못하면 연결 없이 진행한다 */
async function fetchKLeagueLinks(column: 'kleaguePlayerId' | 'idPlayer', ids: string[]): Promise<{ kleaguePlayerId: string; idPlayer: string }[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('kleague_player_links').select('kleaguePlayerId, idPlayer').in(column, ids);
  if (error) { console.warn('Error fetching K League player links:', error); return []; }
  return (data ?? []).map(l => ({ kleaguePlayerId: String(l.kleaguePlayerId), idPlayer: String(l.idPlayer) }));
}

export async function fetchPlayersByTeam(teamId: string, season: string = DEFAULT_SEASON): Promise<TeamPlayer[]> {
  const { data: playersData, error: playersError } = await supabase.from('players_v2').select('idPlayer, strPlayer, strTeam, idTeam, strPosition, strNumber, strNationality, dateBorn, updated_at').eq('idTeam', teamId).order('strNumber', { ascending: true, nullsFirst: false });
  if (playersError) { console.error('Error fetching players:', playersError); return []; }
  if (!playersData || playersData.length === 0) return [];
  const normalized = normalizeSeason(season);
  const { data: statsData, error: statsError } = await supabase.from('player_statistics').select('idPlayer, idLeague, goals, assists, appearances, yellow_cards, red_cards').eq('idTeam', teamId).eq('strSeason', normalized);
  if (statsError) { console.warn('Error fetching player statistics:', statsError); }
  // K리그 기록은 kleague.com 선수 ID 라 연결(migration 22)을 거쳐서만 명단 선수에 붙인다. 다른 리그는 TheSportsDB ID 그대로
  const isKLeagueRow = (stat: { idLeague?: unknown }) => KLEAGUE_LEAGUE_IDS.includes(String(stat.idLeague));
  const links = await fetchKLeagueLinks('kleaguePlayerId', [...new Set((statsData ?? []).filter(isKLeagueRow).map(s => String(s.idPlayer)))]);
  const linked = new Map(links.map(l => [l.kleaguePlayerId, l.idPlayer]));
  const playerStatsMap = new Map<string, Partial<PlayerStatistics>>();
  for (const stat of statsData ?? []) {
    const id = isKLeagueRow(stat) ? linked.get(String(stat.idPlayer)) : String(stat.idPlayer);
    if (id) playerStatsMap.set(id, stat);
  }
  return playersData.map(({ updated_at, ...player }) => {
    // K리그는 득점·도움 상위 선수만 기록이 있어, 기록 행이 없는 선수는 0 이 아니라 null(미제공)
    const stats = playerStatsMap.get(player.idPlayer) || {};
    return {
      ...player, strNationality: player.strNationality ?? null, dateBorn: player.dateBorn ?? null, updatedAt: updated_at ?? null,
      goals: stats.goals ?? null, assists: stats.assists ?? null, appearances: stats.appearances ?? null, yellow_cards: stats.yellow_cards ?? null, red_cards: stats.red_cards ?? null,
    };
  });
}

/**
 * player_statistics 한 행 = 한 리그·한 시즌 기록 (고유키 idPlayer·idLeague·strSeason).
 * 다른 리그로 옮기면 행이 나뉘지만, 같은 리그 안에서 시즌 중 이적하면 한 행으로 합쳐지고 팀은 마지막으로 기록이 잡힌 소속이다.
 * 항목별 null 은 수집하지 않는 값
 */
export type PlayerSeasonStats = {
  season: string; leagueId: string; teamId: string; teamName: string;
  appearances: number | null; minutesPlayed: number | null; goals: number | null; assists: number | null;
  yellowCards: number | null; redCards: number | null; penaltiesScored: number | null; penaltiesMissed: number | null; ownGoals: number | null;
};

export type PlayerDetail = {
  id: string; name: string; teamName: string | null; teamId: string | null; position: string | null; jerseyNumber: string | null; photoUrl: string | null;
  // 수집되지 않은 프로필 항목은 null (화면에서 '미제공')
  nationality: string | null; height: string | null; weight: string | null; birthDate: string | null;
  /** 최근 시즌부터. 같은 시즌 안에서는 현재 소속팀 기록이 먼저 */
  seasons: PlayerSeasonStats[];
  /** 현재 소속팀이 순위표에 있는 가장 최근 리그 (기록이 없을 때 기록 범위 안내용) */
  teamLeagueId: string | null;
};

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

// 갱신 시각을 숫자로 (없거나 잘못된 값은 맨 뒤)
function updatedTime(value: unknown): number {
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? -Infinity : time;
}

export async function fetchPlayerDetail(playerId: number): Promise<PlayerDetail | null> {
  const { data: player, error } = await supabase.from('players_v2').select('*').eq('idPlayer', String(playerId)).maybeSingle();
  if (error || !player) { console.error("Player not found:", error); return null; }
  // K리그 기록은 연결된 kleague.com 선수 ID 로만 읽고(migration 22), 다른 리그 기록은 TheSportsDB ID 로 읽는다
  const leagueList = `(${KLEAGUE_LEAGUE_IDS.join(',')})`;
  const [ownStats, links] = await Promise.all([
    supabase.from('player_statistics').select('*').eq('idPlayer', String(playerId)).not('idLeague', 'in', leagueList),
    fetchKLeagueLinks('idPlayer', [String(playerId)]),
  ]);
  const kleagueStats = links.length > 0
    ? await supabase.from('player_statistics').select('*').in('idPlayer', links.map(l => l.kleaguePlayerId)).in('idLeague', KLEAGUE_LEAGUE_IDS)
    : { data: [], error: null };
  for (const { error: statsError } of [ownStats, kleagueStats]) if (statsError) console.warn('Error fetching player statistics:', statsError);
  // 시즌 내림차순, 같은 시즌이면 현재 소속팀 먼저, 그다음 최근 갱신순
  const statRows = [...(ownStats.data ?? []), ...(kleagueStats.data ?? [])]
    .sort((a, b) => updatedTime(b.last_updated) - updatedTime(a.last_updated));
  const seasons = statRows
    .map((row): PlayerSeasonStats => ({
      season: String(row.strSeason), leagueId: String(row.idLeague ?? ''), teamId: String(row.idTeam ?? ''), teamName: String(row.strTeam ?? ''),
      appearances: toCount(row.appearances), minutesPlayed: toCount(row.minutes_played), goals: toCount(row.goals), assists: toCount(row.assists),
      yellowCards: toCount(row.yellow_cards), redCards: toCount(row.red_cards), penaltiesScored: toCount(row.penalties_scored), penaltiesMissed: toCount(row.penalties_missed), ownGoals: toCount(row.own_goals),
    }))
    .sort((a, b) => b.season.localeCompare(a.season) || Number(b.teamId === player.idTeam) - Number(a.teamId === player.idTeam));
  let teamLeagueId: string | null = null;
  if (textOrNull(player.idTeam)) {
    const { data: standing } = await supabase.from('standings_v2').select('leagueId').eq('teamId', player.idTeam).in('leagueId', supportedLeagueIds()).order('season', { ascending: false }).limit(1).maybeSingle();
    teamLeagueId = standing?.leagueId ? String(standing.leagueId) : null;
  }
  return {
    id: player.idPlayer, name: player.strPlayer, teamName: textOrNull(player.strTeam), teamId: textOrNull(player.idTeam), position: textOrNull(player.strPosition), jerseyNumber: textOrNull(player.strNumber), photoUrl: textOrNull(player.strThumb),
    nationality: textOrNull(player.strNationality), height: textOrNull(player.strHeight), weight: textOrNull(player.strWeight), birthDate: textOrNull(player.dateBorn),
    seasons, teamLeagueId,
  };
}

export async function fetchTeamFromDB(idTeam: string): Promise<TeamFromDB | null> {
  const { data, error } = await supabase.from('teams').select('*').eq('idTeam', idTeam).maybeSingle();
  if (error) { console.error('Error fetching team from DB:', error); throw error; }
  return data;
}

export type TeamDetails = {
  id: string; name: string; nameKorean: string | null; badgeUrl: string | null; strStadium?: string | null; intFormedYear?: string | null;
  strLocation?: string | null; intStadiumCapacity?: number | null; strWebsite?: string | null; strDescriptionEN?: string | null; strEquipment?: string | null;
  current_position?: number | null; points?: number | null; matches_played?: number | null; wins?: number | null; draws?: number | null; losses?: number | null; goals_for?: number | null; goals_against?: number | null; goal_difference?: number | null; currentLeagueId?: string;
  // 순위표가 있는 가장 최근 시즌 (리그별 시즌 표기가 달라 달력 연도 대신 사용)
  currentSeason?: string;
};

export async function fetchTeamDetails(teamId: string, season?: string): Promise<TeamDetails | null> {
  const { data: teamData, error: teamError } = await supabase.from('teams_v2').select('id, name, nameKorean, badgeUrl, strStadium, intFormedYear, strLocation, intStadiumCapacity, strWebsite, strDescriptionEN, strEquipment').eq('id', teamId).maybeSingle();
  if (teamError) { console.error('Error fetching team from teams_v2:', teamError); return null; }
  if (!teamData) return null;
  // 시즌을 지정하지 않으면 팀의 가장 최근 시즌 순위를 쓴다 (유럽 2026-27 시즌은 2027년 상반기에도 '2026')
  let standingQuery = supabase.from('standings_v2').select('rank, points, gamesPlayed, wins, draws, losses, goalsFor, goalsAgainst, goalDifference, leagueId, season').eq('teamId', teamId).in('leagueId', ['4689', '4822', '4328', '4335', '4332', '4331', '4334']);
  if (season) standingQuery = standingQuery.eq('season', normalizeSeason(season));
  const { data: standingData, error: standingError } = await standingQuery.order('season', { ascending: false }).order('leagueId', { ascending: true }).limit(1).maybeSingle();
  if (standingError) { console.warn(`Error fetching standing for team ${teamId}:`, standingError); }
  return {
    id: teamData.id, name: teamData.name, nameKorean: teamData.nameKorean, badgeUrl: teamData.badgeUrl, strStadium: teamData.strStadium, intFormedYear: teamData.intFormedYear,
    strLocation: teamData.strLocation, intStadiumCapacity: teamData.intStadiumCapacity, strWebsite: teamData.strWebsite, strDescriptionEN: teamData.strDescriptionEN, strEquipment: teamData.strEquipment,
    current_position: standingData?.rank ?? null, points: standingData?.points ?? null, matches_played: standingData?.gamesPlayed ?? null, wins: standingData?.wins ?? null, draws: standingData?.draws ?? null, losses: standingData?.losses ?? null, goals_for: standingData?.goalsFor ?? null, goals_against: standingData?.goalsAgainst ?? null, goal_difference: standingData?.goalDifference ?? null, currentLeagueId: standingData?.leagueId ?? null, currentSeason: standingData?.season ?? undefined,
  };
}

// Counts *completed* league titles (rank=1 finishes) recorded for this team
// across the historical standings_v2 backfill (see import-historical-champions-euro.ts
// and 10-insert-historical-champions.sql) plus any completed previous season
// the daily sync has already written. Excludes the in-progress season — a
// team sitting in 1st place mid-season hasn't won it yet, same reasoning as
// fetchHistoricalChampions's currentSeason cutoff.
export async function fetchTeamTrophyCount(teamId: string, currentSeason: string = DEFAULT_SEASON): Promise<number> {
  const { count, error } = await supabase.from('standings_v2').select('season', { count: 'exact', head: true }).eq('teamId', teamId).eq('rank', 1).lt('season', normalizeSeason(currentSeason));
  if (error) { console.warn(`Error fetching trophy count for team ${teamId}:`, error); return 0; }
  return count ?? 0;
}

// Returns the standings rows immediately above/below this team's current
// rank (a compact "mini league table"), rather than the full table.
export async function fetchNearbyStandings(leagueId: string, season: string, teamId: string, windowSize: number = 2): Promise<TeamStanding[]> {
  const normalized = normalizeSeason(season);
  const { data, error } = await supabase.from('standings_v2').select('*').eq('leagueId', leagueId).eq('season', normalized).order('rank', { ascending: true });
  if (error) { console.warn(`Error fetching nearby standings for league ${leagueId}:`, error); return []; }
  const rows = data ?? [];
  const teamIndex = rows.findIndex((row) => String(row.teamId) === String(teamId));
  const start = teamIndex === -1 ? 0 : Math.max(0, teamIndex - windowSize);
  const end = teamIndex === -1 ? rows.length : teamIndex + windowSize + 1;
  return rows.slice(start, end).map((standing) => ({
    team_id: String(standing.teamId ?? ''), team_name: String(standing.teamName || "Unknown"), short_name: null, crest_url: standing.teamBadgeUrl, rank: Number(standing.rank || 0), points: toCount(standing.points), played: toCount(standing.gamesPlayed), win: toCount(standing.wins), draw: toCount(standing.draws), lose: toCount(standing.losses), goals_for: toCount(standing.goalsFor), goals_against: toCount(standing.goalsAgainst), goals_diff: toCount(standing.goalDifference), form: standing.form || null,
  }));
}

export type TeamFixture = { id: number; date_utc: string; status_short: string; home_team: string; away_team: string; home_goals: number | null; away_goals: number | null; is_home: boolean; opponent_name: string; opponent_logo: string | null; result: 'W' | 'D' | 'L' | null; };
export type TeamStatistics = { position: number; points: number; played: number; wins: number; draws: number; losses: number; goals_for: number; goals_against: number; goal_difference: number; clean_sheets: number; failed_to_score: number; avg_goals_scored: number; avg_goals_conceded: number; form_last_5: string; home_record: { wins: number; draws: number; losses: number }; away_record: { wins: number; draws: number; losses: number }; };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fetchTeamFixtures(_teamId: number, _season: string = DEFAULT_SEASON, _limit: number = 10): Promise<TeamFixture[]> { console.warn("fetchTeamFixtures needs implementation with correct schema"); return []; }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fetchTeamStatistics(_teamId: number, _season: string = DEFAULT_SEASON): Promise<TeamStatistics | null> { console.warn("fetchTeamStatistics needs implementation with correct schema"); return null; }

export async function fetchTeamEventsData(teamId: string, season: string, limit?: number): Promise<Match[]> { 
  const normalized = normalizeSeason(season);
  let query = supabase.from('events_v2').select('*').eq('season', normalized).or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`).order('date', { ascending: false }); 
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) { console.error('Error fetching team events from events_v2:', error); throw error; }
  return data || []; 
}

export async function fetchTeamFormGuide(teamId: string, season: string, limit: number = 5): Promise<FormResult[]> {
  // 예정 경기까지 섞여 최근 폼이 비지 않도록 지난 FINISHED 경기만 쓴다
  const events = await fetchTeamRecentEventsData(teamId, season, limit);
  return events.filter(event => event.homeScore !== undefined && event.awayScore !== undefined && event.homeScore !== null && event.awayScore !== null).map(event => {
      const isHome = event.homeTeamId === teamId; const teamScore = isHome ? event.homeScore : event.awayScore; const oppScore = isHome ? event.awayScore : event.homeScore; 
      if (teamScore! > oppScore!) return 'W'; if (teamScore! < oppScore!) return 'L'; return 'D';
    });
}

export async function fetchTeamUpcomingEventsData(teamId: string, season: string, limit: number = 5): Promise<Match[]> { 
  const today = new Date().toISOString(); 
  const normalized = normalizeSeason(season);
  const { data, error } = await supabase.from('events_v2').select('*').eq('season', normalized).or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`).gte('date', today).in('status', ["SCHEDULED", "UNKNOWN", "POSTPONED"]).order('date', { ascending: true }).limit(limit);
  if (error) { console.error('Error fetching team upcoming events from events_v2:', error); return []; }
  return data || []; 
}

export async function fetchTeamUpcomingFixtures(teamId: string, limit: number = 5): Promise<UpcomingFixture[]> {
  const matches = await fetchTeamUpcomingEventsData(teamId, DEFAULT_SEASON, limit);
  return matches.map(match => ({
    id: String(match.id),
    date_utc: String(match.date),
    status: String(match.status),
    round: String(match.round || 'N/A'),
    home_team: {
      id: String(match.homeTeamId),
      name: `Team ${match.homeTeamId}`, 
      logo_url: null
    },
    away_team: {
      id: String(match.awayTeamId),
      name: `Team ${match.awayTeamId}`,
      logo_url: null
    },
    venue: match.venueName || undefined,
    league_id: String(match.leagueId)
  }));
}

export async function fetchTeamRecentEventsData(teamId: string, season: string, limit: number = 5): Promise<Match[]> { 
  const today = new Date().toISOString(); 
  const normalized = normalizeSeason(season);
  const { data, error } = await supabase.from('events_v2').select('*').eq('season', normalized).or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`).lt('date', today).eq('status', "FINISHED").not('homeScore', 'is', null).not('awayScore', 'is', null).order('date', { ascending: false }).limit(limit);
  if (error) { console.error('Error fetching team recent events from events_v2:', error); return []; }
  return data || []; 
}

export async function fetchTeamRecentFixtures(teamId: string, limit: number = 5): Promise<RoundFixture[]> {
  const matches = await fetchTeamRecentEventsData(teamId, DEFAULT_SEASON, limit);
  return matches.map(match => ({
    id: String(match.id),
    date_utc: String(match.date),
    status: String(match.status),
    status_short: String(match.status),
    round: String(match.round || 'N/A'),
    home_team: {
      id: String(match.homeTeamId),
      name: `Team ${match.homeTeamId}`,
      logo_url: null
    },
    away_team: {
      id: String(match.awayTeamId),
      name: `Team ${match.awayTeamId}`,
      logo_url: null
    },
    home_goals: match.homeScore ?? null,
    away_goals: match.awayScore ?? null,
    venue: match.venueName || undefined,
    league_id: String(match.leagueId)
  }));
}

export async function fetchTeamStandingsData(idLeague: string, season: string, teamName: string): Promise<Standing | null> {
  const normalized = normalizeSeason(season);
  const { data, error } = await supabase.from('standings_v2').select('*').eq('leagueId', idLeague).eq('season', normalized).eq('teamName', teamName).maybeSingle();
  if (error) { console.error('Error fetching team standings from standings_v2:', error); return null; }
  if (!data) return null;
  return {
    leagueId: data.leagueId, teamId: data.teamId, season: data.season, rank: Number(data.rank || 0), teamName: data.teamName || "Unknown", teamBadgeUrl: data.teamBadgeUrl, gamesPlayed: toCount(data.gamesPlayed), wins: toCount(data.wins), draws: toCount(data.draws), losses: toCount(data.losses), points: toCount(data.points), goalsFor: toCount(data.goalsFor), goalsAgainst: toCount(data.goalsAgainst), goalDifference: toCount(data.goalDifference), form: data.form, description: data.description, lastUpdated: data.lastUpdated ?? null,
  };
}

export interface PlayerStatistics { idPlayer: string; strPlayer: string; idTeam: string; strTeam: string; idLeague: string; strSeason: string; goals: number | null; assists: number | null; yellow_cards: number | null; red_cards: number | null; appearances: number | null; own_goals: number | null; penalties_scored: number | null; goals_per_game?: number | null; assists_per_game?: number | null; }

export async function fetchTopScorersStats(idLeague: string, season: string, limit: number = 10): Promise<PlayerStatistics[]> {
  const normalized = normalizeSeason(season);
  const { data, error } = await supabase.from('top_scorers').select('*').eq('idLeague', idLeague).eq('strSeason', normalized).limit(limit);
  if (error) { console.error('Error fetching top scorers:', error); return []; }
  return data || [];
}

export async function fetchTopAssistersStats(idLeague: string, season: string, limit: number = 10): Promise<PlayerStatistics[]> {
  const normalized = normalizeSeason(season);
  const { data, error } = await supabase.from('top_assisters').select('*').eq('idLeague', idLeague).eq('strSeason', normalized).limit(limit);
  if (error) { console.error('Error fetching top assisters:', error); return []; }
  return data || [];
}

export async function fetchPlayerStatistics(idLeague: string, season: string): Promise<PlayerStatistics[]> {
  const normalized = normalizeSeason(season);
  const { data, error } = await supabase.from('player_statistics').select('*').eq('idLeague', idLeague).eq('strSeason', normalized).order('goals', { ascending: false });
  if (error) { console.error('Error fetching player statistics:', error); return []; }
  return data || [];
}
// ---------- 목록 페이지 (/teams, /players, /matches) ----------

export type TeamListRow = { team_id: string; team_name: string; crest_url: string | null; league_id: string; season: string; rank: number };

/** 지원 리그별 가장 최근 시즌의 참가 팀 (standings_v2 기준, 리그 메뉴 순서 → 순위 순) */
export async function fetchTeamsList(): Promise<TeamListRow[]> {
  const leagueIds = supportedLeagueIds();
  // 최근 두 시즌만 받아 리그마다 가장 최근 시즌을 고른다 (새 시즌 순위가 아직 없을 때를 위해)
  const minSeason = String(new Date().getFullYear() - 1);
  const { data, error } = await supabase.from('standings_v2').select('leagueId, season, teamId, teamName, teamBadgeUrl, rank')
    .in('leagueId', leagueIds).gte('season', minSeason);
  if (error) throw error;
  const latest = new Map<string, string>();
  for (const row of data ?? []) if (!latest.has(row.leagueId) || row.season > latest.get(row.leagueId)!) latest.set(row.leagueId, row.season);
  return (data ?? [])
    .filter(row => row.season === latest.get(row.leagueId))
    .map(row => ({ team_id: String(row.teamId), team_name: String(row.teamName), crest_url: row.teamBadgeUrl ?? null, league_id: String(row.leagueId), season: String(row.season), rank: Number(row.rank) }))
    .sort((a, b) => leagueIds.indexOf(a.league_id) - leagueIds.indexOf(b.league_id) || a.rank - b.rank);
}

export type PlayerListRow = {
  id: string; name: string; team_id: string | null; team_name: string | null; position: string | null;
  number: string | null; nationality: string | null; birth_date: string | null; photo_url: string | null;
};
export type PlayerSort = 'name' | 'young' | 'old';
export const PLAYER_PAGE_SIZE = 25;

/**
 * 현재 선수단에서 걸러 한 페이지. 정렬·페이지는 서버에서 한다.
 * players_v2_current(migration 24)는 팀 선수단 화면(currentRoster)과 같은 기준으로 이전 명단에만 있는 선수를 뺀 뷰다
 */
export async function fetchPlayersPage(opts: {
  teamIds?: string[]; position?: PositionGroup | null; q?: string; sort?: PlayerSort; page?: number;
}): Promise<{ rows: PlayerListRow[]; total: number }> {
  // 팀이 하나도 없는 조건(순위가 아직 없는 리그 등)은 in.() 을 보내지 않고 빈 결과
  if (opts.teamIds && opts.teamIds.length === 0) return { rows: [], total: 0 };
  const page = Math.max(1, opts.page ?? 1);
  const q = (opts.q ?? '').replace(/[%_*"\\]/g, ' ').trim();
  const filtered = (head: boolean) => {
    let query = supabase.from('players_v2_current')
      .select('idPlayer, strPlayer, idTeam, strTeam, strPosition, strNumber, strNationality, dateBorn, strThumb', { count: 'exact', head })
      // 감독·코치는 빼고, 포지션이 비어 있는 선수는 남긴다
      .or(`strPosition.is.null,strPosition.not.in.(${STAFF_POSITIONS.map(p => `"${p}"`).join(',')})`);
    if (opts.teamIds) query = query.in('idTeam', opts.teamIds);
    if (opts.position) query = query.in('strPosition', POSITION_GROUPS.find(g => g.key === opts.position)!.positions);
    if (q) query = query.ilike('strPlayer', `%${q}%`);
    return query;
  };
  let query = filtered(false);
  if (opts.sort === 'young') query = query.order('dateBorn', { ascending: false, nullsFirst: false });
  else if (opts.sort === 'old') query = query.order('dateBorn', { ascending: true, nullsFirst: false });
  // 같은 값이면 이름·ID 순으로 고정해 페이지 사이에 행이 겹치거나 빠지지 않게 한다
  query = query.order('strPlayer', { ascending: true }).order('idPlayer', { ascending: true });
  const from = (page - 1) * PLAYER_PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + PLAYER_PAGE_SIZE - 1);
  // 마지막 페이지를 넘은 offset 은 PostgREST 가 416(PGRST103)으로 거절한다 — 빈 페이지와 전체 수를 돌려준다
  if (error?.code === 'PGRST103') {
    const { count: total, error: countError } = await filtered(true);
    if (countError) throw countError;
    return { rows: [], total: total ?? 0 };
  }
  if (error) throw error;
  return {
    total: count ?? 0,
    rows: (data ?? []).map(p => ({
      id: String(p.idPlayer), name: String(p.strPlayer), team_id: p.idTeam ? String(p.idTeam) : null, team_name: p.strTeam ?? null,
      position: p.strPosition ?? null, number: p.strNumber ?? null, nationality: p.strNationality ?? null, birth_date: p.dateBorn ?? null, photo_url: p.strThumb ?? null,
    })),
  };
}

const MATCH_SELECT = `*, homeTeam:teams_v2!homeTeamId(id, name, badgeUrl), awayTeam:teams_v2!awayTeamId(id, name, badgeUrl)`;

/** 한국 날짜 하루의 경기 (킥오프 순). leagueId·phase 로 거른다 */
export async function fetchMatchesOnDate(date: string, opts: { leagueId?: string | null; phase?: MatchPhase | null } = {}): Promise<MatchWithTeams[]> {
  const { from, to } = kstDayRange(date);
  let query = supabase.from('events_v2').select(MATCH_SELECT).gte('date', from).lt('date', to);
  query = opts.leagueId ? query.eq('leagueId', opts.leagueId) : query.in('leagueId', supportedLeagueIds());
  if (opts.phase) query = query.in('status', statusesOf(opts.phase));
  const { data, error } = await query.order('date', { ascending: true }).order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MatchWithTeams[];
}

/** 주어진 한국 날짜 다음으로 경기가 있는 가장 가까운 날짜 (없으면 null) */
export async function fetchNextMatchDate(date: string, leagueId?: string | null, phase?: MatchPhase | null): Promise<string | null> {
  let query = supabase.from('events_v2').select('date').gte('date', kstDayRange(date).to);
  query = leagueId ? query.eq('leagueId', leagueId) : query.in('leagueId', supportedLeagueIds());
  if (phase) query = query.in('status', statusesOf(phase));
  const { data, error } = await query.order('date', { ascending: true }).limit(1);
  if (error) throw error;
  return data?.[0]?.date ? kstDate(new Date(data[0].date)) : null;
}

// ---------- 홈 (/) ----------

/**
 * 한국 날짜 [fromDate, toDate] 사이의 경기 (양 끝 포함). teamIds 가 있으면 그 팀이 홈·원정인 경기만.
 * descending 이면 최근 경기부터, limit 개까지
 */
export async function fetchMatchesInRange(fromDate: string, toDate: string, opts: {
  phases?: MatchPhase[]; teamIds?: string[]; descending?: boolean; limit?: number;
} = {}): Promise<MatchWithTeams[]> {
  if (opts.teamIds && opts.teamIds.length === 0) return [];
  let query = supabase.from('events_v2').select(MATCH_SELECT)
    .gte('date', kstDayRange(fromDate).from).lt('date', kstDayRange(toDate).to)
    .in('leagueId', supportedLeagueIds());
  if (opts.phases) query = query.in('status', opts.phases.flatMap(statusesOf));
  if (opts.teamIds) {
    // 팀 ID 는 문자열(hist_* 포함)이라 따옴표로 감싸고, 따옴표·역슬래시는 PostgREST 규칙대로 역슬래시로 이스케이프한다
    const ids = opts.teamIds.map(id => `"${id.replace(/["\\]/g, '\\$&')}"`).join(',');
    query = query.or(`homeTeamId.in.(${ids}),awayTeamId.in.(${ids})`);
  }
  const ascending = !opts.descending;
  const { data, error } = await query.order('date', { ascending }).order('id', { ascending }).limit(opts.limit ?? 100);
  if (error) throw error;
  return (data ?? []) as MatchWithTeams[];
}

export type LeagueLeaderRow = {
  league_id: string; season: string; rank: number; team_id: string; team_name: string;
  crest_url: string | null; played: number | null; points: number | null;
};

/** 지원 리그별 가장 최근 시즌의 1~topN위 (리그 메뉴 순서 → 순위 순) */
export async function fetchLeagueLeaders(topN: number = 4): Promise<LeagueLeaderRow[]> {
  const leagueIds = supportedLeagueIds();
  // fetchTeamsList 와 같이 최근 두 시즌(한국 날짜 기준 작년부터)만 받아 리그마다 가장 최근 시즌을 고른다
  const minSeason = String(Number(kstDate().slice(0, 4)) - 1);
  const { data, error } = await supabase.from('standings_v2')
    .select('leagueId, season, rank, teamId, teamName, teamBadgeUrl, gamesPlayed, points')
    .in('leagueId', leagueIds).gte('season', minSeason).lte('rank', topN);
  if (error) throw error;
  const latest = new Map<string, string>();
  for (const row of data ?? []) if (!latest.has(row.leagueId) || row.season > latest.get(row.leagueId)!) latest.set(row.leagueId, row.season);
  return (data ?? [])
    .filter(row => row.season === latest.get(row.leagueId))
    .map(row => ({
      league_id: String(row.leagueId), season: String(row.season), rank: Number(row.rank), team_id: String(row.teamId),
      team_name: String(row.teamName), crest_url: row.teamBadgeUrl ?? null, played: toCount(row.gamesPlayed), points: toCount(row.points),
    }))
    .sort((a, b) => leagueIds.indexOf(a.league_id) - leagueIds.indexOf(b.league_id) || a.rank - b.rank);
}

/** 수집 단계별 마지막 성공 시각 (sync_status 뷰, migration 21). 예: { events: '2026-11-20T22:53:55Z' } */
export async function fetchSyncStatus(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('sync_status').select('step, lastSuccessAt');
  if (error) throw error;
  return Object.fromEntries((data ?? []).filter(row => row.lastSuccessAt).map(row => [String(row.step), String(row.lastSuccessAt)]));
}
