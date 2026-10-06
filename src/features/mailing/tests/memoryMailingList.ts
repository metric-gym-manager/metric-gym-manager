import { MailingAudience, MailingTopic } from '../config/MailingConfig'
import type {
  AddContactResult,
  IMailingList,
  NewMailingContact,
} from '../services/IMailingList'

interface StoredContact {
  gymId?: string
  token: string
  optOut: Set<MailingTopic>
}

/**
 * An in-memory mailing list with the provider's observable behaviour: contacts
 * keyed by their exact email (Resend matches case-sensitively), membership per
 * audience, topic opt-outs, and the same "already gone is done" semantics.
 * Shared by the mailing tests so every suite fakes the port the same way.
 */
export class MemoryMailingList implements IMailingList {
  readonly contacts = new Map<string, StoredContact>()
  readonly members: Record<MailingAudience, Set<string>> = {
    [MailingAudience.Marketing]: new Set(),
    [MailingAudience.ProductUpdates]: new Set(),
  }
  readonly added: NewMailingContact[] = []
  readonly writes: string[] = []
  /** Addresses whose writes throw, to test that one failure does not stop a run. */
  readonly failFor = new Set<string>()

  seed(
    email: string,
    options: {
      gymId?: string
      audiences?: MailingAudience[]
      optOut?: MailingTopic[]
    } = {}
  ): this {
    this.contacts.set(email, {
      gymId: options.gymId,
      token: 'seeded',
      optOut: new Set(options.optOut),
    })
    for (const audience of options.audiences ?? []) {
      this.members[audience].add(email)
    }
    return this
  }

  private guard(email: string) {
    if (this.failFor.has(email)) throw new Error('rate limited')
  }

  async addContact(contact: NewMailingContact): Promise<AddContactResult> {
    this.guard(contact.email)
    this.added.push(contact)
    this.writes.push(`add:${contact.email}:${contact.audience}`)
    let result: AddContactResult = 'unchanged'
    if (!this.contacts.has(contact.email)) {
      this.contacts.set(contact.email, {
        gymId: contact.gymId,
        token: contact.unsubscribeToken,
        optOut: new Set(),
      })
      result = 'created'
    } else if (!this.members[contact.audience].has(contact.email)) {
      result = 'added_to_audience'
    }
    this.members[contact.audience].add(contact.email)
    return result
  }

  async optOut(email: string, topics: MailingTopic[]): Promise<void> {
    this.guard(email)
    this.writes.push(`opt-out:${email}:${topics.join(',')}`)
    const contact = this.contacts.get(email)
    for (const topic of topics) contact?.optOut.add(topic)
  }

  async listAudience(audience: MailingAudience): Promise<string[]> {
    return [...this.members[audience]]
  }

  async removeFromAudience(
    email: string,
    audience: MailingAudience
  ): Promise<void> {
    this.guard(email)
    this.writes.push(`leave:${email}:${audience}`)
    this.members[audience].delete(email)
  }

  async getGymId(email: string): Promise<string | null> {
    return this.contacts.get(email)?.gymId ?? null
  }

  async optedOutTopics(email: string): Promise<MailingTopic[]> {
    return [...(this.contacts.get(email)?.optOut ?? [])]
  }

  async deleteContact(email: string): Promise<void> {
    this.guard(email)
    this.writes.push(`delete:${email}`)
    this.contacts.delete(email)
    for (const audience of Object.values(MailingAudience)) {
      this.members[audience].delete(email)
    }
  }

  /** Which audiences an address is in, for assertions. */
  audiencesOf(email: string): MailingAudience[] {
    return Object.values(MailingAudience).filter((a) =>
      this.members[a].has(email)
    )
  }
}
