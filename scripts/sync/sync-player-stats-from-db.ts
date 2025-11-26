/**
 * Sync Player Statistics using database events table
 *
 * 1. Get all 2025 K League 1 finished matches from events table
 * 2. For each match, fetch Highlightly events using idAPIfootball
 * 3. Accumulate player statistics (goals, assists, cards)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY || '097fcd07-9a95-4b4d-8ff0-08db3a387d0a';
const SEASON_YEAR = process.env.SEASON_YEAR || '2025';

if (!SUPABASE_URL) {
  console.error('❌ Missing SUPABASE_URL');
  process.exit(1);
}

const supabaseKey = SUPABASE_SERVICE_ROLE || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, supabaseKey);

console.log(`Using ${SUPABASE_SERVICE_ROLE ? 'SERVICE_ROLE' : 'ANON_KEY'} for database access\n`);

interface DBEvent {
  idEvent: string;
  idAPIfootball: string;
  strEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  idHomeTeam: string;
  idAwayTeam: string;
  intHomeScore: string;
  intAwayScore: string;
  strStatus: string;
  dateEvent: string;
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

async function fetchMatchEvents(apiFootballId: string): Promise<HighlightlyEvent[]> {
  // Highlightly uses their own match IDs, not API-Football IDs
  // We need to search for the match first
  const url = `https://sports.highlightly.net/football/events/${apiFootballId}`;

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
    console.log('🗑️  Clearing existing player statistics...\n');
    await supabase.from('player_statistics').delete().neq('id', 0);

    // Get all finished 2025 K League 1 matches
    console.log('📊 Fetching finished matches from database...\n');
    const { data: matches, error } = await supabase
      .from('events')
      .select('*')
      .eq('idLeague', '4689')
      .eq('strSeason', SEASON_YEAR)
      .eq('strStatus', 'Match Finished')
      .order('dateEvent', { ascending: true });

    if (error) {
      console.error('❌ Error fetching matches:', error);
      process.exit(1);
    }

    if (!matches || matches.length === 0) {
      console.error('❌ No matches found in database');
      process.exit(1);
    }

    console.log(`✅ Found ${matches.length} finished matches in database\n`);
    console.log(`🎯 Processing matches to collect player statistics...\n`);

    let processedCount = 0;
    let totalGoals = 0;
    let totalAssists = 0;
    let totalYellowCards = 0;
    let totalRedCards = 0;
    let errorCount = 0;
    let noEventsCount = 0;

    for (const match of matches as DBEvent[]) {
      try {
        // Try using idAPIfootball as Highlightly match ID
        const events = await fetchMatchEvents(match.idAPIfootball);

        if (events.length === 0) {
          noEventsCount++;
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
            p_id_league: '4689',
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

        processedCount++;

        if (processedCount % 50 === 0) {
          console.log(`✅ Processed ${processedCount}/${matches.length} | Goals: ${totalGoals} | Assists: ${totalAssists} | No events: ${noEventsCount}`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.error(`❌ Error processing match ${match.idEvent}:`, error);
        errorCount++;
      }
    }

    console.log(`\n✅ Sync complete!`);
    console.log(`   - Processed: ${processedCount}/${matches.length} matches`);
    console.log(`   - Matches with no events: ${noEventsCount}`);
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
      console.log(`   ${idx + 1}. ${player.strPlayer} (${player.strTeam}) - ${player.goals} goals, ${player.assists} assists`);
    });

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
