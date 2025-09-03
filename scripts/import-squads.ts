// scripts/import-squads.ts
import 'dotenv/config'
import { supa } from './lib/supabase'
import { apiGet, apiPaged } from './lib/api-football'

const K1 = Number(process.env.API_FOOTBALL_K1_ID) || undefined
const K2 = Number(process.env.API_FOOTBALL_K2_ID) || undefined
const SEASON = Number(process.env.SEASON_YEAR) || new Date().getFullYear()

const normalize = (s?: string) => (s ?? '').toLowerCase().replace(/[\s\-]+/g, '')

async function resolveLeagueIdFromSupabase(slug: 'k-league-1' | 'k-league-2') {
  const { data, error } = await supa.from('leagues').select('id').eq('slug', slug).single()
  if (error || !data) return undefined
  return Number(data.id)
}

async function resolveLeagueIdFromApi(aliases: string[]) {
  // KR 나라명 다양한 표기 대응
  const countryCandidates = ['Korea Republic', 'South Korea']
  const rows: any[] = []
  const seen = new Set<number>()
  for (const c of countryCandidates) {
    const d = await apiGet('leagues', { country: c })
    for (const r of d.response ?? []) {
      if (!seen.has(r.league?.id)) { rows.push(r); seen.add(r.league?.id) }
    }
  }
  if (!rows.length) {
    for (const q of ['K League', 'K-League']) {
      const d = await apiGet('leagues', { search: q })
      for (const r of d.response ?? []) {
        if ((r.country?.code === 'KR' || /korea/i.test(r.country?.name)) && !seen.has(r.league?.id)) {
          rows.push(r); seen.add(r.league?.id)
        }
      }
    }
  }
  const match = rows.find(r => aliases.some(a => {
    const rn = normalize(r.league?.name)
    const an = normalize(a)
    return rn === an || rn.includes(an)
  }))
  return match?.league?.id ? Number(match.league.id) : undefined
}

async function resolveSeason(leagueId: number) {
  // 1) .env 우선
  const env = Number(process.env.SEASON_YEAR)
  if (env) return env
  // 2) Supabase(현재 시즌/최신 시즌)
  const { data } = await supa.from('seasons').select('year,is_current')
    .eq('league_id', leagueId).order('year', { ascending: false }).limit(1)
  if (data?.[0]?.year) return Number(data[0].year)
  // 3) API에서 시즌 목록의 최대값
  const d = await apiGet('leagues', { id: leagueId })
  const years = (d.response?.[0]?.seasons ?? []).map((s: any) => s.year).filter((y: any) => Number.isInteger(y))
  return years.length ? Math.max(...years) : new Date().getFullYear()
}

async function resolveKLeaguesAndSeason() {
  let k1 = Number(process.env.API_FOOTBALL_K1_ID) || undefined
  let k2 = Number(process.env.API_FOOTBALL_K2_ID) || undefined

  if (!k1) k1 = await resolveLeagueIdFromSupabase('k-league-1') || await resolveLeagueIdFromApi(['K League 1', 'K-League 1', 'K League Classic'])
  if (!k2) k2 = await resolveLeagueIdFromSupabase('k-league-2') || await resolveLeagueIdFromApi(['K League 2', 'K-League 2', 'K League Challenge'])

  if (!k1 || !k2) {
    throw new Error('K리그 리그 ID 자동탐색 실패. .env에 API_FOOTBALL_K1_ID / API_FOOTBALL_K2_ID를 넣어주세요.')
  }

  const season = await resolveSeason(k1) // 둘 다 동일 시즌 가정(필요시 k2로 한 번 더 계산)
  return { k1, k2, season }
}


async function getLeagueTeams(leagueId: number, season: number) {
  const data = await apiPaged('teams', { league: leagueId, season })
  return data.map((x: any) => ({ id: Number(x.team.id), name: x.team.name }))
}

async function upsertPlayer(p: any) {
  const height_cm = p.player.height ? Number(String(p.player.height).replace(/\D/g,'')) : null
  const weight_kg = p.player.weight ? Number(String(p.player.weight).replace(/\D/g,'')) : null

  const { error } = await supa.from('players').upsert([{
    id: Number(p.player.id),
    name: p.player.name,
    firstname: p.player.firstname,
    lastname: p.player.lastname,
    nationality: p.player.nationality,
    birth_date: p.player.birth?.date || null,
    height_cm,
    weight_kg,
    foot: p.player?.foot || null,
    photo_url: p.player.photo || null,
    updated_at: new Date().toISOString()
  }], { onConflict: 'id' })
  if (error) throw error
}

async function upsertSquadRow(teamId: number, season: number, p: any) {
  const stats = p.statistics?.[0]?.games
  const position = stats?.position || p.player?.position || null
  const number = p.player?.number || null
  const isCaptain = !!stats?.captain

  const { error } = await supa.from('squad_memberships').upsert([{
    team_id: teamId,
    season_year: season,
    player_id: Number(p.player.id),
    number,
    position,
    is_captain: isCaptain,
    on_loan: null,
    joined_at: null,
    left_at: null
  }], { onConflict: 'team_id,season_year,player_id' })
  if (error) throw error
}

async function importTeamSquad(teamId: number, season: number) {
  // players?team= & season=  (페이지네이션)
  const rows = await apiPaged('players', { team: teamId, season })
  for (const r of rows) {
    await upsertPlayer(r)
    await upsertSquadRow(teamId, season, r)
  }
}

async function importLeague(leagueId: number, season: number) {
  console.log(`== Import squads: league=${leagueId} season=${season}`)
  const teams = await getLeagueTeams(leagueId, season)
  for (const t of teams) {
    console.log(` team ${t.id} ${t.name}`)
    await importTeamSquad(t.id, season)
  }
}

async function main() {
  const { k1, k2, season } = await resolveKLeaguesAndSeason()
  console.log(`== Import squads: K1=${k1}, K2=${k2}, season=${season}`)
  await importLeague(k1, season)
  await importLeague(k2, season)
  console.log('✅ players/squad imported')
}

main().catch(e => { console.error(e); process.exit(1) })
