/**
 * Find out whether a fingerprint actually arrived.
 *
 * ## Why this has to be polled
 *
 * Enrolment is two-part and physical: we put the reader into enrolment mode,
 * the member walks over and presents their finger, and the template is created
 * on the hardware. There is **no completion callback** — nothing tells us it
 * worked. So the only honest way to know is to ask the vendor whether the
 * subject now has a template.
 *
 * That shapes the UI as much as the code: the dialog has to say "waiting" and
 * mean it, rather than claiming success the moment the command was accepted.
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
 * Until then a device-local enrolment shows as "not enrolled" — cosmetic, since
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

    // KNOWN LIMITATION, measured 2026-09-23 against the live VFT account.
    //
    // This detection cannot currently succeed. `GET /api/template` returns no
    // template count — the real fields are EmpId, EmpName, Privilege, Group,
    // Password, Card, StartDate, EndDate, verifyType, DeviceID, EmpPhoto,
    // IsDelete, IsSync, Company*, Area*, Category* — and the vendor's own
    // collection has no endpoint reporting biometric state at all. Dispatching
    // a real enrolment moved nothing: FpCount, UserCount and AttCount stayed
    // null on a reader that held the member and answered in two seconds.
    //
    // The behaviour below is still correct and safe: it is additive, so it
    // never un-enrols anyone, and the poll that drives it treats a timeout as
    // "not yet" rather than failure. It simply always answers "no template".
    //
    // The open question is with VFT (campaign findings F26/F29): is there an
    // endpoint or field we have not been told about, or does a completed
    // enrolment produce an event on the attendance callback? If it is the
    // callback, the honest design is to let the first successful scan be the
    // confirmation instead of polling for a flag.
    const vendorSubjects = await this.provider.listSubjects(credentials)

    // Index by id so the lookup below is against the vendor's answer for OUR
    // subject, not a scan of a list that may contain other tenants.
    const templateCounts = new Map(
      vendorSubjects.map((s) => [s.subjectId, s.templateCount ?? 0])
    )

    const ourId = String(context.subject.subject_id)
    const hasTemplate = (templateCounts.get(ourId) ?? 0) > 0

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
    if (hasTemplate && !context.subject.finger_enrolled) {
      await this.repo.setBiometricEnrolled(
        memberId,
        true,
        context.subject.finger_id
      )
      updated += 1
    }

    return {
      applicable: true,
      // Reports what the vendor says right now, which may legitimately differ
      // from the stored flag for an evicted member. The caller is a dialog
      // waiting on a finger, so "is there a template" is the honest answer to
      // its question.
      enrolled: hasTemplate,
      updated,
    }
  }
}
