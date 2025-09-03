// src/features/season/api.ts
import { supabase } from "@/lib/supabaseClient"; // ← 요청하신 대로 경로/형태 변경

// ==== 타입 ====
export type TeamLite = {
  id: string;
  name: string;
  short_name: string | null;
  crest_url: string | null;
};

export type LeagueLite = {
  id: string;
  slug: string;
  name: string;
  tier: number | null;
  country: string | null;
};

export type LeagueTableRow = {
  season_id: string;
  position: number;
  team_id: string;
  team_name: string;
  crest_url: string | null;
  played: number;
  win: number;
  draw: number;
  loss: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  form: string | null;
};

// ==== 공통 유틸 ====
export async function getSeasonId(
  leagueSlug: "kleague1" | "kleague2",
  year = 2025
): Promise<string> {
  const { data: lg, error: e1 } = await supabase
    .from("leagues")
    .select("id")
    .eq("slug", leagueSlug)
    .single();
  if (e1 || !lg) throw new Error(`league not found: ${leagueSlug}`);

  const { data: ss, error: e2 } = await supabase
    .from("seasons")
    .select("id")
    .eq("league_id", lg.id)
    .eq("year", year)
    .single();
  if (e2 || !ss) throw new Error(`season not found: ${leagueSlug} ${year}`);

  return ss.id;
}

// ==== 시즌 참가팀 목록 ====
export async function listTeamsBySeason(seasonId: string): Promise<TeamLite[]> {
  const { data, error } = await supabase
    .from("season_teams")
    .select("team:teams(id,name,short_name,crest_url)")
    .eq("season_id", seasonId)
    .order("team->>name");
  if (error) throw error;
  return (data ?? []).map((r: any) => r.team as TeamLite);
}

// ==== 시즌 내 팀 검색(뷰 기반) ====
export async function searchTeamsInSeason(
  seasonId: string,
  q: string,
  limit = 10
): Promise<TeamLite[]> {
  const pattern = `%${q}%`;
  const { data, error } = await supabase
    .from("v_season_team_search")
    .select("team_id, team_name, team_short_name, crest_url")
    .eq("season_id", seasonId)
    .or(`team_name.ilike.${pattern},team_short_name.ilike.${pattern}`)
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.team_id,
    name: r.team_name,
    short_name: r.team_short_name || null,
    crest_url: r.crest_url ?? null,
  }));
}

// ==== 리그 검색 ====
export async function searchLeagues(q: string, limit = 5): Promise<LeagueLite[]> {
  const { data, error } = await supabase
    .from("leagues")
    .select("id, slug, name, tier, country")
    .ilike("name", `%${q}%`)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ==== 리그 테이블 조회(뷰 우선, 폴백 지원) ====
export async function listLeagueTable(seasonId: string): Promise<LeagueTableRow[]> {
  // 1) 뷰 사용
  const v = await supabase
    .from("v_league_table")
    .select("*")
    .eq("season_id", seasonId)
    .order("position", { ascending: true });

  if (!v.error && v.data && v.data.length) {
    return v.data as unknown as LeagueTableRow[];
  }

  // 2) 폴백: standings + teams 조인 후 정렬/순위 부여
  const fb = await supabase
  .from("standings")
  .select(`
    season_id, team_id, played, win, draw, loss, gf, ga, points, form,
    team:teams!inner(id,name,crest_url)
  `)
  .eq("season_id", seasonId);

  if (fb.error) throw fb.error;

  const rows = (fb.data ?? []).map((r: any) => ({
    season_id: r.season_id,
    position: 0,
    team_id: r.team_id,
    team_name: r.team?.name ?? "",
    crest_url: r.team?.crest_url ?? null,
    played: r.played ?? 0,
    win: r.win ?? 0,
    draw: r.draw ?? 0,
    loss: r.loss ?? 0,
    gf: r.gf ?? 0,
    ga: r.ga ?? 0,
    gd: (r.gf ?? 0) - (r.ga ?? 0),
    points: r.points ?? 0,
    form: r.form ?? "",
  })) as LeagueTableRow[];

  rows.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  rows.forEach((r, i) => (r.position = i + 1));
  return rows;
}
