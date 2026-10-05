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
  /**
   * The Lite tier. Stored as `starter` until 2026-10-05 (the tier's name before
   * the July 2026 rename); migration 20261005000001 renamed those rows.
   */
  Lite = 'lite',
  /** The Pro tier. Stored as `growth` until 2026-10-05. */
  Pro = 'pro',
  /** Enterprise tier enquiry. */
  Enterprise = 'enterprise',
}

/** Human-readable labels for admin/notification surfaces. */
export const LEAD_INTEREST_LABELS: Record<LeadInterest, string> = {
  [LeadInterest.Demo]: 'Demo request',
  [LeadInterest.Sales]: 'Sales enquiry',
  [LeadInterest.Lite]: 'Lite plan',
  [LeadInterest.Pro]: 'Pro plan',
  [LeadInterest.Enterprise]: 'Enterprise plan',
}

/**
 * Where each demo request is emailed (owner decision, 2026-10-05): an alias of
 * admin@capitalistone.co. Sent from the no-reply alias the auth emails use.
 */
export const LEAD_NOTIFY_TO = 'hello@metricgymos.com'
export const LEAD_NOTIFY_FROM = 'Metric Gym OS <noreply@metricgymos.com>'

export function getLeadInterestLabel(interest: LeadInterest): string {
  return LEAD_INTEREST_LABELS[interest]
}
