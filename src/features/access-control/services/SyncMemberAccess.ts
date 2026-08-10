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

import type { IAccessControlProvider } from '@/lib/access-control'
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
}

export interface SyncMemberAccessResult {
  /** False when the gym has no access control configured — not an error. */
  applicable: boolean
  /** Whether the member should currently be admitted. */
  allowed: boolean
  commandsSent: number
  /** Commands the hardware has not confirmed yet. */
  commandsPending: number
  errors: string[]
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
      errors: [],
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

    const commands = deriveAccessCommands({
      decision,
      subject: {
        subjectId: String(subject.subject_id),
        memberName: context.memberName,
        provisioned: subject.provisioned_at !== null,
        lastSyncedValidFrom: subject.last_synced_valid_from,
        lastSyncedValidTo: subject.last_synced_valid_to,
        lastSyncedBlocked: subject.last_synced_blocked,
      },
      deviceSerials,
    })

    const errors: string[] = []
    let sent = 0
    let pending = 0

    for (const command of commands) {
      const outcome = await this.dispatch(
        command,
        credentials,
        context.memberName
      )

      if (outcome.status === 'failed') {
        errors.push(outcome.error)
        // Stop at the first failure: the sequence is ordered, so continuing
        // could land a validity period against a profile that never arrived.
        break
      }

      sent += 1
      if (outcome.status === 'queued') pending += 1
    }

    // Only claim the hardware matches if every command got through. A partial
    // run leaves the recorded state behind, so the next reconcile retries the
    // remainder rather than assuming success.
    if (errors.length === 0 && commands.length > 0) {
      await this.repo.updateSyncState(context.memberId, {
        provisioned: !decision.removeFromDevice,
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
      errors,
    }
  }

  /** Route one derived command to the matching provider call. */
  private async dispatch(
    command: AccessCommand,
    credentials: Parameters<IAccessControlProvider['upsertSubject']>[0],
    memberName: string
  ) {
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
