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
  }[];
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
  const { data, error } = await supabase
    .from("players")
    .select("id, name, position, photo_url, team_id")
    .eq("team_id", teamId)
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: Number(p.id),
    name: String(p.name),
    position: (p.position ?? null) as string | null,
    photo_url: (p.photo_url ?? null) as string | null,
    team_id: p.team_id == null ? null : Number(p.team_id)
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

  return (data ?? []).map((standing: StandingWithTeam) => ({
    team_id: Number(standing.team_id),
    team_name: String(standing.teams[0]?.name || "Unknown"),
    short_name: (standing.teams[0]?.code ?? null) as string | null,
    crest_url: (standing.teams[0]?.logo_url ?? null) as string | null,
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
