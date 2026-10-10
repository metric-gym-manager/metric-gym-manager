/**
 * Turn an access decision into the commands the hardware needs.
 *
 * Pure, so the rules below are unit-testable without a provider, a database or
 * a terminal. `SyncMemberAccess` only executes what this returns.
 *
 * ## The invariant this file exists to guarantee
 *
 * **A blocked subject never receives a validity-period command.**
 *
 * `accessblock` and `validperiod` both write the same device user record, and
 * on some ZKTeco firmware a later property write can reset the privilege flags
 * an earlier block set. A nightly "refresh everyone's window" job would
 * therefore un-suspend suspended members — silently, every night, with the door
 * as the only evidence.
 *
 * Deriving every command from the decision makes that unreachable by
 * construction rather than by remembering, and the rule is asserted directly in
 * `AccessCommands.test.ts`.
 */

import type { AccessDecision } from '@/features/access-control/domain/AccessDecision'
import { AccessIntent } from '@/features/access-control/config/AccessControlConfig'
import { formatDeviceDate } from '@/features/access-control/utils/getGymToday'

/** One instruction for one terminal. */
export interface AccessCommand {
  intent: AccessIntent
  deviceSerial: string
  subjectId: string
  /** `YYYYMMDD`, present only on validity-period commands. */
  startDate?: string
  /** `YYYYMMDD` inclusive, present only on validity-period commands. */
  endDate?: string
}

/**
 * What we know about the member's current presence on the hardware.
 *
 * `provisioned` and `onDevice` are deliberately separate, because the vendor
 * keeps templates centrally while each reader holds its own copy. A member can
 * exist on the vendor with no template on the reader — that is precisely the
 * state a cancelled or evicted member is left in, and it is what makes them
 * restorable without ever touching the scanner again.
 */
export interface SubjectSyncState {
  subjectId: string
  memberName: string
  /** Whether the subject record exists on the vendor platform. */
  provisioned: boolean
  /**
   * Serials of the readers that currently hold this member's template.
   *
   * Per reader, not a single flag, because templates live on each terminal
   * independently. A gym that opens a second entrance has readers holding
   * different sets of members, and a boolean cannot express that: every
   * existing member would look already-synced and the new door would never
   * open for any of them — silently, with no failed job to notice.
   *
   * Emptied on cancellation and on capacity eviction. An allowed member
   * missing from a reader needs a push before their validity window means
   * anything there; without it the reader has a window for somebody it cannot
   * recognise, and the door stays shut while our records say it should open.
   */
  syncedDeviceSerials: string[]
  /** Last window we pushed, for diffing. `null` when never pushed. */
  lastSyncedValidFrom: string | null
  lastSyncedValidTo: string | null
  /** Whether we believe the subject is currently blocked. */
  lastSyncedBlocked: boolean | null
}

export interface DeriveCommandsInput {
  decision: AccessDecision
  subject: SubjectSyncState
  /** Serials of the gym's active terminals. */
  deviceSerials: string[]
  /**
   * Ignore what we believe the readers hold and re-assert everything.
   *
   * The desk's "Re-send to readers" exists for the moment our record and a
   * reader disagree — a reader reset by its installer, a push that sat in an
   * offline reader's queue, a template that never reached the second door.
   * Diffing against our own record is precisely what cannot see that: it
   * agrees with itself however wrong it is (the Z1 lesson, one layer in).
   *
   * Only the manual override sets this. The outbox and the nightly reconcile
   * keep diffing, because re-asserting every member every night is one vendor
   * call per member per reader for no effect. Forcing changes which commands
   * are repeated, never the decision: a blocked member is still never sent a
   * validity period.
   */
  force?: boolean
}

/**
 * Derive the commands needed to bring the hardware in line with the decision.
 *
 * Returns an empty array when the hardware already matches — the vendor has no
 * bulk validity endpoint, so re-asserting unchanged members would be one HTTP
 * call each for no effect.
 *
 * @param input - The resolved decision plus what we believe the device holds.
 * @returns Commands in execution order.
 *
 * @example
 * // Newly expired member: block only, no window.
 * deriveAccessCommands({ decision: expired, subject, deviceSerials: ['A1'] })
 * // => [{ intent: 'block', ... }]
 */
