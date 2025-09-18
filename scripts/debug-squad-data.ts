const apiKey = process.env.API_FOOTBALL_KEY;

async function debugSquadData() {
  console.log("🔍 Debugging squad data for Jeonbuk Motors...\n");

  if (!apiKey) {
    console.log("❌ API key not found");
    return;
  }

  try {
    const response = await fetch('https://v3.football.api-sports.io/players/squads?team=2762', {
      headers: { 'x-rapidapi-key': apiKey }
    });

    if (!response.ok) {
      console.log(`❌ API request failed: ${response.status}`);
      return;
    }

    const data = await response.json();
    
    console.log('📊 Squad data for Jeonbuk Motors (2762):');
    console.log(`Total entries: ${data.response?.length || 0}\n`);
    
    if (data.response && data.response.length > 0) {
      const validPlayers = data.response.filter((p: any) => p.id && p.name);
      const invalidPlayers = data.response.filter((p: any) => !p.id || !p.name);
      
      console.log(`✅ Valid players (with ID): ${validPlayers.length}`);
      console.log(`❌ Invalid players (no ID): ${invalidPlayers.length}\n`);
      
      console.log("🎯 First 10 valid players:");
      validPlayers.slice(0, 10).forEach((p: any, i: number) => {
        console.log(`${i+1}. ${p.name} (#${p.number}) [${p.position}] ID: ${p.id}`);
      });
      
      console.log("\n⚠️ First 5 invalid entries:");
      invalidPlayers.slice(0, 5).forEach((p: any, i: number) => {
        console.log(`${i+1}. Name: '${p.name}', ID: ${p.id}, Number: ${p.number}`);
      });

      // Test 2024 season data
      console.log("\n🔄 Testing 2024 season data...");
      const response2024 = await fetch('https://v3.football.api-sports.io/players/squads?team=2762&season=2024', {
        headers: { 'x-rapidapi-key': apiKey }
      });

      if (response2024.ok) {
        const data2024 = await response2024.json();
        const valid2024 = data2024.response?.filter((p: any) => p.id && p.name) || [];
        console.log(`📈 2024 season valid players: ${valid2024.length}`);
      }

    } else {
      console.log("📭 No squad data returned");
    }

  } catch (error) {
    console.error("💥 Error:", error);
  }
}

debugSquadData().catch(console.error);