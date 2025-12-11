/**
 * Fetch ALL Highlightly matches with pagination
 *
 * Highlightly API returns 100 matches per page, so we need to use offset
 * to get all matches for the season.
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

console.log(`\n🚀 Fetching ALL Highlightly matches for K League 1 - Season ${SEASON_YEAR}\n`);

interface HighlightlyMatch {
  id: number;
  round: string;
  date: string;
  country: {
    code: string;
    name: string;
    logo: string;
  };
  state: {
    clock: string | null;
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
    logo: string;
    season: number;
  };
}

async function fetchHighlightlyMatchesWithPagination(): Promise<HighlightlyMatch[]> {
  const allMatches: HighlightlyMatch[] = [];
  let offset = 1;
  const limit = 100; // Highlightly returns 100 matches per page
  let hasMore = true;

  while (hasMore) {
    console.log(`📡 Fetching page ${offset} (showing 100 matches per page)...`);

    const url = `https://sports.highlightly.net/football/matches?countryCode=KR&season=${SEASON_YEAR}&leagueName=K%20League%201&offset=${offset}`;

    try {
      const response = await fetch(url, {
        headers: {
          'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
          'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData: { data: HighlightlyMatch[] } = await response.json();
      const matches = responseData.data || [];

      console.log(`   ✅ Received ${matches.length} matches`);

      if (matches.length === 0) {
        hasMore = false;
      } else {
        allMatches.push(...matches);

        // If we got less than 100, we've reached the end
        if (matches.length < limit) {
          hasMore = false;
        } else {
          offset++;
          // Rate limiting: wait 500ms between requests
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error(`❌ Error fetching page ${offset}:`, error);
      hasMore = false;
    }
  }

  return allMatches;
}

async function analyzeMatches(matches: HighlightlyMatch[]) {
  console.log(`\n📊 Analyzing ${matches.length} matches...\n`);

  const finished = matches.filter(m => m.state.description === 'Finished' || m.state.description === 'Match finished');
  const notStarted = matches.filter(m => m.state.description === 'Not started');
  const live = matches.filter(m => m.state.description.includes('Live') || m.state.description.includes('In progress'));

  console.log(`Match Status Breakdown:`);
  console.log(`   - Finished: ${finished.length} matches`);
  console.log(`   - Not started: ${notStarted.length} matches`);
  console.log(`   - Live/In progress: ${live.length} matches`);

  return { finished, notStarted, live };
}

async function main() {
  try {
    // Fetch all matches with pagination
    const allMatches = await fetchHighlightlyMatchesWithPagination();

    console.log(`\n📈 Total matches fetched: ${allMatches.length}`);

    // Analyze match statuses
    const { finished, notStarted, live } = await analyzeMatches(allMatches);

    // Show sample of finished matches that should have events
    console.log(`\n🎯 Sample finished matches (should have event data):`);
    finished.slice(0, 5).forEach(m => {
      console.log(`   - ID: ${m.id} | ${m.homeTeam.name} vs ${m.awayTeam.name} | ${m.round} | ${m.date.split('T')[0]}`);
    });

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
