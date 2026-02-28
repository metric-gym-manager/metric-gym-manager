'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function DemoDashboard() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gymName, setGymName] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  const handleSendSMS = async (type: 'welcome' | 'due') => {
    if (!name.trim() || !phone.trim() || !gymName.trim()) {
      toast.error('Please enter name, phone number, and gym name');
      return;
    }

    // Validate phone format (should be +94XXXXXXXXX)
    const phoneRegex = /^\+94\d{9}$/;
    if (!phoneRegex.test(phone)) {
      toast.error('Phone must be in format: +94XXXXXXXXX (e.g., +94771234567)');
      return;
    }

    setLoading(type);
    try {
      const response = await fetch('/api/demo/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, gymName, type }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send SMS');
      }

      toast.success(`${type === 'welcome' ? 'Welcome' : 'Due reminder'} SMS sent successfully!`, {
        description: `Sent to ${phone}`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send SMS');
    } finally {
      setLoading(null);
    }
  };

  const handleResetRateLimits = async () => {
    setLoading('reset');
    try {
      const response = await fetch('/api/demo/reset-rate-limits', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset rate limits');
      }

      toast.success('Rate limits reset successfully!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reset rate limits');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">SMS Demo Dashboard</CardTitle>
            <CardDescription>
              Demonstrate the automated messaging system to gym managers during visits (Localhost only)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gymName">Gym Name</Label>
                <Input
                  id="gymName"
                  type="text"
                  placeholder="FitLife Gym"
                  value={gymName}
                  onChange={(e) => setGymName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Member Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+94771234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <p className="text-sm text-gray-500">
                  Format: +94XXXXXXXXX (Sri Lankan mobile number)
                </p>
              </div>
            </div>

            <div className="border-t pt-6 space-y-3">
              <h3 className="font-medium text-sm text-gray-700">Send Test Messages</h3>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => handleSendSMS('welcome')}
                  disabled={loading !== null}
                  className="w-full"
                >
                  {loading === 'welcome' ? 'Sending...' : 'Welcome SMS'}
                </Button>
                <Button
                  onClick={() => handleSendSMS('due')}
                  disabled={loading !== null}
                  variant="secondary"
                  className="w-full"
                >
                  {loading === 'due' ? 'Sending...' : 'Due SMS'}
                </Button>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-medium text-sm text-gray-700 mb-3">Reset Rate Limits</h3>
              <Button
                onClick={handleResetRateLimits}
                disabled={loading !== null}
                variant="outline"
                className="w-full"
              >
                {loading === 'reset' ? 'Resetting...' : 'Reset All Rate Limits'}
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Clears OTP rate limiting to allow repeated demonstrations
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
              <h4 className="font-medium text-sm text-blue-900 mb-2">Default Settings</h4>
              <div className="space-y-1 text-xs text-blue-800">
                <p><strong>Plan Type:</strong> Annual</p>
                <p><strong>Amount:</strong> Rs. 50,000.00</p>
                <p className="pt-2"><strong>Welcome SMS:</strong> "Welcome to [GymName], [MemberName]! Your Annual membership is now active. Amount paid: Rs.50000.00. Thank you for joining us!"</p>
                <p className="pt-1"><strong>Due Reminder SMS:</strong> "Dear [MemberName], your Annual membership at [GymName] is due on [Date]. Amount: Rs.50000.00. Thank you."</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
