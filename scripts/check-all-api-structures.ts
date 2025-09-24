const apiKey = process.env.API_FOOTBALL_KEY;

async function checkAllAPIStructures() {
  console.log("🔍 Checking all API-Football endpoint structures...\n");

  if (!apiKey) {
    console.log("❌ API key not found");
    return;
  }

  const endpoints = [
    {
      name: "Countries",
      url: "https://v3.football.api-sports.io/countries",
      sampleKey: "name"
    },
    {
      name: "Leagues",
      url: "https://v3.football.api-sports.io/leagues?id=292&season=2025",
      sampleKey: "league"
    },
    {
      name: "Teams",
      url: "https://v3.football.api-sports.io/teams?league=292&season=2025",
      sampleKey: "team"
    },
    {
      name: "Players Squad",
      url: "https://v3.football.api-sports.io/players/squads?team=2762",
      sampleKey: "team"
    },
    {
      name: "Players Stats",
      url: "https://v3.football.api-sports.io/players?team=2762&season=2025",
      sampleKey: "player"
    },
    {
      name: "Fixtures",
      url: "https://v3.football.api-sports.io/fixtures?league=292&season=2025&last=5",
      sampleKey: "fixture"
    },
    {
      name: "Fixture Events",
      url: "https://v3.football.api-sports.io/fixtures/events?fixture=1340863",
      sampleKey: "team"
    },
    {
      name: "Standings",
      url: "https://v3.football.api-sports.io/standings?league=292&season=2025",
      sampleKey: "league"
    },
    {
      name: "Lineups",
      url: "https://v3.football.api-sports.io/fixtures/lineups?fixture=1340863",
      sampleKey: "team"
    }
  ];

  const results: any = {};

  for (const endpoint of endpoints) {
    console.log(`🔄 Checking: ${endpoint.name}`);
    try {
      const response = await fetch(endpoint.url, {
        headers: { 'x-rapidapi-key': apiKey }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Status: ${response.status}`);
        console.log(`   📊 Total results: ${data.results || 0}`);
        console.log(`   📋 Response array length: ${data.response?.length || 0}`);
        
        if (data.response && data.response.length > 0) {
          const firstItem = data.response[0];
          
          // Store structure info
          results[endpoint.name] = {
            totalResults: data.results,
            responseLength: data.response.length,
            structure: analyzeStructure(firstItem),
            sample: firstItem
          };
          
          console.log(`   🏗️ Structure preview:`);
          printStructure(firstItem, "      ");
        }
      } else {
        console.log(`   ❌ Status: ${response.status} ${response.statusText}`);
        results[endpoint.name] = { error: `${response.status} ${response.statusText}` };
      }
      
    } catch (error) {
      console.log(`   💥 Error: ${error}`);
      results[endpoint.name] = { error: error.toString() };
    }
    
    console.log(""); // Empty line
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Generate summary report
  console.log("\n" + "=".repeat(50));
  console.log("📋 API STRUCTURE SUMMARY REPORT");
  console.log("=".repeat(50));

  for (const [name, data] of Object.entries(results)) {
    console.log(`\n🔸 ${name}:`);
    if ((data as any).error) {
      console.log(`   ❌ ${(data as any).error}`);
    } else {
      console.log(`   📊 Results: ${(data as any).totalResults}, Array: ${(data as any).responseLength}`);
      console.log(`   🔑 Key fields: ${(data as any).structure.join(", ")}`);
    }
  }

  console.log("\n🔧 Code fixes needed:");
  
  // Players Squad specific fix
  if (results["Players Squad"] && !results["Players Squad"].error) {
    const sample = results["Players Squad"].sample;
    if (sample.players) {
      console.log("   ✅ Players Squad: FIXED - Use response[0].players array");
      console.log(`      Player count: ${sample.players.length}`);
    }
  }

  return results;
}

function analyzeStructure(obj: any, depth = 0): string[] {
  if (depth > 2 || !obj || typeof obj !== 'object') return [];
  
  const keys: string[] = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      keys.push(key);
    }
  }
  return keys;
}

function printStructure(obj: any, indent = "", depth = 0) {
  if (depth > 2 || !obj || typeof obj !== 'object') return;
  
  const keys = Object.keys(obj).slice(0, 8); // Limit to first 8 keys
  for (const key of keys) {
    const value = obj[key];
    const type = Array.isArray(value) ? 'array' : typeof value;
    const length = Array.isArray(value) ? `[${value.length}]` : '';
    
    console.log(`${indent}${key}: ${type}${length}`);
    
    if (depth < 1 && typeof value === 'object' && !Array.isArray(value)) {
      printStructure(value, indent + "  ", depth + 1);
    }
  }
}

checkAllAPIStructures().catch(console.error);