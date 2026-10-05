import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { isPublicRoute } from '@/lib/auth-config'
import { SENSITIVE_QUERY_PARAMS } from '@/lib/analytics/ga-init'
import UnsubscribePage, { metadata } from '../page'

async function renderWith(params: Record<string, string | undefined>) {
  render(await UnsubscribePage({ searchParams: Promise.resolve(params) }))
}

const link = {
  email: 'owner@titanfitness.lk',
  token: 'tok_123',
  topic: 'marketing',
}

describe('/unsubscribe', () => {
  it('shows the two choices for a complete link', async () => {
    await renderWith(link)
    expect(
      screen.getByRole('heading', { name: /email preferences/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: /marketing emails/i })
    ).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: /product and security updates/i })
    ).not.toBeChecked()
  })

  it('ignores a topic it does not know', async () => {
    await renderWith({ ...link, topic: 'billing' })
    expect(
      screen.getByRole('checkbox', { name: /marketing emails/i })
    ).not.toBeChecked()
  })

  it.each([
    ['no email', { ...link, email: undefined }],
    ['no token', { ...link, token: undefined }],
    ['nothing', {}],
  ])(
    'explains an incomplete link (%s) instead of showing a form',
    async (_, params) => {
      await renderWith(params)
      expect(screen.getByText(/this link is incomplete/i)).toBeInTheDocument()
      expect(screen.queryByRole('checkbox')).toBeNull()
      expect(
        screen.getByRole('link', { name: 'hello@metricgymos.com' })
      ).toHaveAttribute('href', 'mailto:hello@metricgymos.com')
    }
  )

  it('is served to signed-out visitors, since it is reached from an email', () => {
    expect(isPublicRoute('/unsubscribe')).toBe(true)
  })

  it('is never indexed', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  it("keeps the link's email and token out of Google Analytics", () => {
    // The GA bootstrap loads nothing on a URL carrying these parameters.
    expect(SENSITIVE_QUERY_PARAMS).toEqual(
      expect.arrayContaining(['email', 'token'])
    )
  })
})
