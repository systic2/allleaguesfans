// tests/integration/data-integrity.test.ts
import 'dotenv/config';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';

// --- Test Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const SEASON_YEAR = process.env.SEASON_YEAR || '2025';

// --- Test Suite Definition ---
interface Test {
  name: string;
  fn: () => Promise<void>;
}

const tests: Test[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

// --- Supabase Client ---
// Ensure we have the necessary environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set in your .env file.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// --- Test Cases ---

test('K-League 1 should have exactly 12 teams in the standings', async () => {
  const K_LEAGUE_1_ID = '4689';
  
  const { data, error, count } = await supabase
    .from('standings_v2')
    .select('*', { count: 'exact' })
    .eq('leagueId', K_LEAGUE_1_ID)
    .eq('season', SEASON_YEAR);

  // Check for Supabase query errors
  assert.ifError(error, `Supabase query should not fail. Error: ${error?.message}`);

  // Assert that the number of teams is 12
  assert.strictEqual(count, 12, `Expected 12 teams in K-League 1, but found ${count}.`);
});

test('K-League 2 should have a specific number of teams (e.g., 13)', async () => {
  // Note: This number can change based on league structure. Adjust as needed.
  const K_LEAGUE_2_ID = '4822';
  const EXPECTED_TEAM_COUNT = 14; // As of recent seasons, K-League 2 has 14 teams.
  
  const { data, error, count } = await supabase
    .from('standings_v2')
    .select('*', { count: 'exact' })
    .eq('leagueId', K_LEAGUE_2_ID)
    .eq('season', SEASON_YEAR);

  assert.ifError(error, `Supabase query should not fail. Error: ${error?.message}`);

  assert.strictEqual(count, EXPECTED_TEAM_COUNT, `Expected ${EXPECTED_TEAM_COUNT} teams in K-League 2, but found ${count}.`);
});

test('All standings should have a rank, points, and teamName', async () => {
  const { data, error } = await supabase
    .from('standings_v2')
    .select('rank, points, teamName')
    .eq('season', SEASON_YEAR)
    .limit(50); // Limit to a reasonable number for this check

  assert.ifError(error, `Supabase query should not fail. Error: ${error?.message}`);
  assert(data.length > 0, 'standings_v2 table should not be empty for the current season.');

  for (const row of data) {
    assert.ok(typeof row.rank === 'number', `Rank should be a number, but got: ${row.rank}`);
    assert.ok(typeof row.points === 'number', `Points should be a number, but got: ${row.points}`);
    assert.ok(typeof row.teamName === 'string' && row.teamName.length > 0, `teamName should be a non-empty string, but got: ${row.teamName}`);
  }
});


// --- Test Runner ---
async function runTests() {
  console.log('🚀 Running Data Integrity Tests...');
  let passed = 0;
  let failed = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (error) {
      console.error(`❌ FAIL: ${name}`);
      console.error(error);
      failed++;
    }
  }

  console.log('\n--- Test Summary ---');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log('--------------------');

  if (failed > 0) {
    process.exit(1); // Exit with error code if any test fails
  }
}

runTests();
