/**
 * Development Utility: Clear Supabase Auth Rate Limits
 *
 * Run this script when you hit rate limits during development:
 * node scripts/clear-rate-limits.js
 *
 * This script clears:
 * - Email rate limits (signup/password reset)
 * - OTP rate limits (from otp_tokens table)
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

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

async function clearRateLimits() {
  console.log('🧹 Clearing development rate limits...\n');

  try {
    // 1. Clear OTP tokens (our custom rate limiting)
    console.log('📱 Clearing OTP rate limits...');
    const { error: otpError } = await supabase
      .from('otp_tokens')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (otpError) {
      console.error('   ❌ Failed to clear OTP tokens:', otpError.message);
    } else {
      console.log('   ✅ OTP rate limits cleared');
    }

    // 2. Info about Auth rate limits
    console.log('\n📧 Supabase Auth Rate Limits:');
    console.log('   ⚠️  Auth rate limits are managed by Supabase internally.');
    console.log('   ⚠️  To fully reset them, you have 2 options:');
    console.log('   \n   Option 1: Wait 1 hour (rate limits auto-reset)');
    console.log('   \n   Option 2: Use a different email for testing');
    console.log('   \n   Option 3: Disable email confirmations temporarily:');
    console.log('      1. Go to: https://app.supabase.com/project/' + supabaseUrl.split('//')[1].split('.')[0] + '/auth/providers');
    console.log('      2. Disable "Enable email confirmations"');
    console.log('      3. Re-enable after testing\n');

    // 3. Alternative: Delete test users to free up rate limits
    console.log('🗑️  Optional: Delete test users?');
    console.log('   Run: node scripts/delete-test-users.js\n');

    console.log('✅ Rate limit cleanup complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

clearRateLimits();
