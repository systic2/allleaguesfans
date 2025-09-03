// scripts/import-fixtures.ts
import 'dotenv/config'
import { supa } from './lib/supabase'
import { apiGet, apiPaged } from './lib/api-football'

const K1 = Number(process.env.API_FOOTBALL_K1_ID) || undefined
const K2 = Number(process.env.API_FOOTBALL_K2_ID) || undefined
const SEASON = Number(process.env.SEASON_YEAR) || new Date().getFullYear()

async function upsertFixture(f: any, leagueId: number, season: number) {
  const s = f.score || {}
  const ht = s.halftime || {}, ft = s.fulltime || {}, et = s.extratime || {}, pen = s.penalty || {}

  const row = {
    id: Number(f.fixture.id),
    league_id: leagueId,
    season_year: season,
    round: f.league?.round || null,
    kickoff_utc: f.fixture?.date || null,
    status_short: f.fixture?.status?.short || null,
    status_long: f.fixture?.status?.long || null,
    elapsed: f.fixture?.status?.elapsed ?? null,
    venue: f.fixture?.venue?.name || null,
    referee: f.fixture?.referee || null,
    home_team_id: Number(f.teams?.home?.id),
    away_team_id: Number(f.teams?.away?.id),
    goals_home: f.goals?.home ?? null,
    goals_away: f.goals?.away ?? null,
    ht_home: ht.home ?? null, ht_away: ht.away ?? null,
    ft_home: ft.home ?? null, ft_away: ft.away ?? null,
    et_home: et.home ?? null, et_away: et.away ?? null,
    pk_home: pen.home ?? null, pk_away: pen.away ?? null,
    updated_at: new Date().toISOString()
  }

  const { error } = await supa.from('fixtures').upsert([row], { onConflict: 'id' })
  if (error) throw error
}

async function importLineups(fixtureId: number) {
  const data = await apiGet('fixtures/lineups', { fixture: fixtureId })
  for (const L of data.response ?? []) {
    const teamId = Number(L.team?.id)
    const { error: e1 } = await supa.from('lineups').upsert([{
      fixture_id: fixtureId, team_id: teamId,
      formation: L.formation || null,
      coach_name: L.coach?.name || null,
      updated_at: new Date().toISOString()
    }], { onConflict: 'fixture_id,team_id' })
    if (e1) throw e1

    const players: any[] = [...(L.startXI ?? []).map((x: any) => ({ ...x, substitute: false })), ...(L.substitutes ?? []).map((x: any) => ({ ...x, substitute: true }))]
    for (const P of players) {
      const pp = P.player || {}
      const { error: e2 } = await supa.from('lineup_players').upsert([{
        fixture_id: fixtureId, team_id: teamId, player_id: Number(pp.id),
        number: pp.number ?? null,
        position: pp.pos || pp.position || null,
        grid: pp.grid || null,
        is_captain: !!pp.captain,
        substitute: !!P.substitute,
        minutes: null, rating: pp.rating ? Number(pp.rating) : null
      }], { onConflict: 'fixture_id,team_id,player_id' })
      if (e2) throw e2
    }
  }
}

async function importEvents(fixtureId: number) {
  const data = await apiGet('fixtures/events', { fixture: fixtureId })
  const rows = (data.response ?? []).map((E: any) => ({
    fixture_id: fixtureId,
    team_id: Number(E.team?.id),
    player_id: E.player?.id ? Number(E.player.id) : null,
    assist_id: E.assist?.id ? Number(E.assist.id) : null,
    type: E.type || null,
    detail: E.detail || null,
    comments: E.comments || null,
    minute: E.time?.elapsed ?? null,
    extra_minute: E.time?.extra ?? null
  }))
  if (rows.length) {
    const { error } = await supa.from('events').insert(rows, { returning: 'minimal' })
    if (error) throw error
  }
}

async function importLeagueFixtures(leagueId: number, season: number) {
  console.log(`== Import fixtures: league=${leagueId} season=${season}`)
  const fixtures = await apiPaged('fixtures', { league: leagueId, season })
  for (const f of fixtures) {
    await upsertFixture(f, leagueId, season)
    const id = Number(f.fixture.id)
    await importLineups(id)
    await importEvents(id)
  }
}

async function main() {
  if (!K1 && !K2) throw new Error('API_FOOTBALL_K1_ID / K2_ID 필요')
  if (K1) await importLeagueFixtures(K1, SEASON)
  if (K2) await importLeagueFixtures(K2, SEASON)
  console.log('✅ fixtures/lineups/events imported')
}
main().catch(e => { console.error(e); process.exit(1) })
