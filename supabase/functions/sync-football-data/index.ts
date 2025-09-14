// supabase/functions/sync-football-data/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncRequest {
  type: 'fixtures' | 'standings' | 'squads' | 'full'
  season?: number
  league?: number
}

async function apiGet(path: string, params: Record<string, any> = {}) {
  const API_KEY = Deno.env.get('API_FOOTBALL_KEY')!
  const API_BASE = 'https://v3.football.api-sports.io'
  
  const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v != null) as any)
  const response = await fetch(`${API_BASE}/${path}?${qs}`, {
    headers: { 'x-apisports-key': API_KEY }
  })
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`)
  }
  
  return await response.json()
}

async function syncFixtures(supabase: any, leagueId: number, season: number) {
  console.log(`Syncing fixtures for league ${leagueId}, season ${season}`)
  
  const data = await apiGet('fixtures', { league: leagueId, season })
  const fixtures = data.response || []
  
  let updated = 0
  for (const fixture of fixtures) {
    const s = fixture.score || {}
    const ht = s.halftime || {}, ft = s.fulltime || {}
    
    const fixtureRow = {
      id: Number(fixture.fixture.id),
      league_id: leagueId,
      season_year: season,
      round: fixture.league?.round || null,
      kickoff_utc: fixture.fixture?.date || null,
      status_short: fixture.fixture?.status?.short || null,
      status_long: fixture.fixture?.status?.long || null,
      home_team_id: Number(fixture.teams?.home?.id),
      away_team_id: Number(fixture.teams?.away?.id),
      goals_home: fixture.goals?.home ?? null,
      goals_away: fixture.goals?.away ?? null,
      ht_home: ht.home ?? null,
      ht_away: ht.away ?? null,
      ft_home: ft.home ?? null,
      ft_away: ft.away ?? null,
      updated_at: new Date().toISOString()
    }
    
    const { error } = await supabase
      .from('fixtures')
      .upsert([fixtureRow], { onConflict: 'id' })
    
    if (!error) updated++
  }
  
  return { fixtures: updated }
}

async function syncStandings(supabase: any, leagueId: number, season: number) {
  console.log(`Syncing standings for league ${leagueId}, season ${season}`)
  
  const data = await apiGet('standings', { league: leagueId, season })
  const tables: any[] = data.response?.[0]?.league?.standings?.flat() ?? []
  
  // Clear existing standings
  await supabase
    .from('standings')
    .delete()
    .eq('league_id', leagueId)
    .eq('season_year', season)
  
  const rows = tables.map((row: any) => ({
    league_id: leagueId,
    season_year: season,
    team_id: Number(row.team?.id),
    rank: row.rank,
    points: row.points,
    goals_diff: row.goalsDiff,
    played: row.all?.played,
    win: row.all?.win,
    draw: row.all?.draw,
    lose: row.all?.lose,
    form: row.form,
    updated_at: new Date().toISOString()
  }))
  
  if (rows.length > 0) {
    const { error } = await supabase.from('standings').insert(rows)
    if (error) throw error
  }
  
  return { standings: rows.length }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { type, season = 2025, league }: SyncRequest = await req.json()
    
    const K1_ID = 292
    const K2_ID = 293
    const leagues = league ? [league] : [K1_ID, K2_ID]
    
    const results: any = { success: true, timestamp: new Date().toISOString() }
    
    switch (type) {
      case 'fixtures':
        for (const leagueId of leagues) {
          const result = await syncFixtures(supabase, leagueId, season)
          results[`league_${leagueId}`] = result
        }
        break
        
      case 'standings':
        for (const leagueId of leagues) {
          const result = await syncStandings(supabase, leagueId, season)
          results[`league_${leagueId}`] = result
        }
        break
        
      case 'full':
        // Full sync would include squads, fixtures, standings
        for (const leagueId of leagues) {
          const fixtures = await syncFixtures(supabase, leagueId, season)
          const standings = await syncStandings(supabase, leagueId, season)
          results[`league_${leagueId}`] = { ...fixtures, ...standings }
        }
        break
        
      default:
        throw new Error(`Invalid sync type: ${type}`)
    }

    return new Response(
      JSON.stringify(results),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Sync error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})