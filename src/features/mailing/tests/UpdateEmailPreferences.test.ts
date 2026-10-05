/**
 * @jest-environment node
 */
import { MailingTopic } from '../config/MailingConfig'
import {
  InvalidUnsubscribeLinkError,
  MailingUnavailableError,
} from '../services/errors'
import type { IMailingList } from '../services/IMailingList'
import { UpdateEmailPreferences } from '../services/UpdateEmailPreferences'
import { createUnsubscribeToken } from '../utils/unsubscribeToken'

const SECRET = 's'.repeat(64)
const EMAIL = 'owner@titanfitness.lk'

function fakeList(): IMailingList & { optOuts: [string, MailingTopic[]][] } {
  const optOuts: [string, MailingTopic[]][] = []
  return {
    optOuts,
    addContact: async () => 'created',
    optOut: async (email, topics) => {
      optOuts.push([email, topics])
    },
  }
}

describe('UpdateEmailPreferences', () => {
  it('opts the contact out of exactly the chosen topics', async () => {
    const list = fakeList()
    await new UpdateEmailPreferences(list, SECRET).execute({
      email: EMAIL,
      token: createUnsubscribeToken(EMAIL, SECRET),
      topics: [MailingTopic.Updates],
    })
    expect(list.optOuts).toEqual([[EMAIL, [MailingTopic.Updates]]])
  })

  it('opts out of both when both are chosen', async () => {
    const list = fakeList()
    await new UpdateEmailPreferences(list, SECRET).execute({
      email: EMAIL,
      token: createUnsubscribeToken(EMAIL, SECRET),
      topics: [MailingTopic.Marketing, MailingTopic.Updates],
    })
    expect(list.optOuts[0][1]).toEqual([
      MailingTopic.Marketing,
      MailingTopic.Updates,
    ])
  })

  it('checks the token ignoring case, but writes the address as delivered', async () => {
    // F2 (inverted check, 2026-10-06): Resend matches contact emails
    // case-sensitively. The link carries the stored address, so lowercasing
    // it before the write missed a contact stored with capitals, and the
    // page said "Done" while nothing changed. This test used to assert the
    // lowercased write — it pinned the bug.
    const list = fakeList()
    await new UpdateEmailPreferences(list, SECRET).execute({
      email: ' Owner+Gym@TitanFitness.LK',
      token: createUnsubscribeToken('owner+gym@titanfitness.lk', SECRET),
      topics: [MailingTopic.Marketing],
    })
    expect(list.optOuts[0][0]).toBe('Owner+Gym@TitanFitness.LK')
  })

  it('accepts a link whose + arrived as a space', async () => {
    const list = fakeList()
    await new UpdateEmailPreferences(list, SECRET).execute({
      email: 'owner gym@titanfitness.lk',
      token: createUnsubscribeToken('owner+gym@titanfitness.lk', SECRET),
      topics: [MailingTopic.Marketing],
    })
    expect(list.optOuts[0][0]).toBe('owner+gym@titanfitness.lk')
  })

  it('rejects a token made for another address and changes nothing', async () => {
    const list = fakeList()
    await expect(
      new UpdateEmailPreferences(list, SECRET).execute({
        email: EMAIL,
        token: createUnsubscribeToken('someone@else.lk', SECRET),
        topics: [MailingTopic.Marketing],
      })
    ).rejects.toBeInstanceOf(InvalidUnsubscribeLinkError)
    expect(list.optOuts).toHaveLength(0)
  })

  it('reports unavailable when no provider or secret is configured', async () => {
    const token = createUnsubscribeToken(EMAIL, SECRET)
    const input = { email: EMAIL, token, topics: [MailingTopic.Marketing] }
    await expect(
      new UpdateEmailPreferences(null, SECRET).execute(input)
    ).rejects.toBeInstanceOf(MailingUnavailableError)
    await expect(
      new UpdateEmailPreferences(fakeList(), null).execute(input)
    ).rejects.toBeInstanceOf(MailingUnavailableError)
  })
})
