// scripts/import-standings.ts
import 'dotenv/config'
import { supa } from './lib/supabase'
import { apiGet } from './lib/api-football'

const K1 = Number(process.env.API_FOOTBALL_K1_ID) || undefined
const K2 = Number(process.env.API_FOOTBALL_K2_ID) || undefined
const SEASON = Number(process.env.SEASON_YEAR) || new Date().getFullYear()

async function importStandings(leagueId: number, season: number) {
  console.log(`== Import standings: league=${leagueId} season=${season}`)
  const data = await apiGet('standings', { league: leagueId, season })
  // API는 groups/tiers 구조일 수 있음
  const tables: any[] = data.response?.[0]?.league?.standings?.flat() ?? []
  const rows = tables.map((r: any) => ({
    league_id: leagueId,
    season_year: season,
    team_id: Number(r.team?.id),
    rank: r.rank,
    points: r.points,
    goals_diff: r.goalsDiff,
    played: r.all?.played,
    win: r.all?.win,
    draw: r.all?.draw,
    lose: r.all?.lose,
    form: r.form,
    group_name: r.group || null,
    updated_at: new Date().toISOString()
  }))
  if (rows.length) {
    // upsert by (league_id, season_year, team_id)
    const { error } = await supa.from('standings').upsert(rows, {
      onConflict: 'league_id,season_year,team_id'
    })
    if (error) throw error
  }
}

async function main() {
  if (K1) await importStandings(K1, SEASON)
  if (K2) await importStandings(K2, SEASON)
  console.log('✅ standings imported')
}
main().catch(e => { console.error(e); process.exit(1) })
