/**
 * Apply gym_id Migration to Payments Table
 *
 * This script uses the Supabase Management API to apply the migration
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

async function executeSql(sql) {
  const apiUrl = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
  const projectRef = apiUrl.split('.')[0];

  // Try direct PostgREST query
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({})
  });

  return response;
}

async function applyMigration() {
  console.log('🚀 Applying gym_id migration to payments table\n');
  console.log('📋 Please copy the following SQL and run it in Supabase Dashboard:\n');
  console.log('=' .repeat(60));

  const migrationPath = path.resolve(__dirname, '../supabase/migrations/20260303000001_add_gym_id_to_payments.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log(sql);
  console.log('=' .repeat(60));
  console.log('\n📌 Steps to apply:');
  console.log('1. Go to: https://supabase.com/dashboard (select your project)');
  console.log('2. Navigate to: SQL Editor → New query');
  console.log('3. Paste the SQL above');
  console.log('4. Click "Run"');
  console.log('\n✨ After migration completes, run:');
  console.log('   npx tsx scripts/backfill-initial-payments.ts\n');
}

applyMigration().catch(console.error);
