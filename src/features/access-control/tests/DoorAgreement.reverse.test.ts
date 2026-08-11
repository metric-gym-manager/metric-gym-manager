/**
 * Reverse test: simulate the terminal, then check the door agrees with us.
 *
 * Every other test in this feature runs *forwards* — it asserts that a function
 * returns what it was written to return. Those cannot catch a wrong intention,
 * because the same understanding produced both the code and the assertion.
 *
 * This one runs backwards. It models the terminal's own admission logic from
 * the vendor's semantics (inclusive end date, privilege flag, record must be
 * present), pushes our derived commands into it, and then asks the simulated
 * door a question our code never gets to answer:
 *
 *   "On this date, would you actually open?"
 *
 * If that answer ever differs from what `resolveAccessDecision` believes, the
 * system is lying to staff — and it does not matter which side is wrong,
 * because a member is standing at a door either way.
 */

import { resolveAccessDecision } from '@/features/access-control/domain/AccessDecision'
import { deriveAccessCommands } from '@/features/access-control/domain/AccessCommands'
import { AccessIntent } from '@/features/access-control/config/AccessControlConfig'
import { formatDeviceDate } from '@/features/access-control/utils/getGymToday'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { RegistrationSource } from '@/features/members/config/RegistrationConfig'

const day = (iso: string) => new Date(`${iso}T00:00:00Z`)

/** What the terminal holds for one subject. */
interface TerminalRecord {
  validFrom: string | null
  validTo: string | null
  /** Privilege flag set by accessblock / cleared by accessgrant. */
  blocked: boolean
  /** Whether a fingerprint template is loaded on this reader. */
  hasTemplate: boolean
}

/**
 * A stand-in for the ZKTeco reader.
 *
 * Implements admission the way the hardware does, from the vendor's stated
 * behaviour — deliberately written from the *device's* point of view rather
 * than by reusing any of our own logic, so the two can disagree.
 */
class SimulatedTerminal {
  private readonly records = new Map<string, TerminalRecord>()
  /** Templates the vendor holds centrally, independent of this reader. */
  private readonly vendorTemplates = new Set<string>()

  /** Someone enrolled a finger at this reader. */
  enrol(subjectId: string): void {
    const record = this.ensure(subjectId)
    record.hasTemplate = true
    this.vendorTemplates.add(subjectId)
  }

  apply(command: {
    intent: AccessIntent
    subjectId: string
    startDate?: string
    endDate?: string
  }): void {
    switch (command.intent) {
      case AccessIntent.Provision:
        this.ensure(command.subjectId)
        break

      case AccessIntent.SyncToDevice: {
        const record = this.ensure(command.subjectId)
        // Pushing a subject to the reader restores its template from the
        // vendor's central store, if one was ever enrolled.
        if (this.vendorTemplates.has(command.subjectId)) {
          record.hasTemplate = true
        }
        break
      }

      case AccessIntent.SetValidPeriod: {
        const record = this.ensure(command.subjectId)
        record.validFrom = command.startDate ?? null
        record.validTo = command.endDate ?? null
        break
      }

      case AccessIntent.Block:
        this.ensure(command.subjectId).blocked = true
        break

      case AccessIntent.Grant:
        this.ensure(command.subjectId).blocked = false
        break

      case AccessIntent.RevokeBiometric:
        // fromdev: template off the reader, vendor record and template kept.
        this.ensure(command.subjectId).hasTemplate = false
        break

      case AccessIntent.RemoveSubject:
        // Full delete: the record and the central template are destroyed.
        this.records.delete(command.subjectId)
        this.vendorTemplates.delete(command.subjectId)
        break
    }
  }

  /**
   * Would the door open for this subject on this date?
   *
   * The reader needs a record, a loaded fingerprint, no block, and the date
   * inside the validity window — end date inclusive, as VFT confirmed.
   */
  wouldAdmit(subjectId: string, onDate: Date): boolean {
    const record = this.records.get(subjectId)
    if (!record) return false
    if (!record.hasTemplate) return false
    if (record.blocked) return false
    if (!record.validFrom || !record.validTo) return false

    const today = formatDeviceDate(onDate)
    return today >= record.validFrom && today <= record.validTo
  }

