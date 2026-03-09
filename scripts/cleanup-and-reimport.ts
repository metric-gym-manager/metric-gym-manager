/**
 * Cleanup incorrectly dated members and re-import with correct dates
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const GYM_ID = '0489fa6e-075d-48b1-8bc0-838199d8a4af';

// Names from the CSV to identify which members to delete
const importedNames = [
  'Pramod Chanuka', 'Nimesh Miran', 'Dinuk', 'V. Thanuja', 'E. Denvar',
  'Sudarshani Kandasamy', 'Gihan Madusanka', 'Mallika', 'Manuja Pinsara',
  'Thilina Madusanka', 'Senuri Hansani', 'M. Dinnukshia', 'Chamara',
  'Justin', 'Menaka', 'Anuka Fernando', 'Nabeel', 'M. Rimzan', 'Althaf',
  'Kavin', 'Osanda Anuhas', 'Nayani Pavithra', 'Anuththara', 'Tharusha Ishadi',
  'Apnath Damian', 'Himashi Perera', 'Naveedniz', 'Thushan Jaliya',
  'Nimthiya Yogendran', 'Imesh Rangana', 'Pasindu Sahan', 'Lahiru Chamara',
  'Ashok', 'Abzal Arafath', 'Zaman', 'Dineth Thathsara', 'Shesha',
  'S. Pradeepan', 'Shevon Costa', 'Prasad Sandamal Police', 'Kasun',
  'Harsha', 'Yashoda Widurange', 'Priyankaru', 'Shaveen Thenuka',
  'J. Vashigaran', 'Sandunika Premathilaka', 'Charith', 'Dilshan Tharindu Police',
  'Chamika Dilshan Police', 'Nabil Nazeer', 'Dr. Afham', 'Musthaq',
  'Ravija', 'Pathum Bhagya', 'Shevon Rajakaruna', 'Theekshana Laksara',
  'Asmitha Shashini', 'Mahendran', 'Razlan', 'Pathum Sandaruwan',
  'N. Madushan Police', 'Usmaly', 'Pragash', 'Virun Jayasundera',
  'Chamod', 'Ornella Cumine', 'Nishan Perera', 'Sashmitha Suraji',
  'Rushini Shelama', 'Nuwan Nimaladeewa', 'Amanda', 'Dilanka Kodikara',
  'Jerome Reyshau', 'Isuru', 'Shirom De Silva', 'Nihal Ayya', 'Sathish'
];

async function cleanup() {
  console.log('🗑️  Cleaning up incorrectly dated members...\n');

  // Find members to delete
  const { data: membersToDelete, error: fetchError } = await supabase
    .from('members')
    .select('id, name, registered_date')
    .eq('gym_id', GYM_ID)
    .in('name', importedNames);

  if (fetchError) {
    console.error('❌ Error fetching members:', fetchError);
    return;
  }

  console.log(`Found ${membersToDelete?.length || 0} members to delete\n`);

  if (membersToDelete && membersToDelete.length > 0) {
    // Delete members (cascades to payments)
    const memberIds = membersToDelete.map((m) => m.id);
    const { error: deleteError } = await supabase
      .from('members')
      .delete()
      .in('id', memberIds);

    if (deleteError) {
      console.error('❌ Error deleting members:', deleteError);
      return;
    }

    console.log(`✅ Deleted ${membersToDelete.length} members\n`);
  }

  console.log('✨ Cleanup complete! Now run: npx tsx scripts/import-bulk-members.ts\n');
}

cleanup().catch(console.error);
