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
import { SupabaseGymSubscriptionRepository } from '@/features/subscriptions/services/SupabaseGymSubscriptionRepository'
import { SupabaseAccessControlRepository } from './SupabaseAccessControlRepository'
import { SyncMemberAccess } from './SyncMemberAccess'
import { DrainAccessSyncQueue } from './DrainAccessSyncQueue'
import { ReconcileMemberAccess } from './ReconcileMemberAccess'
import { RecordAccessEvents } from './RecordAccessEvents'
import { EvictInactiveSubjects } from './EvictInactiveSubjects'
import { OperateDevice } from './OperateDevice'
import { VerifyAccessAccount } from './VerifyAccessAccount'
import { ManageMemberBiometric } from './ManageMemberBiometric'
import { GetMemberAccessStatus } from './GetMemberAccessStatus'
import { RefreshDeviceStatus } from './RefreshDeviceStatus'
import { DetectBiometricEnrolment } from './DetectBiometricEnrolment'
import { PushRename } from './PushRename'
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

/** Remote unlock and restart. */
export function createOperateDevice(supabase: SupabaseClient): OperateDevice {
  return new OperateDevice(
    createAccessControlRepository(supabase),
    createAccessControlProvider()
  )
}

/**
 * The outbox worker.
 *
 * Service-role only: it works across every gym's queue, so a session client
 * would silently drain nothing.
 */
export function createDrainAccessSyncQueue(
  supabase: SupabaseClient
): DrainAccessSyncQueue {
  return new DrainAccessSyncQueue(
    createAccessControlRepository(supabase),
    createSyncMemberAccess(supabase),
    createOperateDevice(supabase),
    createEvictInactiveSubjects(supabase),
    createAccessControlProvider()
  )
}

/** Device presence refresh, run alongside the drain. */
export function createRefreshDeviceStatus(
  supabase: SupabaseClient
): RefreshDeviceStatus {
  return new RefreshDeviceStatus(
    createAccessControlRepository(supabase),
    createAccessControlProvider()
  )
}

/** The nightly diff. Service-role only, for the same reason as the drainer. */
export function createReconcileMemberAccess(
  supabase: SupabaseClient
): ReconcileMemberAccess {
  return new ReconcileMemberAccess(
    createAccessControlRepository(supabase),
    new SupabaseGymSubscriptionRepository(supabase),
    createEvictInactiveSubjects(supabase)
  )
}

/**
 * Webhook ingestion.
 *
 * The callback is unauthenticated and account-wide, so this resolves the gym
 * from the device serial in our own records — never from the payload.
 */
export function createRecordAccessEvents(
  supabase: SupabaseClient
): RecordAccessEvents {
  return new RecordAccessEvents(createAccessControlRepository(supabase))
}

/** Credential probe for the settings page. */
export function createVerifyAccessAccount(
  supabase: SupabaseClient
): VerifyAccessAccount {
  return new VerifyAccessAccount(
    createAccessControlRepository(supabase),
    createAccessControlProvider()
  )
}

/** Fingerprint enrolment and clearing. */
export function createManageMemberBiometric(
  supabase: SupabaseClient
): ManageMemberBiometric {
  return new ManageMemberBiometric(
    createAccessControlRepository(supabase),
    createAccessControlProvider()
  )
}

/** "Has the finger arrived yet?" — polled by the enrolment dialog. */
export function createDetectBiometricEnrolment(
  supabase: SupabaseClient
): DetectBiometricEnrolment {
  return new DetectBiometricEnrolment(
    createAccessControlRepository(supabase),
    createAccessControlProvider()
  )
}

/** The sanitized member access state for the dashboard. */
export function createGetMemberAccessStatus(
  supabase: SupabaseClient
): GetMemberAccessStatus {
  return new GetMemberAccessStatus(createAccessControlRepository(supabase))
}

/** Name synchronisation, for members and readers alike. */
export function createPushRename(supabase: SupabaseClient): PushRename {
  return new PushRename(
    createAccessControlRepository(supabase),
    createAccessControlProvider()
  )
}

/** Capacity reclamation. */
export function createEvictInactiveSubjects(
  supabase: SupabaseClient
): EvictInactiveSubjects {
  return new EvictInactiveSubjects(
    createAccessControlRepository(supabase),
    createAccessControlProvider()
  )
}
