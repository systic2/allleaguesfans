// Check environment variables
console.log('Environment Variables Check:\n');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Not set');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Not set');
console.log('SUPABASE_SERVICE_ROLE:', process.env.SUPABASE_SERVICE_ROLE ? `✅ Set (${process.env.SUPABASE_SERVICE_ROLE.substring(0, 20)}...)` : '❌ Not set');
console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? `✅ Set (${process.env.VITE_SUPABASE_ANON_KEY.substring(0, 20)}...)` : '❌ Not set');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Not set');
console.log('HIGHLIGHTLY_API_KEY:', process.env.HIGHLIGHTLY_API_KEY ? '✅ Set' : '❌ Not set');
console.log('SEASON_YEAR:', process.env.SEASON_YEAR || 'Not set (will default to 2025)');

const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseKey = SUPABASE_SERVICE_ROLE || SUPABASE_ANON_KEY;

console.log('\nKey Selection Logic:');
console.log('SUPABASE_SERVICE_ROLE value:', SUPABASE_SERVICE_ROLE ? `"${SUPABASE_SERVICE_ROLE.substring(0, 20)}..."` : '""');
console.log('SUPABASE_ANON_KEY value:', SUPABASE_ANON_KEY ? `"${SUPABASE_ANON_KEY.substring(0, 20)}..."` : '""');
console.log('Selected key:', supabaseKey === SUPABASE_SERVICE_ROLE ? 'SERVICE_ROLE' : 'ANON_KEY');
console.log('Will use:', SUPABASE_SERVICE_ROLE ? 'SERVICE_ROLE' : 'ANON_KEY');
