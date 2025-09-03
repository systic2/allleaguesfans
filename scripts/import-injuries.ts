// scripts/import-injuries.ts
import 'dotenv/config'
import { supa } from './lib/supabase'
import { apiPaged, apiGet } from './lib/api-football'

const K1 = Number(process.env.API_FOOTBALL_K1_ID)
const K2 = Number(process.env.API_FOOTBALL_K2_ID)
const SEASON = Number(process.env.SEASON_YEAR) || new Date().getFullYear()

function nz(n:any){ return (n??null) as any }

async function importInjuriesByLeague(leagueId:number, season:number){
  // injuries?league=&season=  (리그 단위로 현재/최근 부상 목록)
  const rows = await apiPaged('injuries', { league: leagueId, season })
  const payload = rows.map((r:any)=>({
    player_id: Number(r.player?.id),
    team_id  : Number(r.team?.id),
    league_id: leagueId,
    season_year: season,
    kind: 'injury',
    reason: nz(r.player?.reason || r?.reason),
    start_date: nz(r.player?.since || r?.fixture?.date || null),
    end_date: null,   // API에 종료일 없으면 null
    source: 'injuries',
    updated_at: new Date().toISOString()
  }))
  if (payload.length) {
    // (1) injuries → sidelined upsert
    const { error } = await supa.from('sidelined').upsert(payload, {
      onConflict: 'player_id,kind,start_date_norm,reason_norm'
    })
    if (error) throw error
  }
}

async function importSuspensionsFromSidelinedForSquad(leagueId:number, season:number){
  // 선수 전체에 대해 sideline을 개별 호출하면 비효율 → 스쿼드에 있는 선수만
  const { data: squad, error } = await supa
    .from('squad_memberships')
    .select('player_id,team_id')
    .in('team_id',
      (await supa.from('team_seasons').select('team_id').eq('league_id', leagueId).eq('season_year', season)).data?.map(r=>r.team_id) || []
    )
  if (error) throw error

  // API: sidelined?player=  (선수별 부상/징계 이력)
  for (const row of (squad||[])) {
    const sid = await apiGet('sidelined', { player: row.player_id })
    for (const it of sid.response ?? []) {
      for (const s of it.sidelined ?? []) {
        const kind = /susp/i.test(String(s.type)) ? 'suspension' : 'injury'
        const payload = {
          player_id: Number(it.player?.id),
          team_id  : row.team_id ?? null,
          league_id: leagueId,
          season_year: season,
          kind,
          reason: s?.reason || s?.type || null,
          start_date: s?.start || null,
          end_date: s?.end || null,
          source: 'sidelined',
          updated_at: new Date().toISOString()
        }
        // (2) sidelined?player= → sidelined upsert
        const { error: e2 } = await supa.from('sidelined').upsert([payload], {
          onConflict: 'player_id,kind,start_date_norm,reason_norm'
        })
        if (e2) throw e2
      }
    }
  }
}

async function main(){
  for (const lid of [K1, K2].filter(Boolean) as number[]) {
    await importInjuriesByLeague(lid, SEASON)
    await importSuspensionsFromSidelinedForSquad(lid, SEASON)
  }
  console.log('✅ sidelined (injury/suspension) imported')
}
main().catch(e=>{ console.error(e); process.exit(1) })
