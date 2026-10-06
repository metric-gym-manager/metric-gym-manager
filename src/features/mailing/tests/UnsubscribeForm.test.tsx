import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { UnsubscribeForm } from '../components/UnsubscribeForm'
import { ALWAYS_SENT_EMAILS, MailingTopic } from '../config/MailingConfig'

const okJson = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response

const marketing = () =>
  screen.getByRole('checkbox', { name: /marketing emails/i })
const updates = () =>
  screen.getByRole('checkbox', { name: /product and security updates/i })
const submit = () => screen.getByRole('button', { name: /unsubscribe/i })

const props = {
  email: 'owner@titanfitness.lk',
  token: 'tok_123',
  initialTopic: MailingTopic.Marketing,
}

beforeEach(() => {
  globalThis.fetch = jest.fn(async () =>
    okJson({ success: true })
  ) as unknown as typeof fetch
})

describe('UnsubscribeForm', () => {
  it('offers one checkbox per kind of email, ticking the one the link came from', () => {
    render(<UnsubscribeForm {...props} />)
    expect(marketing()).toBeChecked()
    expect(updates()).not.toBeChecked()
  })

  it('ticks updates when the link came from an update email', () => {
    render(<UnsubscribeForm {...props} initialTopic={MailingTopic.Updates} />)
    expect(updates()).toBeChecked()
    expect(marketing()).not.toBeChecked()
  })

  it('ticks nothing when the link names no kind', () => {
    render(<UnsubscribeForm {...props} initialTopic={null} />)
    expect(marketing()).not.toBeChecked()
    expect(updates()).not.toBeChecked()
    expect(submit()).toBeDisabled()
  })

  it('says which emails keep arriving whatever is ticked', () => {
    render(<UnsubscribeForm {...props} />)
    for (const line of ALWAYS_SENT_EMAILS) {
      expect(screen.getByText(line)).toBeInTheDocument()
    }
  })

  it('names the address the link is for', () => {
    render(<UnsubscribeForm {...props} />)
    expect(screen.getByText('owner@titanfitness.lk')).toBeInTheDocument()
  })

  it('shows a + that the link delivered as a space', () => {
    render(<UnsubscribeForm {...props} email="owner gym@titan.lk" />)
    expect(screen.getByText('owner+gym@titan.lk')).toBeInTheDocument()
  })

  it('posts the address, token and every ticked kind', async () => {
    render(<UnsubscribeForm {...props} />)
    fireEvent.click(updates())
    fireEvent.click(submit())
    await waitFor(() => {
      const [url, init] = (globalThis.fetch as jest.Mock).mock.calls[0]
      expect(url).toBe('/api/public/email-preferences')
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({
        email: 'owner@titanfitness.lk',
        token: 'tok_123',
        topics: [MailingTopic.Marketing, MailingTopic.Updates],
      })
    })
  })

  it('cannot be submitted with nothing ticked', () => {
    render(<UnsubscribeForm {...props} />)
    fireEvent.click(marketing())
    expect(submit()).toBeDisabled()
  })

  it('confirms what was stopped, and what was kept', async () => {
    render(<UnsubscribeForm {...props} />)
    fireEvent.click(submit())
    const done = await screen.findByRole('status')
    expect(done).toHaveTextContent(/no longer receive marketing emails/i)
    expect(done).toHaveTextContent(
      /still receive product and security updates/i
    )
    expect(screen.queryByRole('button', { name: /unsubscribe/i })).toBeNull()
  })

  it("shows the server's message when the link is refused", async () => {
    globalThis.fetch = jest.fn(async () =>
      okJson(
        {
          success: false,
          error: { code: 'INVALID_LINK', message: 'This link is not valid.' },
        },
        400
      )
    ) as unknown as typeof fetch
    render(<UnsubscribeForm {...props} />)
    fireEvent.click(submit())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This link is not valid.'
    )
  })

  it('reports a network failure without losing the choice', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    render(<UnsubscribeForm {...props} />)
    fireEvent.click(submit())
    expect(await screen.findByRole('alert')).toHaveTextContent(/try again/i)
    expect(marketing()).toBeChecked()
  })
})
