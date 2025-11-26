/**
 * Sync Player Statistics from ALL Highlightly matches
 *
 * This script:
 * 1. Fetches ALL matches from Highlightly API with pagination (not just mapped ones)
 * 2. Filters for finished matches
 * 3. Fetches events for each match
 * 4. Accumulates player statistics (goals, assists, cards)
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

const supabaseKey = SUPABASE_SERVICE_ROLE || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, supabaseKey);

console.log(`Using ${SUPABASE_SERVICE_ROLE ? 'SERVICE_ROLE' : 'ANON_KEY'} for database access\n`);

interface HighlightlyMatch {
  id: number;
  round: string;
  date: string;
  state: {
    description: string;
  };
  homeTeam: {
    id: number;
    name: string;
  };
  awayTeam: {
    id: number;
    name: string;
  };
}

interface HighlightlyEvent {
  type: string;
  time: string;
  player: string;
  playerId: number;
  team: {
    id: number;
    name: string;
  };
  assist?: string | null;
  assistingPlayerId?: number | null;
}

async function fetchAllMatches(): Promise<HighlightlyMatch[]> {
  console.log('🚀 Fetching ALL matches from Highlightly API...\n');

  const allMatches: HighlightlyMatch[] = [];
  let offset = 1;

  while (true) {
    const url = `https://sports.highlightly.net/football/matches?countryCode=KR&season=${SEASON_YEAR}&leagueName=K%20League%201&offset=${offset}`;

    if (offset === 1) {
      console.log(`🔍 DEBUG: URL = ${url}`);
      console.log(`🔍 DEBUG: SEASON_YEAR = ${SEASON_YEAR}`);
    }

    try {
      const response = await fetch(url, {
        headers: {
          'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
          'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const responseData: { data: HighlightlyMatch[] } = await response.json();
      const matches = responseData.data || [];

      if (matches.length === 0) {
        break;
      }

      allMatches.push(...matches);

      if (offset % 10 === 0) {
        console.log(`   📊 Fetched ${allMatches.length} matches so far...`);
      }

      if (matches.length < 100) {
        break;
      }

      offset++;
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`❌ Error at offset ${offset}:`, error);
      break;
    }
  }

  const finished = allMatches.filter(m =>
    m.state.description === 'Finished' || m.state.description === 'Match finished'
  );

  console.log(`✅ Total matches: ${allMatches.length}`);
  console.log(`✅ Finished matches: ${finished.length}\n`);

  return finished;
}

async function fetchMatchEvents(matchId: number): Promise<HighlightlyEvent[]> {
  const url = `https://sports.highlightly.net/football/events/${matchId}`;

  try {
    const response = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
        'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const events: HighlightlyEvent[] = await response.json();
    return events || [];
  } catch (error) {
    return [];
  }
}

async function main() {
  try {
    // Step 1: Clear existing data
    console.log('🗑️  Clearing existing player statistics...\n');
    const { error: truncateError } = await supabase.rpc('truncate_player_statistics');
    if (truncateError) {
      console.warn('⚠️  Could not truncate via RPC, trying DELETE...');
      await supabase.from('player_statistics').delete().neq('id', 0);
    }

    // Step 2: Fetch all finished matches
    const finishedMatches = await fetchAllMatches();

    console.log(`🎯 Processing ${finishedMatches.length} finished matches...\n`);

    let processedMatches = 0;
    let totalGoals = 0;
    let totalAssists = 0;
    let totalYellowCards = 0;
    let totalRedCards = 0;
    let errorCount = 0;

    // Step 3: Process each match
    for (const match of finishedMatches) {
      try {
        const events = await fetchMatchEvents(match.id);

        if (events.length === 0) {
          continue;
        }

        const goalEvents = events.filter(e => e.type === 'Goal');
        const yellowCards = events.filter(e => e.type === 'Yellow Card');
        const redCards = events.filter(e => e.type === 'Red Card');

        totalGoals += goalEvents.length;
        totalYellowCards += yellowCards.length;
        totalRedCards += redCards.length;

        // Process goal events
        for (const goal of goalEvents) {
          // Scorer
          await supabase.rpc('upsert_player_stats', {
            p_id_player: goal.playerId.toString(),
            p_str_player: goal.player,
            p_id_team: goal.team.id.toString(),
            p_str_team: goal.team.name,
            p_id_league: '4689', // K League 1 ID
            p_str_season: SEASON_YEAR,
            p_goals: 1,
            p_assists: 0,
            p_yellow_cards: 0,
            p_red_cards: 0,
            p_appearances: 0,
          });

          // Assister
          if (goal.assistingPlayerId) {
            totalAssists++;
            await supabase.rpc('upsert_player_stats', {
              p_id_player: goal.assistingPlayerId.toString(),
              p_str_player: goal.assist || 'Unknown',
              p_id_team: goal.team.id.toString(),
              p_str_team: goal.team.name,
              p_id_league: '4689',
              p_str_season: SEASON_YEAR,
              p_goals: 0,
              p_assists: 1,
              p_yellow_cards: 0,
              p_red_cards: 0,
              p_appearances: 0,
            });
          }
        }

        // Process cards
        for (const card of [...yellowCards, ...redCards]) {
          await supabase.rpc('upsert_player_stats', {
            p_id_player: card.playerId.toString(),
            p_str_player: card.player,
            p_id_team: card.team.id.toString(),
            p_str_team: card.team.name,
            p_id_league: '4689',
            p_str_season: SEASON_YEAR,
            p_goals: 0,
            p_assists: 0,
            p_yellow_cards: card.type === 'Yellow Card' ? 1 : 0,
            p_red_cards: card.type === 'Red Card' ? 1 : 0,
            p_appearances: 0,
          });
        }

        processedMatches++;

        if (processedMatches % 100 === 0) {
          console.log(`✅ Processed ${processedMatches}/${finishedMatches.length} matches | Goals: ${totalGoals} | Assists: ${totalAssists}`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`❌ Error processing match ${match.id}:`, error);
        errorCount++;
      }
    }

    console.log(`\n✅ Sync complete!`);
    console.log(`   - Processed: ${processedMatches} matches`);
    console.log(`   - Total goals: ${totalGoals}`);
    console.log(`   - Total assists: ${totalAssists}`);
    console.log(`   - Total yellow cards: ${totalYellowCards}`);
    console.log(`   - Total red cards: ${totalRedCards}`);
    console.log(`   - Errors: ${errorCount}`);

    // Show top scorers
    const { data: topScorers } = await supabase
      .from('player_statistics')
      .select('*')
      .eq('idLeague', '4689')
      .eq('strSeason', SEASON_YEAR)
      .order('goals', { ascending: false })
      .limit(10);

    console.log(`\n🏆 Top 10 Scorers:`);
    topScorers?.forEach((player, idx) => {
      console.log(`   ${idx + 1}. ${player.strPlayer} (${player.strTeam}) - ${player.goals} goals`);
    });

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
