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
export type PlayerLite = { id: number; name: string; position: string | null; photo_url: string | null; team_id: number | null };

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
  }[];
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
  // Note: Current database schema doesn't have team-player relationships
  // Return a sample of players for demo purposes
  const { data, error } = await supabase
    .from("players")
    .select("id, name, photo_url")
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: Number(p.id),
    name: String(p.name),
    position: null, // No position data in current schema
    photo_url: (p.photo_url ?? null) as string | null,
    team_id: teamId // Use the requested team_id for consistency
  }));
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
      rank,
      points,
      played,
      win,
      draw,
      lose,
      goals_for,
      goals_against,
      goals_diff,
      form,
      teams!inner(name, code, logo_url)
    `)
    .eq("league_id", leagueId)
    .eq("season_year", season)
    .order("rank", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((standing: any) => ({
    team_id: Number(standing.team_id),
    team_name: String(standing.teams?.name || "Unknown"),
    short_name: (standing.teams?.code ?? null) as string | null,
    crest_url: (standing.teams?.logo_url ?? null) as string | null,
    rank: Number(standing.rank),
    points: Number(standing.points),
    played: Number(standing.played),
    win: Number(standing.win),
    draw: Number(standing.draw),
    lose: Number(standing.lose),
    goals_for: Number(standing.goals_for || 0),
    goals_against: Number(standing.goals_against || 0),
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

export type UpcomingFixture = {
  id: number;
  home_team: string;
  away_team: string;
  home_logo: string | null;
  away_logo: string | null;
  match_date: string;
  status: string;
};

export type TopScorer = {
  player_name: string;
  team_name: string;
  goals: number;
  assists: number;
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

export async function fetchUpcomingFixtures(leagueId: number, season: number = 2025, limit: number = 5): Promise<UpcomingFixture[]> {
  // 2024 시즌은 모든 경기가 완료되었으므로 최근 경기를 보여줌
  const { data, error } = await supabase
    .from("fixtures")
    .select(`
      id,
      date_utc,
      status_short,
      home_team_id,
      away_team_id
    `)
    .eq("league_id", leagueId)
    .eq("season_year", season)
    .eq("status_short", "FT") // 완료된 경기
    .order("date_utc", { ascending: false }) // 최근 경기부터
    .limit(limit);

  if (error) {
    console.warn("Failed to fetch upcoming fixtures:", error);
    return [];
  }

  // 팀 정보를 별도로 가져와서 매핑
  const teamIds = [...new Set([
    ...(data || []).map(f => f.home_team_id),
    ...(data || []).map(f => f.away_team_id)
  ])].filter(Boolean);

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, logo_url")
    .in("id", teamIds);

  const teamMap = (teams || []).reduce((acc, team) => {
    acc[team.id] = team;
    return acc;
  }, {} as Record<number, TeamRecord>);

  return (data ?? []).map((fixture: { id: number; home_team_id: number; away_team_id: number; date_utc: string; status_short: string }) => ({
    id: Number(fixture.id),
    home_team: String(teamMap[fixture.home_team_id]?.name || "Unknown"),
    away_team: String(teamMap[fixture.away_team_id]?.name || "Unknown"),
    home_logo: (teamMap[fixture.home_team_id]?.logo_url ?? null) as string | null,
    away_logo: (teamMap[fixture.away_team_id]?.logo_url ?? null) as string | null,
    match_date: String(fixture.date_utc),
    status: String(fixture.status_short),
  }));
}

export async function fetchTopScorers(leagueId: number, season: number = 2025, limit: number = 5): Promise<TopScorer[]> {
  // 이벤트 데이터 조회 (2025시즌 데이터 존재 확인됨)
  const { data: goalEvents, error } = await supabase
    .from("events")
    .select(`
      player_id,
      team_id,
      fixtures!inner(league_id, season_year)
    `)
    .eq("fixtures.league_id", leagueId)
    .eq("fixtures.season_year", season)
    .eq("event_type", "Goal")
    .not("player_id", "is", null);

  if (error) {
    console.warn("Failed to fetch goal events:", error);
    return [];
  }

  if (!goalEvents || goalEvents.length === 0) {
    return [];
  }

  // 골 이벤트별 선수 집계
  const playerGoalCounts = goalEvents.reduce((acc: Record<number, { goals: number; team_id: number }>, event: GoalEvent) => {
    const playerId = event.player_id;
    if (!acc[playerId]) {
      acc[playerId] = { goals: 0, team_id: event.team_id };
    }
    acc[playerId].goals++;
    return acc;
  }, {});

  // 선수 정보 가져오기
  const playerIds = Object.keys(playerGoalCounts).map(Number);
  const { data: players } = await supabase
    .from("players")
    .select("id, name")
    .in("id", playerIds);

  // 팀 정보 가져오기
  const teamIds = [...new Set(Object.values(playerGoalCounts).map(p => p.team_id))];
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, logo_url")
    .in("id", teamIds);

  const playerMap = (players || []).reduce((acc, player) => {
    acc[player.id] = player;
    return acc;
  }, {} as Record<number, PlayerRecord>);

  const teamMap = (teams || []).reduce((acc, team) => {
    acc[team.id] = team;
    return acc;
  }, {} as Record<number, TeamRecord>);

  // 최종 결과 구성
  const topScorers = Object.entries(playerGoalCounts)
    .map(([playerId, data]) => ({
      player_name: playerMap[Number(playerId)]?.name || "Unknown Player",
      team_name: teamMap[data.team_id]?.name || "Unknown Team",
      goals: data.goals,
      assists: 0, // 현재는 계산하지 않음
      matches: 0, // 현재는 계산하지 않음
    }))
    .sort((a, b) => b.goals - a.goals)
    .slice(0, limit);

  return topScorers;
}

export async function fetchHistoricalChampions(leagueId: number): Promise<HistoricalChampion[]> {
  // 과거 시즌 우승팀 조회 (1위 팀들)
  const { data, error } = await supabase
    .from("standings")
    .select(`
      season_year,
      teams!inner(name, logo_url)
    `)
    .eq("league_id", leagueId)
    .eq("rank", 1)
    .order("season_year", { ascending: false })
    .limit(15); // 최근 15년

  if (error) {
    console.warn("Failed to fetch historical champions:", error);
    return [];
  }

  return (data ?? []).map((champion: ChampionWithTeam) => ({
    season_year: Number(champion.season_year),
    champion_name: String(champion.teams[0]?.name || "Unknown"),
    champion_logo: (champion.teams[0]?.logo_url ?? null) as string | null,
  }));
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
      id, name, code, country_name, founded, logo_url,
      venues (name, capacity, city)
    `)
    .eq("id", teamId)
    .maybeSingle();

  if (teamError || !team) return null;

  // 현재 시즌 순위 정보
  const { data: standings } = await supabase
    .from("standings")
    .select("rank, points, played, win, draw, lose, goals_for, goals_against")
    .eq("team_id", teamId)
    .eq("season_year", season)
    .maybeSingle();

  const venue = Array.isArray(team.venues) ? team.venues[0] : team.venues;

  return {
    id: Number(team.id),
    name: String(team.name),
    code: team.code,
    country: String(team.country_name || 'South Korea'),
    founded: team.founded ? Number(team.founded) : null,
    logo_url: team.logo_url,
    venue_name: venue?.name || null,
    venue_capacity: venue?.capacity ? Number(venue.capacity) : null,
    venue_city: venue?.city || null,
    current_position: standings?.rank || null,
    points: standings?.points || null,
    matches_played: standings?.played || null,
    wins: standings?.win || null,
    draws: standings?.draw || null,
    losses: standings?.lose || null,
    goals_for: standings?.goals_for || null,
    goals_against: standings?.goals_against || null,
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
  const recentFixtures = await fetchTeamFixtures(teamId, season, 5);
  const form = recentFixtures
    .slice(0, 5)
    .map(f => f.result)
    .filter(r => r !== null)
    .join('');

  // 홈/원정 기록 계산 (실제 구현시에는 fixtures 데이터에서 계산)
  const homeRecord = { wins: Math.floor(standings.win * 0.6), draws: Math.floor(standings.draw * 0.5), losses: Math.floor(standings.lose * 0.4) };
  const awayRecord = { wins: standings.win - homeRecord.wins, draws: standings.draw - homeRecord.draws, losses: standings.lose - homeRecord.losses };

  return {
    position: Number(standings.rank),
    points: Number(standings.points),
    played: Number(standings.played),
    wins: Number(standings.win),
    draws: Number(standings.draw),
    losses: Number(standings.lose),
    goals_for: Number(standings.goals_for),
    goals_against: Number(standings.goals_against),
    goal_difference: Number(standings.goals_diff),
    clean_sheets: Math.floor(standings.played * 0.3), // 임시 계산
    failed_to_score: Math.floor(standings.played * 0.2), // 임시 계산
    avg_goals_scored: standings.played > 0 ? Number((standings.goals_for / standings.played).toFixed(2)) : 0,
    avg_goals_conceded: standings.played > 0 ? Number((standings.goals_against / standings.played).toFixed(2)) : 0,
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
      name: String(Array.isArray(fixture.home_team) ? fixture.home_team[0]?.name : fixture.home_team?.name || "Unknown"),
      logo_url: Array.isArray(fixture.home_team) ? fixture.home_team[0]?.logo_url : fixture.home_team?.logo_url || null,
    },
    away_team: {
      id: Number(fixture.away_team_id),
      name: String(Array.isArray(fixture.away_team) ? fixture.away_team[0]?.name : fixture.away_team?.name || "Unknown"),
      logo_url: Array.isArray(fixture.away_team) ? fixture.away_team[0]?.logo_url : fixture.away_team?.logo_url || null,
    },
    venue: Array.isArray(fixture.venues) ? fixture.venues[0]?.name : fixture.venues?.name || undefined,
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
      name: String(Array.isArray(fixture.home_team) ? fixture.home_team[0]?.name : fixture.home_team?.name || "Unknown"),
      logo_url: Array.isArray(fixture.home_team) ? fixture.home_team[0]?.logo_url : fixture.home_team?.logo_url || null,
    },
    away_team: {
      id: Number(fixture.away_team_id),
      name: String(Array.isArray(fixture.away_team) ? fixture.away_team[0]?.name : fixture.away_team?.name || "Unknown"),
      logo_url: Array.isArray(fixture.away_team) ? fixture.away_team[0]?.logo_url : fixture.away_team?.logo_url || null,
    },
    venue: Array.isArray(fixture.venues) ? fixture.venues[0]?.name : fixture.venues?.name || undefined,
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
