import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const SEASON_YEAR = process.env.SEASON_YEAR || '2025';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface PlayerStat {
  idPlayer: string;
  strPlayer: string;
  idTeam: string;
  strTeam: string;
  idLeague: string;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  appearances: number;
}

const K_LEAGUE_MAPPINGS = {
  '4689': '249276', // K League 1
  '4822': '250127', // K League 2
};

async function processLeagueEvents(thesportsDbLeagueId: string, internalLeagueId: string) {
  console.log(`\n📊 Processing events for League ${thesportsDbLeagueId} (Internal: ${internalLeagueId})...\n`);

  // Fetch all events for the league in the season
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .eq('idLeague', thesportsDbLeagueId)
    .eq('strSeason', SEASON_YEAR)
    .order('dateEvent', { ascending: false });

  if (error) {
    console.error(`❌ Error fetching events:`, error.message);
    return;
  }

  if (!events || events.length === 0) {
    console.log(`⚠️  No events found for league ${thesportsDbLeagueId}`);
    return;
  }

  console.log(`✅ Found ${events.length} events\n`);

  const playerStats = new Map<string, PlayerStat>();

  // Process each event
  for (const event of events) {
    const homeTeamId = event.idHomeTeam;
    const awayTeamId = event.idAwayTeam;
    const homeTeamName = event.strHomeTeam;
    const awayTeamName = event.strAwayTeam;

    // Process goals (home team)
    if (event.strHomeGoalDetails) {
      const goalDetails = event.strHomeGoalDetails.split(';');
      for (const detail of goalDetails) {
        const match = detail.trim().match(/^(.+?)\s+(\d+)'/);
        if (match) {
          const playerName = match[1].trim();
          updatePlayerStat(playerStats, playerName, homeTeamId, homeTeamName, internalLeagueId, 'goal');
        }
      }
    }

    // Process goals (away team)
    if (event.strAwayGoalDetails) {
      const goalDetails = event.strAwayGoalDetails.split(';');
      for (const detail of goalDetails) {
        const match = detail.trim().match(/^(.+?)\s+(\d+)'/);
        if (match) {
          const playerName = match[1].trim();
          updatePlayerStat(playerStats, playerName, awayTeamId, awayTeamName, internalLeagueId, 'goal');
        }
      }
    }

    // Process yellow cards (home team)
    if (event.strHomeYellowCards) {
      const cards = event.strHomeYellowCards.split(';');
      for (const card of cards) {
        const playerName = card.trim().replace(/\s+\d+'/, '').trim();
        if (playerName) {
          updatePlayerStat(playerStats, playerName, homeTeamId, homeTeamName, internalLeagueId, 'yellow_card');
        }
      }
    }

    // Process yellow cards (away team)
    if (event.strAwayYellowCards) {
      const cards = event.strAwayYellowCards.split(';');
      for (const card of cards) {
        const playerName = card.trim().replace(/\s+\d+'/, '').trim();
        if (playerName) {
          updatePlayerStat(playerStats, playerName, awayTeamId, awayTeamName, internalLeagueId, 'yellow_card');
        }
      }
    }

    // Process red cards (home team)
    if (event.strHomeRedCards) {
      const cards = event.strHomeRedCards.split(';');
      for (const card of cards) {
        const playerName = card.trim().replace(/\s+\d+'/, '').trim();
        if (playerName) {
          updatePlayerStat(playerStats, playerName, homeTeamId, homeTeamName, internalLeagueId, 'red_card');
        }
      }
    }

    // Process red cards (away team)
    if (event.strAwayRedCards) {
      const cards = event.strAwayRedCards.split(';');
      for (const card of cards) {
        const playerName = card.trim().replace(/\s+\d+'/, '').trim();
        if (playerName) {
          updatePlayerStat(playerStats, playerName, awayTeamId, awayTeamName, internalLeagueId, 'red_card');
        }
      }
    }

    // Mark appearances for lineup players
    if (event.strHomeLineupGoalkeeper) {
      updatePlayerStat(playerStats, event.strHomeLineupGoalkeeper, homeTeamId, homeTeamName, internalLeagueId, 'appearance');
    }
    if (event.strAwayLineupGoalkeeper) {
      updatePlayerStat(playerStats, event.strAwayLineupGoalkeeper, awayTeamId, awayTeamName, internalLeagueId, 'appearance');
    }

    // Process home lineup
    if (event.strHomeLineupDefense) {
      const players = event.strHomeLineupDefense.split(';');
      players.forEach(p => updatePlayerStat(playerStats, p.trim(), homeTeamId, homeTeamName, internalLeagueId, 'appearance'));
    }
    if (event.strHomeLineupMidfield) {
      const players = event.strHomeLineupMidfield.split(';');
      players.forEach(p => updatePlayerStat(playerStats, p.trim(), homeTeamId, homeTeamName, internalLeagueId, 'appearance'));
    }
    if (event.strHomeLineupForward) {
      const players = event.strHomeLineupForward.split(';');
      players.forEach(p => updatePlayerStat(playerStats, p.trim(), homeTeamId, homeTeamName, internalLeagueId, 'appearance'));
    }

    // Process away lineup
    if (event.strAwayLineupDefense) {
      const players = event.strAwayLineupDefense.split(';');
      players.forEach(p => updatePlayerStat(playerStats, p.trim(), awayTeamId, awayTeamName, internalLeagueId, 'appearance'));
    }
    if (event.strAwayLineupMidfield) {
      const players = event.strAwayLineupMidfield.split(';');
      players.forEach(p => updatePlayerStat(playerStats, p.trim(), awayTeamId, awayTeamName, internalLeagueId, 'appearance'));
    }
    if (event.strAwayLineupForward) {
      const players = event.strAwayLineupForward.split(';');
      players.forEach(p => updatePlayerStat(playerStats, p.trim(), awayTeamId, awayTeamName, internalLeagueId, 'appearance'));
    }
  }

  // Save statistics to database
  console.log(`\n📈 Saving statistics for ${playerStats.size} players...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const [key, stat] of playerStats.entries()) {
    // Try to find player in database
    const { data: player } = await supabase
      .from('players')
      .select('idPlayer, strPlayer, idTeam, strTeam')
      .ilike('strPlayer', `%${stat.strPlayer}%`)
      .eq('idTeam', stat.idTeam)
      .limit(1)
      .single();

    const playerData = {
      idPlayer: player?.idPlayer || `temp_${Date.now()}_${Math.random()}`,
      strPlayer: stat.strPlayer,
      idTeam: stat.idTeam,
      strTeam: stat.strTeam,
      idLeague: stat.idLeague,
      strSeason: SEASON_YEAR,
      goals: stat.goals,
      assists: stat.assists,
      yellow_cards: stat.yellow_cards,
      red_cards: stat.red_cards,
      appearances: stat.appearances,
      last_updated: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('player_statistics')
      .upsert(playerData, {
        onConflict: 'idPlayer,idLeague,strSeason',
      });

    if (upsertError) {
      console.error(`❌ Error saving ${stat.strPlayer}:`, upsertError.message);
      errorCount++;
    } else {
      successCount++;
    }
  }

  console.log(`\n✅ Saved: ${successCount} players`);
  if (errorCount > 0) {
    console.log(`❌ Errors: ${errorCount} players`);
  }

  console.log(`\n📊 Statistics Summary:`);
  console.log(`   Total goals: ${Array.from(playerStats.values()).reduce((sum, p) => sum + p.goals, 0)}`);
  console.log(`   Total assists: ${Array.from(playerStats.values()).reduce((sum, p) => sum + p.assists, 0)}`);
  console.log(`   Total yellow cards: ${Array.from(playerStats.values()).reduce((sum, p) => sum + p.yellow_cards, 0)}`);
  console.log(`   Total red cards: ${Array.from(playerStats.values()).reduce((sum, p) => sum + p.red_cards, 0)}`);
}

function updatePlayerStat(
  statsMap: Map<string, PlayerStat>,
  playerName: string,
  teamId: string,
  teamName: string,
  leagueId: string,
  statType: 'goal' | 'assist' | 'yellow_card' | 'red_card' | 'appearance'
) {
  if (!playerName || playerName.trim() === '') return;

  const key = `${playerName}_${teamId}_${leagueId}`;

  if (!statsMap.has(key)) {
    statsMap.set(key, {
      idPlayer: '',
      strPlayer: playerName,
      idTeam: teamId,
      strTeam: teamName,
      idLeague: leagueId,
      goals: 0,
      assists: 0,
      yellow_cards: 0,
      red_cards: 0,
      appearances: 0,
    });
  }

  const stat = statsMap.get(key)!;

  switch (statType) {
    case 'goal':
      stat.goals++;
      if (stat.appearances === 0) stat.appearances = 1;
      break;
    case 'assist':
      stat.assists++;
      if (stat.appearances === 0) stat.appearances = 1;
      break;
    case 'yellow_card':
      stat.yellow_cards++;
      if (stat.appearances === 0) stat.appearances = 1;
      break;
    case 'red_card':
      stat.red_cards++;
      if (stat.appearances === 0) stat.appearances = 1;
      break;
    case 'appearance':
      stat.appearances++;
      break;
  }
}

async function main() {
  console.log('🚀 Starting player statistics synchronization from TheSportsDB...');
  console.log(`Season: ${SEASON_YEAR}\n`);

  for (const [thesportsDbId, internalId] of Object.entries(K_LEAGUE_MAPPINGS)) {
    await processLeagueEvents(thesportsDbId, internalId);
  }

  console.log('\n✅ Player statistics synchronization complete!');
}

main();