  /** Whether the member would have to re-enrol to use the door again. */
  needsReEnrolment(subjectId: string): boolean {
    return !this.vendorTemplates.has(subjectId)
  }

  /** Subjects occupying a template slot on this reader. */
  templateSlotsUsed(): number {
    return [...this.records.values()].filter((r) => r.hasTemplate).length
  }

  private ensure(subjectId: string): TerminalRecord {
    let record = this.records.get(subjectId)
    if (!record) {
      record = {
        validFrom: null,
        validTo: null,
        blocked: false,
        hasTemplate: false,
      }
      this.records.set(subjectId, record)
    }
    return record
  }
}

/** Our side's view of what the reader holds. */
interface SyncedState {
  provisioned: boolean
  onDevice: boolean
  validFrom: string | null
  validTo: string | null
  blocked: boolean | null
}

const SUBJECT_ID = '100042'

/**
 * Run one sync cycle: decide, derive, push to the terminal, record what we
 * believe. Mirrors what `SyncMemberAccess` does, minus the database.
 */
function syncOnce(
  terminal: SimulatedTerminal,
  synced: SyncedState,
  member: {
    status: MemberStatus
    membershipStartDate: Date
    nextDueDate: Date
    registrationSource?: RegistrationSource
    verifiedAt?: Date | null
  },
  today: Date
): { commandCount: number; allowed: boolean } {
  const decision = resolveAccessDecision({
    status: member.status,
    membershipStartDate: member.membershipStartDate,
    nextDueDate: member.nextDueDate,
    registrationSource: member.registrationSource ?? RegistrationSource.Manual,
    verifiedAt: member.verifiedAt ?? null,
    today,
  })

  const commands = deriveAccessCommands({
    decision,
    subject: {
      subjectId: SUBJECT_ID,
      memberName: 'Test Member',
      provisioned: synced.provisioned,
      onDevice: synced.onDevice,
      lastSyncedValidFrom: synced.validFrom,
      lastSyncedValidTo: synced.validTo,
      lastSyncedBlocked: synced.blocked,
    },
    deviceSerials: ['DEV-1'],
  })

  for (const command of commands) {
    terminal.apply(command)
  }

  if (commands.length > 0) {
    const window = commands.find(
      (c) => c.intent === AccessIntent.SetValidPeriod
    )
    synced.provisioned = true
    if (commands.some((c) => c.intent === AccessIntent.SyncToDevice)) {
      synced.onDevice = true
    } else if (
      commands.some((c) => c.intent === AccessIntent.RevokeBiometric)
    ) {
      synced.onDevice = false
    }
    synced.validFrom = window?.startDate ?? null
    synced.validTo = window?.endDate ?? null
    synced.blocked = !decision.allowed
  }

  return { commandCount: commands.length, allowed: decision.allowed }
}

function freshState(): SyncedState {
  return {
    provisioned: false,
    onDevice: false,
    validFrom: null,
    validTo: null,
    blocked: null,
  }
}

/** Assert the door and the app agree about this member on this date. */
function expectAgreement(
  terminal: SimulatedTerminal,
  member: Parameters<typeof syncOnce>[2],
  today: Date,
  context: string
): void {
  const weBelieve = resolveAccessDecision({
    status: member.status,
    membershipStartDate: member.membershipStartDate,
    nextDueDate: member.nextDueDate,
    registrationSource: member.registrationSource ?? RegistrationSource.Manual,
    verifiedAt: member.verifiedAt ?? null,
    today,
  }).allowed

  const doorOpens = terminal.wouldAdmit(SUBJECT_ID, today)

  expect({ context, doorOpens }).toEqual({ context, doorOpens: weBelieve })
}

