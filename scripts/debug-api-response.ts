// scripts/debug-api-response.ts
import 'dotenv/config'
import { apiGet, apiPaged } from './lib/api-football'

const K1 = Number(process.env.API_FOOTBALL_K1_ID) || 292
const K2 = Number(process.env.API_FOOTBALL_K2_ID) || 293
const SEASON = Number(process.env.SEASON_YEAR) || 2024

async function debugTeamsResponse(leagueId: number, season: number) {
  console.log(`\n=== Debugging Teams API for League ${leagueId}, Season ${season} ===`)
  
  try {
    const data = await apiGet('teams', { league: leagueId, season })
    console.log(`Response received:`)
    console.log(`- Total response items: ${data.response?.length || 0}`)
    console.log(`- First team: ${data.response?.[0]?.team?.name || 'None'}`)
    console.log(`- API info:`, data.get || 'No get info')
    console.log(`- Parameters:`, data.parameters || 'No parameters')
    console.log(`- Errors:`, data.errors || 'No errors')
    console.log(`- Results:`, data.results || 'No results')
    
    if (data.response?.length > 0) {
      console.log('\nFirst few teams:')
      data.response.slice(0, 3).forEach((item: any, index: number) => {
        console.log(`${index + 1}. ${item.team?.name} (ID: ${item.team?.id})`)
      })
    }
  } catch (error) {
    console.error('Error fetching teams:', error)
  }
}

async function debugPlayersResponse(teamId: number, season: number) {
  console.log(`\n=== Debugging Players API for Team ${teamId}, Season ${season} ===`)
  
  try {
    const data = await apiGet('players', { team: teamId, season })
    console.log(`Response received:`)
    console.log(`- Total response items: ${data.response?.length || 0}`)
    console.log(`- First player: ${data.response?.[0]?.player?.name || 'None'}`)
    console.log(`- API info:`, data.get || 'No get info')
    console.log(`- Parameters:`, data.parameters || 'No parameters')
    console.log(`- Errors:`, data.errors || 'No errors')
    console.log(`- Results:`, data.results || 'No results')
    console.log(`- Paging:`, data.paging || 'No paging info')
    
    if (data.response?.length > 0) {
      console.log('\nFirst few players:')
      data.response.slice(0, 3).forEach((item: any, index: number) => {
        console.log(`${index + 1}. ${item.player?.name} (ID: ${item.player?.id})`)
      })
    }
  } catch (error) {
    console.error('Error fetching players:', error)
  }
}

async function debugFixturesResponse(leagueId: number, season: number) {
  console.log(`\n=== Debugging Fixtures API for League ${leagueId}, Season ${season} ===`)
  
  try {
    const data = await apiGet('fixtures', { league: leagueId, season })
    console.log(`Response received:`)
    console.log(`- Total response items: ${data.response?.length || 0}`)
    console.log(`- First fixture: ${data.response?.[0]?.fixture?.date || 'None'}`)
    console.log(`- API info:`, data.get || 'No get info')
    console.log(`- Parameters:`, data.parameters || 'No parameters')
    console.log(`- Errors:`, data.errors || 'No errors')
    console.log(`- Results:`, data.results || 'No results')
    console.log(`- Paging:`, data.paging || 'No paging info')
    
    if (data.response?.length > 0) {
      console.log('\nFirst few fixtures:')
      data.response.slice(0, 3).forEach((item: any, index: number) => {
        console.log(`${index + 1}. ${item.teams?.home?.name} vs ${item.teams?.away?.name} on ${item.fixture?.date}`)
      })
    }
  } catch (error) {
    console.error('Error fetching fixtures:', error)
  }
}

async function testSeasons() {
  console.log('\n=== Testing Different Seasons ===')
  const seasons = [2024, 2023, 2022]
  
  for (const season of seasons) {
    console.log(`\n--- Season ${season} ---`)
    await debugTeamsResponse(K1, season)
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('🔍 API Football Response Debug')
  console.log(`K1 ID: ${K1}, K2 ID: ${K2}, Season: ${SEASON}`)
  console.log('='.repeat(60))
  
  // Test teams endpoint
  await debugTeamsResponse(K1, SEASON)
  await debugTeamsResponse(K2, SEASON)
  
  // Test fixtures endpoint
  await debugFixturesResponse(K1, SEASON)
  await debugFixturesResponse(K2, SEASON)
  
  // Test different seasons
  await testSeasons()
  
  // Get first team and test players endpoint
  try {
    const teamsData = await apiGet('teams', { league: K1, season: SEASON })
    if (teamsData.response?.length > 0) {
      const firstTeamId = teamsData.response[0].team.id
      console.log(`\nTesting players for first team: ${teamsData.response[0].team.name} (ID: ${firstTeamId})`)
      await debugPlayersResponse(firstTeamId, SEASON)
    }
  } catch (error) {
    console.error('Error testing players endpoint:', error)
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('✨ Debug complete')
  console.log('='.repeat(60))
}

main().catch(console.error)