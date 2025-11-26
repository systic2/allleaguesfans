/**
 * Import team players from TheSportsDB API
 * Endpoint: https://www.thesportsdb.com/api/v1/json/460915/lookup_all_players.php?id={teamId}
 */
import { supa } from './lib/supabase.ts';

const THESPORTSDB_API_KEY = '460915'; // Free API key
const DELAY_MS = 500; // Delay between API calls to avoid rate limiting

interface TheSportsDBPlayer {
  idPlayer: string;
  strPlayer: string;
  strPlayerAlternate?: string;
  strTeam?: string;
  idTeam?: string;
  strSport?: string;
  strPosition?: string;
  strNumber?: string;
  dateBorn?: string;
  strBirthLocation?: string;
  strNationality?: string;
  strGender?: string;
  strHeight?: string;
  strWeight?: string;
  strStatus?: string;
  dateSigned?: string;
  strSigning?: string;
  strWage?: string;
  strOutfitter?: string;
  strKit?: string;
  strAgent?: string;
  idAPIfootball?: string;
  idPlayerManager?: string;
  strLocked?: string;
  strThumb?: string;
  strCutout?: string;
  strRender?: string;
  strBanner?: string;
  strFanart1?: string;
  strFanart2?: string;
  strFanart3?: string;
  strFanart4?: string;
  strDescriptionEN?: string;
  strWebsite?: string;
  strFacebook?: string;
  strTwitter?: string;
  strInstagram?: string;
  strYoutube?: string;
}

interface TheSportsDBPlayerResponse {
  player: TheSportsDBPlayer[] | null;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchTeamPlayers(teamId: string): Promise<TheSportsDBPlayer[]> {
  const url = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_API_KEY}/lookup_all_players.php?id=${teamId}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: TheSportsDBPlayerResponse = await response.json();
    return data.player || [];
  } catch (error) {
    console.error(`Error fetching players for team ${teamId}:`, error);
    return [];
  }
}

async function importTeamPlayers(teamId: string, teamName: string): Promise<number> {
  console.log(`\n📥 Importing players for ${teamName} (${teamId})...`);
  
  const players = await fetchTeamPlayers(teamId);
  
  if (players.length === 0) {
    console.log(`   ⚠️  No players found`);
    return 0;
  }
  
  console.log(`   Found ${players.length} players`);

  // Map to database schema fields: idPlayer, strPlayer, strTeam, idTeam, strPosition, strNumber
  const essentialPlayers = players.map(p => ({
    idPlayer: p.idPlayer,
    strPlayer: p.strPlayer,
    strTeam: p.strTeam || teamName,
    idTeam: p.idTeam || teamId,
    strPosition: p.strPosition || null,
    strNumber: p.strNumber || null,
  }));

  // Upsert players to database
  const { error } = await supa
    .from('players')
    .upsert(essentialPlayers, {
      onConflict: 'idPlayer',
      ignoreDuplicates: false
    });
  
  if (error) {
    console.error(`   ❌ Error inserting players:`, error);
    return 0;
  }
  
  console.log(`   ✅ Successfully imported ${players.length} players`);
  return players.length;
}

async function main() {
  console.log('🏃 Starting K League player data import...\n');
  
  // Get all K League teams from database
  const { data: teams, error } = await supa
    .from('teams')
    .select('idTeam, strTeam, idLeague')
    .in('idLeague', ['4689', '4822']) // K League 1 and K League 2
    .order('strTeam', { ascending: true });
  
  if (error) {
    console.error('❌ Error fetching teams:', error);
    return;
  }
  
  if (!teams || teams.length === 0) {
    console.log('⚠️  No K League teams found in database');
    return;
  }
  
  console.log(`📊 Found ${teams.length} K League teams\n`);
  
  let totalPlayers = 0;
  let successfulImports = 0;
  
  for (const team of teams) {
    const count = await importTeamPlayers(team.idTeam, team.strTeam);
    if (count > 0) {
      totalPlayers += count;
      successfulImports++;
    }
    
    // Delay between requests to avoid rate limiting
    if (team !== teams[teams.length - 1]) {
      await delay(DELAY_MS);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📈 Import Summary:');
  console.log(`   Teams processed: ${teams.length}`);
  console.log(`   Successful imports: ${successfulImports}`);
  console.log(`   Total players imported: ${totalPlayers}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
