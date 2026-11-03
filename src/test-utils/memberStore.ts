import { Member, type MemberProps } from '@/features/members/domain/Member'
import type { MemberWritableField } from '@/features/members/config/MemberWriteFields'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import type { MemberWriteGuard } from '@/features/members/services/IMemberRepository'
import { ConflictError, NotFoundError } from '@/utils/errors'

/**
 * An in-memory `members` table for tests that need two writers to meet.
 *
 * What it models: only the named fields of a write change, and the guards
 * (`expectedNextDueDate`, `expectedStatus`) match against the CURRENT row — the
 * two properties the real `updateFields` has and the removed whole-row write
 * did not. What it cannot model: RLS, triggers, column defaults, the real query
 * text. A live stack is the only thing that can see those.
 *
 * `duringNextRead(fn)` is how a race is staged deterministically. Every read
 * (`findById`, `findAll*`) takes its snapshot first and THEN runs the queued
 * `fn` before returning, so `fn` lands while the reader holds a copy that is
 * about to go stale — the exact state of a request between its read and its
 * write.
 */
export function createMemberStore(initial: Member | Member[]) {
  const rows = new Map<string, Member>(
    (Array.isArray(initial) ? initial : [initial]).map((m) => [m.id, m])
  )
  let interleave: (() => Promise<void>) | null = null

  const afterSnapshot = async () => {
    if (!interleave) return
    const run = interleave
    interleave = null
    await run()
  }

  const byStatus = (status: MemberStatus) =>
    [...rows.values()].filter((m) => m.status === status)

  const snapshotRead = (pick: () => Member[]) =>
    jest.fn(async () => {
      const snapshot = pick()
      await afterSnapshot()
      return snapshot
    })

  const isoDay = (d: Date) => d.toISOString().split('T')[0]

  return {
    /** The stored member (first one, for single-member tests). */
    get current(): Member {
      return [...rows.values()][0]
    },
    get(id: string): Member {
      const member = rows.get(id)
      if (!member) throw new Error(`no member ${id} in the store`)
      return member
    },
    /** Run `fn` right after the next read has taken its snapshot. */
    duringNextRead(fn: () => Promise<void>) {
      interleave = fn
    },
    repo: {
      findById: jest.fn(async (id: string) => {
        const snapshot = rows.get(id) ?? null
        await afterSnapshot()
        return snapshot
      }),
      findByPhoneNumber: jest.fn(
        async (phone: string) =>
          [...rows.values()].find((m) => m.phoneNumber === phone) ?? null
      ),
      findActiveMembers: snapshotRead(() => byStatus(MemberStatus.Active)),
      findAllActiveMembers: snapshotRead(() => byStatus(MemberStatus.Active)),
      findAllExpiredMembers: snapshotRead(() => byStatus(MemberStatus.Expired)),
      findAllSuspendedMembers: snapshotRead(() =>
        byStatus(MemberStatus.Suspended)
      ),
      updateFields: jest.fn(
        async (
          edited: Member,
          fields: readonly MemberWritableField[],
          options?: MemberWriteGuard
        ) => {
          const stored = rows.get(edited.id)
          if (!stored) throw new NotFoundError(`Member ${edited.id}`)

          if (
            (options?.expectedNextDueDate &&
              isoDay(options.expectedNextDueDate) !==
                isoDay(stored.nextDueDate)) ||
            (options?.expectedStatus &&
              options.expectedStatus !== stored.status) ||
            (options?.expectedPlan &&
              (options.expectedPlan.planType !== stored.planType ||
                options.expectedPlan.planAmount !== stored.planAmount))
          ) {
            throw new ConflictError(
              'This member was updated by another request. Reload and try again.'
            )
          }

          const next = { ...stored.toDatabase() } as Record<string, unknown>
          const incoming = edited.toDatabase() as unknown as Record<
            string,
            unknown
          >
          for (const field of fields) next[field] = incoming[field]
          const saved = Member.fromDatabase(next as unknown as MemberProps)
          rows.set(saved.id, saved)
          return saved
        }
      ),
    },
  }
}
