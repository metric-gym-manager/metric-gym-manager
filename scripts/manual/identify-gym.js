/**
 * Script to identify a gym by name in the database
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function identifyGym(searchTerm) {
  console.log(`\n🔍 Searching for gym: "${searchTerm}"\n`);

  // Query gyms table
  const { data: gyms, error } = await supabase
    .from('gyms')
    .select('*')
    .ilike('gym_name', `%${searchTerm}%`);

  if (error) {
    console.error('❌ Error querying database:', error.message);
    process.exit(1);
  }

  if (!gyms || gyms.length === 0) {
    console.log(`⚠️  No gyms found matching "${searchTerm}"`);

    // Show all gyms as reference
    console.log('\n📋 All gyms in database:');
    const { data: allGyms } = await supabase
      .from('gyms')
      .select('id, gym_name, owner_name, email')
      .order('created_at', { ascending: false });

    if (allGyms && allGyms.length > 0) {
      allGyms.forEach((gym, i) => {
        console.log(`\n${i + 1}. ${gym.gym_name}`);
        console.log(`   ID: ${gym.id}`);
        console.log(`   Owner: ${gym.owner_name}`);
        console.log(`   Email: ${gym.email}`);
      });
    } else {
      console.log('   (No gyms found in database)');
    }
    return;
  }

  // Display results
  console.log(`✅ Found ${gyms.length} gym(s):\n`);

  gyms.forEach((gym, i) => {
    console.log(`${i + 1}. ${gym.gym_name}`);
    console.log(`   ├─ ID: ${gym.id}`);
    console.log(`   ├─ Owner: ${gym.owner_name}`);
    console.log(`   ├─ Email: ${gym.email}`);
    console.log(`   ├─ Phone: ${gym.phone_number || 'N/A'}`);
    console.log(`   ├─ Address: ${gym.address || 'N/A'}`);
    console.log(`   ├─ User ID: ${gym.user_id}`);
    console.log(`   └─ Created: ${new Date(gym.created_at).toLocaleString()}`);
    console.log('');
  });

  // Get member count for each gym
  for (const gym of gyms) {
    const { count } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('gym_id', gym.id);

    console.log(`📊 ${gym.gym_name} has ${count || 0} members`);
  }
}

// Get search term from command line or use default
const searchTerm = process.argv[2] || 'Fitness Empire';
identifyGym(searchTerm).catch(console.error);
