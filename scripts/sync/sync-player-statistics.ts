/**
 * Player Statistics Synchronization Script
 *
 * Process:
 * 1. Fetch Highlightly events (goals, assists, cards)
 * 2. Match with TheSportsDB events
 * 3. Aggregate player statistics
 * 4. Update player_statistics table
 */

import { supa } from './lib/supabase.ts';

const SEASON_YEAR = process.env.SEASON_YEAR || '2025';
const K_LEAGUE_1_ID = '4689';
const K_LEAGUE_2_ID = '4822';
const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY || process.env.VITE_HIGHLIGHTLY_API_KEY;

if (!HIGHLIGHTLY_API_KEY) {
  console.error('❌ HIGHLIGHTLY_API_KEY environment variable is required');
  process.exit(1);
}

interface PlayerStat {
  idPlayer: string;
  strPlayer: string;
  idTeam: string;
  strTeam: string;
  idLeague: string;
  strSeason: string;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  appearances: number;
  own_goals: number;
  penalties_scored: number;
}

interface HighlightlyEvent {
  id: string;
  match_id: string;
  type: 'goal' | 'yellow_card' | 'red_card' | 'substitution' | 'penalty' | 'own_goal';
  team_id: string;
  player: {
    id: string;
    name: string;
  };
  assist_player?: {
    id: string;
    name: string;
  };
  minute: number;
}

