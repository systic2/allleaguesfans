#!/usr/bin/env node
/**
 * Check historical champions data in standings table
 * Verifies which seasons have rank 1 data
 */

import { supa } from './lib/supabase.ts';

async function checkHistoricalChampions() {
  console.log('🔍 Checking historical champions data...\n');

  // Check K League 1 champions
  console.log('📊 K League 1 (idLeague: 4689)');
  const { data: kl1Data, error: kl1Error } = await supa
    .from('standings')
    .select('strSeason, strTeam, intRank, intPoints, intPlayed')
    .eq('idLeague', '4689')
    .eq('intRank', 1)
    .order('strSeason', { ascending: false });

  if (kl1Error) {
    console.error('❌ Error fetching K League 1 champions:', kl1Error);
  } else {
    console.log(`Found ${kl1Data?.length || 0} seasons with rank 1 data:\n`);
    kl1Data?.forEach(champion => {
      const seasonYear = Number(champion.strSeason);
      const isCurrentSeason = seasonYear === 2025;
      const statusIcon = isCurrentSeason ? '⚠️' : '✅';
      const statusText = isCurrentSeason ? '(진행 중 - 표시 제외 필요)' : '(완료된 시즌)';

      console.log(`${statusIcon} ${champion.strSeason}: ${champion.strTeam} - ${champion.intPoints}점 (${champion.intPlayed}경기) ${statusText}`);
    });
  }

  console.log('\n📊 K League 2 (idLeague: 4822)');
  const { data: kl2Data, error: kl2Error } = await supa
    .from('standings')
    .select('strSeason, strTeam, intRank, intPoints, intPlayed')
    .eq('idLeague', '4822')
    .eq('intRank', 1)
    .order('strSeason', { ascending: false });

  if (kl2Error) {
    console.error('❌ Error fetching K League 2 champions:', kl2Error);
  } else {
    console.log(`Found ${kl2Data?.length || 0} seasons with rank 1 data:\n`);
    kl2Data?.forEach(champion => {
      const seasonYear = Number(champion.strSeason);
      const isCurrentSeason = seasonYear === 2025;
      const statusIcon = isCurrentSeason ? '⚠️' : '✅';
      const statusText = isCurrentSeason ? '(진행 중 - 표시 제외 필요)' : '(완료된 시즌)';

      console.log(`${statusIcon} ${champion.strSeason}: ${champion.strTeam} - ${champion.intPoints}점 (${champion.intPlayed}경기) ${statusText}`);
    });
  }

  // Summary
  console.log('\n📋 Summary:');
  const kl1CurrentSeason = kl1Data?.filter(c => Number(c.strSeason) === 2025).length || 0;
  const kl1CompletedSeasons = kl1Data?.filter(c => Number(c.strSeason) < 2025).length || 0;
  const kl2CurrentSeason = kl2Data?.filter(c => Number(c.strSeason) === 2025).length || 0;
  const kl2CompletedSeasons = kl2Data?.filter(c => Number(c.strSeason) < 2025).length || 0;

  console.log(`K League 1: ${kl1CompletedSeasons} completed seasons, ${kl1CurrentSeason} current season`);
  console.log(`K League 2: ${kl2CompletedSeasons} completed seasons, ${kl2CurrentSeason} current season`);

  if (kl1CurrentSeason > 0 || kl2CurrentSeason > 0) {
    console.log('\n⚠️  ISSUE DETECTED:');
    console.log('Current season (2025) is being included in historical champions.');
    console.log('Fix: Add filter .lt("strSeason", "2025") to fetchHistoricalChampions query');
  } else {
    console.log('\n✅ No issues detected - only completed seasons are available');
  }
}

checkHistoricalChampions().catch(console.error);
