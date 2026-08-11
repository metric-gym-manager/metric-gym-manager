/**
 * Access control feature factory.
 *
 * Server composition happens here and nowhere else (R7): routes and crons call
 * these, they never `new` up a provider or repository themselves.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  MockAccessControlProvider,
  VftAccessControlProvider,
  isAccessControlEnabled,
  type IAccessControlProvider,
} from '@/lib/access-control'
import { SupabaseAccessControlRepository } from './SupabaseAccessControlRepository'
import { SyncMemberAccess } from './SyncMemberAccess'
import type { IAccessControlRepository } from './IAccessControlRepository'

/**
 * The hardware provider.
 *
 * Mock unless `ACCESS_CONTROL_ENABLED=true`, mirroring `createSMSProvider` and
 * `createStorageProvider`. Local development, CI and every gym that has not
 * opted in therefore never reach real door hardware — which is what lets this
 * feature ship before the integration has been exercised against a terminal.
 */
export function createAccessControlProvider(): IAccessControlProvider {
  if (isAccessControlEnabled()) {
    return new VftAccessControlProvider()
  }

  return new MockAccessControlProvider()
}

/**
 * The repository.
 *
 * Pass the client the caller is entitled to: session `createClient()` for
 * gym-scoped dashboard work, service-role `createAdminClient()` for crons and
 * the webhook. Credentials only load under service-role, because
 * `access_control_secrets` has RLS enabled with no policies.
 */
export function createAccessControlRepository(
  supabase: SupabaseClient
): IAccessControlRepository {
  return new SupabaseAccessControlRepository(supabase)
}

/** The one-member sync use case, wired to the configured provider. */
export function createSyncMemberAccess(
  supabase: SupabaseClient
): SyncMemberAccess {
  return new SyncMemberAccess(
    createAccessControlRepository(supabase),
    createAccessControlProvider()
  )
}
