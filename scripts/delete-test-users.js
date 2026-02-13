/**
 * Development Utility: Delete Test Users
 *
 * Run this script to clean up test users during development:
 * node scripts/delete-test-users.js
 *
 * This helps with:
 * - Freeing up email rate limits
 * - Cleaning test data
 * - Resetting development database state
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: Missing Supabase credentials in .env.local');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function deleteTestUsers() {
  console.log('🗑️  Delete Test Users Utility\n');

  try {
    // Get all users
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error('❌ Failed to fetch users:', usersError.message);
      process.exit(1);
    }

    if (!users || users.users.length === 0) {
      console.log('✅ No users found in the database.\n');
      process.exit(0);
    }

    console.log(`📋 Found ${users.users.length} user(s):\n`);
    users.users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (Created: ${new Date(user.created_at).toLocaleString()})`);
    });

    console.log('\n⚠️  WARNING: This will permanently delete users and all related data!');
    const confirm = await ask('\nType "DELETE ALL" to confirm deletion (or anything else to cancel): ');

    if (confirm.trim() !== 'DELETE ALL') {
      console.log('\n❌ Deletion cancelled.\n');
      rl.close();
      process.exit(0);
    }

    console.log('\n🗑️  Deleting users...\n');

    let successCount = 0;
    let failCount = 0;

    for (const user of users.users) {
      try {
        // Delete from auth.users (this should cascade to gyms table)
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

        if (deleteError) {
          console.log(`   ❌ Failed to delete ${user.email}: ${deleteError.message}`);
          failCount++;
        } else {
          console.log(`   ✅ Deleted ${user.email}`);
          successCount++;
        }
      } catch (error) {
        console.log(`   ❌ Error deleting ${user.email}: ${error.message}`);
        failCount++;
      }
    }

    console.log(`\n✅ Deletion complete!`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Failed: ${failCount}\n`);

    rl.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    rl.close();
    process.exit(1);
  }
}

deleteTestUsers();
