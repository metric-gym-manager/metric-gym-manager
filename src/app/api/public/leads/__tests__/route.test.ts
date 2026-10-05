/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

/**
 * POST /api/public/leads with the real SubmitLead: the visitor is answered 201
 * once the lead is stored, whatever happens to the email to
 * hello@metricgymos.com, and the email's outcome is written to the row.
 */
const updates: Record<string, unknown>[] = []
const sendMail = jest.fn()

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => ({
            data: {
              id: 'lead-1',
              ...row,
              created_at: '2026-10-05T06:34:14.534Z',
            },
            error: null,
          }),
        }),
      }),
      update: (values: Record<string, unknown>) => {
        updates.push(values)
        return {
          eq: () => ({
            select: async () => ({ data: [{ id: 'lead-1' }], error: null }),
          }),
        }
      },
    }),
  }),
}))

jest.mock('@/lib/email/smtp', () => ({
  createSmtpMailer: () => ({ send: sendMail }),
}))

import { POST } from '../route'

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/public/leads', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '10.0.0.1',
    },
    body: JSON.stringify(body),
  })
}

const visitor = {
  name: 'Nimal Perera',
  email: 'nimal@example.lk',
  phone: '+94 77 123 4567',
  interest: 'lite',
}

describe('POST /api/public/leads', () => {
  beforeEach(() => {
    updates.length = 0
    sendMail.mockReset()
  })

  it('answers 201 and records the email as sent', async () => {
    sendMail.mockResolvedValue(undefined)
    const res = await POST(request(visitor))
    expect(res.status).toBe(201)
    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(updates).toEqual([
      { notified_at: expect.any(String), notification_error: null },
    ])
  })

  it('still answers 201 when the email fails, and records why', async () => {
    sendMail.mockRejectedValue(new Error('Invalid login: 535 5.7.8'))
    const res = await POST(request({ ...visitor, email: 'other@example.lk' }))
    expect(res.status).toBe(201)
    expect(updates).toEqual([
      { notification_error: expect.stringContaining('535') },
    ])
  })
})
