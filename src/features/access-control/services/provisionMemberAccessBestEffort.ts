/**
 * Push a newly registered member to the door hardware immediately.
 *
 * ## Why this exists when the outbox already covers it
 *
 * The members trigger enqueues a sync job the moment a member is inserted, and
 * `drain-access-sync` sends it on its next run — every five minutes when it is
 * scheduled, which it is not while the drain is disabled (2026-11-04,
 * access-control-master.md §4.5). That is the guarantee — but five minutes is
 * wrong for the workflow that actually happens at a desk: staff register
 * someone and walk them straight to the reader to enrol a finger.
 *
 * So this is the fast path, not the reliable one. It races the drain, and
 * whichever gets there first is fine: `SyncMemberAccess` re-derives everything
 * from current state and every vendor command it sends is idempotent.
 *
 * ## Why it can never fail a registration
 *
 * **A gym must be able to take money and sign a member up whether or not a
 * door controller is reachable.** That is the premise the whole integration is
 * built on — the terminal enforces access from its own clock precisely so our
 * availability never gates a gym's operations. Letting a vendor HTTP call
 * fail a registration would invert exactly that.
 *
 * So every outcome is swallowed. If it fails, the member is already in the
 * database, the outbox job is already queued, and the drain will carry it.
 *
 * ## Why it is awaited rather than fired and forgotten
 *
 * A floating promise in a serverless runtime can be frozen the instant the
 * HTTP response is returned. This codebase has already been bitten by that —
 * see the receipt-SMS comment in `CollectPayment`, where a fire-and-forget
 * send dropped its own `sms_logs` insert mid-flight. Callers await this, and
 * it simply never rejects.
 *
 * ## Where it is deliberately NOT used
 *
 * - **Bulk import.** A thousand members would be a thousand inline vendor
 *   calls. The outbox drains those paced, which is the whole reason it paces.
 * - **QR self-registration.** A self-registered member is unverified until the
 *   desk confirms them, so `resolveAccessDecision` denies them and
 *   `deriveAccessCommands` returns nothing for a never-provisioned denied
 *   member. The call would be a round trip to do nothing.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSyncMemberAccess } from './factory'

/**
 * Best-effort provision of one member onto the gym's readers.
 *
 * @param supabase - A **service-role** client: credentials live in an
 *   RLS-enabled, policy-free table that a session client cannot read.
 * @param memberId - The member just registered.
 * @returns Whether the member reached the hardware. Advisory only — callers
 *   should not branch on it, and must never surface it as a failure.
 */
export async function provisionMemberAccessBestEffort(
  supabase: SupabaseClient,
  memberId: string
): Promise<boolean> {
  try {
    const result = await createSyncMemberAccess(supabase).execute({ memberId })

    // `applicable: false` is the ordinary case: the gym has no access control
    // configured. Not a failure, just nothing to do.
    return result.applicable && result.failures.length === 0
  } catch (error) {
    // Logged, never thrown. The outbox job is already queued and the drain
    // owns retry, backoff and failure classification from here.
    console.error(
      `Inline access provision failed for member ${memberId} (queued for retry):`,
      error
    )
    return false
  }
}
