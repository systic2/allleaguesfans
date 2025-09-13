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

// ---------- API ----------
export async function fetchLeagues(): Promise<LeagueLite[]> {
  // 🔧 tier 컬럼을 선택/정렬에서 제거, 이름순으로 정렬
  const { data, error } = await supabase
    .from("leagues")
    .select("id, slug, name")
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((x) => ({
    id: Number(x.id),
    slug: String(x.slug),
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
      .select("id, name, slug")
      .ilike("name", `%${qq}%`)
      .limit(10),
    supabase
      .from("teams")
      .select("id, name, short_name, crest_url")
      .ilike("name", `%${qq}%`)
      .limit(10)
  ]);

  const rows: SearchRow[] = [];

  for (const x of leagues.data ?? []) {
    rows.push({
      type: "league",
      entity_id: Number(x.id),
      name: String(x.name),
      slug: String(x.slug)
    } as SearchRow);
  }
  for (const t of teams.data ?? []) {
    rows.push({
      type: "team",
      entity_id: Number(t.id),
      team_id: Number(t.id),
      name: String(t.name),
      short_name: (t.short_name ?? null) as string | null,
      crest_url: (t.crest_url ?? null) as string | null
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
  const { data, error } = await supabase
    .from("leagues")
    .select("id, name, slug, country")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: Number(data.id),
    name: String(data.name),
    slug: String(data.slug),
    country: data.country as string | null,
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
      goals_diff,
      form,
      teams!inner(name, short_name, crest_url)
    `)
    .eq("league_id", leagueId)
    .eq("season_year", season)
    .order("rank", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((standing: any) => ({
    team_id: Number(standing.team_id),
    team_name: String(standing.teams.name),
    short_name: (standing.teams.short_name ?? null) as string | null,
    crest_url: (standing.teams.crest_url ?? null) as string | null,
    rank: Number(standing.rank),
    points: Number(standing.points),
    played: Number(standing.played),
    win: Number(standing.win),
    draw: Number(standing.draw),
    lose: Number(standing.lose),
    goals_for: 0, // standings 테이블에 없으면 0으로 처리
    goals_against: 0, // standings 테이블에 없으면 0으로 처리
    goals_diff: Number(standing.goals_diff),
    form: (standing.form ?? null) as string | null,
  }));
}

export async function fetchLeagueTeams(leagueId: number, season: number = 2025): Promise<TeamLite[]> {
  const { data, error } = await supabase
    .from("team_seasons")
    .select(`
      teams!inner(id, name, short_name, crest_url)
    `)
    .eq("league_id", leagueId)
    .eq("season_year", season);

  if (error) throw error;

  return (data ?? []).map((item: any) => ({
    id: Number(item.teams.id),
    name: String(item.teams.name),
    short_name: (item.teams.short_name ?? null) as string | null,
    crest_url: (item.teams.crest_url ?? null) as string | null,
  }));
}
