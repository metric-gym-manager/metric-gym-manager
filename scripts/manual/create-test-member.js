const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestMember() {
  console.log('🔍 Finding gym for colomboshyan@gmail.com...\n');

  // Find gym
  const { data: gym, error: gymError } = await supabase
    .from('gyms')
    .select('id, gym_name, email')
    .eq('email', 'colomboshyan@gmail.com')
    .single();

  if (gymError || !gym) {
    console.error('❌ Gym not found:', gymError?.message);
    process.exit(1);
  }

  console.log(`✅ Found gym: ${gym.gym_name} (${gym.id})\n`);

  // Get an active plan type for this gym
  const { data: planTypes } = await supabase
    .from('plan_types')
    .select('*')
    .eq('gym_id', gym.id)
    .eq('is_active', true)
    .limit(1);

  if (!planTypes || planTypes.length === 0) {
    console.error('❌ No active plan types found for this gym');
    process.exit(1);
  }

  const planType = planTypes[0];
  console.log(`✅ Using plan type: ${planType.plan_type} (Rs. ${planType.default_amount})\n`);

  // Set due date to TOMORROW so "due_today" reminder triggers at tomorrow's 9 AM cron run
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const dueDateStr = tomorrow.toISOString().split('T')[0];

  console.log(`📅 Setting due date to TOMORROW: ${dueDateStr}`);
  console.log(`   This will trigger a "due_today" reminder when cron runs at 9:00 AM tomorrow\n`);

  // Create member
  const memberData = {
    gym_id: gym.id,
    name: 'Test Member',
    phone_number: '+94783607777',
    plan_type: planType.plan_type,
    plan_amount: planType.default_amount,
    next_due_date: dueDateStr,
    membership_start_date: dueDateStr,
    status: 'active',
    recurring_discount: false,
  };

  console.log('👤 Creating test member...');
  console.log(`   Name: ${memberData.name}`);
  console.log(`   Phone: ${memberData.phone_number}`);
  console.log(`   Plan: ${memberData.plan_type}`);
  console.log(`   Amount: Rs. ${memberData.plan_amount}`);
  console.log(`   Due Date: ${memberData.next_due_date}\n`);

  const { data: member, error: memberError } = await supabase
    .from('members')
    .insert(memberData)
    .select()
    .single();

  if (memberError) {
    console.error('❌ Failed to create member:', memberError.message);
    process.exit(1);
  }

  console.log('✅ Test member created successfully!');
  console.log(`   Member ID: ${member.id}`);
  console.log(`   Name: ${member.name}`);
  console.log(`   Phone: ${member.phone_number}`);
  console.log(`   Due Date: ${member.next_due_date}\n`);

  console.log('🚀 Verification Steps:');
  console.log('   1. Wait until tomorrow at 9:00 AM Sri Lanka time');
  console.log('   2. Vercel cron will automatically run /api/cron/send-reminders');
  console.log('   3. Check your phone (+94783607777) for the "due today" SMS reminder');
  console.log('   4. If you receive the SMS, Vercel cron is working correctly!');
  console.log('');
  console.log('⏰ Next Cron Execution:');
  const nextRun = new Date(tomorrow);
  nextRun.setHours(9, 0, 0, 0); // 9:00 AM Sri Lanka time tomorrow
  console.log(`   ${nextRun.toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })} (Sri Lanka Time)`);
  console.log('');
  console.log('📱 Expected SMS:');
  console.log(`   "Dear Test Member, your ${planType.plan_type} membership at ${gym.gym_name}`);
  console.log(`    expires today. Amount: Rs.${planType.default_amount.toFixed(2)}. Please make payment. Thank you."\n`);
}

createTestMember().catch(console.error);
