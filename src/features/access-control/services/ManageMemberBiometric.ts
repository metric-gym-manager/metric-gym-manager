/**
 * Enrolling and clearing a member's fingerprint.
 *
 * ## Why enrolment is two-part
 *
 * We cannot capture a fingerprint from a browser. Pressing "Enrol" here puts
 * the reader into enrolment mode for one specific subject; the member then
 * presents their finger at the terminal. The template is created on the
 * hardware and travels to the vendor platform — it never passes through us,
 * which is also why we hold no biometric data of our own.
 *
 * The member must already exist on the reader before this can target them, so
 * enrolment provisions first when necessary.
 *
 * ## Why consent is checked here and not at the route
 *
 * This is the last point before a command that causes a fingerprint to be
 * taken. Putting the gate at the route would leave every other caller of
 * `enrol` — a future bulk flow, a retry path, a script — free to skip it, and
 * the one thing that must never happen is a template collected with no
 * consent record. Fails closed: no record and no consent on the request means
 * no command is dispatched.
 *
 * ## Why clearing is its own operation
 *
 * Deleting someone's fingerprint is not an edit to their membership. It maps
 * to the vendor's `fromdev` delete — template off the reader, employee record
 * intact — and touches no `members` row except to withdraw the consent that
 * allowed the template to be taken. Registry and biometrics stay
 * separable in both directions: a member can lose their fingerprint and keep
 * their membership, and can be evicted from a reader and be restored later
 * without re-enrolling.
 */

import type { IAccessControlProvider } from '@/lib/access-control'
import type { IAccessControlRepository } from './IAccessControlRepository'
import { resolveAccessDecision } from '@/features/access-control/domain/AccessDecision'
import { getGymToday } from '@/features/access-control/utils/getGymToday'

export interface EnrolMemberBiometricInput {
  gymId: string
  memberId: string
  /** Which reader the member will present their finger to. */
  deviceId: string
  /** Finger index. Gyms here record one finger, so this rarely moves. */
  fingerId?: number
  /**
   * The member has just consented, at the desk, to their fingerprint being
   * recorded.
   *
   * Only meaningful when no consent is already on file — a member who
   * consented previously is not re-consenting by being enrolled again, and
   * their original timestamp is what the audit trail keeps.
   */
  consentGranted?: boolean
}

export interface BiometricOperationResult {
  /** False when the gym has no access control configured. */
  applicable: boolean
  /** True once the vendor accepted the command. */
  dispatched: boolean
  /** Sanitized reason — never a vendor error string (rules 2.8 / 2.9). */
  error?: string
  /**
   * True when the only thing missing is the member's consent.
   *
   * Distinct from a plain failure so the desk is shown a checkbox to tick
   * rather than an error to retry — nothing is broken, and retrying the same
   * request unchanged would fail identically.
   */
  consentRequired?: boolean
}

export class ManageMemberBiometric {
  constructor(
    private readonly repo: IAccessControlRepository,
    private readonly provider: IAccessControlProvider
  ) {}

