// src/domain/types.ts
export interface League { id: string; name: string; country?: string; logo?: string }
export interface Team   { id: string; name: string; shortName?: string; logo?: string; founded?: number }
export interface Player { id: string; name: string; position?: string; nationality?: string; photo?: string }

export interface FootballApi {
  getLeagues(countryCode?: string): Promise<League[]>
  getTeamsByLeague(leagueId: string, season?: string | number): Promise<Team[]>
  getPlayersByTeam(teamId: string, season?: string | number): Promise<Player[]>
}
