import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LeadInterest } from '@/features/leads/config/LeadConfig'
import { DemoModal } from '../DemoModal'

/**
 * SEO-035: a demo request is the public site's conversion. GA4 can only tie an
 * organic landing page to a lead if the form reports one — and only after the
 * lead was actually stored, and without the visitor's personal data.
 */
describe('DemoModal analytics', () => {
  const gtag = jest.fn()
  const fetchMock = jest.fn()

  beforeEach(() => {
    gtag.mockReset()
    fetchMock.mockReset()
    window.gtag = gtag
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    delete window.gtag
  })

  function submitDemoRequest() {
    render(<DemoModal />)
    fireEvent.click(screen.getByRole('button', { name: 'Request a demo' }))
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Nimal Perera' },
    })
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'nimal@example.lk' },
    })
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: '+94 77 123 4567' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }))
  }

  it('reports generate_lead once the lead is stored, with no personal data', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })

    submitDemoRequest()

    expect(await screen.findByText(/be in touch/i)).toBeInTheDocument()
    expect(gtag).toHaveBeenCalledTimes(1)
    expect(gtag).toHaveBeenCalledWith('event', 'generate_lead', {
      form: 'demo_request',
      interest: LeadInterest.Demo,
    })
    const params = JSON.stringify(gtag.mock.calls[0])
    expect(params).not.toMatch(/Nimal|example\.lk|123 4567/)
  })

  it('sends the Lite tier as interest "lite"', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })
    render(<DemoModal />)
    fireEvent.click(screen.getByRole('button', { name: 'Request a demo' }))
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Nimal Perera' },
    })
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'nimal@example.lk' },
    })
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: '+94 77 123 4567' },
    })
    fireEvent.click(screen.getByText('Select a plan'))
    fireEvent.click(screen.getByText('Lite'))
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }))

    expect(await screen.findByText(/be in touch/i)).toBeInTheDocument()
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.interest).toBe('lite')
  })

  it('reports nothing when the lead was rejected', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { message: 'Too many requests' },
      }),
    })

    submitDemoRequest()

    expect(await screen.findByText('Too many requests')).toBeInTheDocument()
    expect(gtag).not.toHaveBeenCalled()
  })
})

/**
 * Marketing consent (owner decision, 2026-10-06): an UNTICKED box, so only a
 * visitor who chooses it is emailed product news. The request carries the
 * choice either way; the server stores its time as the consent record.
 */
describe('DemoModal marketing consent', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })
    global.fetch = fetchMock as unknown as typeof fetch
  })

  function open() {
    render(<DemoModal />)
    fireEvent.click(screen.getByRole('button', { name: 'Request a demo' }))
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Nimal Perera' },
    })
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'nimal@example.lk' },
    })
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: '+94 77 123 4567' },
    })
  }

  const consentBox = () =>
    screen.getByRole('checkbox', { name: /product news and offers/i })

  it('starts unticked', () => {
    open()
    expect(consentBox()).not.toBeChecked()
  })

  it('sends no consent when the box is left alone', async () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }))
    await screen.findByText(/be in touch/i)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).marketingConsent).toBe(
      false
    )
  })

  it('sends consent when the visitor ticks the box', async () => {
    open()
    fireEvent.click(consentBox())
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }))
    await screen.findByText(/be in touch/i)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).marketingConsent).toBe(
      true
    )
  })

  it('links to the privacy policy beside the box', () => {
    open()
    expect(
      screen.getByRole('link', { name: /privacy policy/i })
    ).toHaveAttribute('href', '/privacy')
  })

  it('clears the box when the form is opened again', async () => {
    open()
    fireEvent.click(consentBox())
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }))
    await screen.findByText(/be in touch/i)
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.click(screen.getByRole('button', { name: 'Request a demo' }))
    expect(consentBox()).not.toBeChecked()
  })
})
