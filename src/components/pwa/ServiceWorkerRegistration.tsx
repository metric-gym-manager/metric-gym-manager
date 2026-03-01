'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((reg) => console.log('Service Worker registered', reg.scope))
        .catch((err) => console.log('Service Worker failed', err));
    }
  }, []);

  return null;
}
