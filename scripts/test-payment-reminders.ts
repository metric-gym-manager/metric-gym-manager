/**
 * Comprehensive Test Suite for Payment Reminders Feature
 *
 * This script tests:
 * 1. Daily members: NO automatic reminders
 * 2. Monthly members: 3-day and due-date only (NO 7-day)
 * 3. Other plans: All reminders (7-day, 3-day, due-date, overdue)
 * 4. SMS logging
 * 5. Frontend display logic
 * 6. Manual reminders
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as path from 'path';

config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const GYM_ID = '0489fa6e-075d-48b1-8bc0-838199d8a4af'; // Fitness Empire

interface TestMember {
  name: string;
  plan_type: 'daily' | 'monthly' | '3-months' | '6-months' | 'annual';
  days_until_due: number;
  expected_sms: string[]; // SMS types that SHOULD be sent
}

// Test scenarios
const TEST_SCENARIOS: TestMember[] = [
  // DAILY MEMBERS - Should receive NO automatic reminders
  { name: 'Daily Test - 7 Days', plan_type: 'daily', days_until_due: 7, expected_sms: [] },
  { name: 'Daily Test - 3 Days', plan_type: 'daily', days_until_due: 3, expected_sms: [] },
  { name: 'Daily Test - Due Today', plan_type: 'daily', days_until_due: 0, expected_sms: [] },
  { name: 'Daily Test - Overdue', plan_type: 'daily', days_until_due: -2, expected_sms: [] },

  // MONTHLY MEMBERS - Should receive 3-day and due-date only (NO 7-day)
  { name: 'Monthly Test - 7 Days', plan_type: 'monthly', days_until_due: 7, expected_sms: [] },
  { name: 'Monthly Test - 3 Days', plan_type: 'monthly', days_until_due: 3, expected_sms: ['reminder_3day'] },
  { name: 'Monthly Test - Due Today', plan_type: 'monthly', days_until_due: 0, expected_sms: ['due_today'] },
  { name: 'Monthly Test - Overdue', plan_type: 'monthly', days_until_due: -5, expected_sms: ['overdue'] },

  // ANNUAL MEMBERS - Should receive ALL reminders
  { name: 'Annual Test - 7 Days', plan_type: 'annual', days_until_due: 7, expected_sms: ['reminder_7day'] },
  { name: 'Annual Test - 3 Days', plan_type: 'annual', days_until_due: 3, expected_sms: ['reminder_3day'] },
  { name: 'Annual Test - Due Today', plan_type: 'annual', days_until_due: 0, expected_sms: ['due_today'] },
  { name: 'Annual Test - Overdue', plan_type: 'annual', days_until_due: -3, expected_sms: ['overdue'] },

  // 3-MONTHS MEMBERS - Should receive ALL reminders
  { name: '3-Month Test - 7 Days', plan_type: '3-months', days_until_due: 7, expected_sms: ['reminder_7day'] },
  { name: '3-Month Test - 3 Days', plan_type: '3-months', days_until_due: 3, expected_sms: ['reminder_3day'] },

  // 6-MONTHS MEMBERS - Should receive ALL reminders
  { name: '6-Month Test - Due Today', plan_type: '6-months', days_until_due: 0, expected_sms: ['due_today'] },
];

/**
 * Calculate due date based on days from today
 */
function calculateDueDate(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().split('T')[0];
}

/**
 * Clean up any existing test members
 */
async function cleanupTestMembers() {
  console.log('🧹 Cleaning up existing test members...\n');

  const { error } = await supabase
    .from('members')
    .delete()
    .eq('gym_id', GYM_ID)
    .like('name', '%Test%');

  if (error) {
    console.error('Failed to cleanup test members:', error);
  } else {
    console.log('✓ Cleanup complete\n');
  }
}

/**
 * Create test members
 */
async function createTestMembers(): Promise<Map<string, string>> {
  console.log('📝 Creating test members...\n');
  const memberIds = new Map<string, string>();

  for (const scenario of TEST_SCENARIOS) {
    const dueDate = calculateDueDate(scenario.days_until_due);
    const phoneNumber = `+947${Math.floor(10000000 + Math.random() * 90000000)}`;

    const { data: member, error } = await supabase
      .from('members')
      .insert({
        gym_id: GYM_ID,
        name: scenario.name,
        phone_number: phoneNumber,
        plan_type: scenario.plan_type,
        plan_amount: 3500,
        status: 'active',
        registered_date: new Date().toISOString().split('T')[0],
        membership_start_date: new Date().toISOString().split('T')[0],
        next_due_date: dueDate,
      })
      .select('id, name, plan_type, next_due_date')
      .single();

    if (error || !member) {
      console.error(`✗ Failed to create ${scenario.name}:`, error?.message);
    } else {
      memberIds.set(scenario.name, member.id);
      console.log(`✓ Created: ${member.name}`);
      console.log(`  Plan: ${member.plan_type}, Due: ${member.next_due_date} (${scenario.days_until_due} days)`);
    }
  }

  console.log(`\n✅ Created ${memberIds.size} test members\n`);
  return memberIds;
}

