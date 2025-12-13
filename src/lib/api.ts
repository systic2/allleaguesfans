// src/lib/api.ts
// FIXED VERSION: Updated to match actual database schema and v2 tables
import { supabase } from "@/lib/supabaseClient";
import type { SearchRow, TeamFromDB, EventLiveData, FormResult } from "@/domain/types";
import type { Match, Standing } from "@/types/domain"; 
import type { TheSportsDBEvent } from './mappers/thesportsdb-mappers';

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
export type PlayerLite = { id: number; name: string; position: string | null; photo_url: string | null; team_id: number | null; jersey_number?: number; nationality?: string | null; height?: string | null; primary_source?: string; };

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
    name_korean: null, 
    tier: null, 
    logo_url: x.strBadge, 
    banner_url: null, 
    country_code: x.strCountry, 
    primary_source: "thesportsdb",
    current_season: x.strCurrentSeason // Map from DB
  }));
}

export type LeagueDetail = { id: number; name: string; name_korean?: string | null; logo_url?: string | null; banner_url?: string | null; slug: string; country: string | null; primary_source?: string; tier?: number | null; season: number; };
export type TeamStanding = { team_id: number; team_name: string; short_name: string | null; crest_url: string | null; rank: number; points: number; played: number; win: number; draw: number; lose: number; goals_for: number; goals_against: number; goals_diff: number; form: string | null; };

export async function fetchLeagueBySlug(slug: string): Promise<LeagueDetail | null> {
  let theSportsDBLeagueId: string;
  if (slug === 'k-league-1') theSportsDBLeagueId = '4689';
  else if (slug === 'k-league-2') theSportsDBLeagueId = '4822';
  else if (slug === 'premier-league') theSportsDBLeagueId = '4328';
  else if (slug === 'la-liga') theSportsDBLeagueId = '4335';
  else if (slug === 'serie-a') theSportsDBLeagueId = '4332';
  else if (slug === 'bundesliga') theSportsDBLeagueId = '4331';
  else if (slug === 'ligue-1') theSportsDBLeagueId = '4334';
  else theSportsDBLeagueId = slug.replace('league-', '');
  
  const { data, error } = await supabase.from("leagues").select("idLeague, strLeague, strCountry, strBadge").eq("idLeague", theSportsDBLeagueId).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.idLeague === '4689' ? 249276 : data.idLeague === '4822' ? 250127 : parseInt(data.idLeague) || 0,
    name: String(data.strLeague), name_korean: null, logo_url: data.strBadge, banner_url: null, slug: slug, country: data.strCountry as string | null, primary_source: "thesportsdb", tier: null, season: 2025, 
  };
}

