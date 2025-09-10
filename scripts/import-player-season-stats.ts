// scripts/import-player-season-stats.ts
import 'dotenv/config'
import { supa } from './lib/supabase'
import { apiPaged } from './lib/api-football'

const K1 = Number(process.env.API_FOOTBALL_K1_ID)
const K2 = Number(process.env.API_FOOTBALL_K2_ID)
const SEASON = Number(process.env.SEASON_YEAR) || new Date().getFullYear()

function nz(n: any) { return (n ?? null) as any }
function takeStats(s: any) {
  const g = s?.goals || {}, sh = s?.shots || {}, p = s?.passes || {}, t = s?.tackles || {}
  const d = s?.dribbles || {}, du = s?.duels || {}, f = s?.fouls || {}, c = s?.cards || {}
  const pen = s?.penalty || {}, gm = s?.games || {}, _gk = s?.goals || {}
  return {
    position    : nz(gm?.position),
    apps        : nz(gm?.appearences),
    lineups     : nz(gm?.lineups),
    minutes     : nz(gm?.minutes),
    rating_avg  : gm?.rating ? Number(gm.rating) : null,
    goals       : nz(g.total),
    assists     : nz(g.assists),
    shots_total : nz(sh.total),
    shots_on    : nz(sh.on),
    key_passes  : nz(p?.key),
    passes_total: nz(p?.total),
    passes_acc  : nz(p?.accuracy ? Number(String(p.accuracy).replace('%','')) : null),
    tackles     : nz(t?.total),
    interceptions: nz(t?.interceptions),
    dribbles_attempts: nz(d?.attempts),
    dribbles_success : nz(d?.success),
    duels_total : nz(du?.total),
    duels_won   : nz(du?.won),
    fouls_drawn : nz(f?.drawn),
    fouls_committed: nz(f?.commited ?? f?.committed),
    yellow      : nz(c?.yellow),
    red         : nz(c?.red),
    pen_scored  : nz(pen?.scored),
    pen_missed  : nz(pen?.missed),
    pen_won     : nz(pen?.won),
    pen_committed: nz(pen?.commited ?? pen?.committed),
    gk_saves    : nz(s?.goals?.saves),
    goals_conceded: nz(s?.goals?.conceded),
    clean_sheets: nz(s?.goals?.conceded === 0 ? 1 : null) //-- 단순 파생치(없으면 null)
  }
}

async function getTeams(leagueId: number, season: number) {
  const rows = await apiPaged('teams', { league: leagueId, season })
  return rows.map((x: any) => ({ id: Number(x.team.id) }))
}

async function importLeague(leagueId: number, season: number) {
  const teams = await getTeams(leagueId, season)
  for (const t of teams) {
    // players?team=&season=  (통계 포함)
    const plist = await apiPaged('players', { team: t.id, season })
    const rows = []
    for (const r of plist) {
      const s = r.statistics?.[0]
      if (!s) continue
      const base = takeStats(s)
      rows.push({
        player_id: Number(r.player.id),
        league_id: leagueId,
        season_year: season,
        team_id: t.id,
        ...base,
        updated_at: new Date().toISOString()
      })
    }
    if (rows.length) {
      const { error } = await supa.from('player_season_stats').upsert(rows, {
        onConflict: 'player_id,league_id,season_year,team_id'
      })
      if (error) throw error
    }
  }
}

async function main() {
  if (K1) await importLeague(K1, SEASON)
  if (K2) await importLeague(K2, SEASON)
  console.log('✅ player_season_stats imported')
}
main().catch(e => { console.error(e); process.exit(1) })
