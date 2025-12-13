
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
const theSportsDBApiKey = process.env.THESPORTSDB_API_KEY || '460915';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const LEAGUES_TO_ADD = [
  { id: '4332', name: 'Italian Serie A' },
  { id: '4331', name: 'German Bundesliga' },
  { id: '4334', name: 'French Ligue 1' }
];

async function addLeagues() {
  console.log('🚀 Adding remaining Big 5 leagues to DB...');

  for (const target of LEAGUES_TO_ADD) {
    const url = `https://www.thesportsdb.com/api/v1/json/${theSportsDBApiKey}/lookupleague.php?id=${target.id}`;
    
    try {
      const res = await fetch(url);
      const json = await res.json();
      const league = json.leagues ? json.leagues[0] : null;

      if (!league) {
        console.error(`❌ Failed to fetch ${target.name} (${target.id}) from TheSportsDB`);
        continue;
      }

      console.log(`Fetched: ${league.strLeague}`);

      const payload = {
        idLeague: league.idLeague,
        strLeague: league.strLeague,
        strLeagueAlternate: league.strLeagueAlternate,
        strSport: league.strSport,
        strCountry: league.strCountry,
        strCurrentSeason: league.strCurrentSeason,
        intFormedYear: league.intFormedYear,
        dateFirstEvent: league.dateFirstEvent,
        strGender: league.strGender,
        strWebsite: league.strWebsite,
        strDescriptionEN: league.strDescriptionEN,
        strBadge: league.strBadge,
        strLogo: league.strLogo,
        strBanner: league.strBanner,
        strTrophy: league.strTrophy,
        strPoster: league.strPoster,
        highlightly_id: parseInt(league.idLeague) // Using ID as placeholder
      };

      const { error } = await supabase
        .from('leagues')
        .upsert(payload, { onConflict: 'idLeague' });

      if (error) {
        console.error(`❌ Error inserting ${target.name}:`, error);
      } else {
        console.log(`✅ Successfully added ${target.name} to DB!`);
      }

    } catch (error) {
      console.error(`❌ Script failed for ${target.name}:`, error);
    }
  }
}

addLeagues();
