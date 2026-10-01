const DISPLAY_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Colombo',
})

/**
 * "1 October 2026" for a registry date (YYYY-MM-DD), read as a Sri Lankan
 * calendar date so the server's time zone can never shift it by a day.
 */
export function formatDisplayDate(isoDate: string): string {
  return DISPLAY_DATE.format(new Date(`${isoDate}T00:00:00+05:30`))
}