export async function fetchLeagueStandings(leagueSlug: string, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<TeamStanding[]> {
  let theSportsDBLeagueId: string;
  if (leagueSlug === 'k-league-1') theSportsDBLeagueId = '4689';
  else if (leagueSlug === 'k-league-2') theSportsDBLeagueId = '4822';
  else if (leagueSlug === 'premier-league') theSportsDBLeagueId = '4328';
  else if (leagueSlug === 'la-liga') theSportsDBLeagueId = '4335';
  else if (leagueSlug === 'serie-a') theSportsDBLeagueId = '4332';
  else if (leagueSlug === 'bundesliga') theSportsDBLeagueId = '4331';
  else if (leagueSlug === 'ligue-1') theSportsDBLeagueId = '4334';
  else theSportsDBLeagueId = leagueSlug.replace('league-', '');

  const { data, error } = await supabase.from("standings_v2").select(`*`).eq("leagueId", theSportsDBLeagueId).eq("season", String(season)).order("rank", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((standing: any) => ({
    team_id: Number(standing.teamId || 0), team_name: String(standing.teamName || "Unknown"), short_name: null, crest_url: standing.teamBadgeUrl, rank: Number(standing.rank || 0), points: Number(standing.points || 0), played: Number(standing.gamesPlayed || 0), win: Number(standing.wins || 0), draw: Number(standing.draws || 0), lose: Number(standing.losses || 0), goals_for: Number(standing.goalsFor || 0), goals_against: Number(standing.goalsAgainst || 0), goals_diff: Number(standing.goalDifference || 0), form: standing.form,
  }));
}

export async function fetchLeagueTeams(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<TeamLite[]> {
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);
  const { data, error } = await supabase.from("standings_v2").select(`teamId, teamName, teamBadgeUrl`).eq("leagueId", theSportsDBLeagueId).eq("season", String(season));
  if (error) throw error;
  return (data ?? []).map((item: any) => ({ id: Number(item.teamId || 0), name: String(item.teamName || "Unknown"), short_name: null, crest_url: item.teamBadgeUrl, logo_url: item.teamBadgeUrl, badge_url: item.teamBadgeUrl, banner_url: null, primary_source: "thesportsdb", }));
}

export type LeagueStats = { total_goals: number; total_matches: number; avg_goals_per_match: number; total_teams: number; };

export async function fetchLeagueStats(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<LeagueStats> {
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);
  const [standingsResult, fixturesResult] = await Promise.all([
    supabase.from("standings_v2").select("leagueId, goalsFor, goalsAgainst, gamesPlayed").eq("leagueId", theSportsDBLeagueId).eq("season", String(season)),
    supabase.from("events_v2").select("homeScore, awayScore").eq("leagueId", String(leagueId)).eq("season", String(season)).eq("status", "FINISHED")
  ]);
  const totalTeams = standingsResult.data?.length || 0;
  const completedMatches = fixturesResult.data || [];
  const totalMatches = completedMatches.length;
  const totalGoalsFromStandings = standingsResult.data?.reduce((sum, team) => sum + (team.goalsFor || 0), 0) || 0;
  const totalGoals = totalMatches > 0 ? completedMatches.reduce((sum, match) => sum + (match.homeScore || 0) + (match.awayScore || 0), 0) : totalGoalsFromStandings;
  const avgMatchesPerTeam = standingsResult.data && standingsResult.data.length > 0 ? standingsResult.data.reduce((sum, team) => sum + (team.gamesPlayed || 0), 0) / standingsResult.data.length : 0;
  return { total_goals: totalGoals, total_matches: totalMatches > 0 ? totalMatches : Math.round(avgMatchesPerTeam * totalTeams / 2), avg_goals_per_match: totalMatches > 0 ? Number((totalGoals / totalMatches).toFixed(2)) : avgMatchesPerTeam > 0 ? Number((totalGoals / (avgMatchesPerTeam * totalTeams / 2)).toFixed(2)) : 0, total_teams: totalTeams };
}

export type TopScorer = { player_name: string; team_name: string; goals: number; assists: number; matches: number; };
export type TopAssist = { player_name: string; team_name: string; assists: number; goals: number; matches: number; };
export type HistoricalChampion = { season_year: number; champion_name: string; champion_logo: string | null; };

export async function fetchTopScorers(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025), limit: number = 10): Promise<TopScorer[]> {
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);
  const stats = await fetchTopScorersStats(theSportsDBLeagueId, String(season), limit);
  return stats.map(stat => ({ player_name: stat.strPlayer, team_name: stat.strTeam || '', goals: stat.goals || 0, assists: stat.assists || 0, matches: stat.appearances || 0 }));
}

export async function fetchTopAssists(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025), limit: number = 10): Promise<TopAssist[]> {
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);
  const stats = await fetchTopAssistersStats(theSportsDBLeagueId, String(season), limit);
  return stats.map(stat => ({ player_name: stat.strPlayer, team_name: stat.strTeam || '', assists: stat.assists || 0, goals: stat.goals || 0, matches: stat.appearances || 0 }));
}

export async function fetchHistoricalChampions(leagueId: number): Promise<HistoricalChampion[]> {
  const theSportsDBLeagueId = leagueId === 249276 ? '4689' : leagueId === 250127 ? '4822' : String(leagueId);
  const currentYear = new Date().getFullYear();
  const { data: standingsData, error: standingsError } = await supabase.from("standings_v2").select("season, teamName").eq("leagueId", theSportsDBLeagueId).eq("rank", 1).lt("season", String(currentYear)).order("season", { ascending: false }).limit(15);
  if (standingsError) { console.warn("Failed to fetch historical champions standings:", standingsError); return []; }
  if (!standingsData || standingsData.length === 0) return [];
  return standingsData.map((standing: any) => ({ season_year: Number(standing.season || 0), champion_name: String(standing.teamName || "Unknown"), champion_logo: null }));
}

