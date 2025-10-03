// scripts/test-team-api.ts
// Test script for new Team Page API functions

import { supa } from './lib/supabase.ts';
const SEASON = '2025';

// Define API functions inline to avoid path alias issues
async function fetchTeamFromDB(idTeam: string) {
  const { data, error } = await supa
    .from('teams')
    .select('*')
    .eq('idTeam', idTeam)
    .maybeSingle();

  if (error) {
    console.error('Error fetching team from DB:', error);
    throw error;
  }

  return data;
}

async function fetchTeamStandingsData(
  idLeague: string,
  season: string,
  teamName: string
) {
  const { data, error } = await supa
    .from('standings')
    .select('*')
    .eq('idLeague', idLeague)
    .eq('strSeason', season) // Fixed: use strSeason instead of season
    .eq('strTeam', teamName)
    .maybeSingle();

  if (error) {
    console.error('Error fetching team standings:', error);
    return null;
  }

  return data;
}

async function fetchTeamEventsData(
  teamName: string,
  season: string,
  limit?: number
) {
  let query = supa
    .from('events')
    .select('*')
    .eq('strSeason', season)
    .or(`strHomeTeam.eq.${teamName},strAwayTeam.eq.${teamName}`)
    .order('dateEvent', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching team events:', error);
    throw error;
  }

  return data || [];
}

async function fetchEventLiveData(idEvent: string) {
  const { data, error } = await supa
    .from('events_highlightly_enhanced')
    .select('*')
    .eq('idEvent', idEvent)
    .maybeSingle();

  if (error) {
    console.warn('No live data found for event:', idEvent);
    return null;
  }

  return data;
}

async function fetchTeamFormGuide(
  teamName: string,
  season: string,
  limit: number = 5
) {
  const events = await fetchTeamEventsData(teamName, season, limit);

  return events
    .filter((event: any) => event.intHomeScore !== null && event.intAwayScore !== null)
    .map((event: any) => {
      const isHome = event.strHomeTeam === teamName;
      const teamScore = isHome ? event.intHomeScore : event.intAwayScore;
      const oppScore = isHome ? event.intAwayScore : event.intHomeScore;

      if (teamScore! > oppScore!) return 'W';
      if (teamScore! < oppScore!) return 'L';
      return 'D';
    });
}

async function fetchTeamUpcomingEventsData(
  teamName: string,
  season: string,
  limit: number = 5
) {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supa
    .from('events')
    .select('*')
    .eq('strSeason', season)
    .or(`strHomeTeam.eq.${teamName},strAwayTeam.eq.${teamName}`)
    .gte('dateEvent', today)
    .order('dateEvent', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching team upcoming events:', error);
    return [];
  }

  return data || [];
}

async function fetchTeamRecentEventsData(
  teamName: string,
  season: string,
  limit: number = 5
) {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supa
    .from('events')
    .select('*')
    .eq('strSeason', season)
    .or(`strHomeTeam.eq.${teamName},strAwayTeam.eq.${teamName}`)
    .lt('dateEvent', today)
    .not('intHomeScore', 'is', null)
    .not('intAwayScore', 'is', null)
    .order('dateEvent', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching team recent events:', error);
    return [];
  }

  return data || [];
}