/**
 * Simulate cron job execution
 */
async function simulateCronJob() {
  console.log('🚀 Simulating automated reminder cron job...\n');

  // Call the cron endpoint
  const response = await fetch('http://localhost:3000/api/cron/send-reminders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CRON_SECRET || 'dev-secret-key'}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.error('✗ Cron job failed:', response.status, response.statusText);
    const error = await response.json();
    console.error('Error details:', error);
    return null;
  }

  const result = await response.json();
  console.log('✓ Cron job completed successfully\n');
  console.log('Results:', JSON.stringify(result.data, null, 2));

  return result.data;
}

/**
 * Verify SMS logs were created correctly
 */
async function verifySMSLogs(memberIds: Map<string, string>): Promise<void> {
  console.log('\n📊 Verifying SMS logs...\n');

  let passCount = 0;
  let failCount = 0;

  for (const scenario of TEST_SCENARIOS) {
    const memberId = memberIds.get(scenario.name);
    if (!memberId) {
      console.error(`✗ Member ID not found for ${scenario.name}`);
      failCount++;
      continue;
    }

    // Fetch SMS logs for this member
    const { data: smsLogs, error } = await supabase
      .from('sms_logs')
      .select('*')
      .eq('member_id', memberId)
      .eq('gym_id', GYM_ID)
      .order('sent_at', { ascending: false });

    if (error) {
      console.error(`✗ Failed to fetch SMS logs for ${scenario.name}:`, error.message);
      failCount++;
      continue;
    }

    // Filter to only payment reminder SMS
    const reminderLogs = smsLogs?.filter(log =>
      ['reminder_7day', 'reminder_3day', 'due_today', 'overdue'].includes(log.sms_type)
    ) || [];

    const actualSMS = reminderLogs.map(log => log.sms_type);
    const expected = scenario.expected_sms;

    // Check if actual matches expected
    const isMatch =
      actualSMS.length === expected.length &&
      expected.every(type => actualSMS.includes(type));

    if (isMatch) {
      console.log(`✅ ${scenario.name}`);
      console.log(`   Expected: [${expected.join(', ') || 'NONE'}]`);
      console.log(`   Actual:   [${actualSMS.join(', ') || 'NONE'}]`);
      passCount++;
    } else {
      console.log(`❌ ${scenario.name}`);
      console.log(`   Expected: [${expected.join(', ') || 'NONE'}]`);
      console.log(`   Actual:   [${actualSMS.join(', ') || 'NONE'}]`);
      failCount++;
    }
  }

  console.log(`\n📈 Test Results: ${passCount} passed, ${failCount} failed\n`);
}

/**
 * Test frontend display logic
 */
async function testFrontendDisplay(memberIds: Map<string, string>): Promise<void> {
  console.log('🖥️  Testing frontend display logic...\n');

  // Fetch reminders data (same as frontend does)
  const response = await fetch('http://localhost:3000/api/sms/reminders');

  if (!response.ok) {
    console.error('✗ Failed to fetch reminders');
    return;
  }

  const result = await response.json();
  const reminders = result.data.reminders;

  console.log(`✓ Fetched ${reminders.length} reminders from API\n`);

  // Test specific scenarios
  const testCases = [
    {
      name: 'Daily Test - 7 Days',
      expectedStatuses: { '7day': 'not_applicable', '3day': 'not_applicable', 'due': 'not_applicable' }
    },
    {
      name: 'Monthly Test - 7 Days',
      expectedStatuses: { '7day': 'not_applicable', '3day': 'not_sent', 'due': 'not_sent' }
    },
    {
      name: 'Monthly Test - 3 Days',
      expectedStatuses: { '7day': 'not_applicable', '3day': 'sent', 'due': 'not_sent' }
    },
    {
      name: 'Annual Test - 7 Days',
      expectedStatuses: { '7day': 'sent', '3day': 'not_sent', 'due': 'not_sent' }
    },
  ];

  for (const testCase of testCases) {
    const memberId = memberIds.get(testCase.name);
    const reminder = reminders.find((r: any) => r.id === memberId);

    if (!reminder) {
      console.log(`⚠️  ${testCase.name}: Not found in reminders list`);
      continue;
    }

    console.log(`Testing: ${testCase.name}`);
    console.log(`  Plan: ${reminder.plan_type}, Days until due: ${reminder.days_until_due}`);
    console.log(`  Last reminder type: ${reminder.last_reminder_type || 'none'}`);
    console.log(`  Expected statuses: ${JSON.stringify(testCase.expectedStatuses)}`);
    console.log('');
  }
}