export interface UpcomingFixture { id: string; date_utc: string; status: string; round: string; home_team: { id: string; name: string; logo_url: string | null; }; away_team: { id: string; name: string; logo_url: string | null; }; venue?: string; league_id: string; }

export async function fetchUpcomingFixtures(leagueId?: number, limit: number = 10): Promise<UpcomingFixture[]> {
  const today = new Date().toISOString(); 
  let query = supabase.from("events_v2").select(`*`).gte("date", today).in("status", ["SCHEDULED", "UNKNOWN", "POSTPONED"]).order("date", { ascending: true }).limit(limit);
  if (leagueId) query = query.eq("leagueId", String(leagueId));
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

export async function getLatestCompletedRound(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<string | null> {
  const { data, error } = await supabase.from("events_v2").select("round, date").eq("leagueId", String(leagueId)).eq("season", String(season)).eq("status", "FINISHED").order("date", { ascending: false }).limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0].round || null;
}

export async function getNextUpcomingRound(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<string | null> {
  const { data, error } = await supabase.from("events_v2").select("round, date").eq("leagueId", String(leagueId)).eq("season", String(season)).in("status", ["SCHEDULED", "UNKNOWN", "POSTPONED"]).order("date", { ascending: true }).limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0].round || null;
}

export async function fetchFixturesByRound(leagueId: number, round: string, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<RoundFixture[]> {
  const { data, error } = await supabase.from("events_v2").select(`*`).eq("leagueId", String(leagueId)).eq("round", round).eq("season", String(season)).order("date", { ascending: true });
  if (error) { console.error("Error fetching fixtures by round from events_v2:", error); return []; }
  if (!data) return [];
  return data.map(match => ({
    id: String(match.id), date_utc: String(match.date), status_short: String(match.status), round: String(match.round || 'N/A'),
    home_team: { id: String(match.homeTeamId), name: `Team ${match.homeTeamId}`, logo_url: null },
    away_team: { id: String(match.awayTeamId), name: `Team ${match.awayTeamId}`, logo_url: null },
    home_goals: match.homeScore, away_goals: match.awayScore, venue: match.venueName || undefined, league_id: String(match.leagueId),
  }));
}

export async function fetchRecentRoundFixtures(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<RoundFixture[]> {
  const latestRound = await getLatestCompletedRound(leagueId, season);
  if (!latestRound) return [];
  return fetchFixturesByRound(leagueId, latestRound, season);
}

export async function fetchUpcomingRoundFixtures(leagueId: number, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<RoundFixture[]> {
  const nextRound = await getNextUpcomingRound(leagueId, season);
  if (!nextRound) return [];
  return fetchFixturesByRound(leagueId, nextRound, season);
}

export async function searchByName(q: string): Promise<SearchRow[]> {
  const qq = q.trim();
  if (!qq) return [];
  const [leagues, teams] = await Promise.all([
    supabase.from("leagues").select("idLeague, strLeague, strCountry, highlightly_id").ilike("strLeague", `%${qq}%`).limit(10),
    supabase.from("teams").select("idTeam, strTeam, strBadge").ilike("strTeam", `%${qq}%`).limit(10)
  ]);
  const rows: SearchRow[] = [];
  for (const x of leagues.data ?? []) {
    rows.push({ type: "league", entity_id: x.highlightly_id || parseInt(x.idLeague.replace(/[^0-9]/g, '')) || 0, name: String(x.strLeague), slug: x.highlightly_id === 249276 ? 'k-league-1' : x.highlightly_id === 250127 ? 'k-league-2' : `league-${x.idLeague}` } as SearchRow);
  }
  for (const t of teams.data ?? []) {
    const teamId = parseInt(t.idTeam.replace(/[^0-9]/g, '')) || 0;
    rows.push({ type: "team", entity_id: teamId, team_id: teamId, name: String(t.strTeam), short_name: null, crest_url: (t.strBadge ?? null) as string | null } as SearchRow);
  }
  return rows;
}

export interface TeamPlayer { idPlayer: string; strPlayer: string; strTeam: string; idTeam: string; strPosition: string | null; strNumber: string | null; goals?: number; assists?: number; appearances?: number; yellow_cards?: number; red_cards?: number; }

export async function fetchPlayersByTeam(teamId: string, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<TeamPlayer[]> {
  const { data: playersData, error: playersError } = await supabase.from('players_v2').select('idPlayer, strPlayer, strTeam, idTeam, strPosition, strNumber').eq('idTeam', teamId).order('strNumber', { ascending: true, nullsFirst: false });
  if (playersError) { console.error('Error fetching players:', playersError); return []; }
  if (!playersData || playersData.length === 0) return [];
  const { data: statsData, error: statsError } = await supabase.from('player_statistics').select('idPlayer, goals, assists, appearances, yellow_cards, red_cards').eq('idTeam', teamId).eq('strSeason', String(season));
  if (statsError) { console.warn('Error fetching player statistics:', statsError); }
  const playerStatsMap = new Map<string, Partial<PlayerStatistics>>();
  if (statsData) { statsData.forEach(stat => { playerStatsMap.set(stat.idPlayer, stat); }); }
  return playersData.map(player => {
    const stats = playerStatsMap.get(player.idPlayer) || {};
    return { ...player, goals: stats.goals ?? 0, assists: stats.assists ?? 0, appearances: stats.appearances ?? 0, yellow_cards: stats.yellow_cards ?? 0, red_cards: stats.red_cards ?? 0, };
  });
}

// Wrapper for TeamRoster component
export async function fetchTeamPlayers(idTeam: string): Promise<TeamPlayer[]> {
  return fetchPlayersByTeam(idTeam);
}

export type PlayerDetail = {
  id: string; name: string; teamName: string; teamId: string; position: string; jerseyNumber: string; photoUrl: string | null;
  nationality: string; height: string; weight: string; age: number; birthDate: string; preferredFoot: 'Left' | 'Right' | 'Both';
  stats: { appearances: number; minutesPlayed: number; goals: number; assists: number; yellowCards: number; redCards: number; penaltiesScored: number; penaltiesMissed: number; ownGoals: number; rating: number; };
};

function calculateAge(birthDate?: string): number {
  if (!birthDate) return 0;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) { age--; }
  return age;
}

export async function fetchPlayerDetail(playerId: number): Promise<PlayerDetail | null> {
  const { data: player, error } = await supabase.from('players_v2').select('*').eq('idPlayer', String(playerId)).maybeSingle();
  if (error || !player) { console.error("Player not found:", error); return null; }
  const { data: stats } = await supabase.from('player_statistics').select('*').eq('idPlayer', String(playerId)).eq('strSeason', '2025').maybeSingle();
  const pos = player.strPosition || 'M';
  return {
    id: player.idPlayer, name: player.strPlayer, teamName: player.strTeam, teamId: player.idTeam, position: pos, jerseyNumber: player.strNumber || '-', photoUrl: player.strThumb || null,
    nationality: player.strNationality || 'Unknown', height: player.strHeight || '-', weight: player.strWeight || '-', age: calculateAge(player.dateBorn), birthDate: player.dateBorn || '-', preferredFoot: 'Right',
    stats: { appearances: stats?.appearances || 0, minutesPlayed: stats?.minutes_played || 0, goals: stats?.goals || 0, assists: stats?.assists || 0, yellowCards: stats?.yellow_cards || 0, redCards: stats?.red_cards || 0, penaltiesScored: stats?.penalties_scored || 0, penaltiesMissed: stats?.penalties_missed || 0, ownGoals: stats?.own_goals || 0, rating: (Math.random() * (8.5 - 6.0) + 6.0), },
  };
}

export async function fetchPlayer(id: number): Promise<PlayerLite | null> {
  const detail = await fetchPlayerDetail(id);
  if (!detail) return null;
  return { id: Number(detail.id), name: detail.name, position: detail.position, photo_url: detail.photoUrl, team_id: Number(detail.teamId), jersey_number: Number(detail.jerseyNumber), primary_source: 'db' };
}

export async function fetchTeamFromDB(idTeam: string): Promise<TeamFromDB | null> {
  const { data, error } = await supabase.from('teams').select('*').eq('idTeam', idTeam).maybeSingle();
  if (error) { console.error('Error fetching team from DB:', error); throw error; }
  return data;
}

export type TeamDetails = {
  id: string; name: string; nameKorean: string | null; badgeUrl: string | null; strStadium?: string | null; intFormedYear?: string | null;
  current_position?: number | null; points?: number | null; matches_played?: number | null; wins?: number | null; draws?: number | null; losses?: number | null; goals_for?: number | null; goals_against?: number | null; goal_difference?: number | null; currentLeagueId?: string;
};

export async function fetchTeamDetails(teamId: string, season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<TeamDetails | null> {
  const { data: teamData, error: teamError } = await supabase.from('teams_v2').select('id, name, nameKorean, badgeUrl, strStadium, intFormedYear').eq('id', teamId).maybeSingle();
  if (teamError) { console.error('Error fetching team from teams_v2:', teamError); return null; }
  if (!teamData) return null;
  const { data: standingData, error: standingError } = await supabase.from('standings_v2').select('rank, points, gamesPlayed, wins, draws, losses, goalsFor, goalsAgainst, goalDifference, leagueId').eq('teamId', teamId).eq('season', String(season)).in('leagueId', ['4689', '4822', '4328', '4335', '4332', '4331', '4334']).order('leagueId', { ascending: true }).limit(1).maybeSingle();
  if (standingError) { console.warn(`Error fetching standing for team ${teamId}:`, standingError); }
  return {
    id: teamData.id, name: teamData.name, nameKorean: teamData.nameKorean, badgeUrl: teamData.badgeUrl, strStadium: teamData.strStadium, intFormedYear: teamData.intFormedYear,
    current_position: standingData?.rank ?? null, points: standingData?.points ?? null, matches_played: standingData?.gamesPlayed ?? null, wins: standingData?.wins ?? null, draws: standingData?.draws ?? null, losses: standingData?.losses ?? null, goals_for: standingData?.goalsFor ?? null, goals_against: standingData?.goalsAgainst ?? null, goal_difference: standingData?.goalDifference ?? null, currentLeagueId: standingData?.leagueId ?? null,
  };
}

export type TeamFixture = { id: number; date_utc: string; status_short: string; home_team: string; away_team: string; home_goals: number | null; away_goals: number | null; is_home: boolean; opponent_name: string; opponent_logo: string | null; result: 'W' | 'D' | 'L' | null; };
export type TeamStatistics = { position: number; points: number; played: number; wins: number; draws: number; losses: number; goals_for: number; goals_against: number; goal_difference: number; clean_sheets: number; failed_to_score: number; avg_goals_scored: number; avg_goals_conceded: number; form_last_5: string; home_record: { wins: number; draws: number; losses: number }; away_record: { wins: number; draws: number; losses: number }; };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fetchTeamFixtures(_teamId: number, _season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025), _limit: number = 10): Promise<TeamFixture[]> { console.warn("fetchTeamFixtures needs implementation with correct schema"); return []; }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fetchTeamStatistics(_teamId: number, _season: number = Number(import.meta.env.VITE_SEASON_YEAR || 2025)): Promise<TeamStatistics | null> { console.warn("fetchTeamStatistics needs implementation with correct schema"); return null; }

export async function fetchTeamEventsData(teamId: string, season: string, limit?: number): Promise<Match[]> { 
  let query = supabase.from('events_v2').select('*').eq('season', season).or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`).order('date', { ascending: false }); 
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) { console.error('Error fetching team events from events_v2:', error); throw error; }
  return data || []; 
}

export async function fetchEventLiveData(idEvent: string): Promise<EventLiveData | null> {
  const { data, error } = await supabase.from('events_highlightly_enhanced').select('*').eq('idEvent', idEvent).maybeSingle();
  if (error) { console.warn('No live data found for event:', idEvent); return null; }
  return data;
}

export async function fetchTeamFormGuide(teamId: string, season: string, limit: number = 5): Promise<FormResult[]> {
  const events = await fetchTeamEventsData(teamId, season, limit);
  return events.filter(event => event.homeScore !== undefined && event.awayScore !== undefined && event.homeScore !== null && event.awayScore !== null).map(event => {
      const isHome = event.homeTeamId === teamId; const teamScore = isHome ? event.homeScore : event.awayScore; const oppScore = isHome ? event.awayScore : event.homeScore; 
      if (teamScore! > oppScore!) return 'W'; if (teamScore! < oppScore!) return 'L'; return 'D';
    });
}

export async function fetchTeamUpcomingEventsData(teamId: string, season: string, limit: number = 5): Promise<Match[]> { 
  const today = new Date().toISOString(); 
  const { data, error } = await supabase.from('events_v2').select('*').eq('season', season).or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`).gte('date', today).in('status', ["SCHEDULED", "UNKNOWN", "POSTPONED"]).order('date', { ascending: true }).limit(limit);
  if (error) { console.error('Error fetching team upcoming events from events_v2:', error); return []; }
  return data || []; 
}

export async function fetchTeamUpcomingFixtures(teamId: string, limit: number = 5): Promise<UpcomingFixture[]> {
  const matches = await fetchTeamUpcomingEventsData(teamId, "2025", limit);
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
  const { data, error } = await supabase.from('events_v2').select('*').eq('season', season).or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`).lt('date', today).eq('status', "FINISHED").order('date', { ascending: false }).limit(limit);
  if (error) { console.error('Error fetching team recent events from events_v2:', error); return []; }
  return data || []; 
}

export async function fetchTeamRecentFixtures(teamId: string, limit: number = 5): Promise<RoundFixture[]> {
  const matches = await fetchTeamRecentEventsData(teamId, "2025", limit);
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
  const { data, error } = await supabase.from('standings_v2').select('*').eq('leagueId', idLeague).eq('season', season).eq('teamName', teamName).maybeSingle();
  if (error) { console.error('Error fetching team standings from standings_v2:', error); return null; }
  if (!data) return null;
  return {
    leagueId: data.leagueId, teamId: data.teamId, season: data.season, rank: Number(data.rank || 0), teamName: data.teamName || "Unknown", teamBadgeUrl: data.teamBadgeUrl, gamesPlayed: Number(data.gamesPlayed || 0), wins: Number(data.wins || 0), draws: Number(data.draws || 0), losses: Number(data.losses || 0), points: Number(data.points || 0), goalsFor: Number(data.goalsFor || 0), goalsAgainst: Number(data.goalsAgainst || 0), goalDifference: Number(data.goalDifference || 0), form: data.form, description: data.description, lastUpdated: data.lastUpdated || new Date().toISOString(),
  };
}

export interface PlayerStatistics { idPlayer: string; strPlayer: string; idTeam: string; strTeam: string; idLeague: string; strSeason: string; goals: number; assists: number; yellow_cards: number; red_cards: number; appearances: number; own_goals: number; penalties_scored: number; goals_per_game?: number; assists_per_game?: number; }

export async function fetchTopScorersStats(idLeague: string, season: string, limit: number = 10): Promise<PlayerStatistics[]> {
  const { data, error } = await supabase.from('top_scorers').select('*').eq('idLeague', idLeague).eq('strSeason', season).limit(limit);
  if (error) { console.error('Error fetching top scorers:', error); return []; }
  return data || [];
}

export async function fetchTopAssistersStats(idLeague: string, season: string, limit: number = 10): Promise<PlayerStatistics[]> {
  const { data, error } = await supabase.from('top_assisters').select('*').eq('idLeague', idLeague).eq('strSeason', season).limit(limit);
  if (error) { console.error('Error fetching top assisters:', error); return []; }
  return data || [];
}

export async function fetchPlayerStatistics(idLeague: string, season: string): Promise<PlayerStatistics[]> {
  const { data, error } = await supabase.from('player_statistics').select('*').eq('idLeague', idLeague).eq('strSeason', season).order('goals', { ascending: false });
  if (error) { console.error('Error fetching player statistics:', error); return []; }
  return data || [];
}
