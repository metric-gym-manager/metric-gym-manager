export const NEW_MEMBER_DAYS = 7

/**
 * Returns true if the member's record was created within the last NEW_MEMBER_DAYS days.
 * Pass `created_at` (the actual DB row creation timestamp), not `registered_date`
 * (which stores the membership start date and can be backdated).
 */
export function isNewMember(dateStr: string): boolean {
  const registered = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - registered.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= NEW_MEMBER_DAYS
}
