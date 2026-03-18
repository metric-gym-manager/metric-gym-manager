'use client';

import { useState } from 'react';
import { Bell, BellOff, Send } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

export default function NotificationSettingsPage() {
  const {
    permission,
    isSubscribed,
    isLoading,
    isSupported,
    subscribe,
    unsubscribe,
  } = usePushNotifications();
  const [isSendingTest, setIsSendingTest] = useState(false);

  const handleToggle = async () => {
    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        toast.success('Push notifications disabled');
      } else {
        toast.error('Failed to disable notifications');
      }
    } else {
      const success = await subscribe();
      if (success) {
        toast.success('Push notifications enabled');
      } else if (permission === 'denied') {
        toast.error(
          'Notification permission was denied. Please enable it in your browser settings.'
        );
      } else {
        toast.error('Failed to enable notifications');
      }
    }
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    try {
      const response = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Notification',
          body: 'Push notifications are working correctly!',
          type: 'system',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send test notification');
      }

      const data = await response.json();
      if (data.data?.successful > 0) {
        toast.success('Test notification sent');
      } else {
        toast.info('No subscribed devices found');
      }
    } catch {
      toast.error('Failed to send test notification');
    } finally {
      setIsSendingTest(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
          <div className="h-24 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Push Notifications Card */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-blue-50 rounded-lg">
            {isSubscribed ? (
              <Bell className="h-6 w-6 text-blue-600" />
            ) : (
              <BellOff className="h-6 w-6 text-gray-400" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Push Notifications</h3>
            <p className="text-sm text-gray-500 mt-1">
              Receive notifications for announcements and important updates on
              this device.
            </p>

            {!isSupported && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  Push notifications are not supported in this browser. Try
                  using Chrome, Edge, or Firefox.
                </p>
              </div>
            )}

            {permission === 'denied' && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">
                  Notification permission was denied. To enable, go to your
                  browser settings and allow notifications for this site.
                </p>
              </div>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleToggle}
                disabled={!isSupported || permission === 'denied'}
                className={`
                  relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
                  border-2 border-transparent transition-colors duration-200 ease-in-out
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${isSubscribed ? 'bg-blue-600' : 'bg-gray-200'}
                `}
                role="switch"
                aria-checked={isSubscribed}
              >
                <span
                  className={`
                    pointer-events-none inline-block h-5 w-5 transform rounded-full
                    bg-white shadow ring-0 transition duration-200 ease-in-out
                    ${isSubscribed ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </button>
              <span className="text-sm font-medium text-gray-700">
                {isSubscribed ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Test Notification Card */}
      {isSubscribed && (
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-green-50 rounded-lg">
              <Send className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Test Notification</h3>
              <p className="text-sm text-gray-500 mt-1">
                Send a test notification to verify everything is working.
              </p>
              <button
                onClick={handleSendTest}
                disabled={isSendingTest}
                className="mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded-md font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isSendingTest ? 'Sending...' : 'Send Test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-gray-50 rounded-lg border p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          About Notifications
        </h3>
        <ul className="text-sm text-gray-500 space-y-1.5">
          <li>
            Notifications are sent when announcements are dispatched to members.
          </li>
          <li>Each device/browser requires its own subscription.</li>
          <li>
            You can disable notifications at any time from this page.
          </li>
        </ul>
      </div>
    </div>
  );
}
