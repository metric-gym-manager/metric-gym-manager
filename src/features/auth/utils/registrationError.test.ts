import { CONTACT } from '@/features/marketing'
import {
  REGISTRATION_SUPPORT_EMAIL,
  describeRegistrationError,
} from './registrationError'

/**
 * Rule 2.8: what a visitor sees on /register is plain language with a next
 * step, never Supabase's own message. Production showed "Error sending
 * confirmation email" verbatim on 2026-10-05 while the SMTP login was broken.
 */
describe('describeRegistrationError', () => {
  it('names an address that is already registered', () => {
    expect(describeRegistrationError({ code: 'user_already_exists' })).toBe(
      'Email already registered'
    )
    expect(describeRegistrationError({ code: 'email_exists' })).toBe(
      'Email already registered'
    )
  })

  it('keeps recognising the older code-less "already registered" message', () => {
    expect(
      describeRegistrationError({ message: 'User already registered' })
    ).toBe('Email already registered')
  })

  it('asks for a different password when Supabase rejects it as weak', () => {
    expect(describeRegistrationError({ code: 'weak_password' })).toBe(
      'That password is too easy to guess. Please choose a different one.'
    )
  })

  it('asks the visitor to wait when a rate limit is hit', () => {
    for (const code of [
      'over_email_send_rate_limit',
      'over_request_rate_limit',
    ]) {
      expect(describeRegistrationError({ code })).toBe(
        'Too many sign-up attempts. Please wait a few minutes and try again.'
      )
    }
  })

  it('asks for a valid address when Supabase refuses the email', () => {
    expect(describeRegistrationError({ code: 'email_address_invalid' })).toBe(
      'Enter a valid email address.'
    )
  })

  describe('anything else gets the generic message with a support route', () => {
    const generic = `We couldn't create your account right now. Please try again in a few minutes. If it keeps happening, email ${CONTACT.supportEmail}.`

    it('hides the SMTP failure seen in production', () => {
      const shown = describeRegistrationError({
        code: 'unexpected_failure',
        message: 'Error sending confirmation email',
      })
      expect(shown).toBe(generic)
      expect(shown).not.toMatch(/confirmation email/i)
    })

    it('covers an unknown code, a missing code and a missing error', () => {
      expect(
        describeRegistrationError({ code: 'hook_timeout', message: 'x' })
      ).toBe(generic)
      expect(
        describeRegistrationError({ message: 'Database error saving new user' })
      ).toBe(generic)
      expect(describeRegistrationError(null)).toBe(generic)
      expect(describeRegistrationError(undefined)).toBe(generic)
    })
  })

  it('names the support address the public site publishes', () => {
    expect(REGISTRATION_SUPPORT_EMAIL).toBe(CONTACT.supportEmail)
  })
})
