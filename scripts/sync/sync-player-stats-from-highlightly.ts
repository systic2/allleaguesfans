/**
 * Sync Player Statistics from Highlightly API
 *
 * Fetches event data from Highlightly for mapped matches
 * and populates player_statistics table with goals, assists, cards
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY || '097fcd07-9a95-4b4d-8ff0-08db3a387d0a';
const SEASON_YEAR = process.env.SEASON_YEAR || '2025';

if (!SUPABASE_URL) {
  console.error('❌ Missing SUPABASE_URL');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE && !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabaseKey = SUPABASE_SERVICE_ROLE || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, supabaseKey);

console.log(`Using ${SUPABASE_SERVICE_ROLE ? 'SERVICE_ROLE' : 'ANON_KEY'} for database access\n`);

interface HighlightlyEvent {
  type: string; // Goal, Yellow Card, Red Card, Substitution
  time: string;
  player: string;
  playerId: number;
  team: {
    id: number;
    name: string;
    logo: string;
  };
  assist?: string | null;
  assistingPlayerId?: number | null;
  substituted?: string | null;
}

interface PlayerStat {
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
  league_id: string;
  season: string;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  appearances: number;
}

async function fetchMatchEvents(matchId: string): Promise<HighlightlyEvent[]> {
  const url = `https://sports.highlightly.net/football/events/${matchId}`;

  console.log(`📡 Fetching events for match ${matchId}...`);

  try {
    const response = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
        'x-rapidapi-key': HIGHLIGHTLY_API_KEY || '',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`   ⚠️  No events found for match ${matchId}`);
        return [];
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: HighlightlyEvent[] = await response.json();
    console.log(`   ✅ Fetched ${data?.length || 0} events`);
    return data || [];
  } catch (error) {
    console.error(`   ❌ Error fetching match ${matchId}:`, error);
    return [];
  }
}

async function getMappedMatches() {
  console.log('🔍 Fetching mapped matches from database...\n');

  const { data, error } = await supabase
    .from('events_highlightly_enhanced')
    .select(`
      idEvent,
      highlightly_match_id,
      events!inner (
        idLeague,
        strHomeTeam,
        strAwayTeam,
        strSeason,
        idHomeTeam,
        idAwayTeam
      )
    `)
    .eq('sync_status', 'synced')
    .not('highlightly_match_id', 'is', null);

  if (error) {
    console.error('❌ Error fetching mapped matches:', error);
    return [];
  }

  console.log(`✅ Found ${data?.length || 0} mapped matches\n`);
  return data || [];
}

async function processPlayerStats(events: HighlightlyEvent[], matchData: any): Promise<Map<string, PlayerStat>> {
  const playerStats = new Map<string, PlayerStat>();

  for (const event of events) {
    if (!event.playerId) continue;

    const playerId = event.playerId.toString();
    const playerName = event.player;
    const teamId = event.team.id.toString();
    const teamName = event.team.name;
    const leagueId = matchData.events.idLeague;

    if (!playerStats.has(playerId)) {
      playerStats.set(playerId, {
        player_id: playerId,
        player_name: playerName,
        team_id: teamId,
        team_name: teamName,
        league_id: leagueId,
        season: SEASON_YEAR,
        goals: 0,
        assists: 0,
        yellow_cards: 0,
        red_cards: 0,
        appearances: 1,
      });
    }

    const stat = playerStats.get(playerId)!;

    switch (event.type.toLowerCase()) {
      case 'goal':
        stat.goals++;
        // Process assist if present
        if (event.assistingPlayerId && event.assist) {
          const assistPlayerId = event.assistingPlayerId.toString();
          if (!playerStats.has(assistPlayerId)) {
            playerStats.set(assistPlayerId, {
              player_id: assistPlayerId,
              player_name: event.assist,
              team_id: teamId,
              team_name: teamName,
              league_id: leagueId,
              season: SEASON_YEAR,
              goals: 0,
              assists: 1,
              yellow_cards: 0,
              red_cards: 0,
              appearances: 1,
            });
          } else {
            playerStats.get(assistPlayerId)!.assists++;
          }
        }
        break;
      case 'yellow_card':
      case 'yellow card':
        stat.yellow_cards++;
        break;
      case 'red_card':
      case 'red card':
        stat.red_cards++;
        break;
    }
  }

  return playerStats;
}

async function upsertPlayerStats(playerStats: Map<string, PlayerStat>) {
  const stats = Array.from(playerStats.values());

  if (stats.length === 0) {
    return { success: 0, errors: 0 };
  }

  let successCount = 0;
  let errorCount = 0;

  // Process in batches of 50
  const batchSize = 50;
  for (let i = 0; i < stats.length; i += batchSize) {
    const batch = stats.slice(i, i + batchSize);

    for (const stat of batch) {
      // Use raw SQL to properly accumulate statistics
      const { error } = await supabase.rpc('upsert_player_stats', {
        p_id_player: stat.player_id,
        p_str_player: stat.player_name,
        p_id_team: stat.team_id,
        p_str_team: stat.team_name,
        p_id_league: stat.league_id,
        p_str_season: stat.season,
        p_goals: stat.goals,
        p_assists: stat.assists,
        p_yellow_cards: stat.yellow_cards,
        p_red_cards: stat.red_cards,
        p_appearances: stat.appearances,
      });

      if (error) {
        console.error(`❌ Error upserting ${stat.player_name}:`, error.message);
        errorCount++;
      } else {
        successCount++;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { success: successCount, errors: errorCount };
}

async function main() {
  console.log('🚀 Starting player statistics synchronization...\n');
  console.log(`Season: ${SEASON_YEAR}\n`);

  // Get all mapped matches
  const mappedMatches = await getMappedMatches();

  if (mappedMatches.length === 0) {
    console.log('⚠️  No mapped matches found. Run sync-highlightly-correct.ts first.');
    return;
  }

  let totalEvents = 0;
  let totalPlayers = 0;
  let processedMatches = 0;

  // Process each match
  for (const match of mappedMatches) {
    const matchId = match.highlightly_match_id;

    if (!matchId) continue;

    // Fetch events for this match
    const events = await fetchMatchEvents(matchId);

    if (events.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 300));
      continue;
    }

    totalEvents += events.length;

    // Process player statistics
    const playerStats = await processPlayerStats(events, match);

    // Upsert to database
    const result = await upsertPlayerStats(playerStats);

    totalPlayers += result.success;
    processedMatches++;

    console.log(`   📊 Processed ${playerStats.size} players (${result.success} success, ${result.errors} errors)\n`);

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n📊 Final Statistics:');
  console.log(`   ✅ Processed matches: ${processedMatches}/${mappedMatches.length}`);
  console.log(`   📈 Total events: ${totalEvents}`);
  console.log(`   👥 Total players updated: ${totalPlayers}`);
  console.log('\n✅ Player statistics synchronization complete!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
