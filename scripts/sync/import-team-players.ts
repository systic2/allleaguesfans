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
  strTeam?: string;
  idTeam?: string;
  strPosition?: string;
  strNumber?: string;
  dateBorn?: string;
  strNationality?: string;
  strHeight?: string;
  strWeight?: string;
  strThumb?: string;
  strBirthLocation?: string;
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
    
    const data: any = await response.json();
    if (data && Array.isArray(data.player)) {
      return data.player;
    }
    return [];
  } catch (error) {
    console.error(`Error fetching players for team ${teamId}:`, error);
    return [];
  }
}

async function importTeamPlayers(teamId: string, teamName: string): Promise<number> {
  if (!/^\d+$/.test(teamId)) {
    console.log(`Skipping non-numeric ID: ${teamId} (${teamName})`);
    return 0;
  }

  console.log(`Importing players for ${teamName} (${teamId})...`);
  
  const players = await fetchTeamPlayers(teamId);
  
  if (players.length === 0) {
    console.log(`   No players found`);
    return 0;
  }
  
  console.log(`   Found ${players.length} players`);

  // Map to players_v2 schema
  const essentialPlayers = players.map(p => ({
    idPlayer: p.idPlayer,
    strPlayer: p.strPlayer,
    strTeam: p.strTeam || teamName,
    idTeam: p.idTeam || teamId,
    strPosition: p.strPosition || null,
    strNumber: p.strNumber || null,
    strNationality: p.strNationality || null,
    strHeight: p.strHeight || null,
    strWeight: p.strWeight || null,
    dateBorn: p.dateBorn || null,
    strThumb: p.strThumb || null,
    strBirthLocation: p.strBirthLocation || null
  }));

  // Upsert into players_v2
  const { error } = await supa
    .from('players_v2')
    .upsert(essentialPlayers, {
      onConflict: 'idPlayer',
      ignoreDuplicates: false
    });
  
  if (error) {
    console.error(`   Error inserting players into players_v2:`, error);
    return 0;
  }
  
  console.log(`   Successfully imported ${players.length} players to v2`);
  return players.length;
}

async function main() {
  console.log('Starting player data import to PLAYERS_V2 table...');
  
  // Get all target teams from standings_v2 (EPL, K1, K2)
  const { data: teams, error } = await supa
    .from('standings_v2')
    .select('teamId, teamName, leagueId')
    .in('leagueId', ['4689', '4822', '4328'])
    .order('teamName', { ascending: true });
  
  if (error) {
    console.error('Error fetching teams:', error);
    return;
  }
  
  if (!teams || teams.length === 0) {
    console.log('No teams found in database');
    return;
  }
  
  const uniqueTeams = Array.from(new Map(teams.map(t => [t.teamId, t])).values());
  
  console.log(`Found ${uniqueTeams.length} unique teams from standings`);
  
  let totalPlayers = 0;
  let successfulImports = 0;
  
  for (const team of uniqueTeams) {
    const count = await importTeamPlayers(team.teamId, team.teamName);
    if (count > 0) {
      totalPlayers += count;
      successfulImports++;
    }
    
    if (team !== uniqueTeams[uniqueTeams.length - 1]) {
      await delay(DELAY_MS);
    }
  }
  
  console.log('------------------------------------------------');
  console.log('Import Summary (V2):');
  console.log(`   Teams processed: ${uniqueTeams.length}`);
  console.log(`   Successful imports: ${successfulImports}`);
  console.log(`   Total players imported: ${totalPlayers}`);
  console.log('------------------------------------------------');
}

main().catch(console.error);
