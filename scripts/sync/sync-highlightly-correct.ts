/**
 * Correct Highlightly Matches Synchronization
 *
 * Fetches matches from Highlightly API with correct match IDs
 * and maps them to TheSportsDB events
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
  console.error('❌ Missing Supabase credentials (need SERVICE_ROLE or ANON_KEY)');
  process.exit(1);
}

if (!HIGHLIGHTLY_API_KEY) {
  console.error('❌ Missing HIGHLIGHTLY_API_KEY');
  process.exit(1);
}

// Prefer SERVICE_ROLE for write operations
const supabaseKey = SUPABASE_SERVICE_ROLE || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, supabaseKey);

console.log(`Using ${SUPABASE_SERVICE_ROLE ? 'SERVICE_ROLE' : 'ANON_KEY'} for database access\n`);

interface HighlightlyMatch {
  id: number;
  round: string;
  date: string;
  state: {
    clock: number | null;
    score: {
      current: string | null;
      penalties: string | null;
    };
    description: string;
  };
  homeTeam: {
    id: number;
    name: string;
    logo: string;
  };
  awayTeam: {
    id: number;
    name: string;
    logo: string;
  };
  league: {
    id: number;
    name: string;
    season: number;
  };
}

interface HighlightlyResponse {
  data: HighlightlyMatch[];
}

const LEAGUE_CONFIGS = [
  { name: 'K League 1', leagueId: 249276, thesportsDbId: '4689' },
  { name: 'K League 2', leagueId: 250127, thesportsDbId: '4822' },
];

async function fetchHighlightlyMatches(leagueName: string, offset: number = 1): Promise<HighlightlyMatch[]> {
  const url = new URL('https://sports.highlightly.net/football/matches');
  url.searchParams.append('countryCode', 'KR');
  url.searchParams.append('season', SEASON_YEAR);
  url.searchParams.append('leagueName', leagueName);
  url.searchParams.append('offset', offset.toString());

  console.log(`📡 Fetching: ${leagueName}, offset ${offset}`);

  const response = await fetch(url.toString(), {
    headers: {
      'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
      'x-rapidapi-key': HIGHLIGHTLY_API_KEY || '',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data: HighlightlyResponse = await response.json();
  return data.data || [];
}

async function fetchAllMatchesForLeague(leagueName: string): Promise<HighlightlyMatch[]> {
  const allMatches: HighlightlyMatch[] = [];
  let offset = 1;
  let hasMore = true;

  while (hasMore) {
    const matches = await fetchHighlightlyMatches(leagueName, offset);

    if (matches.length === 0) {
      hasMore = false;
    } else {
      allMatches.push(...matches);
      console.log(`   ✅ Fetched ${matches.length} matches (total: ${allMatches.length})`);

      if (matches.length < 100) {
        hasMore = false;
      } else {
        offset += 100;
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
      }
    }
  }

  return allMatches;
}

// Team name mapping: Highlightly → TheSportsDB
const TEAM_NAME_MAPPINGS: Record<string, string> = {
  // K League 1
  'Ulsan Hyundai FC': 'Ulsan HD',
  'Jeonbuk Motors': 'Jeonbuk Hyundai Motors',
  'Gimcheon Sangmu FC': 'Sangju Sangmu',
  'Daejeon Citizen': 'Daejeon Hana Citizen',
  'Suwon City FC': 'Suwon FC',
  'FC Anyang': 'Anyang',
  'Jeju United FC': 'Jeju SK',
  // K League 2
  'Suwon Bluewings': 'Suwon Samsung Bluewings',
  'Busan I Park': 'Busan IPark',
  'Asan Mugunghwa': 'Chungnam Asan',
  'Cheongju': 'Chungbuk Cheongju',
  'Gimpo Citizen': 'Gimpo FC',
  'Seoul E-Land FC': 'Seoul E-Land',
  'Hwaseong': 'Hwaseong FC',
};

function normalizeTeamName(name: string): string {
  // First, check if there's a direct mapping
  if (TEAM_NAME_MAPPINGS[name]) {
    return TEAM_NAME_MAPPINGS[name].toLowerCase();
  }

  return name
    .toLowerCase()
    .replace(/\s+fc$/i, '')
    .replace(/\s+sc$/i, '')
    .replace(/\s+united$/i, '')
    .replace(/\s+city$/i, '')
    .replace(/\s+motors$/i, '')
    .replace(/\s+1995$/i, '')
    .replace(/\s+fc\s+/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function findMatchingEvent(
  match: HighlightlyMatch,
  thesportsDbLeagueId: string
): Promise<string | null> {
  // Try to match by team names and date
  const matchDate = new Date(match.date).toISOString().split('T')[0];

  const { data: events } = await supabase
    .from('events')
    .select('idEvent, strHomeTeam, strAwayTeam, dateEvent, strEvent')
    .eq('idLeague', thesportsDbLeagueId)
    .eq('strSeason', SEASON_YEAR)
    .gte('dateEvent', matchDate)
    .lte('dateEvent', matchDate);

  if (!events || events.length === 0) {
    return null;
  }

  // Apply team name mapping first
  const mappedHomeName = TEAM_NAME_MAPPINGS[match.homeTeam.name] || match.homeTeam.name;
  const mappedAwayName = TEAM_NAME_MAPPINGS[match.awayTeam.name] || match.awayTeam.name;

  // Try exact match with mapped names
  for (const event of events) {
    if (
      event.strHomeTeam === mappedHomeName &&
      event.strAwayTeam === mappedAwayName
    ) {
      return event.idEvent;
    }
  }

  // Try exact match with original names
  for (const event of events) {
    if (
      event.strHomeTeam === match.homeTeam.name &&
      event.strAwayTeam === match.awayTeam.name
    ) {
      return event.idEvent;
    }
  }

  const normalizedHomeName = normalizeTeamName(match.homeTeam.name);
  const normalizedAwayName = normalizeTeamName(match.awayTeam.name);

  // Try normalized match
  for (const event of events) {
    const eventHomeName = normalizeTeamName(event.strHomeTeam || '');
    const eventAwayName = normalizeTeamName(event.strAwayTeam || '');

    if (
      eventHomeName === normalizedHomeName &&
      eventAwayName === normalizedAwayName
    ) {
      return event.idEvent;
    }
  }

  // Try fuzzy match (contains key words)
  for (const event of events) {
    const eventHomeName = normalizeTeamName(event.strHomeTeam || '');
    const eventAwayName = normalizeTeamName(event.strAwayTeam || '');

    const homeMatch =
      eventHomeName.includes(normalizedHomeName) ||
      normalizedHomeName.includes(eventHomeName);
    const awayMatch =
      eventAwayName.includes(normalizedAwayName) ||
      normalizedAwayName.includes(eventAwayName);

    if (homeMatch && awayMatch && eventHomeName.length > 3 && normalizedHomeName.length > 3) {
      return event.idEvent;
    }
  }

  return null;
}

async function syncLeagueMatches(leagueName: string, leagueId: number, thesportsDbId: string) {
  console.log(`\n🏆 Syncing ${leagueName}...\n`);

  // Fetch all matches from Highlightly
  const matches = await fetchAllMatchesForLeague(leagueName);
  console.log(`\n✅ Total matches fetched: ${matches.length}\n`);

  let matchedCount = 0;
  let unmatchedCount = 0;

  // Process each match
  for (const match of matches) {
    const eventId = await findMatchingEvent(match, thesportsDbId);

    if (eventId) {
      // Update events_highlightly_enhanced table
      const { error: enhancedError } = await supabase
        .from('events_highlightly_enhanced')
        .upsert(
          {
            idEvent: eventId,
            highlightly_event_id: match.id.toString(),
            highlightly_match_id: match.id.toString(),
            highlightly_league_id: leagueId.toString(),
            live_status: match.state.description.toLowerCase(),
            live_minute: match.state.clock,
            live_score_home: match.state.score.current ? parseInt(match.state.score.current.split(' - ')[0]) : null,
            live_score_away: match.state.score.current ? parseInt(match.state.score.current.split(' - ')[1]) : null,
            last_updated: new Date().toISOString(),
            sync_status: 'synced',
          },
          {
            onConflict: 'idEvent',
          }
        );

      if (enhancedError) {
        console.error(`❌ Error saving to events_highlightly_enhanced ${match.id}:`, enhancedError.message);
      }

      // IMPORTANT: Also update events table with highlightly_match_id
      const { error: eventsError } = await supabase
        .from('events')
        .update({ highlightly_match_id: match.id.toString() })
        .eq('idEvent', eventId);

      if (eventsError) {
        console.error(`❌ Error updating events table for ${eventId}:`, eventsError.message);
      } else {
        matchedCount++;
        console.log(`✅ Matched: ${match.homeTeam.name} vs ${match.awayTeam.name} → Event ${eventId}`);
      }
    } else {
      unmatchedCount++;
      console.log(`⚠️  No match: ${match.homeTeam.name} vs ${match.awayTeam.name} (${match.date})`);
    }

    await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
  }

  console.log(`\n📊 ${leagueName} Summary:`);
  console.log(`   ✅ Matched: ${matchedCount}`);
  console.log(`   ⚠️  Unmatched: ${unmatchedCount}`);
}

async function main() {
  console.log('🚀 Starting Highlightly matches synchronization...\n');
  console.log(`Season: ${SEASON_YEAR}\n`);

  for (const config of LEAGUE_CONFIGS) {
    await syncLeagueMatches(config.name, config.leagueId, config.thesportsDbId);
  }

  console.log('\n✅ Highlightly matches synchronization complete!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
