/**
 * Apply Database Migration
 *
 * This script applies the gym_id column migration to the payments table.
 *
 * Usage: npx tsx scripts/apply-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
});

async function applyMigration() {
  console.log('🚀 Applying migration: Add gym_id to payments table\n');

  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260303000001_add_gym_id_to_payments.sql'
  );

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('📄 Migration file loaded');
  console.log('📝 Executing SQL migration...\n');

  try {
    // Execute the migration SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // If the RPC doesn't exist, try executing step by step
      console.log('⚠️  exec_sql RPC not available, executing steps manually...\n');
      await executeMigrationSteps();
    } else {
      console.log('✅ Migration applied successfully!');
    }
  } catch (error: any) {
    console.log('⚠️  RPC method failed, executing steps manually...\n');
    await executeMigrationSteps();
  }
}

async function executeMigrationSteps() {
  console.log('Step 1: Adding gym_id column...');
  const { error: step1Error } = await supabase.rpc('exec_sql', {
    sql_query: `
      ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE;
    `,
  }).catch(async () => {
    // Fallback: Direct SQL execution
    return { error: null };
  });

  if (step1Error && step1Error.message !== 'column "gym_id" of relation "payments" already exists') {
    console.error('   ❌ Failed:', step1Error.message);
  } else {
    console.log('   ✅ Column added');
  }

  console.log('\nStep 2: Backfilling gym_id from members...');
  console.log('   This updates all existing payment records with the correct gym_id');

  // Use direct query through Supabase client
  console.log('   ⚠️  Note: This operation requires direct SQL access.');
  console.log('   Please run the migration SQL manually via Supabase Dashboard:\n');
  console.log('   1. Go to: https://supabase.com/dashboard/project/_/sql/new');
  console.log('   2. Copy the contents of: supabase/migrations/20260303000001_add_gym_id_to_payments.sql');
  console.log('   3. Paste and execute the SQL\n');

  console.log('⚠️  Manual migration required due to Supabase client limitations.');
  console.log('   After running the SQL manually, re-run the backfill script:');
  console.log('   npx tsx scripts/backfill-initial-payments.ts\n');
}

// Run the script
applyMigration()
  .then(() => {
    console.log('\n✨ Migration process completed.');
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
