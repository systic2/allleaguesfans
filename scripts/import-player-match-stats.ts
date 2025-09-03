// scripts/import-player-match-stats.ts
import 'dotenv/config'
import { supa } from './lib/supabase'
import { apiPaged, apiGet } from './lib/api-football'

const K1 = Number(process.env.API_FOOTBALL_K1_ID)
const K2 = Number(process.env.API_FOOTBALL_K2_ID)
const SEASON = Number(process.env.SEASON_YEAR) || new Date().getFullYear()

function nz(n:any){ return (n??null) as any }

function projectStat(ps: any) {
  const s = ps.statistics?.[0] || {}
  const g = s.goals||{}, sh=s.shots||{}, p=s.passes||{}, t=s.tackles||{}, d=s.dribbles||{}, du=s.duels||{}, f=s.fouls||{}, c=s.cards||{}, pen=s.penalty||{}, gm=s.games||{}
  return {
    number     : nz(ps.player?.number),
    position   : nz(gm?.position || ps.player?.pos),
    is_captain : !!gm?.captain,
    substitute : !!gm?.substitute,
    minutes    : nz(gm?.minutes),
    rating     : gm?.rating ? Number(gm.rating) : null,
    goals      : nz(g.total),
    assists    : nz(g.assists),
    shots_total: nz(sh.total),
    shots_on   : nz(sh.on),
    passes_total: nz(p.total),
    passes_acc : nz(p.accuracy ? Number(String(p.accuracy).replace('%','')) : null),
    key_passes : nz(p.key),
    tackles    : nz(t.total),
    interceptions: nz(t.interceptions),
    dribbles_attempts: nz(d.attempts),
    dribbles_success : nz(d.success),
    duels_total: nz(du.total),
    duels_won  : nz(du.won),
    fouls_drawn: nz(f.drawn),
    fouls_committed: nz(f.commited ?? f.committed),
    yellow     : nz(c.yellow),
    red        : nz(c.red),
    pen_scored : nz(pen.scored),
    pen_missed : nz(pen.missed),
    pen_won    : nz(pen.won),
    pen_committed: nz(pen.commited ?? pen.committed),
    gk_saves   : nz(s.goals?.saves),
    goals_conceded: nz(s.goals?.conceded),
    clean_sheets  : nz((s.goals?.conceded===0)?1:null)
  }
}

async function getFixtures(leagueId:number, season:number){
  return await apiPaged('fixtures',{ league: leagueId, season })
}

async function importFixture(fx:any){
  const fixtureId = Number(fx.fixture.id)
  const data = await apiGet('fixtures/players', { fixture: fixtureId })
  for (const side of data.response ?? []) {
    const teamId = Number(side.team?.id)
    for (const ps of side.players ?? []) {
      const row = {
        fixture_id: fixtureId,
        team_id: teamId,
        player_id: Number(ps.player?.id),
        ...projectStat(ps)
      }
      const { error } = await supa.from('player_match_stats').upsert([row], {
        onConflict: 'fixture_id,player_id'
      })
      if (error) throw error
    }
  }
}

async function importLeague(leagueId:number, season:number){
  const fixtures = await getFixtures(leagueId, season)
  for (const fx of fixtures) {
    await importFixture(fx)
  }
}

async function main(){
  if (K1) await importLeague(K1, SEASON)
  if (K2) await importLeague(K2, SEASON)
  console.log('✅ player_match_stats imported')
}
main().catch(e=>{ console.error(e); process.exit(1) })
