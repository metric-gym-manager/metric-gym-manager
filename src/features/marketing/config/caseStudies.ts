/**
 * Facts published about a named customer.
 *
 * Every figure here was read from Metric's own records with the customer's
 * permission and approved by Metric's owner before publication (SEO-042,
 * approved 2026-10-15; the figures are as of 2026-10-05). They are snapshots,
 * not live counts: a page that recomputed them would publish figures nobody
 * approved. `MarketingPages.test.tsx` pins each value to the approval.
 *
 * The homepage testimonial reads its quote from here too, so the two pages
 * can never quote the owner differently.
 */
export const FITNESS_EMPIRE = {
  name: 'Fitness Empire',
  owner: 'Zulfi Ahamath',
  street: 'Negombo Road',
  locality: 'Wattala',
  /** The day the figures were read (YYYY-MM-DD). */
  asOf: '2026-10-05',
  onMetricSince: '2026-02-28',
  members: {
    registered: 231,
    active: 134,
    /** Members on any plan other than monthly. */
    notMonthly: 2,
  },
  /** Payments recorded at the desk. March to July is an approximate monthly figure. */
  paymentsRecorded: { marchToJulyMonthly: 90, august: 148, september: 166 },
  /** Automated texts sent from the gym's account since it joined. */
  texts: {
    welcome: 127,
    receipt: 453,
    threeDayReminder: 301,
    dueTodayReminder: 221,
    overdueNotice: 122,
    reactivation: 42,
  },
  /**
   * April to September 2026: the date each renewal was recorded against the
   * due date it settled, after removing same-day duplicate payments.
   */
  renewals: {
    count: 531,
    onOrBeforeDuePercent: 48.2,
    withinAWeekPercent: 81.5,
    duplicatesRemoved: 30,
  },
  /** Confirmed by the owner 2026-10-04 (SEO-024). */
  quote:
    'We cut our admin time by 80% in the first month. The automated reminders alone paid for the subscription.',
} as const
