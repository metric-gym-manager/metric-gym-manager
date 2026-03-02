'use client';

import { useEffect, useState } from 'react';

const UPDATE_AVAILABLE_KEY = 'pwa_update_available';
const UPDATE_DISMISSED_KEY = 'pwa_update_dismissed';

export function ServiceWorkerRegistration() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Check if user returned from a previous session with pending update
    const hadPendingUpdate = localStorage.getItem(UPDATE_AVAILABLE_KEY) === 'true';
    const wasDismissed = localStorage.getItem(UPDATE_DISMISSED_KEY) === 'true';

    if (hadPendingUpdate && !wasDismissed) {
      // User left and came back - silently apply the update
      localStorage.removeItem(UPDATE_AVAILABLE_KEY);
      localStorage.removeItem(UPDATE_DISMISSED_KEY);
      window.location.reload();
      return;
    }

    // Clear dismissed state on new session (user came back)
    if (hadPendingUpdate && wasDismissed) {
      localStorage.removeItem(UPDATE_DISMISSED_KEY);
    }

    navigator.serviceWorker
      .register('/service-worker.js')
      .then((reg) => {
        console.log('Service Worker registered', reg.scope);

        // Check for updates on page load
        reg.update();

        // Check if there's already a waiting worker
        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
          setUpdateAvailable(true);
          localStorage.setItem(UPDATE_AVAILABLE_KEY, 'true');
        }

        // When a new service worker is found
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is waiting - don't auto-reload!
              // Instead, show banner and let user decide
              setWaitingWorker(newWorker);
              setUpdateAvailable(true);
              localStorage.setItem(UPDATE_AVAILABLE_KEY, 'true');
              console.log('Update available - waiting for user action');
            }
          });
        });

        // Listen for messages from the service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'RELOAD_PAGE') {
            window.location.reload();
          }
        });
      })
      .catch((err) => console.log('Service Worker registration failed', err));
  }, []);

  const handleRefreshNow = () => {
    if (!waitingWorker) return;

    // Tell the waiting service worker to skip waiting and activate
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });

    // Clean up state
    localStorage.removeItem(UPDATE_AVAILABLE_KEY);
    localStorage.removeItem(UPDATE_DISMISSED_KEY);

    // The service worker will send a message back to reload
    // Adding a fallback timeout in case the message doesn't arrive
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
    // Keep UPDATE_AVAILABLE_KEY so it applies on next session
    // Set dismissed flag so we don't auto-reload if user navigates
    localStorage.setItem(UPDATE_DISMISSED_KEY, 'true');
  };

  return updateAvailable ? (
    <UpdateBanner onRefresh={handleRefreshNow} onDismiss={handleDismiss} />
  ) : null;
}

// Update banner component
function UpdateBanner({ onRefresh, onDismiss }: { onRefresh: () => void; onDismiss: () => void }) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white px-4 py-3 shadow-lg"
      role="alert"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="font-medium">New version available!</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="px-4 py-1.5 bg-white text-blue-600 rounded-md font-medium hover:bg-blue-50 transition-colors"
          >
            Refresh Now
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-1.5 border border-white/30 rounded-md font-medium hover:bg-white/10 transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