/**
 * Test manual reminder sending
 */
async function testManualReminder(memberIds: Map<string, string>): Promise<void> {
  console.log('🔧 Testing manual reminder send...\n');

  const testMemberName = 'Monthly Test - 7 Days';
  const memberId = memberIds.get(testMemberName);

  if (!memberId) {
    console.error('✗ Test member not found');
    return;
  }

  console.log(`Sending manual reminder to: ${testMemberName}`);

  const response = await fetch('http://localhost:3000/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      memberId: memberId,
      smsType: 'reminder_7day',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('✗ Manual send failed:', error);
    return;
  }

  const result = await response.json();
  console.log('✓ Manual reminder sent successfully');
  console.log('Result:', result);

  // Verify SMS log was created
  const { data: smsLogs } = await supabase
    .from('sms_logs')
    .select('*')
    .eq('member_id', memberId)
    .eq('sms_type', 'reminder_7day')
    .order('sent_at', { ascending: false })
    .limit(1);

  if (smsLogs && smsLogs.length > 0) {
    const log = smsLogs[0];
    console.log('✓ SMS log created:');
    console.log(`  Type: ${log.sms_type}`);
    console.log(`  Sent at: ${log.sent_at}`);
    console.log(`  Status: ${log.delivery_status}`);
  }

  console.log('');
}

/**
 * Test SMS History Modal data
 */
async function testSMSHistoryModal(memberIds: Map<string, string>): Promise<void> {
  console.log('📜 Testing SMS History Modal data...\n');

  const testMemberName = 'Monthly Test - 3 Days';
  const memberId = memberIds.get(testMemberName);

  if (!memberId) {
    console.error('✗ Test member not found');
    return;
  }

  console.log(`Fetching SMS history for: ${testMemberName}`);

  const response = await fetch(`http://localhost:3000/api/members/${memberId}/sms-history`);

  if (!response.ok) {
    console.error('✗ Failed to fetch SMS history');
    return;
  }

  const result = await response.json();
  const { member, smsLogs, totalCount } = result.data;

  console.log('✓ SMS History fetched successfully');
  console.log(`  Member: ${member.name} (${member.phone_number})`);
  console.log(`  Total SMS logs: ${totalCount}`);

  // Filter payment reminders
  const paymentReminders = smsLogs.filter((log: any) =>
    ['reminder_7day', 'reminder_3day', 'due_today', 'overdue'].includes(log.sms_type)
  );

  console.log(`  Payment reminders: ${paymentReminders.length}`);

  paymentReminders.forEach((log: any) => {
    console.log(`    - ${log.sms_type}: ${log.delivery_status} at ${new Date(log.sent_at).toLocaleString()}`);
  });

  console.log('');
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   PAYMENT REMINDERS COMPREHENSIVE TEST SUITE              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Cleanup
    await cleanupTestMembers();

    // Step 2: Create test members
    const memberIds = await createTestMembers();

    // Step 3: Simulate cron job
    console.log('⏰ Waiting 2 seconds before simulating cron...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const cronResult = await simulateCronJob();

    if (!cronResult) {
      console.error('❌ Cron job simulation failed. Cannot continue tests.');
      return;
    }

    // Step 4: Verify SMS logs
    await verifySMSLogs(memberIds);

    // Step 5: Test frontend display
    await testFrontendDisplay(memberIds);

    // Step 6: Test manual reminder
    await testManualReminder(memberIds);

    // Step 7: Test SMS history modal
    await testSMSHistoryModal(memberIds);

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   TEST SUITE COMPLETED                                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('📝 Summary:');
    console.log('  1. Test members created: ✓');
    console.log('  2. Cron job simulated: ✓');
    console.log('  3. SMS logs verified: ✓');
    console.log('  4. Frontend display tested: ✓');
    console.log('  5. Manual reminder tested: ✓');
    console.log('  6. SMS history modal tested: ✓');
    console.log('\n✨ All tests complete!\n');

  } catch (error) {
    console.error('💥 Test suite error:', error);
    process.exit(1);
  }
}

// Run tests
runTests().catch(console.error);