export function deriveAccessCommands(
  input: DeriveCommandsInput
): AccessCommand[] {
  const { decision, subject, deviceSerials, force = false } = input

  if (deviceSerials.length === 0) {
    return []
  }

  // Nothing on the hardware to change. A member who cannot get in and was
  // never pushed to the reader needs no commands at all — provisioning them
  // just to block them costs three API calls and creates a record that the
  // capacity policy then has to claw back.
  if (!decision.allowed && !subject.provisioned) {
    return []
  }

  // Cancellation shuts the door, but must NOT destroy the enrolled
  // fingerprint. `RevokeBiometric` (fromdev) clears the template from the
  // reader while the vendor keeps its central copy, so a member who rejoins is
  // restored by a plain re-sync and never has to touch the scanner again.
  //
  // A full `RemoveSubject` would delete the central template too. Cancelled →
  // Active is an explicit, supported transition, so that would silently lock a
  // returning, paying member out — while our records still said they were
  // fine. `RemoveSubject` is reserved for genuine erasure requests.
  //
  // Block first, then revoke: either one alone shuts the door, so if the
  // second call fails the member is still out.
  if (decision.removeFromDevice) {
    const commands: AccessCommand[] = []

    for (const deviceSerial of deviceSerials) {
      commands.push({
        intent: AccessIntent.Block,
        deviceSerial,
        subjectId: subject.subjectId,
      })
      commands.push({
        intent: AccessIntent.RevokeBiometric,
        deviceSerial,
        subjectId: subject.subjectId,
      })
    }

    return commands
  }

  const commands: AccessCommand[] = []

  // The subject record must exist on the vendor before anything can reference
  // it. This is a hardware ordering requirement, not a preference.
  if (!subject.provisioned) {
    commands.push({
      intent: AccessIntent.Provision,
      deviceSerial: deviceSerials[0],
      subjectId: subject.subjectId,
    })
  }

  // Push the member to every reader that may admit them but does not hold
  // them. Evaluated per reader, which covers four cases with one rule: a
  // brand-new member, a member returning after cancellation, a member restored
  // after capacity eviction, and — the case a single flag could never see — an
  // existing member when the gym installs an additional reader.
  //
  // Skipped for blocked members on purpose: loading a template for somebody
  // who cannot get in wastes a finite reader slot.
  //
  // Forced, every reader counts as missing: our record of who holds the
  // member is the thing being doubted.
  const missingFrom = !decision.allowed
    ? []
    : force
      ? [...deviceSerials]
      : deviceSerials.filter((s) => !subject.syncedDeviceSerials.includes(s))

  for (const deviceSerial of missingFrom) {
    commands.push({
      intent: AccessIntent.SyncToDevice,
      deviceSerial,
      subjectId: subject.subjectId,
    })
  }

  if (!decision.allowed) {
    // Already blocked and still blocked: nothing to send — unless forced, when
    // the block itself is what is being re-asserted.
    if (subject.lastSyncedBlocked === true && subject.provisioned && !force) {
      return commands
    }

    for (const deviceSerial of deviceSerials) {
      commands.push({
        intent: AccessIntent.Block,
        deviceSerial,
        subjectId: subject.subjectId,
      })
    }

    // Deliberately no validity command here. See the file header.
    return commands
  }

  const startDate = decision.validFrom
    ? formatDeviceDate(decision.validFrom)
    : undefined
  const endDate = decision.validTo
    ? formatDeviceDate(decision.validTo)
    : undefined

  // Lift a block before widening the window, so the two writes cannot race in
  // an order that leaves the member blocked with a valid window. Forced, the
  // grant goes out whatever we last recorded: a reader still holding an old
  // block is one of the disagreements the override exists for, and a grant to
  // a member who is not blocked is a benign duplicate (audit Y1).
  //
  // Every reader that is HANDED the member also gets a grant, even when we
  // believe they were never blocked (visit 1, D3): a freshly added user was
  // refused with event 23 "invalid time period" on the first scan until an
  // Access Grant arrived (PH-04/06/07; PH-08, the one enrolment preceded by a
  // grant, was the exception). Nothing else tells us the reader's own record
  // of the user carries no privilege.
  const grantTo =
    subject.lastSyncedBlocked === true || force ? deviceSerials : missingFrom

  for (const deviceSerial of grantTo) {
    commands.push({
      intent: AccessIntent.Grant,
      deviceSerial,
      subjectId: subject.subjectId,
    })
  }

  // Any reader that was just handed the member gets the window re-pushed, even
  // when it matches what we last recorded: we cannot assume a template push
  // carried the validity dates with it, and a reader holding a member with no
  // window is a member refused at a door our records call open.
  //
  // `missingFrom` being non-empty is therefore enough on its own — that is the
  // newly-installed-reader case, where the dates are unchanged but one
  // terminal has never seen them. It is also what makes a forced run re-push
  // the window: forcing marks every reader missing.
  const windowUnchanged =
    missingFrom.length === 0 &&
    subject.provisioned &&
    subject.lastSyncedBlocked !== true &&
    subject.lastSyncedValidFrom === (startDate ?? null) &&
    subject.lastSyncedValidTo === (endDate ?? null)

  if (!windowUnchanged && startDate && endDate) {
    for (const deviceSerial of deviceSerials) {
      commands.push({
        intent: AccessIntent.SetValidPeriod,
        deviceSerial,
        subjectId: subject.subjectId,
        startDate,
        endDate,
      })
    }
  }

  return commands
}

/**
 * Whether a command set would push a validity period.
 *
 * Used by the reconciler's own assertions, and by tests, to check the blocked
 * invariant without reaching into command internals.
 *
 * @param commands - Commands to inspect.
 * @returns True if any command sets a validity period.
 */
export function containsValidPeriod(commands: AccessCommand[]): boolean {
  return commands.some((c) => c.intent === AccessIntent.SetValidPeriod)
}
