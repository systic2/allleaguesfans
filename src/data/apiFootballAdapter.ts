// src/data/apiFootballAdapter.ts
import type { League, Team, Player } from "@/domain/types";
import { apiGet, apiPaged } from "@/../scripts/lib/api-football"; // 실제 경로에 맞게
// 필요시 위 import는 제거하고 fetch 로직 직접 포함

// 이 파일 내에서만 쓰는 인터페이스
interface FootballApiAdapter {
  getLeagues(country: string): Promise<League[]>;
  getTeamsByLeague(leagueId: number, season: number): Promise<Team[]>;
  getPlayersByTeam(teamId: number, season: number): Promise<Player[]>;
}

export const apiFootballAdapter: FootballApiAdapter = {
  async getLeagues(country: string) {
    const data: any = await apiGet("leagues", { country });
    return (data.response ?? []).map((x: any) => ({
      id: Number(x.league.id),
      name: x.league.name,
      country: x.country?.name ?? null,
      slug: undefined, // 필요시 매핑
      tier: undefined,
      logo: x.league?.logo ?? undefined,
    })) as League[];
  },

  async getTeamsByLeague(leagueId: number, season: number) {
    const rows: any[] = await apiPaged("teams", { league: leagueId, season });
    return rows.map((x: any) => ({
      id: Number(x.team.id),
      name: x.team.name,
      shortName: x.team.code ?? undefined,
      logo: x.team.logo ?? undefined,
      founded: x.team.founded ?? null,
    })) as Team[];
  },

  async getPlayersByTeam(teamId: number, season: number) {
    const rows: any[] = await apiPaged("players", { team: teamId, season });
    return rows.map((x: any) => ({
      id: Number(x.player.id),
      name: x.player.name,
      nationality: x.player.nationality ?? undefined,
      position: x.statistics?.[0]?.games?.position ?? undefined,
      photo: x.player.photo ?? undefined,
      birth_date: x.player.birth?.date ?? null,
      height_cm: x.player.height
        ? Number(String(x.player.height).replace(/\D/g, ""))
        : null,
      weight_kg: x.player.weight
        ? Number(String(x.player.weight).replace(/\D/g, ""))
        : null,
      foot: x.player.foot ?? null,
    })) as Player[];
  },
};
