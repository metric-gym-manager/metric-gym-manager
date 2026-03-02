'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/service-worker.js')
      .then((reg) => {
        console.log('Service Worker registered', reg.scope);

        // Check for updates on page load
        reg.update();

        // When a new service worker is found, reload to apply it
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              // New service worker activated, reload to get fresh assets
              window.location.reload();
            }
          });
        });
      })
      .catch((err) => console.log('Service Worker failed', err));
  }, []);

  return null;
}
