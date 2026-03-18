'use client';

import { useState, useEffect } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const NOTIFICATION_DISMISSED_KEY = 'push_notification_banner_dismissed';

export function NotificationPermission() {
  const { permission, isSubscribed, isLoading, isSupported, subscribe } =
    usePushNotifications();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Only show banner if push is supported, not yet subscribed,
    // permission hasn't been denied, and user hasn't dismissed
    if (!isSupported || isLoading) return;

    const wasDismissed =
      localStorage.getItem(NOTIFICATION_DISMISSED_KEY) === 'true';
    setDismissed(wasDismissed || isSubscribed || permission === 'denied');
  }, [isSupported, isLoading, isSubscribed, permission]);

  if (dismissed || !isSupported || isLoading || isSubscribed || permission === 'denied') {
    return null;
  }

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      setDismissed(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(NOTIFICATION_DISMISSED_KEY, 'true');
  };

  return (
    <div
      className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4"
      role="alert"
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-600 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span className="text-sm text-blue-800">
            Enable push notifications to get alerts for announcements and updates.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEnable}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md font-medium hover:bg-blue-700 transition-colors"
          >
            Enable
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-blue-600 text-sm rounded-md font-medium hover:bg-blue-100 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
