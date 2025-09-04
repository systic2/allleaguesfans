// src/lib/api.ts
import { supabase } from "./supabaseClient";
import type { League, Team, Player, SearchRow } from "./types";
import { getSeasonId } from "@/features/season/api"; // 시즌 id 조회 재사용

/** 리그 목록 */
export async function fetchLeagues(): Promise<League[]> {
const { data, error } = await supabase
  .from("leagues")
  .select("id,name,country,slug,logo_url,tier") // ← slug,tier 포함
  .order("tier", { ascending: true })
  .order("name");
  if (error) throw error;
  return data as League[];
}

/**
 * (변경) 리그별 팀 목록 — 시즌 참가 팀 기준
 * @param leagueSlug kleague1 | kleague2
 * @param year 기본 2025
 */
export async function fetchTeamsByLeague(
  leagueSlug: string,
  year = 2025
): Promise<Team[]> {
  // 1) 시즌 id 조회
  const seasonId = await getSeasonId(
    (leagueSlug as "kleague1" | "kleague2") ?? "kleague1",
    year
  );

  // 2) 시즌 참가팀 통해 teams 조인
  //    ⚠️ 만약 DB가 team_seasons 테이블이라면 from("season_teams") -> from("team_seasons")로 바꾸세요.
  const { data, error } = await supabase
    .from("season_teams")
    .select("team:teams(*)")
    .eq("season_id", seasonId)
    .order("team->>name");
  if (error) throw error;

  // season_teams의 team 조인 결과만 꺼내서 반환
  return (data ?? []).map((r: any) => r.team) as Team[];
}

/** 팀 소속 선수 (스키마에 players 테이블 있는 경우 그대로 사용) */
export async function fetchPlayersByTeam(teamId: string, season = 2025) {
  const { data, error } = await supabase
    .from("v_squad_current")
    .select("player_id,name,nationality,photo_url,position,number,team_id,team_name,season_year,players!inner(birth_date)")
    .eq("team_id", teamId)
    .eq("season_year", season)
    .order("position", { ascending: true });
  if (error) throw error;
  // UI에서 쓰기 좋게 매핑
  return (data ?? []).map((r: any) => ({
    id: r.player_id,
    name: r.name,
    nationality: r.nationality,
    position: r.position,
    photo: r.photo_url,
    team_name: r.team_name,
    birth_date: r.players?.birth_date ?? null,
  })) as Player[]; // Player 타입에 birth_date?/team_name?가 추가되어 있으면 더 깔끔
}

/** 선수 상세 */
export async function fetchPlayer(playerId: string): Promise<Player> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .single();
  if (error) throw error;
  return data as Player;
}

/**
 * (변경) 이름 검색 — 리그 + 시즌 참가팀 동시 검색
 * 기존 search_index 뷰 사용을 제거하고, leagues / v_season_team_search를 직접 조회합니다.
 * SearchRow는 { type, entity_id, ... } 형태로 매핑합니다.
 */
export async function searchByName(q: string): Promise<SearchRow[]> {
  const keyword = q.trim();
  if (!keyword) return [];

  // 1) 리그 검색
  const leaguesReq = supabase
    .from("leagues")
    .select("id, slug, name, tier, country")
    .ilike("name", `%${keyword}%`)
    .limit(5);

  // 2) 팀 검색 (시즌 제한 없음: 뷰에서 모든 시즌 팀을 대상으로)
  //    특정 시즌으로 제한하고 싶다면 seasonId를 eq로 넘겨주세요.
  const teamsReq = supabase
    .from("v_season_team_search")
    .select("season_id, team_id, team_name, team_short_name, crest_url")
    .or(`team_name.ilike.%${keyword}%,team_short_name.ilike.%${keyword}%`)
    .limit(10);

  const [{ data: leagues, error: e1 }, { data: teams, error: e2 }] =
    await Promise.all([leaguesReq, teamsReq]);
  if (e1) throw e1;
  if (e2) throw e2;

  // ✅ SearchRow 규격에 맞게 매핑
  const leagueRows: SearchRow[] = (leagues ?? []).map((l: any) => ({
  type: "league",
  entity_id: Number(l.id),
  name: l.name,
  slug: l.slug,
  tier: l.tier ?? null,
  country: l.country ?? null,
}));

const teamRows: SearchRow[] = (teams ?? []).map((t: any) => ({
  type: "team",
  entity_id: Number(t.team_id),
  name: t.team_name,
  team_id: Number(t.team_id),
  season_id: t.season_id ? Number(t.season_id) : undefined,
  short_name: t.team_short_name ?? null,
  crest_url: t.crest_url ?? null,
}));


  // 리그 우선 → 팀
  return [...leagueRows, ...teamRows];
}