  /**
   * Put a reader into enrolment mode for one member.
   *
   * @param input - Gym, member, target reader and optional finger index.
   */
  async enrol(
    input: EnrolMemberBiometricInput
  ): Promise<BiometricOperationResult> {
    const credentials = await this.repo.getCredentials(input.gymId)
    if (!credentials) return { applicable: false, dispatched: false }

    const device = await this.repo.findDeviceById(input.gymId, input.deviceId)
    if (!device || !device.is_active) {
      return {
        applicable: true,
        dispatched: false,
        error: 'Reader not found or not active',
      }
    }

    const context = await this.repo.getMemberAccessContext(input.memberId)
    if (!context || context.gymId !== input.gymId) {
      return { applicable: true, dispatched: false, error: 'Member not found' }
    }

    // A member who may not enter may not be enrolled either.
    //
    // Enrolling means putting the subject onto that reader, and a reader is
    // only supposed to hold people entitled to walk through it. Found live: a
    // cancelled member reached a reader this way, which acknowledged the
    // command exactly as it does for a real one.
    const decision = resolveAccessDecision({
      status: context.status,
      membershipStartDate: context.membershipStartDate,
      nextDueDate: context.nextDueDate,
      registrationSource: context.registrationSource,
      verifiedAt: context.verifiedAt,
      today: getGymToday(),
    })

    if (!decision.allowed) {
      return {
        applicable: true,
        dispatched: false,
        error:
          'This membership is not active, so their fingerprint cannot be registered yet',
      }
    }

    if (!context.biometricConsentAt) {
      if (!input.consentGranted) {
        return {
          applicable: true,
          dispatched: false,
          consentRequired: true,
          error:
            'The member must agree to their fingerprint being recorded before it can be registered',
        }
      }

      // Written before anything is dispatched, and awaited. If the consent
      // write fails we throw and never reach the reader — a record with no
      // template is a harmless outcome, a template with no record is the one
      // this whole path exists to prevent.
      await this.repo.recordBiometricConsent(input.memberId, new Date())
    }

    let subject = context.subject
    if (!subject) {
      const subjectId = await this.repo.allocateSubjectId()
      subject = await this.repo.createSubject(
        input.gymId,
        input.memberId,
        subjectId
      )
    }

    if (!subject.provisioned_at) {
      // The reader can only enrol a subject it already knows about, so a
      // member enrolled before their first sync needs provisioning here.
      const provisioned = await this.provider.upsertSubject(credentials, {
        subjectId: String(subject.subject_id),
        name: context.memberName,
        areaId: credentials.areaId,
      })

      if (provisioned.status === 'failed') {
        return {
          applicable: true,
          dispatched: false,
          error: 'Could not prepare the member on the reader',
        }
      }

      // Records provisioning only. The reader list is untouched: creating the
      // subject on the vendor is not the same as a reader holding a template,
      // and claiming otherwise here would tell the sync path there is nothing
      // left to push.
      await this.repo.updateSyncState(input.memberId, {
        provisioned: true,
        syncedDeviceSerials: subject.synced_device_serials ?? [],
        validFrom: subject.last_synced_valid_from,
        validTo: subject.last_synced_valid_to,
        blocked: subject.last_synced_blocked ?? false,
      })
    }

    // The reader has to hold the subject before it can enrol a finger for it.
    //
    // Creating the subject on the vendor is a different thing — the comment
    // above says so, and the live failure proved it: `enrollfinger` went to a
    // reader whose `synced_device_serials` did not include it, and the reader
    // acknowledged the command with the same return value it gives for a
    // subject it knows. Nothing distinguishes the two from outside.
    const synced = subject.synced_device_serials ?? []

    if (!synced.includes(device.device_serial)) {
      const pushed = await this.provider.syncSubjectsToDevice(
        credentials,
        device.device_serial,
        [String(subject.subject_id)]
      )

      if (pushed.status === 'failed') {
        return {
          applicable: true,
          dispatched: false,
          error: 'Could not put the member on that reader',
        }
      }

      await this.repo.updateSyncState(input.memberId, {
        provisioned: true,
        syncedDeviceSerials: [...synced, device.device_serial],
        validFrom: subject.last_synced_valid_from,
        validTo: subject.last_synced_valid_to,
        blocked: subject.last_synced_blocked ?? false,
      })
    }

    const outcome = await this.provider.startFingerEnrolment(credentials, {
      deviceSerial: device.device_serial,
      subjectId: String(subject.subject_id),
      fingerId: input.fingerId,
    })

    if (outcome.status === 'failed') {
      return {
        applicable: true,
        dispatched: false,
        error: 'The reader did not accept the enrolment request',
      }
    }

    return { applicable: true, dispatched: true }
  }

  /**
   * Clear a member's fingerprint, keeping their membership untouched.
   *
   * @param gymId - Owning gym.
   * @param memberId - Member whose template to remove.
   */
  async clear(
    gymId: string,
    memberId: string
  ): Promise<BiometricOperationResult> {
    const credentials = await this.repo.getCredentials(gymId)
    if (!credentials) return { applicable: false, dispatched: false }

    const context = await this.repo.getMemberAccessContext(memberId)
    if (!context || context.gymId !== gymId || !context.subject) {
      return { applicable: true, dispatched: false, error: 'Member not found' }
    }

    const outcome = await this.provider.revokeBiometrics(
      credentials,
      String(context.subject.subject_id)
    )

    if (outcome.status === 'failed') {
      return {
        applicable: true,
        dispatched: false,
        error: 'The reader did not accept the request',
      }
    }

    await this.repo.setBiometricEnrolled(memberId, false, null)
    await this.repo.markSubjectOffDevice(memberId)
    // Removing the fingerprint IS the withdrawal, so the consent goes with it.
    // Leaving the timestamp would let the next enrolment proceed silently on a
    // permission the member had already taken back.
    await this.repo.clearBiometricConsent(memberId)

    return { applicable: true, dispatched: true }
  }
}
