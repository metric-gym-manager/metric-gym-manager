/**
 * Formats a per-gym member number as a human-friendly member ID.
 *
 * Numbers are zero-padded to a minimum of 4 digits and prefixed with `#`,
 * so member 1 renders as `#0001`. Numbers beyond 9999 are shown in full
 * (e.g. `#12345`). Returns an em dash for a missing number (a not-yet-persisted
 * entity), so the UI never prints `#NaN`.
 *
 * @param memberNumber - 1-based per-gym member number (null when unassigned)
 * @returns Display string such as `#0001`
 *
 * @example
 * formatMemberNumber(1);    // '#0001'
 * formatMemberNumber(42);   // '#0042'
 * formatMemberNumber(null); // '—'
 */
export function formatMemberNumber(
  memberNumber: number | null | undefined
): string {
  if (
    memberNumber === null ||
    memberNumber === undefined ||
    !Number.isFinite(memberNumber)
  ) {
    return '—'
  }
  return `#${String(memberNumber).padStart(4, '0')}`
}
