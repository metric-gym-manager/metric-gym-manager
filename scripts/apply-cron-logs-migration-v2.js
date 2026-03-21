const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('📦 Applying cron_execution_logs migration...\n');

  const migrationSql = fs.readFileSync(
    path.join(__dirname, '../supabase/migrations/20260321000001_create_cron_execution_logs.sql'),
    'utf8'
  );

  // Split by semicolons and filter empty statements
  const statements = migrationSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`[${i + 1}/${statements.length}] Executing: ${statement.substring(0, 60)}...`);

    try {
      // Use execute_sql RPC function
      const { data, error } = await supabase.rpc('execute_sql', {
        sql_query: statement + ';'
      });

      if (error) {
        console.error(`❌ Error:`, error.message);
        // Try with raw SQL instead
        console.log(`   Retrying with raw query...`);
        const pgResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'POST',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ query: statement + ';' })
        });

        if (!pgResponse.ok) {
          console.error(`   ❌ Still failed`);
        } else {
          console.log(`   ✅ Success`);
        }
      } else {
        console.log(`   ✅ Success`);
      }
    } catch (err) {
      console.error(`❌ Exception:`, err.message);
    }
  }

  console.log('\n✅ Migration script completed');
  console.log('\nℹ️  If migration failed, manually apply via Supabase Dashboard:');
  console.log('   1. Go to SQL Editor in Supabase Dashboard');
  console.log('   2. Paste contents of: supabase/migrations/20260321000001_create_cron_execution_logs.sql');
  console.log('   3. Run the query\n');
}

applyMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
