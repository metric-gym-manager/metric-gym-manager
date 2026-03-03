/**
 * Backfill Initial Payment Records
 *
 * This script adds the initial payment record for all existing members
 * who don't have a payment on their registration date.
 *
 * Usage: npx tsx scripts/backfill-initial-payments.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

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
});

interface Member {
  id: string;
  gym_id: string;
  name: string;
  registered_date: string;
  membership_start_date: string;
  plan_type: string;
  plan_amount: number;
  discount_id: string | null;
  next_due_date: string;
}

interface Discount {
  id: string;
  discount_name: string;
  discount_percentage: number;
}

async function backfillInitialPayments() {
  console.log('🚀 Starting backfill of initial payment records...\n');

  // Step 1: Get all members
  console.log('📋 Fetching all members...');
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, gym_id, name, registered_date, membership_start_date, plan_type, plan_amount, discount_id, next_due_date')
    .order('registered_date', { ascending: true });

  if (membersError) {
    console.error('❌ Failed to fetch members:', membersError);
    process.exit(1);
  }

  if (!members || members.length === 0) {
    console.log('✅ No members found. Nothing to backfill.');
    return;
  }

  console.log(`✓ Found ${members.length} members\n`);

  // Step 2: Get all discounts (for reference)
  const { data: discounts, error: discountsError } = await supabase
    .from('discounts')
    .select('id, discount_name, discount_percentage');

  if (discountsError) {
    console.error('❌ Failed to fetch discounts:', discountsError);
    process.exit(1);
  }

  const discountMap = new Map<string, Discount>();
  (discounts || []).forEach((d: Discount) => {
    discountMap.set(d.id, d);
  });

  // Step 3: Process each member
  let processedCount = 0;
  let skippedCount = 0;
  let insertedCount = 0;
  let errorCount = 0;

  console.log('🔄 Processing members...\n');

  for (const member of members as Member[]) {
    processedCount++;

    // Check if payment already exists for this member on registered_date
    const { data: existingPayments, error: checkError } = await supabase
      .from('payments')
      .select('id')
      .eq('member_id', member.id)
      .eq('payment_date', member.registered_date)
      .limit(1);

    if (checkError) {
      console.error(`❌ [${processedCount}/${members.length}] Error checking ${member.name}:`, checkError.message);
      errorCount++;
      continue;
    }

    if (existingPayments && existingPayments.length > 0) {
      console.log(`⏭️  [${processedCount}/${members.length}] Skipped ${member.name} - payment already exists`);
      skippedCount++;
      continue;
    }

    // Get discount info if applicable
    let discountName: string | null = null;
    let discountPercentage: number | null = null;
    let effectiveAmount = member.plan_amount;

    if (member.discount_id && discountMap.has(member.discount_id)) {
      const discount = discountMap.get(member.discount_id)!;
      discountName = discount.discount_name;
      discountPercentage = discount.discount_percentage;
      // Calculate the amount actually paid with discount
      effectiveAmount = member.plan_amount - (member.plan_amount * discount.discount_percentage / 100);
    }

    // Insert initial payment record
    const { error: insertError } = await supabase
      .from('payments')
      .insert({
        gym_id: member.gym_id,
        member_id: member.id,
        payment_date: member.registered_date,
        amount_paid: effectiveAmount,
        discount_applied: discountName,
        discount_percentage: discountPercentage,
        next_due_date_calculated: member.next_due_date,
      });

    if (insertError) {
      console.error(`❌ [${processedCount}/${members.length}] Failed to insert payment for ${member.name}:`, insertError.message);
      errorCount++;
      continue;
    }

    console.log(
      `✅ [${processedCount}/${members.length}] Added payment for ${member.name} ` +
      `(${member.plan_type}, LKR ${effectiveAmount.toFixed(2)} on ${member.registered_date})`
    );
    insertedCount++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 BACKFILL SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total members processed:  ${processedCount}`);
  console.log(`Payments inserted:        ${insertedCount}`);
  console.log(`Already had payment:      ${skippedCount}`);
  console.log(`Errors:                   ${errorCount}`);
  console.log('='.repeat(60) + '\n');

  if (insertedCount > 0) {
    console.log('✅ Backfill completed successfully!');
  } else {
    console.log('ℹ️  No new payments were needed.');
  }
}

// Run the script
backfillInitialPayments()
  .then(() => {
    console.log('\n✨ Script finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
