import { supa } from './lib/supabase.js';

async function checkTableStructure() {
  console.log('🔍 Checking top_scorers table structure...');
  const { data: scorersData, error: scorersError } = await supa
    .from('top_scorers')
    .select('*')
    .limit(1);

  if (scorersError) {
    console.error('Error:', scorersError);
  } else if (scorersData && scorersData[0]) {
    console.log('top_scorers columns:', Object.keys(scorersData[0]));
  } else {
    console.log('top_scorers table is empty');
  }

  console.log('🔍 Checking top_assists table structure...');
  const { data: assistsData, error: assistsError } = await supa
    .from('top_assists')
    .select('*')
    .limit(1);

  if (assistsError) {
    console.error('Error:', assistsError);
  } else if (assistsData && assistsData[0]) {
    console.log('top_assists columns:', Object.keys(assistsData[0]));
  } else {
    console.log('top_assists table is empty');
  }
}

checkTableStructure();