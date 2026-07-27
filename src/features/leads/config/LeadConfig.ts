/**
 * Lead configuration — the single owner (R5) of the marketing-lead interest
 * enum. Captured from the public landing page CTAs (demo request, sales
 * enquiry, per-tier "get started"). Validated with `z.nativeEnum(LeadInterest)`
 * (R13); never duplicate this list as a `z.enum([...])` elsewhere.
 */

/** What the visitor asked for when they submitted the lead form. */
export enum LeadInterest {
  /** "Request a demo" — wants a guided walkthrough. */
  Demo = 'demo',
  /** "Talk to sales" / "Contact sales" — Enterprise / hardware enquiry. */
  Sales = 'sales',
  /** "Get started" on the Lite / Starter tier. */
  Starter = 'starter',
  /** "Get started" on the Pro / Growth tier. */
  Growth = 'growth',
  /** Enterprise tier enquiry. */
  Enterprise = 'enterprise',
}

/** Human-readable labels for admin/notification surfaces. */
export const LEAD_INTEREST_LABELS: Record<LeadInterest, string> = {
  [LeadInterest.Demo]: 'Demo request',
  [LeadInterest.Sales]: 'Sales enquiry',
  [LeadInterest.Starter]: 'Starter plan',
  [LeadInterest.Growth]: 'Growth plan',
  [LeadInterest.Enterprise]: 'Enterprise plan',
}

export function getLeadInterestLabel(interest: LeadInterest): string {
  return LEAD_INTEREST_LABELS[interest]
}
