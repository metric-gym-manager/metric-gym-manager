/**
 * SMS_DISABLED_GYM_IDS — the operator's list of gyms that must never be texted.
 *
 * The E2E test gyms live in production, seeded with valid-format Sri Lankan
 * numbers, and the reminders cron sent 310 real texts to them before they were
 * suspended (2026-10-04). They are re-enabled with texts disabled, through this
 * list, which is enforced where every real text leaves (`sendSmsViaTextLk`).
 */

import {
  isSmsDisabledForGym,
  smsDisabledGymIds,
} from '../config/SmsSuppression'

const A = 'e0d0a7f9-094c-474c-9277-21cdf1b0bffd'
const B = '3133db6c-55e1-4c30-a309-811e691f0be9'

describe('smsDisabledGymIds', () => {
  it('is empty when the variable is unset or blank', () => {
    expect(smsDisabledGymIds({}).size).toBe(0)
    expect(smsDisabledGymIds({ SMS_DISABLED_GYM_IDS: '  ' }).size).toBe(0)
  })

  it('reads comma- or space-separated ids, trimmed and lower-cased', () => {
    const ids = smsDisabledGymIds({
      SMS_DISABLED_GYM_IDS: ` ${A.toUpperCase()} ,\n${B}  ,, `,
    })
    expect([...ids].sort()).toEqual([A, B].sort())
  })
})

describe('isSmsDisabledForGym', () => {
  const env = { SMS_DISABLED_GYM_IDS: `${A},${B}` }

  it('is true for a listed gym, whatever its case', () => {
    expect(isSmsDisabledForGym(A, env)).toBe(true)
    expect(isSmsDisabledForGym(B.toUpperCase(), env)).toBe(true)
  })

  it('is false for any other gym', () => {
    expect(
      isSmsDisabledForGym('481599f6-5134-4152-83b2-6e2dd10e3018', env)
    ).toBe(false)
  })

  it('is false for every gym when nothing is listed', () => {
    expect(isSmsDisabledForGym(A, {})).toBe(false)
  })
})
