import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || '';
const HIGHLIGHTLY_API_KEY = '097fcd07-9a95-4b4d-8ff0-08db3a387d0a';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function main() {
  const { data: matches } = await supabase
    .from('events')
    .select('*')
    .eq('idLeague', '4689')
    .eq('strSeason', '2025')
    .eq('strStatus', 'Match Finished')
    .not('intHomeScore', 'is', null)
    .limit(1);

  if (!matches || matches.length === 0) {
    console.log('No matches found');
    return;
  }

  const match = matches[0];
  console.log(`Match: ${match.strHomeTeam} ${match.intHomeScore} - ${match.intAwayScore} ${match.strAwayTeam} (${match.dateEvent})`);

  // Search Highlightly
  const url = 'https://sports.highlightly.net/football/matches?countryCode=KR&season=2025&leagueName=K%20League%201&offset=1';
  const response = await fetch(url, {
    headers: {
      'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
      'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
    },
  });

  const data = await response.json();
  const allMatches = data.data || [];

  const found = allMatches.find((m: any) => {
    const mDate = m.date.split('T')[0];
    return mDate === match.dateEvent;
  });

  if (found) {
    console.log(`Found Highlightly match ID: ${found.id}`);
    
    const eventsUrl = `https://sports.highlightly.net/football/events/${found.id}`;
    const eventsResponse = await fetch(eventsUrl, {
      headers: {
        'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
        'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
      },
    });

    if (eventsResponse.ok) {
      const events = await eventsResponse.json();
      const goals = events.filter((e: any) => e.type === 'Goal');
      console.log(`Found ${goals.length} goals`);
      
      if (goals.length > 0) {
        const goalEvent = goals[0];
        const { error } = await supabase.rpc('upsert_player_stats', {
          p_id_player: goalEvent.playerId.toString(),
          p_str_player: goalEvent.player,
          p_id_team: goalEvent.team.id.toString(),
          p_str_team: goalEvent.team.name,
          p_id_league: '4689',
          p_str_season: '2025',
          p_goals: 1,
          p_assists: 0,
          p_yellow_cards: 0,
          p_red_cards: 0,
          p_appearances: 0,
        });
        
        console.log(error ? `Error: ${error}` : 'Successfully inserted');
      }
    }
  } else {
    console.log('Match not found in Highlightly');
  }
}

main();
