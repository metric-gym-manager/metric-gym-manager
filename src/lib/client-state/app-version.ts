import { PWA_VERSION } from '@/lib/pwa-version';

/**
 * Single source of truth for the deployed application version on the client.
 * Sourced from package.json via scripts/generate-pwa-assets.js so the app
 * bundle, the PWA manifest and the service worker always agree.
 */
export const APP_VERSION = PWA_VERSION;

/** Major version segment, used to namespace localStorage keys per release line. */
export const APP_MAJOR_VERSION = APP_VERSION.split('.')[0] ?? '0';

/** localStorage key that records which app version last wrote client state. */
export const APP_VERSION_STORAGE_KEY = 'mgm_app_version';

/** Cache name the current service worker uses (kept in sync with generate-pwa-assets.js). */
export const CURRENT_SW_CACHE_NAME = `saas-app-v${APP_VERSION}`;
