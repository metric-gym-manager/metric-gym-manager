import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import AuthShell from '../AuthShell'

/**
 * The sign-in side panel is shown on /register (indexable) and every other
 * auth page, so it is public copy and states only what the code does (rule
 * 2.23, SEO-024). The owner confirmed its figures on 2026-10-04 and asked for
 * the domain label to name the real domain.
 */
describe('AuthShell side panel', () => {
  const text = () =>
    render(
      <AuthShell>
        <p>form</p>
      </AuthShell>
    ).container.textContent ?? ''

  it('labels the real domain, not metricgym.lk', () => {
    expect(text()).toContain('metricgymos.com')
    expect(text()).not.toMatch(/metricgym\.lk/)
  })

  // The reminder run is the 03:30 UTC send-reminders cron (vercel.json):
  // 9:00 in the morning in Sri Lanka, as the public SMS pages say. The
  // panel used to promise the first batch "tonight".
  it('gives the reminder run its real time', () => {
    expect(text()).toContain('Your reminders go out every morning at 9:00.')
    expect(text()).not.toMatch(/tonight/i)
  })
})
