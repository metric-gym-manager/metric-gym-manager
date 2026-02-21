/**
 * Test script to verify welcome SMS is sent when creating a new member
 *
 * Usage: node test-welcome-sms.js
 */

const memberData = {
  name: 'SMS Test Member',
  phoneNumber: '+94783607777',
  emergencyContactName: 'Emergency Contact',
  emergencyContactPhone: '+94771234567',
  planType: 'monthly',
  planAmount: 5000,
  paymentAmount: 5000,
  membershipStartDate: new Date().toISOString().split('T')[0],
  discountId: null,
  recurringDiscount: false,
};

async function testWelcomeSMS() {
  try {
    console.log('🚀 Creating member via API to trigger welcome SMS...');
    console.log('Member data:', JSON.stringify(memberData, null, 2));

    const response = await fetch('http://localhost:3000/api/members', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: You'll need to add authentication headers if required
        // 'Cookie': 'your-session-cookie-here'
      },
      body: JSON.stringify(memberData),
    });

    const result = await response.json();

    if (response.ok) {
      console.log('\n✅ Member created successfully!');
      console.log('Member ID:', result.data.id);
      console.log('\n📱 Welcome SMS should be sent to:', memberData.phoneNumber);
      console.log('\n💡 Check the server console logs for SMS sending confirmation');
      console.log('💡 Query the sms_logs table to verify SMS was logged');
    } else {
      console.error('\n❌ Failed to create member:', result.error);
      console.error('Status:', response.status);
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n💡 Make sure the development server is running (npm run dev)');
  }
}

testWelcomeSMS();
