// Apply TheSportsDB Foundation Schema to Database
import 'dotenv/config';
import { supa } from './lib/supabase.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applySchema() {
  try {
    console.log('🗄️ Starting TheSportsDB Schema Application...');
    
    // Read the schema file
    const schemaPath = join(__dirname, '01-create-thesportsdb-foundation-schema.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Schema file loaded successfully');
    console.log(`📊 Schema size: ${schemaSQL.length} characters`);
    
    // Split SQL into individual statements
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`🔧 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    let executedCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.trim().length === 0) continue;
      
      try {
        console.log(`\\n⚡ Executing statement ${i + 1}/${statements.length}:`);
        console.log(`   ${statement.substring(0, 100)}...`);
        
        const { data, error } = await supa.rpc('exec', { sql: statement });
        
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error);
          // Continue with next statement for non-critical errors
          if (error.message.includes('does not exist') || error.message.includes('already exists')) {
            console.log('   ⚠️ Non-critical error, continuing...');
          } else {
            throw error;
          }
        } else {
          console.log(`   ✅ Statement ${i + 1} executed successfully`);
          executedCount++;
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Failed to execute statement ${i + 1}:`, error);
        console.log(`   Statement: ${statement}`);
      }
    }
    
    console.log(`\\n🎉 Schema Application Complete!`);
    console.log(`✅ Successfully executed: ${executedCount}/${statements.length} statements`);
    
    // Verify tables were created
    console.log('\\n🔍 Verifying table creation...');
    
    const tables = ['leagues', 'teams', 'players', 'events', 'standings'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supa
          .from(table)
          .select('count', { count: 'exact', head: true });
        
        if (error) {
          console.log(`❌ Table '${table}' verification failed:`, error.message);
        } else {
          console.log(`✅ Table '${table}' exists and is accessible`);
        }
      } catch (error) {
        console.log(`❌ Table '${table}' verification error:`, error);
      }
    }
    
    console.log('\\n🚀 Ready for data import!');
    
  } catch (error) {
    console.error('❌ Schema application failed:', error);
    throw error;
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  applySchema().catch(console.error);
}