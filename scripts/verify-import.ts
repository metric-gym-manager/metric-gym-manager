/**
 * Verify the bulk member import
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);
const GYM_ID = '0489fa6e-075d-48b1-8bc0-838199d8a4af';

async function verify() {
  console.log('🔍 Verifying member import...\n');

  // Get sample members
  const { data: members, error } = await supabase
    .from('members')
    .select('*')
    .eq('gym_id', GYM_ID)
    .in('name', ['Pramod Chanuka', 'Nimesh Miran', 'Sathish'])
    .order('registered_date', { ascending: true });

  if (error) {
    console.error('❌ Error fetching members:', error);
    return;
  }

  console.log('📋 Sample Members:\n');
  members?.forEach((member) => {
    console.log(`${member.name}`);
    console.log(`  ├─ Phone: ${member.phone_number}`);
    console.log(`  ├─ Plan: ${member.plan_type} (LKR ${member.plan_amount})`);
    console.log(`  ├─ Registered: ${member.registered_date}`);
    console.log(`  ├─ Start Date: ${member.membership_start_date}`);
    console.log(`  ├─ Next Due: ${member.next_due_date}`);
    console.log(`  └─ Status: ${member.status}\n`);
  });

  // Check payment records
  const memberIds = members?.map((m) => m.id) || [];
  const { data: payments, error: paymentError } = await supabase
    .from('payments')
    .select('*')
    .in('member_id', memberIds)
    .order('payment_date', { ascending: true });

  if (paymentError) {
    console.error('❌ Error fetching payments:', paymentError);
    return;
  }

  console.log('💰 Sample Payment Records:\n');
  payments?.forEach((payment) => {
    const member = members?.find((m) => m.id === payment.member_id);
    console.log(`${member?.name}`);
    console.log(`  ├─ Payment Date: ${payment.payment_date}`);
    console.log(`  ├─ Amount: LKR ${payment.amount_paid}`);
    console.log(`  └─ Next Due Calculated: ${payment.next_due_date_calculated}\n`);
  });

  // Get count by registration date
  const { data: dateStats } = await supabase
    .from('members')
    .select('registered_date')
    .eq('gym_id', GYM_ID)
    .order('registered_date', { ascending: true });

  if (dateStats) {
    const dateCounts = dateStats.reduce((acc, m) => {
      acc[m.registered_date] = (acc[m.registered_date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('📅 Members by Registration Date:\n');
    Object.entries(dateCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, count]) => {
        console.log(`  ${date}: ${count} members`);
      });
  }

  console.log('\n✅ Verification complete!');
}

verify().catch(console.error);
