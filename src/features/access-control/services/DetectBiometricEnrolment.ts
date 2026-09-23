/**
 * Find out whether a fingerprint actually arrived.
 *
 * ## Where the answer comes from
 *
 * Enrolment is two-part and physical: we put the reader into enrolment mode,
 * the member walks over and presents their finger, and the template is created
 * on the hardware. Nothing announces that it worked.
 *
 * Asked directly on 2026-09-23, VFT confirmed there is nothing to ask for
 * either: *"in the next update, the finger count will be displayed. Now it is
 * considered with the attendance record."* So the template count this used to
 * read does not exist yet, and the real confirmation is the member's first
 * fingerprint scan arriving on the webhook, where `RecordAccessEvents` writes
 * it down (findings F26/F29, audit Y3).
 *
 * This therefore reports the strongest evidence available, in order:
 *
 *  1. a template count from the vendor, if a future build ever sends one;
 *  2. otherwise our own `finger_enrolled` flag, which a scan set.
 *
 * A zero from the vendor is NOT evidence of absence — every subject reads as
 * zero today — so it never overrides a flag that is already set.
 *
 * That shapes the UI as much as the code: the dialog has to say "waiting" and
 * mean it, and the desk has to be told that the fingerprint is confirmed by
 * the member's first entry rather than the moment the command was accepted.
 *
 * ## The tenant trap in here
 *
 * `listSubjects` returns every subject on the **vendor account**, which on a
 * shared account includes other companies' people. Matching is therefore
 * against our own `member_access_subjects` rows for this gym, never against
 * the vendor's list as though it were ours.
 *
 * ## What this deliberately does not do
 *
 * It does not run on a schedule. A background sweep would also catch
 * enrolments performed at the terminal's own admin menu — but whether those
 * ever reach the platform is assumption A-4/A-5, unverified, and building a
 * polling loop against an unverified assumption produces code nobody can later
 * justify. It is one test in the simulator plan; the sweep follows the answer.
 *
 * A device-local enrolment is in fact caught now, but by the scan path rather
 * than by a sweep: whoever was enrolled at the admin menu eventually walks
 * through the door, and that scan is what tells us. Cosmetic either way, since
 * the door is driven by validity windows rather than by this flag.
 */

import type { IAccessControlProvider } from '@/lib/access-control'
import type { IAccessControlRepository } from './IAccessControlRepository'

export interface DetectBiometricEnrolmentResult {
  /** False when the gym has no access control configured. */
  applicable: boolean
  /** Whether the member we asked about now has a template. */
  enrolled: boolean
  /** Members whose stored flag this call corrected. */
  updated: number
}

export class DetectBiometricEnrolment {
  constructor(
    private readonly repo: IAccessControlRepository,
    private readonly provider: IAccessControlProvider
  ) {}

  /**
   * Check the vendor for templates and reconcile our enrolment flags.
   *
   * One vendor call regardless of how many members it resolves, so the
   * enrolment dialog polling every few seconds costs one request per poll
   * rather than one per member.
   *
   * @param gymId - The gym whose subjects to reconcile.
   * @param memberId - The member the caller is waiting on.
   */
  async execute(
    gymId: string,
    memberId: string
  ): Promise<DetectBiometricEnrolmentResult> {
    const idle = { applicable: false, enrolled: false, updated: 0 }

    const credentials = await this.repo.getCredentials(gymId)
    if (!credentials) return idle

    const context = await this.repo.getMemberAccessContext(memberId)
    if (!context || context.gymId !== gymId || !context.subject) return idle

    // ANSWERED by VFT on 2026-09-23, and the answer is "not yet".
    //
    // `GET /api/template` returns no template count — the real fields are
    // EmpId, EmpName, Privilege, Group, Password, Card, StartDate, EndDate,
    // verifyType, DeviceID, EmpPhoto, IsDelete, IsSync, Company*, Area*,
    // Category* — and no endpoint in the vendor's collection reports biometric
    // state. Their words: the finger count arrives in a future update, and
    // until then enrolment "is considered with the attendance record".
    //
    // The call is still made, because the day that field appears this starts
    // working with no further change, and because the vendor's answer is
    // additive: a count it does send can only confirm what the scan already
    // told us. It simply cannot, today, be the only source.
    const vendorSubjects = await this.provider.listSubjects(credentials)

    // Index by id so the lookup below is against the vendor's answer for OUR
    // subject, not a scan of a list that may contain other tenants.
    const templateCounts = new Map(
      vendorSubjects.map((s) => [s.subjectId, s.templateCount ?? 0])
    )

    const ourId = String(context.subject.subject_id)
    const vendorReportsTemplate = (templateCounts.get(ourId) ?? 0) > 0

    // Our own flag counts as evidence, because the only thing that sets it is
    // a fingerprint scan (or a deliberate detection), and the vendor's side is
    // permanently silent. Without this the dialog waits for a flag nothing can
    // set and every enrolment in the product times out.
    const hasTemplate = vendorReportsTemplate || context.subject.finger_enrolled

    let updated = 0

    // **Additive only: this never sets `finger_enrolled` back to false.**
    //
    // A zero template count is ambiguous. Whether `GET /api/template` reports
    // the vendor's central copies or the per-reader ones is unverified
    // (simulator plan, A-5) — and if it is per-reader, then a member evicted
    // for capacity reads as zero while their fingerprint is very much still on
    // file. Clearing the flag would send the front desk to walk that member
    // back to the scanner for no reason.
    //
    // Deliberately clearing a fingerprint already has a path of its own
    // (`ManageMemberBiometric.clear`), which knows it meant it. Detection is
    // for discovering that a finger arrived, and nothing else.
    //
    // Written only on a change, too: this is polled every few seconds while a
    // dialog is open, and an unconditional write would be a row update per
    // poll per member being enrolled.
    if (vendorReportsTemplate && !context.subject.finger_enrolled) {
      await this.repo.setBiometricEnrolled(
        memberId,
        true,
        context.subject.finger_id
      )
      updated += 1
    }

    return {
      applicable: true,
      // The strongest evidence either side holds. The caller is a dialog
      // waiting on a finger, so "is there a template" is the honest answer to
      // its question — and a vendor that reports no counts at all cannot be
      // allowed to answer "no" on everyone's behalf.
      enrolled: hasTemplate,
      updated,
    }
  }
}
