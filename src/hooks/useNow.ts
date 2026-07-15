'use client';

import { useSyncExternalStore } from 'react';

// Module-level cache keeps getSnapshot pure: returning Date.now() directly
// would yield a new value on every call and loop the store.
let nowCache = Date.now();

function subscribe(callback: () => void) {
  const id = setInterval(() => {
    nowCache = Date.now();
    callback();
  }, 60_000);
  return () => clearInterval(id);
}

function getSnapshot(): number {
  return nowCache;
}

/**
 * Current timestamp (ms), refreshed once a minute.
 *
 * Render-safe replacement for calling Date.now() during render (impure):
 * components showing relative-time labels ("Sent 5m ago") re-render on the
 * minute tick so the labels stay fresh.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
