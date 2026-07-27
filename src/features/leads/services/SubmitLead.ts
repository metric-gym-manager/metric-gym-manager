import type { LeadInterest } from '../config/LeadConfig'
import type { Lead } from '../types'
import type { ILeadRepository } from './ILeadRepository'

/** Validated lead input (honeypot already stripped by the schema/route). */
export interface SubmitLeadInput {
  name: string
  email: string
  phone: string
  gymName?: string
  message?: string
  interest: LeadInterest
  /** Origin of the lead; defaults to 'landing'. */
  source?: string
}

/**
 * Submit a marketing lead.
 *
 * Normalizes optional fields (blank → null), stamps the source, and persists.
 * Kept as a use-case (not an inline route insert) so the route stays thin
 * (R6) and this logic is unit-testable in isolation.
 */
export class SubmitLead {
  constructor(private readonly leads: ILeadRepository) {}

  async execute(input: SubmitLeadInput): Promise<Lead> {
    const trimmedGym = input.gymName?.trim()
    const trimmedMessage = input.message?.trim()

    return this.leads.create({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      gymName: trimmedGym ? trimmedGym : null,
      message: trimmedMessage ? trimmedMessage : null,
      interest: input.interest,
      source: input.source?.trim() || 'landing',
    })
  }
}
