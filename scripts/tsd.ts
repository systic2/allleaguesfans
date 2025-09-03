// scripts/tsd.ts
import 'dotenv/config';
const KEY = process.env.THESPORTSDB_KEY || '3';
const V1 = `https://www.thesportsdb.com/api/v1/json/${KEY}`;

export type TsdTeam = {
  idTeam: string; strTeam: string; strAlternate?: string;
  strCountry?: string; strLeague?: string;
  strTeamBadge?: string; strTeamLogo?: string;
};

export async function listTeamsByLeagueName(leagueName: string): Promise<TsdTeam[]> {
  // 리그 "정확한" 이름으로 조회 (예: "South Korean K League 1")
  const r = await fetch(`${V1}/search_all_teams.php?l=${encodeURIComponent(leagueName)}`);
  const j = await r.json();
  return j?.teams ?? [];
}

export async function listTeamsByLeagueId(leagueId: number): Promise<TsdTeam[]> {
  const r = await fetch(`${V1}/lookup_all_teams.php?id=${leagueId}`);
  const j = await r.json();
  return j?.teams ?? [];
}

export function pickBadge(t: TsdTeam): string | null {
  const url = t.strTeamBadge || t.strTeamLogo || '';
  return url ? url.replace(/^http:/, 'https:') : null;
}
