import expected from '../../../../supabase/expected-enums.json'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { SMS_TYPES, SmsDeliveryStatus } from '@/features/sms/config/SmsConfig'

/**
 * The TypeScript half of the enum contract.
 *
 * `supabase/expected-enums.json` is the single declaration of what each
 * Postgres enum contains. This test holds the TypeScript owners to it;
 * `npm run db:audit` holds the live database to the same file. Neither side can
 * drift without one of the two failing.
 *
 * This is not hypothetical tidiness. The two have diverged four times, and
 * twice it reached production as a failing insert that was patched afterwards
 * by a migration — `welcome`, then `reactivation`. A third (`pending`) was
 * declared in TypeScript and rejected by Postgres for months, and a fourth
 * (`frozen`) sat in the database with no TypeScript representation because the
 * migration meant to remove it never ran.
 *
 * Nothing else catches this: the Supabase clients carry no generated `Database`
 * generic, so every `.select()` and `.update()` is an unchecked string.
 */
describe('enum parity: TypeScript vs the declared contract', () => {
  it('MemberStatus matches member_status', () => {
    expect(Object.values(MemberStatus).sort()).toEqual(
      [...expected.enums.member_status.values].sort()
    )
  })

  it('SMS_TYPES matches sms_type', () => {
    expect([...SMS_TYPES].sort()).toEqual(
      [...expected.enums.sms_type.values].sort()
    )
  })

  it('SmsDeliveryStatus matches delivery_status', () => {
    expect(Object.values(SmsDeliveryStatus).sort()).toEqual(
      [...expected.enums.delivery_status.values].sort()
    )
  })

  /**
   * The contract file names where each enum is owned, so a reader who fails one
   * of the assertions above knows which of the three places to change.
   */
  it('names an owner for every declared enum', () => {
    for (const [name, spec] of Object.entries(expected.enums)) {
      expect(spec.owner).toBeTruthy()
      expect(spec.values.length).toBeGreaterThan(0)
      expect(name).toMatch(/^[a-z_]+$/)
    }
  })
})
