
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  const sqlFilePath = process.argv[2];
  if (!sqlFilePath) {
    console.error('Usage: npx tsx scripts/one-off/run-migration.ts <path-to-sql-file>');
    process.exit(1);
  }

  console.log(`🚀 Running migration: ${sqlFilePath}`);

  try {
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Supabase JS client doesn't support running raw SQL directly via .rpc() unless a function is set up.
    // However, the postgres connection string is usually not exposed to the client.
    // BUT, we can use the `pg` library if we have the connection string.
    // Assuming we don't, we might need to rely on the user running this in the dashboard if we can't.
    
    // WAIT! If the user has provided a connection string, we can use it.
    // Check for DATABASE_URL.
    
    // Alternative: Create a postgres function via dashboard once that accepts SQL string? No, security risk.
    
    console.warn("⚠️  NOTE: This script cannot execute raw SQL via supabase-js directly without a helper RPC function.");
    console.warn("⚠️  Please copy the content of the SQL file and run it in your Supabase SQL Editor.");
    console.log("\n--- SQL CONTENT ---\n");
    console.log(sql);
    console.log("\n-------------------\n");

  } catch (error) {
    console.error('❌ Error reading file:', error);
  }
}

runMigration();
