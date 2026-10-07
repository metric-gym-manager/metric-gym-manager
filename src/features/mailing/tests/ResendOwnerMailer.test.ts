/**
 * @jest-environment node
 */
import { MAILING_FROM } from '../config/MailingConfig'
import { OUTREACH_OWNER_EMAIL } from '../config/outreachCampaign'
import {
  ResendOwnerMailer,
  type OwnerMailResendApi,
} from '../services/ResendOwnerMailer'

type SendPayload = Parameters<OwnerMailResendApi['emails']['send']>[0]
type SendOptions = Parameters<OwnerMailResendApi['emails']['send']>[1]

function fake(
  received: Partial<{
    from: string
    to: string[]
    subject: string
    text: string | null
    html: string | null
  }> = {}
) {
  const sent: { payload: SendPayload; options: SendOptions }[] = []
  const api: OwnerMailResendApi = {
    emails: {
      send: async (payload, options) => {
        sent.push({ payload, options })
        return { data: { id: `em_${sent.length}` }, error: null }
      },
      receiving: {
        get: async (id) =>
          id === 'missing'
            ? { data: null, error: { name: 'not_found', message: 'Not found' } }
            : {
                data: {
                  from: 'Ruwan Perera <Ruwan@IronGym.lk>',
                  to: ['hello@go.metricgymos.com'],
                  subject: 'Re: Tired of chasing payments?',
                  text: 'How much is it for 300 members?',
                  html: null,
                  created_at: '2026-10-14T03:12:00Z',
                  ...received,
                },
                error: null,
              },
      },
    },
  }
  return { api, sent }
}

describe('ResendOwnerMailer', () => {
  it('sends the owner’s email from the updates domain to the owner, once per key', async () => {
    const { api, sent } = fake()
    const id = await new ResendOwnerMailer(api).send({
      subject: 'Outreach paused: 2 spam complaints',
      html: '<p>Paused</p>',
      text: 'Paused',
      idempotencyKey: 'outreach-paused:intro:2026-10-20T04:30:00.000Z',
    })
    expect(id).toBe('em_1')
    expect(sent[0].payload).toMatchObject({
      from: MAILING_FROM,
      to: OUTREACH_OWNER_EMAIL,
      subject: 'Outreach paused: 2 spam complaints',
      text: 'Paused',
      tags: [{ name: 'kind', value: 'outreach-report' }],
    })
    expect(sent[0].options?.idempotencyKey).toBe(
      'outreach-paused:intro:2026-10-20T04:30:00.000Z'
    )
  })

  it('forwards mail written to the outreach address, so the owner can reply to its writer', async () => {
    const { api, sent } = fake()
    await new ResendOwnerMailer(api).forward('rcv_1')
    const { payload, options } = sent[0]
    expect(payload).toMatchObject({
      from: MAILING_FROM,
      to: OUTREACH_OWNER_EMAIL,
      replyTo: 'ruwan@irongym.lk',
      subject: 'Fwd: Re: Tired of chasing payments?',
      tags: [{ name: 'kind', value: 'outreach-forward' }],
    })
    expect(payload.text).toContain('From: Ruwan Perera <Ruwan@IronGym.lk>')
    expect(payload.text).toContain('How much is it for 300 members?')
    // A redelivered webhook forwards nothing twice.
    expect(options?.idempotencyKey).toBe('outreach-forward:rcv_1')
  })

  it('never passes the writer’s HTML on, only its text', async () => {
    const { api, sent } = fake({
      text: null,
      html: '<p>Call me <b>today</b></p><script>steal()</script>',
    })
    await new ResendOwnerMailer(api).forward('rcv_2')
    expect(sent[0].payload.html).toBeUndefined()
    expect(sent[0].payload.text).toContain('Call me today')
    expect(sent[0].payload.text).not.toMatch(/<\/?(p|b|script)>/)
    expect(sent[0].payload.text).not.toContain('steal()')
  })

  it('does not add a second "Fwd:"', async () => {
    const { api, sent } = fake({ subject: 'Fwd: price list' })
    await new ResendOwnerMailer(api).forward('rcv_3')
    expect(sent[0].payload.subject).toBe('Fwd: price list')
  })

  it('throws when the received email cannot be read, so the webhook is retried', async () => {
    const { api } = fake()
    await expect(new ResendOwnerMailer(api).forward('missing')).rejects.toThrow(
      'Not found'
    )
  })
})
