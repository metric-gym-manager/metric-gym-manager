import type { LeadInterest } from '../config/LeadConfig'

/**
 * A captured marketing lead (a row in `public.leads`). Anonymous — there is no
 * gym_id/user_id; leads exist before any account.
 */
export interface Lead {
  id: string
  name: string
  email: string
  phone: string
  gymName: string | null
  message: string | null
  interest: LeadInterest
  /** Where the lead came from, e.g. 'landing'. */
  source: string
  createdAt: string
}

/** What happened to a lead's email: sent at a time, or not sent and why. */
export type LeadNotificationOutcome = { notifiedAt: Date } | { error: string }

/** Fields required to record a new lead (post-validation, post-honeypot). */
export interface NewLead {
  name: string
  email: string
  phone: string
  gymName: string | null
  message: string | null
  interest: LeadInterest
  source: string
}
