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

/** What we know about the member's current presence on the hardware. */
export interface SubjectSyncState {
  subjectId: string
  memberName: string
  /** Whether the subject record has been pushed to the vendor at least once. */
  provisioned: boolean
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
  const { decision, subject, deviceSerials } = input

  if (deviceSerials.length === 0) {
    return []
  }

  // Cancellation takes the record off the hardware entirely; nothing else is
  // worth sending afterwards.
  if (decision.removeFromDevice) {
    return [
      {
        intent: AccessIntent.RemoveSubject,
        deviceSerial: deviceSerials[0],
        subjectId: subject.subjectId,
      },
    ]
  }

  const commands: AccessCommand[] = []

  // The subject record must exist on the vendor, and be pushed to a terminal,
  // before a validity period will bind to it. Ordering here is a hardware
  // requirement, not a preference.
  if (!subject.provisioned) {
    commands.push({
      intent: AccessIntent.Provision,
      deviceSerial: deviceSerials[0],
      subjectId: subject.subjectId,
    })

    for (const deviceSerial of deviceSerials) {
      commands.push({
        intent: AccessIntent.SyncToDevice,
        deviceSerial,
        subjectId: subject.subjectId,
      })
    }
  }

  if (!decision.allowed) {
    // Already blocked and still blocked: nothing to send.
    if (subject.lastSyncedBlocked === true && subject.provisioned) {
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
  // an order that leaves the member blocked with a valid window.
  if (subject.lastSyncedBlocked === true) {
    for (const deviceSerial of deviceSerials) {
      commands.push({
        intent: AccessIntent.Grant,
        deviceSerial,
        subjectId: subject.subjectId,
      })
    }
  }

  const windowUnchanged =
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