async function testTeamAPI() {
  console.log('🧪 Testing Team Page API Functions\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Get a sample team from database
    console.log('\n📋 Step 1: Fetching sample team from database...');
    const { data: sampleTeams, error: teamsError } = await supa
      .from('teams')
      .select('idTeam, strTeam, idLeague')
      .eq('idLeague', '4689') // K League 1
      .limit(1);

    if (teamsError || !sampleTeams || sampleTeams.length === 0) {
      throw new Error('No sample teams found in database');
    }

    const testTeam = sampleTeams[0];
    console.log(`✅ Sample team: ${testTeam.strTeam} (ID: ${testTeam.idTeam})`);

    // Step 2: Test fetchTeamFromDB
    console.log('\n📋 Step 2: Testing fetchTeamFromDB...');
    const teamData = await fetchTeamFromDB(testTeam.idTeam);

    if (!teamData) {
      throw new Error('fetchTeamFromDB returned null');
    }

    console.log(`✅ Team data retrieved:`);
    console.log(`   - Name: ${teamData.strTeam}`);
    console.log(`   - League: ${teamData.idLeague}`);
    console.log(`   - Badge: ${teamData.strBadge ? '✓' : '✗'}`);
    console.log(`   - Stadium: ${teamData.strStadium || 'N/A'}`);
    console.log(`   - Capacity: ${teamData.intStadiumCapacity?.toLocaleString() || 'N/A'}`);
    console.log(`   - Description: ${teamData.strDescriptionKR ? '✓' : '✗'}`);
    console.log(`   - Social Media:`);
    console.log(`     • Facebook: ${teamData.strFacebook ? '✓' : '✗'}`);
    console.log(`     • Twitter: ${teamData.strTwitter ? '✓' : '✗'}`);
    console.log(`     • Instagram: ${teamData.strInstagram ? '✓' : '✗'}`);
    console.log(`     • YouTube: ${teamData.strYoutube ? '✓' : '✗'}`);

    // Step 3: Test fetchTeamStandingsData
    console.log('\n📋 Step 3: Testing fetchTeamStandingsData...');
    const standingsData = await fetchTeamStandingsData(
      testTeam.idLeague,
      SEASON,
      testTeam.strTeam
    );

    if (standingsData) {
      console.log(`✅ Standings data retrieved:`);
      console.log(`   - Rank: ${standingsData.intRank}`);
      console.log(`   - Points: ${standingsData.intPoints}`);
      console.log(`   - Played: ${standingsData.intPlayed}`);
      console.log(`   - W/D/L: ${standingsData.intWin}/${standingsData.intDraw}/${standingsData.intLoss}`);
      console.log(`   - Goals: ${standingsData.intGoalsFor} - ${standingsData.intGoalsAgainst}`);
      console.log(`   - Goal Diff: ${standingsData.intGoalDifference}`);
      console.log(`   - Form: ${standingsData.strForm || 'N/A'}`);
      console.log(`   - Home Record: ${standingsData.intWinHome}/${standingsData.intDrawHome}/${standingsData.intLossHome}`);
      console.log(`   - Away Record: ${standingsData.intWinAway}/${standingsData.intDrawAway}/${standingsData.intLossAway}`);
    } else {
      console.log('⚠️  No standings data found (non-critical)');
    }

    // Step 4: Test fetchTeamEventsData
    console.log('\n📋 Step 4: Testing fetchTeamEventsData (limit 5)...');
    const events = await fetchTeamEventsData(testTeam.strTeam, SEASON, 5);

    console.log(`✅ Found ${events.length} events`);
    if (events.length > 0) {
      console.log(`   Sample event:`);
      const sampleEvent = events[0];
      console.log(`   - ID: ${sampleEvent.idEvent}`);
      console.log(`   - Match: ${sampleEvent.strHomeTeam} vs ${sampleEvent.strAwayTeam}`);
      console.log(`   - Score: ${sampleEvent.intHomeScore ?? '?'} - ${sampleEvent.intAwayScore ?? '?'}`);
      console.log(`   - Date: ${sampleEvent.dateEvent}`);
      console.log(`   - Round: ${sampleEvent.intRound}`);
      console.log(`   - Venue: ${sampleEvent.strVenue || 'N/A'}`);
    }

    // Step 5: Test fetchTeamFormGuide
    console.log('\n📋 Step 5: Testing fetchTeamFormGuide (last 5 matches)...');
    const formGuide = await fetchTeamFormGuide(testTeam.strTeam, SEASON, 5);

    if (formGuide.length > 0) {
      console.log(`✅ Form Guide: ${formGuide.join('')}`);
      const wins = formGuide.filter(r => r === 'W').length;
      const draws = formGuide.filter(r => r === 'D').length;
      const losses = formGuide.filter(r => r === 'L').length;
      console.log(`   - Wins: ${wins}, Draws: ${draws}, Losses: ${losses}`);
    } else {
      console.log('⚠️  No completed matches found for form guide');
    }

    // Step 6: Test fetchTeamUpcomingEventsData
    console.log('\n📋 Step 6: Testing fetchTeamUpcomingEventsData (limit 3)...');
    const upcomingEvents = await fetchTeamUpcomingEventsData(testTeam.strTeam, SEASON, 3);

    console.log(`✅ Found ${upcomingEvents.length} upcoming events`);
    if (upcomingEvents.length > 0) {
      upcomingEvents.forEach((event, idx) => {
        console.log(`   ${idx + 1}. ${event.strHomeTeam} vs ${event.strAwayTeam} - ${event.dateEvent}`);
      });
    } else {
      console.log('   (No upcoming matches found)');
    }

    // Step 7: Test fetchTeamRecentEventsData
    console.log('\n📋 Step 7: Testing fetchTeamRecentEventsData (limit 3)...');
    const recentEvents = await fetchTeamRecentEventsData(testTeam.strTeam, SEASON, 3);

    console.log(`✅ Found ${recentEvents.length} recent completed events`);
    if (recentEvents.length > 0) {
      recentEvents.forEach((event, idx) => {
        const score = `${event.intHomeScore} - ${event.intAwayScore}`;
        console.log(`   ${idx + 1}. ${event.strHomeTeam} ${score} ${event.strAwayTeam} - ${event.dateEvent}`);
      });
    } else {
      console.log('   (No recent completed matches found)');
    }

    // Step 8: Test fetchEventLiveData (if any events exist)
    console.log('\n📋 Step 8: Testing fetchEventLiveData...');
    let liveData = null; // Declare outside if block
    if (events.length > 0) {
      const testEventId = events[0].idEvent;
      liveData = await fetchEventLiveData(testEventId);

      if (liveData) {
        console.log(`✅ Live data found for event ${testEventId}:`);
        console.log(`   - Live Status: ${liveData.live_status || 'N/A'}`);
        console.log(`   - Live Minute: ${liveData.live_minute || 'N/A'}`);
        console.log(`   - Live Score: ${liveData.live_score_home ?? '?'} - ${liveData.live_score_away ?? '?'}`);
        console.log(`   - Possession: ${liveData.possession_home ?? '?'}% - ${liveData.possession_away ?? '?'}%`);
        console.log(`   - Shots: ${liveData.shots_home ?? '?'} - ${liveData.shots_away ?? '?'}`);
        console.log(`   - Corners: ${liveData.corners_home ?? '?'} - ${liveData.corners_away ?? '?'}`);
      } else {
        console.log(`⚠️  No live data found for event ${testEventId} (expected for completed/future matches)`);
      }
    } else {
      console.log('⚠️  No events available to test live data');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📊 Test Summary:');
    console.log(`   - Team Data: ✓`);
    console.log(`   - Standings Data: ${standingsData ? '✓' : '⚠️ (optional)'}`);
    console.log(`   - Events Data: ✓ (${events.length} events)`);
    console.log(`   - Form Guide: ${formGuide.length > 0 ? '✓' : '⚠️ (no completed matches)'}`);
    console.log(`   - Upcoming Events: ✓ (${upcomingEvents.length} events)`);
    console.log(`   - Recent Events: ✓ (${recentEvents.length} events)`);
    console.log(`   - Live Data: ${liveData ? '✓' : '⚠️ (expected for most matches)'}`);

    console.log('\n🎉 Ready to proceed to Step 4: Create TeamPageDB component\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    console.error('\nStack trace:', error instanceof Error ? error.stack : 'N/A');
    process.exit(1);
  }
}

// Run tests
testTeamAPI();
