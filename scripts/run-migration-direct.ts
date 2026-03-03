/**
 * Run Migration Directly
 *
 * Applies the gym_id column migration using direct SQL execution
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

async function runMigration() {
  console.log('🚀 Running migration: Add gym_id to payments table\n');

  const steps = [
    {
      name: 'Add gym_id column',
      sql: `ALTER TABLE payments ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE;`,
    },
    {
      name: 'Backfill gym_id from members',
      sql: `UPDATE payments p SET gym_id = m.gym_id FROM members m WHERE p.member_id = m.id AND p.gym_id IS NULL;`,
    },
    {
      name: 'Make gym_id NOT NULL',
      sql: `ALTER TABLE payments ALTER COLUMN gym_id SET NOT NULL;`,
    },
    {
      name: 'Create index on gym_id',
      sql: `CREATE INDEX IF NOT EXISTS idx_payments_gym_id ON payments(gym_id);`,
    },
    {
      name: 'Create composite index',
      sql: `CREATE INDEX IF NOT EXISTS idx_payments_gym_member ON payments(gym_id, member_id);`,
    },
    {
      name: 'Add column comment',
      sql: `COMMENT ON COLUMN payments.gym_id IS 'References the gym this payment belongs to (multi-tenant isolation)';`,
    },
  ];

  for (const step of steps) {
    console.log(`📝 ${step.name}...`);
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ query: step.sql }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.log(`   ⚠️  ${error}`);
      } else {
        console.log('   ✅ Done');
      }
    } catch (error: any) {
      console.log(`   ⚠️  ${error.message}`);
    }
  }

  console.log('\n✨ Migration steps executed');
  console.log('\n📌 Note: Some steps may have failed due to API limitations.');
  console.log('   If you see errors, please apply the migration manually:');
  console.log('   1. Open Supabase Dashboard SQL Editor');
  console.log('   2. Run: supabase/migrations/20260303000001_add_gym_id_to_payments.sql\n');
}

runMigration().catch(console.error);
