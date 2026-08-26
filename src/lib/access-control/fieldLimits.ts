/**
 * Vendor field constraints.
 *
 * VFT confirmed these directly:
 *
 * - `EmpId` — numeric recommended, **15 characters** maximum.
 * - `EmpName` — **24 characters** maximum, and **spaces must be underscores**.
 *
 * Both are enforced here rather than at the call sites, so a name can never
 * reach the wire in a shape the terminal will mangle. Truncating a member's
 * name is cosmetic; getting the identifier wrong is not, which is why the two
 * are handled very differently below.
 */

/**
 * Maximum characters VFT accepts in `EmpId`.
 *
 * Note this is the **platform** limit. Individual reader firmware may be
 * stricter, which is why our allocator stays far inside it — see
 * `MAX_SUBJECT_ID` in the feature config.
 */
export const EMP_ID_MAX_LENGTH = 15

/** Maximum characters VFT accepts in `EmpName`. */
export const EMP_NAME_MAX_LENGTH = 24

/**
 * Format a member's name for the terminal.
 *
 * Spaces become underscores and the result is capped at 24 characters. Where
 * truncation is needed we cut at the last underscore that fits, so a name lands
 * as `Kasun_Perera` rather than `Kasun_Perer` — a clipped whole name reads far
 * better on a small reader display than a clipped word.
 *
 * @param name - The member's name as entered in our system.
 * @returns A name safe to send as `EmpName`.
 *
 * @example
 * formatSubjectName('Kasun Perera')                 // => 'Kasun_Perera'
 * formatSubjectName('Wickramasinghe Rajapaksa Silva') // => 'Wickramasinghe'
 */
export function formatSubjectName(name: string): string {
  const normalised = name
    .trim()
    // Any run of whitespace collapses to a single underscore.
    .replace(/\s+/g, '_')
    // Strip anything outside a conservative safe set. Vendor behaviour with
    // non-ASCII is undocumented, and a mangled name is not worth the risk.
    .replace(/[^A-Za-z0-9_.-]/g, '')

  if (normalised.length <= EMP_NAME_MAX_LENGTH) {
    return normalised
  }

  const clipped = normalised.slice(0, EMP_NAME_MAX_LENGTH)
  const lastSeparator = clipped.lastIndexOf('_')

  // Only prefer the word boundary if it keeps a useful amount of the name.
  if (lastSeparator >= EMP_NAME_MAX_LENGTH / 2) {
    return clipped.slice(0, lastSeparator)
  }

  return clipped
}

/**
 * Check that an identifier is safe to send as `EmpId`.
 *
 * Deliberately strict and non-coercing: a subject id is an identity, so a value
 * that does not fit must be rejected loudly rather than trimmed. A silently
 * shortened id could collide with another member's and open a door for the
 * wrong person.
 *
 * @param subjectId - The identifier we intend to send.
 * @returns True if it is numeric and within the length limit.
 */
export function isValidSubjectId(subjectId: string): boolean {
  return (
    subjectId.length > 0 &&
    subjectId.length <= EMP_ID_MAX_LENGTH &&
    /^[0-9]+$/.test(subjectId)
  )
}

/**
 * Assert an identifier is safe to send, or throw.
 *
 * @param subjectId - The identifier we intend to send.
 * @throws {Error} If it is non-numeric or too long.
 */
export function assertValidSubjectId(subjectId: string): void {
  if (!isValidSubjectId(subjectId)) {
    throw new Error(
      `Subject id "${subjectId}" is not a valid EmpId: must be numeric and at most ${EMP_ID_MAX_LENGTH} characters`
    )
  }
}
