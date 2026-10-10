/**
 * Sync one member's access to the hardware.
 *
 * Reads the member's state, resolves the decision, derives the commands, and
 * executes them in order. All policy lives in the domain layer; this class is
 * orchestration and persistence.
 *
 * ## Failure posture
 *
 * A failure here must never bubble into member registration or payment
 * collection — a gym must be able to take money whether or not a door
 * controller is reachable. Callers therefore treat the result as advisory and
 * the outbox retries independently.
 *
 * The safety of that comes from the device holding the validity window: if this
 * never runs again, members still expire correctly on their paid-through date,
 * because the terminal enforces it from its own clock with no network.
 */

import type {
  CommandOutcome,
  IAccessControlProvider,
} from '@/lib/access-control'
import type { IAccessControlRepository } from './IAccessControlRepository'
import { resolveAccessDecision } from '@/features/access-control/domain/AccessDecision'
import {
  deriveAccessCommands,
  type AccessCommand,
} from '@/features/access-control/domain/AccessCommands'
import { AccessIntent } from '@/features/access-control/config/AccessControlConfig'
import { getGymToday } from '@/features/access-control/utils/getGymToday'

export interface SyncMemberAccessInput {
  memberId: string
  /** Gym-local calendar day. Defaults to now, injectable for tests. */
  today?: Date
  /**
   * Re-assert everything to every active reader, ignoring our record of what
   * they hold. Set by the desk's "Re-send to readers" only — see
   * `DeriveCommandsInput.force` for why the outbox must not.
   */
  force?: boolean
  /** Delete-then-add; see `DeriveCommandsInput.reseat`. */
  reseat?: boolean
  /**
   * Queue a forced reconcile when anything failed. Set by the desk route, whose
   * toast promises we will keep trying.
   */
  retryOnFailure?: boolean
}

/**
 * Why a sync failed, in the terms the outbox needs to act on.
 *
 * A bare message would force the drainer to guess whether to retry — and the
 * return-code classification in `lib/access-control/returnCodes.ts` exists
 * precisely so it does not have to. A full terminal must not be retried
 * forever; a momentary "no response" must not be dead-lettered.
 */
export interface SyncFailure {
  message: string
  /** Worth trying again with backoff. */
  retryable: boolean
  /** A person has to intervene — a full reader, a rejected template. */
  needsAttention: boolean
  /** Raw device return code, when the vendor reported one. */
  returnCode?: number
  /**
   * The terminal the failing command was aimed at.
   *
   * Taken from the command rather than the response, so it is present even
   * when the vendor's error says nothing about which reader it came from. The
   * drainer needs it to act on a reader-specific failure — telling a gym's
   * roomy side door that it is full, because its front door was, is worse than
   * doing nothing.
   */
  deviceSerial?: string
}

export interface SyncMemberAccessResult {
  /** False when the gym has no access control configured — not an error. */
  applicable: boolean
  /** Whether the member should currently be admitted. */
  allowed: boolean
  commandsSent: number
  /** Commands the hardware has not confirmed yet. */
  commandsPending: number
  failures: SyncFailure[]
}

export class SyncMemberAccess {
  constructor(
    private readonly repo: IAccessControlRepository,
    private readonly provider: IAccessControlProvider
  ) {}

  /**
   * Bring one member's hardware state in line with their membership.
   *
   * @param input - Member to sync, and optionally the calendar day to use.
   * @returns What was sent, and whether anything failed.
   */
  async execute(input: SyncMemberAccessInput): Promise<SyncMemberAccessResult> {
    const idle: SyncMemberAccessResult = {
      applicable: false,
      allowed: false,
      commandsSent: 0,
      commandsPending: 0,
      failures: [],
    }

    const context = await this.repo.getMemberAccessContext(input.memberId)
    if (!context) return idle

    const credentials = await this.repo.getCredentials(context.gymId)
    if (!credentials) return idle

    const deviceSerials = await this.repo.listActiveDeviceSerials(context.gymId)
    if (deviceSerials.length === 0) return idle

    const decision = resolveAccessDecision({
      status: context.status,
      membershipStartDate: context.membershipStartDate,
      nextDueDate: context.nextDueDate,
      registrationSource: context.registrationSource,
      verifiedAt: context.verifiedAt,
      today: input.today ?? getGymToday(),
    })

    // Allocate an identifier only now — at first provisioning — because the
    // device namespace is finite and most members never reach hardware.
    let subject = context.subject
    if (!subject) {
      const subjectId = await this.repo.allocateSubjectId()
      subject = await this.repo.createSubject(
        context.gymId,
        context.memberId,
        subjectId
      )
    }

    const heldBefore = subject.synced_device_serials ?? []

    const commands = deriveAccessCommands({
      decision,
      subject: {
        subjectId: String(subject.subject_id),
        memberName: context.memberName,
        provisioned: subject.provisioned_at !== null,
        syncedDeviceSerials: heldBefore,
        lastSyncedValidFrom: subject.last_synced_valid_from,
        lastSyncedValidTo: subject.last_synced_valid_to,
        lastSyncedBlocked: subject.last_synced_blocked,
      },
      deviceSerials,
      force: input.force ?? false,
      reseat: input.reseat ?? false,
    })

    const failures: SyncFailure[] = []
    let sent = 0
    let pending = 0

    for (const command of commands) {
      const outcome = await this.dispatch(
        command,
        credentials,
        context.memberName
      )

      if (outcome.status === 'failed') {
        failures.push({
          message: outcome.error,
          retryable: outcome.retryable,
          needsAttention: outcome.needsAttention ?? false,
          returnCode: outcome.returnCode,
          // The command knows its target even when the error does not. Only
          // reported for commands actually aimed at a terminal: `Provision`
          // targets the vendor's records and borrows a serial for ordering,
          // so attributing its failure to that reader would be a guess.
          deviceSerial:
            command.intent === AccessIntent.Provision
              ? outcome.deviceSerial
              : (outcome.deviceSerial ?? command.deviceSerial),
        })
        // Stop at the first failure: the sequence is ordered, so continuing
        // could land a validity period against a profile that never arrived.
        break
      }

      sent += 1
      if (outcome.status === 'queued') pending += 1
    }

    if (failures.length > 0) {
      // A re-seat that got past its revoke has already taken the member off
      // every reader (`fromdev` is not per reader), so our record must not keep
      // claiming otherwise just because a later push failed (visit 1, D1).
      if (
        commands
          .slice(0, sent)
          .some((c) => c.intent === AccessIntent.RevokeBiometric)
      ) {
        await this.repo.markSubjectOffDevice(context.memberId)
      }

      if (input.retryOnFailure) {
        await this.repo.enqueue(
          context.gymId,
          context.memberId,
          AccessIntent.ReconcileMember,
          { reason: 'desk_resend_failed', force: true }
        )
      }
    }

    // Only claim the hardware matches if every command got through. A partial
    // run leaves the recorded state behind, so the next reconcile retries the
    // remainder rather than assuming success.
    if (failures.length === 0 && commands.length > 0) {
      await this.repo.updateSyncState(context.memberId, {
        // Stays true through cancellation: we revoke the template from the
        // reader but the vendor keeps the subject record, which is what lets a
        // returning member back in without re-enrolling.
        provisioned: true,
        syncedDeviceSerials: resolveHeldSerials(commands, heldBefore),
        validFrom: formatOrNull(commands, 'startDate'),
        validTo: formatOrNull(commands, 'endDate'),
        blocked: !decision.allowed,
      })
    }

    return {
      applicable: true,
      allowed: decision.allowed,
      commandsSent: sent,
      commandsPending: pending,
      failures,
    }
  }

