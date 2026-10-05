/**
 * @jest-environment node
 */
import nodemailer from 'nodemailer'
import { createSmtpMailer } from '../smtp'

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
}))

const createTransport = nodemailer.createTransport as jest.Mock

/**
 * The app's one SMTP sender: the Gmail account the auth emails use
 * (admin@capitalistone.co). The app password lives in Vercel as SMTP_PASS;
 * without it the app still runs and simply sends nothing.
 */
describe('createSmtpMailer', () => {
  beforeEach(() => createTransport.mockReset())

  it('returns null when the credentials are not set', () => {
    expect(createSmtpMailer({})).toBeNull()
    expect(createSmtpMailer({ SMTP_USER: 'admin@capitalistone.co' })).toBeNull()
    expect(createSmtpMailer({ SMTP_PASS: 'abcdabcdabcdabcd' })).toBeNull()
    expect(createTransport).not.toHaveBeenCalled()
  })

  it('logs in to Gmail over TLS with bounded timeouts', () => {
    const sendMail = jest.fn().mockResolvedValue({})
    createTransport.mockReturnValue({ sendMail })

    const mailer = createSmtpMailer({
      SMTP_USER: ' admin@capitalistone.co ',
      // Google shows app passwords in four groups of four.
      SMTP_PASS: 'abcd efgh ijkl mnop',
    })

    expect(mailer).not.toBeNull()
    const options = createTransport.mock.calls[0][0]
    expect(options).toMatchObject({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'admin@capitalistone.co', pass: 'abcdefghijklmnop' },
    })
    expect(options.connectionTimeout).toBeLessThanOrEqual(10_000)
    expect(options.socketTimeout).toBeLessThanOrEqual(15_000)
  })

  it('passes the message to the transport and surfaces its failure', async () => {
    const sendMail = jest
      .fn()
      .mockRejectedValue(new Error('Invalid login: 535 5.7.8'))
    createTransport.mockReturnValue({ sendMail })
    const mailer = createSmtpMailer({
      SMTP_USER: 'admin@capitalistone.co',
      SMTP_PASS: 'abcdabcdabcdabcd',
    })

    const message = {
      from: 'Metric Gym OS <noreply@metricgymos.com>',
      to: 'hello@metricgymos.com',
      subject: 's',
      text: 't',
    }
    await expect(mailer?.send(message)).rejects.toThrow('535')
    expect(sendMail).toHaveBeenCalledWith(message)
  })
})
