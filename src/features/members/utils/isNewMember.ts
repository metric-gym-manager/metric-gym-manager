export const NEW_MEMBER_DAYS = 7

/**
 * Returns true if the member registered within the last NEW_MEMBER_DAYS days.
 * Used to show a transient "NEW" badge in the members table and dashboard.
 */
export function isNewMember(registeredDate: string): boolean {
  const registered = new Date(registeredDate)
  const now = new Date()
  const diffMs = now.getTime() - registered.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= NEW_MEMBER_DAYS
}