async function fetchHighlightlyEvents(matchId: string): Promise<HighlightlyEvent[]> {
  try {
    const response = await fetch(
      `https://api.highlightly.net/v1/matches/${matchId}/events`,
      {
        headers: {
          'Authorization': `Bearer ${HIGHLIGHTLY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error(`Error fetching events for match ${matchId}:`, error);
    return [];
  }
}

async function getEventHighlightlyMapping() {
  // Get events that have been mapped to Highlightly matches
  const { data, error } = await supa
    .from('events_highlightly_enhanced')
    .select('idEvent, highlightly_event_id')
    .not('highlightly_event_id', 'is', null);

  if (error) {
    console.error('Error fetching event-highlightly mapping:', error);
    return new Map<string, string>();
  }

  const mapping = new Map<string, string>();
  data?.forEach(row => {
    if (row.idEvent && row.highlightly_event_id) {
      mapping.set(row.idEvent, row.highlightly_event_id);
    }
  });

  return mapping;
}

async function getEventDetails(idEvent: string) {
  const { data, error } = await supa
    .from('events')
    .select('idEvent, strHomeTeam, strAwayTeam, idLeague, strSeason')
    .eq('idEvent', idEvent)
    .single();

  if (error) {
    console.error(`Error fetching event ${idEvent}:`, error);
    return null;
  }

  return data;
}

async function findPlayerInDatabase(playerName: string, teamName: string): Promise<any> {
  // Try exact match first
  const { data, error } = await supa
    .from('players')
    .select('idPlayer, strPlayer, idTeam, strTeam')
    .eq('strPlayer', playerName)
    .eq('strTeam', teamName)
    .single();

  if (!error && data) {
    return data;
  }

  // Try case-insensitive partial match
  const { data: players, error: searchError } = await supa
    .from('players')
    .select('idPlayer, strPlayer, idTeam, strTeam')
    .ilike('strPlayer', `%${playerName}%`)
    .ilike('strTeam', `%${teamName}%`);

  if (!searchError && players && players.length > 0) {
    return players[0];
  }

  console.warn(`⚠️  Player not found: ${playerName} (${teamName})`);
  return null;
}

async function processPlayerStatistics(leagueId: string, leagueName: string) {
  console.log(`\n📊 Processing player statistics for ${leagueName}...\n`);

  // Get event-highlightly mapping
  const mapping = await getEventHighlightlyMapping();
  console.log(`   Found ${mapping.size} mapped events`);

  if (mapping.size === 0) {
    console.log(`   ⚠️  No Highlightly mappings found. Run sync-highlightly-matches.ts first.`);
    return;
  }

  // Initialize statistics aggregator
  const statsMap = new Map<string, PlayerStat>();

  // Process each mapped event
  let processedEvents = 0;
  let totalGoals = 0;
  let totalAssists = 0;

  for (const [idEvent, highlightlyMatchId] of mapping) {
    const eventDetails = await getEventDetails(idEvent);
    if (!eventDetails || eventDetails.idLeague !== leagueId) {
      continue;
    }

    // Fetch Highlightly events for this match
    const highlightlyEvents = await fetchHighlightlyEvents(highlightlyMatchId);

    if (highlightlyEvents.length === 0) {
      continue;
    }

    processedEvents++;
    console.log(`   Processing event ${processedEvents}: ${eventDetails.strHomeTeam} vs ${eventDetails.strAwayTeam}`);

    // Process each event (goal, assist, card, etc.)
    for (const event of highlightlyEvents) {
      // Process goal scorer
      if (event.type === 'goal' || event.type === 'penalty') {
        const teamName = event.team_id === 'home' ? eventDetails.strHomeTeam : eventDetails.strAwayTeam;
        const player = await findPlayerInDatabase(event.player.name, teamName);

        if (player) {
          const key = `${player.idPlayer}-${leagueId}-${SEASON_YEAR}`;
          const stat = statsMap.get(key) || {
            idPlayer: player.idPlayer,
            strPlayer: player.strPlayer,
            idTeam: player.idTeam,
            strTeam: player.strTeam,
            idLeague: leagueId,
            strSeason: SEASON_YEAR,
            goals: 0,
            assists: 0,
            yellow_cards: 0,
            red_cards: 0,
            appearances: 0,
            own_goals: 0,
            penalties_scored: 0
          };

          stat.goals++;
          if (event.type === 'penalty') {
            stat.penalties_scored++;
          }
          totalGoals++;
          statsMap.set(key, stat);
        }
      }

      // Process assist
      if (event.assist_player) {
        const teamName = event.team_id === 'home' ? eventDetails.strHomeTeam : eventDetails.strAwayTeam;
        const player = await findPlayerInDatabase(event.assist_player.name, teamName);

        if (player) {
          const key = `${player.idPlayer}-${leagueId}-${SEASON_YEAR}`;
          const stat = statsMap.get(key) || {
            idPlayer: player.idPlayer,
            strPlayer: player.strPlayer,
            idTeam: player.idTeam,
            strTeam: player.strTeam,
            idLeague: leagueId,
            strSeason: SEASON_YEAR,
            goals: 0,
            assists: 0,
            yellow_cards: 0,
            red_cards: 0,
            appearances: 0,
            own_goals: 0,
            penalties_scored: 0
          };

          stat.assists++;
          totalAssists++;
          statsMap.set(key, stat);
        }
      }

      // Process cards
      if (event.type === 'yellow_card' || event.type === 'red_card') {
        const teamName = event.team_id === 'home' ? eventDetails.strHomeTeam : eventDetails.strAwayTeam;
        const player = await findPlayerInDatabase(event.player.name, teamName);

        if (player) {
          const key = `${player.idPlayer}-${leagueId}-${SEASON_YEAR}`;
          const stat = statsMap.get(key) || {
            idPlayer: player.idPlayer,
            strPlayer: player.strPlayer,
            idTeam: player.idTeam,
            strTeam: player.strTeam,
            idLeague: leagueId,
            strSeason: SEASON_YEAR,
            goals: 0,
            assists: 0,
            yellow_cards: 0,
            red_cards: 0,
            appearances: 0,
            own_goals: 0,
            penalties_scored: 0
          };

          if (event.type === 'yellow_card') {
            stat.yellow_cards++;
          } else {
            stat.red_cards++;
          }
          statsMap.set(key, stat);
        }
      }

      // Process own goals
      if (event.type === 'own_goal') {
        const teamName = event.team_id === 'home' ? eventDetails.strAwayTeam : eventDetails.strHomeTeam;
        const player = await findPlayerInDatabase(event.player.name, teamName);

        if (player) {
          const key = `${player.idPlayer}-${leagueId}-${SEASON_YEAR}`;
          const stat = statsMap.get(key) || {
            idPlayer: player.idPlayer,
            strPlayer: player.strPlayer,
            idTeam: player.idTeam,
            strTeam: player.strTeam,
            idLeague: leagueId,
            strSeason: SEASON_YEAR,
            goals: 0,
            assists: 0,
            yellow_cards: 0,
            red_cards: 0,
            appearances: 0,
            own_goals: 0,
            penalties_scored: 0
          };

          stat.own_goals++;
          statsMap.set(key, stat);
        }
      }
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log(`\n📈 Statistics Summary:`);
  console.log(`   Processed events: ${processedEvents}`);
  console.log(`   Total goals: ${totalGoals}`);
  console.log(`   Total assists: ${totalAssists}`);
  console.log(`   Unique players: ${statsMap.size}`);

  // Update database
  if (statsMap.size > 0) {
    console.log(`\n💾 Updating database...`);

    const stats = Array.from(statsMap.values());
    const { error } = await supa
      .from('player_statistics')
      .upsert(stats, {
        onConflict: 'idPlayer,idLeague,strSeason',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('   ❌ Error updating statistics:', error);
    } else {
      console.log(`   ✅ Successfully updated ${stats.length} player statistics`);

      // Show top scorers
      const topScorers = stats
        .filter(s => s.goals > 0)
        .sort((a, b) => b.goals - a.goals)
        .slice(0, 5);

      console.log(`\n🏆 Top Scorers:`);
      topScorers.forEach((scorer, idx) => {
        console.log(`   ${idx + 1}. ${scorer.strPlayer} (${scorer.strTeam}) - ${scorer.goals} goals, ${scorer.assists} assists`);
      });
    }
  }
}

async function main() {
  console.log('🚀 Starting player statistics synchronization...\n');
  console.log(`Season: ${SEASON_YEAR}\n`);

  // Process K League 1
  await processPlayerStatistics(K_LEAGUE_1_ID, 'K League 1');

  // Process K League 2
  await processPlayerStatistics(K_LEAGUE_2_ID, 'K League 2');

  console.log('\n✅ Player statistics synchronization complete!');
}

main().catch(console.error);
