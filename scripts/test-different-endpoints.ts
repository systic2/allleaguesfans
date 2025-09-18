const apiKey = process.env.API_FOOTBALL_KEY;

async function testDifferentEndpoints() {
  console.log("🔍 Testing different API-Football endpoints for player data...\n");

  if (!apiKey) {
    console.log("❌ API key not found");
    return;
  }

  const endpoints = [
    {
      name: "Players Squad (2025)",
      url: "https://v3.football.api-sports.io/players/squads?team=2762"
    },
    {
      name: "Players Squad (2024)",
      url: "https://v3.football.api-sports.io/players/squads?team=2762&season=2024"
    },
    {
      name: "Players Stats (2025)",
      url: "https://v3.football.api-sports.io/players?team=2762&season=2025"
    },
    {
      name: "Players Stats (2024)",
      url: "https://v3.football.api-sports.io/players?team=2762&season=2024"
    },
    {
      name: "Team Squad Info",
      url: "https://v3.football.api-sports.io/teams?id=2762"
    }
  ];

  for (const endpoint of endpoints) {
    console.log(`🔄 Testing: ${endpoint.name}`);
    try {
      const response = await fetch(endpoint.url, {
        headers: { 'x-rapidapi-key': apiKey }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Status: ${response.status}`);
        console.log(`   📊 Results: ${data.response?.length || 0}`);
        
        if (data.response && data.response.length > 0) {
          if (endpoint.name.includes("Players Stats")) {
            const validPlayers = data.response.filter((item: any) => 
              item.player && item.player.id && item.player.name
            );
            console.log(`   👥 Valid players: ${validPlayers.length}`);
            
            if (validPlayers.length > 0) {
              console.log(`   🎯 Sample: ${validPlayers[0].player.name} (ID: ${validPlayers[0].player.id})`);
            }
          } else if (endpoint.name.includes("Squad")) {
            const validPlayers = data.response.filter((p: any) => p.id && p.name);
            console.log(`   👥 Valid players: ${validPlayers.length}`);
            
            if (validPlayers.length > 0) {
              console.log(`   🎯 Sample: ${validPlayers[0].name} (#${validPlayers[0].number})`);
            }
          } else if (endpoint.name.includes("Team")) {
            console.log(`   🏟️ Team info available`);
          }
        }
      } else {
        console.log(`   ❌ Status: ${response.status} ${response.statusText}`);
      }
      
    } catch (error) {
      console.log(`   💥 Error: ${error}`);
    }
    
    console.log(""); // Empty line
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testDifferentEndpoints().catch(console.error);