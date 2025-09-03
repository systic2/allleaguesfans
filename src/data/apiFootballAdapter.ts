// src/data/apiFootballAdapter.ts
import type { FootballApi, League, Team, Player } from "@/domain/types"

const API = "https://v3.football.api-sports.io"
const KEY = process.env.API_FOOTBALL_KEY!
if (!KEY) throw new Error("Missing API_FOOTBALL_KEY")

async function req(path: string, params: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null) as [string, string][]
  )
  const r = await fetch(`${API}/${path}?${qs}`, {
    headers: { "x-apisports-key": KEY }
  })
  if (!r.ok) {
    const msg = await r.text().catch(() => "")
    throw new Error(`API-FOOTBALL ${r.status} ${r.statusText} ${msg}`)
  }
  return r.json()
}

export const apiFootball: FootballApi = {
  async getLeagues(country) {
    const data = await req("leagues", { country })
    return (data.response ?? []).map((x: any): League => ({
      id: String(x.league.id),
      name: x.league.name,
      country: x.country?.name,
      logo: x.league?.logo
    }))
  },

  async getTeamsByLeague(leagueId, season) {
    const data = await req("teams", { league: leagueId, season })
    return (data.response ?? []).map((x: any): Team => ({
      id: String(x.team.id),
      name: x.team.name,
      shortName: x.team.code,
      logo: x.team.logo,
      founded: x.team.founded
    }))
  },

  async getPlayersByTeam(teamId, season) {
    const data = await req("players", { team: teamId, season })
    return (data.response ?? []).map((x: any): Player => ({
      id: String(x.player.id),
      name: x.player.name,
      position: x.statistics?.[0]?.games?.position,
      nationality: x.player.nationality,
      photo: x.player.photo
    }))
  }
}
