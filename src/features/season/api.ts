// src/features/season/api.ts
import { supabase } from "@/lib/supabaseClient";

export type TeamLite = {
  id: number;
  name: string;
  short_name: string | null;
  crest_url: string | null;
};
export type LeagueLite = {
  id: number;
  slug: string;
  name: string;
  tier: number | null;
};
export type SeasonLite = {
  id: number;
  league_id: number;
  year: number;
  is_current: boolean | null;
};
export type LeagueTableRow = {
  team: TeamLite;
  played: number;
  win: number;
  draw: number;
  loss: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  form: string;
  position: number;
};

function coerceInt(v: unknown, fb = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fb;
}
function asTeamLite(input: any): TeamLite | null {
  const pick = (val: any): TeamLite | null =>
    val
      ? {
          id: coerceInt(val.id),
          name: String(val.name ?? ""),
          short_name: (val.short_name ?? null) as string | null,
          crest_url: (val.crest_url ?? null) as string | null
        }
      : null;
  return Array.isArray(input) ? (input[0] ? pick(input[0]) : null) : pick(input);
}

// ----- 리그/시즌 -----
export async function getLeagueBySlug(slug: string): Promise<LeagueLite | null> {
  if (!slug) return null;
  // 🔧 tier 제거
  const { data, error } = await supabase
    .from("leagues")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: coerceInt(data.id), slug: data.slug, name: data.name, tier: null };
}

export async function getSeasonByLeagueSlug(leagueSlug: string, year?: number): Promise<SeasonLite | null> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return null;

  if (typeof year === "number") {
    const { data, error } = await supabase
      .from("seasons")
      .select("id, league_id, year, is_current")
      .eq("league_id", league.id)
      .eq("year", year)
      .maybeSingle();
    if (error) throw error;
    return data
      ? { id: coerceInt(data.id), league_id: coerceInt(data.league_id), year: coerceInt(data.year), is_current: data.is_current ?? null }
      : null;
  }

  const current = await supabase
    .from("seasons")
    .select("id, league_id, year, is_current")
    .eq("league_id", league.id)
    .eq("is_current", true)
    .maybeSingle();
  if (current.error) throw current.error;
  if (current.data) {
    return {
      id: coerceInt(current.data.id),
      league_id: coerceInt(current.data.league_id),
      year: coerceInt(current.data.year),
      is_current: current.data.is_current ?? null
    };
  }

  const latest = await supabase
    .from("seasons")
    .select("id, league_id, year, is_current")
    .eq("league_id", league.id)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest.error) throw latest.error;
  return latest.data
    ? { id: coerceInt(latest.data.id), league_id: coerceInt(latest.data.league_id), year: coerceInt(latest.data.year), is_current: latest.data.is_current ?? null }
    : null;
}

// ----- 시즌 팀 -----
export async function fetchSeasonTeams(leagueSlug: string, year?: number): Promise<TeamLite[]> {
  const season = await getSeasonByLeagueSlug(leagueSlug, year);
  if (!season) return [];
  const { data, error } = await supabase
    .from("season_teams")
    .select(
      `
      team:teams (
        id, name, short_name, crest_url
      )
    `
    )
    .eq("season_id", season.id);
  if (error) throw error;
  const rows = (data ?? []).map((r: any) => asTeamLite(r.team)).filter((t): t is TeamLite => !!t);
  rows.sort((a, b) => a.name.localeCompare(b.name, "en"));
  return rows;
}

// ----- 순위표 -----
export async function fetchLeagueTable(leagueSlug: string, year?: number): Promise<LeagueTableRow[]> {
  const season = await getSeasonByLeagueSlug(leagueSlug, year);
  if (!season) return [];
  const { data, error } = await supabase
    .from("standings")
    .select(
      `
      played, win, draw, loss, gf, ga, points, form,
      team:teams ( id, name, short_name, crest_url )
    `
    )
    .eq("season_id", season.id);
  if (error) throw error;
  const rows = (data ?? [])
    .map((r: any) => {
      const team = asTeamLite(r.team);
      if (!team) return null;
      const played = coerceInt(r.played);
      const win = coerceInt(r.win);
      const draw = coerceInt(r.draw);
      const loss = coerceInt(r.loss);
      const gf = coerceInt(r.gf);
      const ga = coerceInt(r.ga);
      const points = coerceInt(r.points);
      const form = (typeof r.form === "string" ? r.form : "") || "";
      return { team, played, win, draw, loss, gf, ga, gd: gf - ga, points, form, position: 0 } as LeagueTableRow;
    })
    .filter((x): x is LeagueTableRow => !!x);
  rows.sort((a, b) => (b.points - a.points) || (b.gd - a.gd) || (b.gf - a.gf));
  rows.forEach((r, i) => (r.position = i + 1));
  return rows;
}

// ====== 과거 함수명/시그니처 호환 ======
export async function getSeasonId(leagueSlug: string, year?: number): Promise<number | null> {
  const s = await getSeasonByLeagueSlug(leagueSlug, year);
  return s?.id ?? null;
}
export async function listLeagueTable(leagueSlug: string, year?: number) {
  return fetchLeagueTable(leagueSlug, year);
}
export async function searchLeagues(q: string, limit = 20): Promise<LeagueLite[]> {
  // 🔧 tier 제거
  const { data, error } = await supabase
    .from("leagues")
    .select("id, slug, name")
    .ilike("name", `%${q}%`)
    .order("name", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((x: any) => ({ id: coerceInt(x.id), slug: String(x.slug), name: String(x.name), tier: null }));
}

// 오버로드: (seasonId, q, limit?) | (leagueSlug, year, q, limit?)
export async function searchTeamsInSeason(seasonId: number, q: string, limit?: number): Promise<TeamLite[]>;
export async function searchTeamsInSeason(leagueSlug: string, year: number, q: string, limit?: number): Promise<TeamLite[]>;
export async function searchTeamsInSeason(a: number | string, b: number | string, c?: string | number, d?: number): Promise<TeamLite[]> {
  // 형태 1: (seasonId:number, q:string, limit?)
  if (typeof a === "number" && typeof b === "string") {
    const seasonId = a;
    const q = b.toLowerCase();
    const lim = typeof c === "number" ? c : d ?? 50;

    const { data, error } = await supabase
      .from("season_teams")
      .select(`team:teams ( id, name, short_name, crest_url )`)
      .eq("season_id", seasonId);
    if (error) throw error;
    const rows = (data ?? [])
      .map((r: any) => asTeamLite(r.team))
      .filter((t): t is TeamLite => !!t)
      .filter((t) => t.name.toLowerCase().includes(q) || (t.short_name ?? "").toLowerCase().includes(q))
      .slice(0, lim);
    return rows;
  }

  // 형태 2: (leagueSlug:string, year:number, q:string, limit?)
  if (typeof a === "string" && typeof b === "number") {
    const leagueSlug = a;
    const year = b;
    const q = (typeof c === "string" ? c : "").toLowerCase();
    const lim = (typeof c === "number" ? c : d) ?? 50;

    const teams = await fetchSeasonTeams(leagueSlug, year);
    return teams.filter((t) => t.name.toLowerCase().includes(q) || (t.short_name ?? "").toLowerCase().includes(q)).slice(0, lim);
  }

  return [];
}
