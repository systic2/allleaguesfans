import { supa } from './lib/supabase.ts';

async function checkPlayersSchema() {
  console.log('🔍 Checking actual players table schema...\n');
  
  // Try to get a sample row to see actual column names
  const { data, error } = await supa
    .from('players')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
  } else if (data && data.length > 0) {
    console.log('Available columns:', Object.keys(data[0]));
  } else {
    console.log('Table is empty, trying to insert test data...');
    
    // Try minimal insert to see what fields are accepted
    const { error: insertError } = await supa
      .from('players')
      .insert({
        idPlayer: 'test123',
        strPlayer: 'Test Player',
        idTeam: '138107'
      });
    
    if (insertError) {
      console.error('Insert error:', insertError);
    } else {
      console.log('✅ Basic insert successful');
      // Clean up
      await supa.from('players').delete().eq('idPlayer', 'test123');
    }
  }
}

checkPlayersSchema().catch(console.error);
