import {
  memberStatusIndicator,
  EXPIRES_SOON_DAYS,
} from '../utils/memberStatusIndicator'

const inDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

describe('memberStatusIndicator', () => {
  it('reads an active member with a distant due date as active', () => {
    expect(memberStatusIndicator('active', inDays(30))).toEqual({
      variant: 'success',
      label: 'Active',
    })
  })

  it('warns when an active member is inside the expiry window', () => {
    expect(memberStatusIndicator('active', inDays(3)).variant).toBe('warning')
    expect(
      memberStatusIndicator('active', inDays(EXPIRES_SOON_DAYS)).variant
    ).toBe('warning')
  })

  it('does not warn the day outside the window', () => {
    expect(
      memberStatusIndicator('active', inDays(EXPIRES_SOON_DAYS + 1)).variant
    ).toBe('success')
  })

  it('never reports an overdue member as healthy', () => {
    // Found by the inverted check (probe E5). The pre-migration page used
    // `Math.ceil` on raw timestamps, where a just-lapsed member produced `-0`
    // and passed a `days >= 0` test, so it showed amber "Expires soon". The
    // midnight-normalised replacement returned a clean negative, which fell
    // through to green "Active" — a member past their due date rendering as
    // healthy.
    expect(memberStatusIndicator('active', inDays(-1))).toEqual({
      variant: 'error',
      label: 'Overdue',
    })
    expect(memberStatusIndicator('active', inDays(-30)).variant).toBe('error')
  })

  it('treats an active member with no due date as simply active', () => {
    expect(memberStatusIndicator('active', null).variant).toBe('success')
  })

  it('maps the terminal statuses', () => {
    expect(memberStatusIndicator('expired').variant).toBe('error')
    expect(memberStatusIndicator('suspended').variant).toBe('warning')
    expect(memberStatusIndicator('cancelled').variant).toBe('neutral')
  })

  it('falls back to the raw status rather than inventing one', () => {
    // The old implementations defaulted unknown statuses to "active"/success,
    // which reported a lapsed member as healthy.
    expect(memberStatusIndicator('archived')).toEqual({
      variant: 'neutral',
      label: 'archived',
    })
  })
})
