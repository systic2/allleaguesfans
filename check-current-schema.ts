// Check Current Database Schema
import 'dotenv/config';
import { supa } from './scripts/lib/supabase.js';

async function checkSchema() {
  try {
    console.log('🔍 Checking Current Database Schema...');
    
    // Check if tables exist and their structure
    const tables = ['leagues', 'teams', 'players', 'events', 'standings'];
    
    for (const tableName of tables) {
      try {
        console.log(`\\n📋 Checking table: ${tableName}`);
        
        // Try to select from table to see if it exists
        const { data, error } = await supa
          .from(tableName)
          .select('*')
          .limit(0); // Just check structure, no data
        
        if (error) {
          console.log(`❌ Table '${tableName}' error:`, error.message);
        } else {
          console.log(`✅ Table '${tableName}' exists and is accessible`);
        }
        
        // Try a simple insert to see required fields
        const { data: insertData, error: insertError } = await supa
          .from(tableName)
          .insert({})
          .select();
        
        if (insertError) {
          console.log(`📝 Required fields for '${tableName}':`, insertError.message);
        }
        
      } catch (error) {
        console.log(`⚠️ Could not check table '${tableName}':`, error);
      }
    }
    
    console.log('\\n🎯 Current Status Analysis:');
    console.log('- If tables exist but columns are wrong, schema needs to be reapplied');
    console.log('- If tables don\'t exist, schema was not applied successfully');
    
  } catch (error) {
    console.error('❌ Schema check failed:', error);
  }
}

// Main execution
checkSchema().catch(console.error);