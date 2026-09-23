/**
 * What the Access Control card is allowed to claim.
 *
 * The badge said **Connected** for twenty-five days while production could not
 * decrypt its own credentials and every nightly job died. It was not lying
 * about the past — `verified` meant "a sign-in probe succeeded at some point,
 * ever", and nothing ever wrote a failure down. Shown as a live status, that
 * is the worst kind of wrong: reassuring, and unfalsifiable.
 *
 * Three states, not two:
 *   - a recent success            → Connected
 *   - an old success, nothing since → needs checking
 *   - a failure, or nothing ever  → not verified
 */

import { serializeAccessAccountForAPI } from '@/features/access-control/utils/serializeAccessForAPI'
import { ACCOUNT_VERIFICATION_TTL_HOURS } from '@/features/access-control/config/AccessControlConfig'
import type { AccessControlAccount } from '@/features/access-control/types'

const account = (lastVerifiedAt: string | null): AccessControlAccount =>
  ({
    id: 'acc-1',
    gym_id: 'gym-1',
    base_url: 'https://acccloudlk.com',
    area_id: 1,
    is_active: true,
    last_verified_at: lastVerifiedAt,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  }) as AccessControlAccount

const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 60 * 60 * 1000).toISOString()

describe('access account verification state', () => {
  it('reports connected after a recent successful check', () => {
    expect(serializeAccessAccountForAPI(account(hoursAgo(1))).verified).toBe(
      true
    )
  })

  it('stops reporting connected once the check is stale', () => {
    const stale = hoursAgo(ACCOUNT_VERIFICATION_TTL_HOURS + 1)

    // The exact failure: a success from 27 August still reading as "Connected"
    // on 22 September. A check is evidence about a moment, not a standing state.
    expect(serializeAccessAccountForAPI(account(stale)).verified).toBe(false)
  })

  it('keeps the date so a stale account can say when it last worked', () => {
    const stale = hoursAgo(ACCOUNT_VERIFICATION_TTL_HOURS + 1)

    expect(serializeAccessAccountForAPI(account(stale)).lastVerifiedAt).toBe(
      stale
    )
  })

  it('reports not verified when nothing has ever succeeded', () => {
    const serialized = serializeAccessAccountForAPI(account(null))

    expect(serialized.verified).toBe(false)
    expect(serialized.lastVerifiedAt).toBeNull()
  })

  it('treats a check from twenty-five days ago as not connected', () => {
    // The real row, as it stood on 2026-09-22.
    expect(
      serializeAccessAccountForAPI(account('2026-08-27T18:55:13.95Z')).verified
    ).toBe(false)
  })
})
