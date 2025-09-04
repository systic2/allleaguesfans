// src/lib/api.ts
import { supabase } from "@/lib/supabaseClient";
import type { SearchRow } from "@/lib/types";

// ---------- 공통 fetch 유틸 ----------
export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

export async function postJson<Req, Res>(
  url: string,
  body: Req,
  init?: RequestInit
): Promise<Res> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    body: JSON.stringify(body),
    ...init
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
  return (await r.json()) as Res;
}

// ---------- 도메인 라이트 타입 ----------
export type LeagueLite = { id: number; slug: string; name: string; tier: number | null };
export type TeamLite = { id: number; name: string; short_name: string | null; crest_url: string | null };
export type PlayerLite = { id: number; name: string; position: string | null; photo_url: string | null; team_id: number | null };

// ---------- API ----------
export async function fetchLeagues(): Promise<LeagueLite[]> {
  const { data, error } = await supabase
    .from("leagues")
    .select("id, slug, name, tier")
    .order("tier", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((x: any) => ({
    id: Number(x.id),
    slug: String(x.slug),
    name: String(x.name),
    tier: x.tier ?? null
  }));
}

export async function fetchPlayersByTeam(teamId: number): Promise<PlayerLite[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, name, position, photo_url, team_id")
    .eq("team_id", teamId)
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
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
      team_id: Number(t.id), // 🔐 프로젝트 타입과 호환
      name: String(t.name),
      short_name: (t.short_name ?? null) as string | null,
      crest_url: (t.crest_url ?? null) as string | null
    } as SearchRow);
  }

  return rows;
}
