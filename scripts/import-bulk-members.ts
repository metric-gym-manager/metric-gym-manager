/**
 * Script to bulk import member records from CSV file with backdated registration dates
 * This script directly inserts into the database to support historical data import
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Fitness Empire gym ID (identified earlier)
const GYM_ID = '0489fa6e-075d-48b1-8bc0-838199d8a4af';

interface MemberRecord {
  name: string;
  phone_number: string;
  plan_type: string;
  registered_date: string;
  plan_amount: number;
}

/**
 * Format phone number to Sri Lankan format (+94XXXXXXXXX)
 */
function formatPhoneNumber(phone: string): string {
  // Remove any whitespace
  const cleaned = phone.trim();

  // If already has +94, return as is
  if (cleaned.startsWith('+94')) {
    return cleaned;
  }

  // If starts with 0, remove it and add +94
  if (cleaned.startsWith('0')) {
    return `+94${cleaned.substring(1)}`;
  }

  // Otherwise just add +94
  return `+94${cleaned}`;
}

/**
 * Parse CSV file
 */
function parseCSV(filePath: string): MemberRecord[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  // Skip header
  const dataLines = lines.slice(1);

  return dataLines.map((line) => {
    const [name, phone_number, plan_type, registered_date, plan_amount] = line.split(',');

    return {
      name: name.trim(),
      phone_number: phone_number.trim(),
      plan_type: plan_type.trim(),
      registered_date: registered_date.trim(),
      plan_amount: parseFloat(plan_amount.trim()),
    };
  });
}

/**
 * Calculate next due date based on plan type and start date
 */
function calculateNextDueDate(startDate: Date, planType: string): Date {
  const nextDue = new Date(startDate);

  switch (planType.toLowerCase()) {
    case 'daily':
      nextDue.setDate(nextDue.getDate() + 1);
      break;
    case 'weekly':
      nextDue.setDate(nextDue.getDate() + 7);
      break;
    case 'monthly':
      nextDue.setMonth(nextDue.getMonth() + 1);
      break;
    case '3-months':
      nextDue.setMonth(nextDue.getMonth() + 3);
      break;
    case '6-months':
      nextDue.setMonth(nextDue.getMonth() + 6);
      break;
    case 'annual':
      nextDue.setFullYear(nextDue.getFullYear() + 1);
      break;
  }

  return nextDue;
}

/**
 * Import a single member
 */
async function importMember(record: MemberRecord): Promise<{ success: boolean; error?: string }> {
  try {
    // Format phone number
    const formattedPhone = formatPhoneNumber(record.phone_number);

    // Parse registration date (extract just YYYY-MM-DD to avoid timezone issues)
    const dateMatch = record.registered_date.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!dateMatch) {
      throw new Error(`Invalid date format: ${record.registered_date}`);
    }
    const registeredDateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    const registeredDate = new Date(registeredDateStr + 'T12:00:00'); // Use noon to avoid timezone issues

    // Calculate next due date
    const nextDueDate = calculateNextDueDate(registeredDate, record.plan_type);
    const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

    // Insert member
    const { data: member, error: memberError } = await supabase
      .from('members')
      .insert({
        gym_id: GYM_ID,
        name: record.name,
        phone_number: formattedPhone,
        plan_type: record.plan_type.toLowerCase(),
        plan_amount: record.plan_amount,
        status: 'active',
        registered_date: registeredDateStr,
        membership_start_date: registeredDateStr,
        next_due_date: nextDueDateStr,
        discount_id: null,
        recurring_discount: false,
      })
      .select()
      .single();

    if (memberError || !member) {
      throw new Error(`Failed to create member: ${memberError?.message}`);
    }

    // Insert payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        gym_id: GYM_ID,
        member_id: member.id,
        payment_date: registeredDateStr,
        amount_paid: record.plan_amount,
        next_due_date_calculated: nextDueDateStr,
        discount_applied: null,
        discount_percentage: null,
      });

    if (paymentError) {
      console.warn(`⚠️  Member created but payment record failed for ${record.name}: ${paymentError.message}`);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Main import function
 */
async function main() {
  console.log('🚀 Starting bulk member import for Fitness Empire\n');
  console.log(`📍 Gym ID: ${GYM_ID}\n`);

  // Parse CSV
  const csvPath = path.join(__dirname, 'bulk-members-import.csv');
  console.log(`📄 Reading CSV file: ${csvPath}`);

  const records = parseCSV(csvPath);
  console.log(`✅ Parsed ${records.length} member records\n`);

  // Import members
  console.log('⏳ Importing members...\n');

  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ name: string; error: string }> = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    process.stdout.write(`[${i + 1}/${records.length}] ${record.name}... `);

    const result = await importMember(record);

    if (result.success) {
      console.log('✅');
      successCount++;
    } else {
      console.log(`❌ ${result.error}`);
      errorCount++;
      errors.push({ name: record.name, error: result.error || 'Unknown error' });
    }
  }

  // Summary
  console.log('\n📊 Import Summary:');
  console.log(`   ✅ Successfully imported: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(({ name, error }) => {
      console.log(`   - ${name}: ${error}`);
    });
  }

  // Verify total member count
  const { count } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('gym_id', GYM_ID);

  console.log(`\n📈 Total members in Fitness Empire: ${count}`);
  console.log('\n✨ Import complete!');
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