  /**
   * Route one derived command to the matching provider call.
   *
   * Never throws. `assertValidSubjectId` throws by design, and transport errors
   * (network, malformed JSON) throw too — but an exception escaping here would
   * abort the drainer mid-batch and strand every already-claimed job in
   * `in_flight`, where nothing picks it up again. Those members would never
   * sync, and nothing would report it. So every throw becomes a failed outcome
   * for this member alone.
   */
  private async dispatch(
    command: AccessCommand,
    credentials: Parameters<IAccessControlProvider['upsertSubject']>[0],
    memberName: string
  ): Promise<CommandOutcome> {
    try {
      return await this.dispatchUnsafe(command, credentials, memberName)
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown sync error',
        // A thrown error is either our bug (an invalid identifier) or a
        // transport fault. Retrying is safe — every command here is
        // idempotent — and the retry budget caps the cost either way.
        retryable: true,
      }
    }
  }

  private async dispatchUnsafe(
    command: AccessCommand,
    credentials: Parameters<IAccessControlProvider['upsertSubject']>[0],
    memberName: string
  ): Promise<CommandOutcome> {
    const target = {
      deviceSerial: command.deviceSerial,
      subjectId: command.subjectId,
    }

    switch (command.intent) {
      case AccessIntent.Provision:
        return this.provider.upsertSubject(credentials, {
          subjectId: command.subjectId,
          name: memberName,
          areaId: credentials.areaId,
        })

      case AccessIntent.SyncToDevice:
        return this.provider.syncSubjectsToDevice(
          credentials,
          command.deviceSerial,
          [command.subjectId]
        )

      case AccessIntent.SetValidPeriod:
        return this.provider.setValidPeriod(credentials, {
          ...target,
          startDate: command.startDate ?? '',
          endDate: command.endDate ?? '',
        })

      case AccessIntent.Block:
        return this.provider.blockAccess(credentials, target)

      case AccessIntent.Grant:
        return this.provider.grantAccess(credentials, target)

      case AccessIntent.RemoveSubject:
        return this.provider.removeSubject(credentials, command.subjectId)

      case AccessIntent.RevokeBiometric:
        return this.provider.revokeBiometrics(credentials, command.subjectId)

      default:
        return {
          status: 'failed' as const,
          error: `Unsupported intent ${command.intent}`,
          retryable: false,
        }
    }
  }
}

/**
 * Which readers hold the member once this command set has been applied.
 *
 * Derived from the commands rather than from a flag, so the record can never
 * claim a reader holds a member it was never sent. Applied in order, because a
 * re-seat revokes before it pushes and the member is back on every reader it
 * pushed to; the cancellation sequence has no pushes, so its result is
 * unchanged.
 *
 * @param commands - The commands that all succeeded.
 * @param heldBefore - Readers that already held the member.
 */
function resolveHeldSerials(
  commands: AccessCommand[],
  heldBefore: string[]
): string[] {
  const held = new Set(heldBefore)

  for (const command of commands) {
    if (command.intent === AccessIntent.SyncToDevice) {
      held.add(command.deviceSerial)
    } else if (command.intent === AccessIntent.RevokeBiometric) {
      held.delete(command.deviceSerial)
    }
  }

  return [...held]
}

/** Pull the window off whichever command carried it, if any. */
function formatOrNull(
  commands: AccessCommand[],
  field: 'startDate' | 'endDate'
): string | null {
  const withWindow = commands.find(
    (c) => c.intent === AccessIntent.SetValidPeriod
  )
  return withWindow?.[field] ?? null
}
