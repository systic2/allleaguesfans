// src/data/apiFootballAdapter.ts
// API-FOOTBALL 어댑터 (필요 필드만 최소 타입으로 매핑)

import { getJson } from "@/lib/api";
// domain/types가 존재한다고 전제하고 필요한 타입만 import
import type { League, Team /* , Player */ } from "@/domain/types";

const API_KEY = import.meta.env.VITE_API_FOOTBALL_KEY as string | undefined;
const API_BASE = "https://v3.football.api-sports.io";

if (!API_KEY) {
  // 런타임에서 친절히 경고 (빌드 실패 X)
   
  console.warn("[apiFootballAdapter] VITE_API_FOOTBALL_KEY is not set.");
}

// 우리가 실제 사용하는 필드만 정의 (불필요 필드는 생략)
type ApiLeagueItem = {
  league: { id: number; name: string; logo?: string | null };
  country: { name: string; code?: string | null; flag?: string | null };
};

type ApiTeamItem = {
  team: { id: number; name: string; logo?: string | null };
};

function authHeaders() {
  return {
    headers: {
      "x-apisports-key": API_KEY ?? "",
      Accept: "application/json"
    }
  };
}

export const apiFootballAdapter = {
  // 국가명으로 리그 목록
  async getLeagues(country: string): Promise<League[]> {
    // https://www.api-football.com/documentation-v3#tag/Leagues/operation/get-leagues
    const url = new URL(`${API_BASE}/leagues`);
    if (country) url.searchParams.set("country", country);

    const json = await getJson<{ response: ApiLeagueItem[] }>(url.toString(), authHeaders());
    return json.response.map((x) => ({
      id: Number(x.league.id),
      name: x.league.name,
      country: x.country.name,
      logo: x.league.logo ?? null
    })) as League[];
  },

  // 리그 ID로 팀 목록 (시즌은 최신 자동 선택 or 필요시 인자로 확장)
  async getTeams(leagueId: number, season?: number): Promise<Team[]> {
    // https://www.api-football.com/documentation-v3#tag/Teams/operation/get-teams
    const url = new URL(`${API_BASE}/teams`);
    url.searchParams.set("league", String(leagueId));
    if (season) url.searchParams.set("season", String(season));

    const json = await getJson<{ response: ApiTeamItem[] }>(url.toString(), authHeaders());
    return json.response.map((x) => ({
      id: Number(x.team.id),
      name: x.team.name,
      logo: x.team.logo ?? null
    })) as Team[];
  }
  // 필요시 players API 추가 가능
};