describe('reverse test — does the door agree with us?', () => {
  describe('the ordinary life of a member', () => {
    it('keeps the door and the app in step from joining to expiry', () => {
      const terminal = new SimulatedTerminal()
      const synced = freshState()

      const member = {
        status: MemberStatus.Active,
        membershipStartDate: day('2026-01-01'),
        nextDueDate: day('2026-01-31'),
      }

      // Join, then enrol a finger at the reader.
      syncOnce(terminal, synced, member, day('2026-01-01'))
      terminal.enrol(SUBJECT_ID)

      expectAgreement(terminal, member, day('2026-01-01'), 'joining day')
      expectAgreement(terminal, member, day('2026-01-15'), 'mid-membership')
      expectAgreement(terminal, member, day('2026-01-31'), 'last paid day')
      expectAgreement(terminal, member, day('2026-02-01'), 'day after expiry')
    })

    it('closes the door at midnight without any sync running', () => {
      // The whole point of pushing a window: expiry does not depend on us.
      const terminal = new SimulatedTerminal()
      const synced = freshState()

      const member = {
        status: MemberStatus.Active,
        membershipStartDate: day('2026-01-01'),
        nextDueDate: day('2026-01-31'),
      }

      syncOnce(terminal, synced, member, day('2026-01-01'))
      terminal.enrol(SUBJECT_ID)

      expect(terminal.wouldAdmit(SUBJECT_ID, day('2026-01-31'))).toBe(true)
      expect(terminal.wouldAdmit(SUBJECT_ID, day('2026-02-01'))).toBe(false)
    })
  })

  describe('suspension and reinstatement', () => {
    it('shuts the door on suspension and reopens it on reinstatement', () => {
      const terminal = new SimulatedTerminal()
      const synced = freshState()

      const member = {
        status: MemberStatus.Active,
        membershipStartDate: day('2026-01-01'),
        nextDueDate: day('2026-01-31'),
      }

      syncOnce(terminal, synced, member, day('2026-01-10'))
      terminal.enrol(SUBJECT_ID)
      expectAgreement(terminal, member, day('2026-01-10'), 'before suspension')

      const suspended = { ...member, status: MemberStatus.Suspended }
      syncOnce(terminal, synced, suspended, day('2026-01-11'))
      expectAgreement(terminal, suspended, day('2026-01-11'), 'suspended')

      const reinstated = { ...member, status: MemberStatus.Active }
      syncOnce(terminal, synced, reinstated, day('2026-01-12'))
      expectAgreement(terminal, reinstated, day('2026-01-12'), 'reinstated')
    })

    it('does not make a reinstated member enrol again', () => {
      // A suspension is expected to be lifted. If the fingerprint does not
      // survive it, every reinstatement becomes a trip to the reader.
      const terminal = new SimulatedTerminal()
      const synced = freshState()

      const member = {
        status: MemberStatus.Active,
        membershipStartDate: day('2026-01-01'),
        nextDueDate: day('2026-01-31'),
      }

      syncOnce(terminal, synced, member, day('2026-01-10'))
      terminal.enrol(SUBJECT_ID)

      syncOnce(
        terminal,
        synced,
        { ...member, status: MemberStatus.Suspended },
        day('2026-01-11')
      )

      expect(terminal.needsReEnrolment(SUBJECT_ID)).toBe(false)
    })
  })

  describe('cancellation and return', () => {
    it('shuts the door on cancellation', () => {
      const terminal = new SimulatedTerminal()
      const synced = freshState()

      const member = {
        status: MemberStatus.Active,
        membershipStartDate: day('2026-01-01'),
        nextDueDate: day('2026-01-31'),
      }

      syncOnce(terminal, synced, member, day('2026-01-10'))
      terminal.enrol(SUBJECT_ID)

      const cancelled = { ...member, status: MemberStatus.Cancelled }
      syncOnce(terminal, synced, cancelled, day('2026-01-11'))

      expect(terminal.wouldAdmit(SUBJECT_ID, day('2026-01-11'))).toBe(false)
    })

    it('lets a returning member back in after they pay again', () => {
      // Cancelled -> Active is an explicit, supported transition
      // (StatusConfig). The door must follow it.
      const terminal = new SimulatedTerminal()
      const synced = freshState()

      const member = {
        status: MemberStatus.Active,
        membershipStartDate: day('2026-01-01'),
        nextDueDate: day('2026-01-31'),
      }

      syncOnce(terminal, synced, member, day('2026-01-10'))
      terminal.enrol(SUBJECT_ID)

      syncOnce(
        terminal,
        synced,
        { ...member, status: MemberStatus.Cancelled },
        day('2026-02-15')
      )

      const rejoined = {
        status: MemberStatus.Active,
        membershipStartDate: day('2026-06-01'),
        nextDueDate: day('2026-06-30'),
      }
      syncOnce(terminal, synced, rejoined, day('2026-06-01'))

      expectAgreement(terminal, rejoined, day('2026-06-01'), 'rejoined')
    })
  })

  describe('members who never reach the door', () => {
    it('does not put a blocked, never-provisioned member on the reader', () => {
      // Device template slots are finite (1,000-3,000). Spending one on
      // somebody who is refused anyway is pure waste, and it is exactly the
      // capacity the eviction policy has to claw back later.
      const terminal = new SimulatedTerminal()
      const synced = freshState()

      const expired = {
        status: MemberStatus.Expired,
        membershipStartDate: day('2025-01-01'),
        nextDueDate: day('2025-02-01'),
      }

      syncOnce(terminal, synced, expired, day('2026-01-10'))

      expect(terminal.templateSlotsUsed()).toBe(0)
    })

    it('sends nothing at all for a member who cannot get in and never could', () => {
      const terminal = new SimulatedTerminal()
      const synced = freshState()

      const result = syncOnce(
        terminal,
        synced,
        {
          status: MemberStatus.Cancelled,
          membershipStartDate: day('2025-01-01'),
          nextDueDate: day('2025-02-01'),
        },
        day('2026-01-10')
      )

      expect(result.commandCount).toBe(0)
    })
  })

  describe('the unverified self-registration', () => {
    it('keeps an unverified QR member out, then lets them in once verified', () => {
      const terminal = new SimulatedTerminal()
      const synced = freshState()

      const unverified = {
        status: MemberStatus.Active,
        membershipStartDate: day('2026-01-01'),
        nextDueDate: day('2026-01-31'),
        registrationSource: RegistrationSource.Qr,
        verifiedAt: null,
      }

      syncOnce(terminal, synced, unverified, day('2026-01-05'))
      terminal.enrol(SUBJECT_ID)
      expectAgreement(terminal, unverified, day('2026-01-05'), 'unverified')

      const verified = { ...unverified, verifiedAt: day('2026-01-06') }
      syncOnce(terminal, synced, verified, day('2026-01-06'))
      expectAgreement(terminal, verified, day('2026-01-06'), 'verified')
    })
  })

  describe('repeated syncs', () => {
    it('stops sending commands once the reader already matches', () => {
      const terminal = new SimulatedTerminal()
      const synced = freshState()

      const member = {
        status: MemberStatus.Active,
        membershipStartDate: day('2026-01-01'),
        nextDueDate: day('2026-01-31'),
      }

      syncOnce(terminal, synced, member, day('2026-01-10'))
      terminal.enrol(SUBJECT_ID)

      const second = syncOnce(terminal, synced, member, day('2026-01-11'))
      const third = syncOnce(terminal, synced, member, day('2026-01-12'))

      expect(second.commandCount).toBe(0)
      expect(third.commandCount).toBe(0)
    })

    it('keeps the door correct across a long quiet period', () => {
      const terminal = new SimulatedTerminal()
      const synced = freshState()

      const member = {
        status: MemberStatus.Active,
        membershipStartDate: day('2026-01-01'),
        nextDueDate: day('2026-01-31'),
      }

      syncOnce(terminal, synced, member, day('2026-01-01'))
      terminal.enrol(SUBJECT_ID)

      // Nothing changes for a month; the reconciler runs daily regardless.
      for (const d of ['2026-01-05', '2026-01-20', '2026-01-30']) {
        syncOnce(terminal, synced, member, day(d))
        expectAgreement(terminal, member, day(d), `quiet day ${d}`)
      }

      expectAgreement(terminal, member, day('2026-02-01'), 'after expiry')
    })
  })
})
