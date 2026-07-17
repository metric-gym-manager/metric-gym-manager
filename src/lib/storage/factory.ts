/**
 * Storage provider factory
 *
 * Returns the Cloudflare R2 provider when R2 credentials are configured,
 * otherwise falls back to the in-memory mock (development/tests).
 * Selection logic copied verbatim from the retired DI Container
 * (Container.getStorageProvider) so behavior is identical.
 */

import type { IStorageProvider } from './IStorageProvider';
import { R2StorageProvider } from './R2StorageProvider';
import { MockStorageProvider } from './MockStorageProvider';

export function createStorageProvider(): IStorageProvider {
  const r2Configured =
    !!process.env.R2_ACCOUNT_ID &&
    !!process.env.R2_ACCESS_KEY_ID &&
    !!process.env.R2_SECRET_ACCESS_KEY &&
    !!process.env.R2_BUCKET_NAME;

  if (r2Configured) {
    return new R2StorageProvider();
  }
  console.log('🗄️ Using Mock Storage Provider (R2 env vars not set)');
  return new MockStorageProvider();
}
