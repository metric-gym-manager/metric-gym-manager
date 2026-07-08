import { NextRequest, NextResponse } from 'next/server';
import { sendSmsViaTextLk } from '@/features/sms/services/textlk.service';

// ============================================================
// POST /api/demo/send-sms - Demo SMS Sending (Localhost only)
// ============================================================

/**
 * Demo endpoint for testing SMS functionality during gym manager visits.
 * SECURITY: Only works on localhost. Rejects all production requests.
 */
export async function POST(request: NextRequest) {
  // SECURITY: Only allow localhost
  const host = request.headers.get('host') || '';
  if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
    return NextResponse.json(
      { success: false, error: 'Demo endpoint only available on localhost' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { name, phone, gymName, type, fee } = body;

    // Validate inputs
    if (!name || !phone || !gymName || !type || !fee) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, phone, gymName, type, fee' },
        { status: 400 }
      );
    }

    // Validate phone format (+94XXXXXXXXX)
    const phoneRegex = /^\+94\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone format. Use: +94XXXXXXXXX' },
        { status: 400 }
      );
    }

    // Validate type
    if (!['welcome', 'due', 'receipt'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be: welcome, due, or receipt' },
        { status: 400 }
      );
    }

    // Validate fee (must be a positive number)
    const feeNumber = parseFloat(fee);
    if (isNaN(feeNumber) || feeNumber <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid fee. Must be a positive number' },
        { status: 400 }
      );
    }

    // Format SMS message based on type
    const message = formatDemoMessage(type, name, gymName, feeNumber);

    // Check if real SMS is enabled
    const useRealSms = process.env.ENABLE_REAL_SMS === 'true';

    if (useRealSms) {
      // Send real SMS via text.lk
      console.log('📱 [DEMO - REAL SMS] Sending via text.lk:');
      console.log(`   To: ${phone}`);
      console.log(`   Type: ${type}`);
      console.log(`   Message: ${message}`);

      const result = await sendSmsViaTextLk({
        to: phone,
        message: message,
      });

      if (result.success) {
        console.log(`   ✓ SMS sent successfully (ID: ${result.message_id})`);
        if (result.balance !== undefined) {
          console.log(`   Balance: ${result.balance} credits`);
        }

        return NextResponse.json(
          {
            success: true,
            message: 'SMS sent successfully',
            messageId: result.message_id,
            balance: result.balance,
          },
          { status: 200 }
        );
      } else {
        console.error(`   ✗ SMS failed: ${result.error}`);
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to send SMS' },
          { status: 500 }
        );
      }
    } else {
      // Mock mode - just log to console
      console.log('📱 [DEMO - MOCK SMS] Would send:');
      console.log(`   To: ${phone}`);
      console.log(`   Type: ${type}`);
      console.log(`   Message: ${message}`);

      return NextResponse.json(
        {
          success: true,
          message: 'SMS sent successfully (mock mode)',
          mock: true,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Demo SMS API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Format demo SMS messages with custom amounts and dates
 */
function formatDemoMessage(type: string, name: string, gymName: string, fee: number): string {
  // Format amount with thousands separator and 2 decimal places
  const amount = `Rs.${fee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + 1);
  const dueDateStr = dueDate.toLocaleDateString('en-GB');

  switch (type) {
    case 'welcome':
      return `Welcome to ${gymName}, ${name}! Your Annual membership is now active. Amount paid: ${amount}. Thank you for joining us!`;

    case 'due':
      return `Dear ${name}, your Annual membership at ${gymName} is due on ${dueDateStr}. Amount: ${amount}. Thank you.`;

    case 'receipt':
      return `Dear ${name}, payment of ${amount} received. Next due date: ${dueDateStr}. Thank you - ${gymName}`;

    default:
      return `Message from ${gymName}`;
  }
}
