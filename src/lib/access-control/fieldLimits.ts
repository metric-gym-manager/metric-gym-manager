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
 * What a member is called on the reader when their name does not survive
 * normalisation.
 *
 * Never blank. A reader showing an empty row, and a vendor console listing one,
 * is worse than a placeholder: it cannot be matched back to a person at the
 * desk during the exact conversation the display exists for.
 */
const SUBJECT_NAME_FALLBACK = 'Member'

/**
 * Format a member's name for the terminal.
 *
 * Spaces become underscores and the result is capped at 24 characters. Where
 * truncation is needed we cut at the last underscore that fits, so a name lands
 * as `Kasun_Perera` rather than `Kasun_Perer` — a clipped whole name reads far
 * better on a small reader display than a clipped word.
 *
 * **A name can normalise to nothing.** The vendor's behaviour with non-ASCII is
 * undocumented, so anything outside a conservative set is stripped — and this
 * product serves Sri Lanka, where a member's name may be written entirely in
 * Sinhala or Tamil. Stripping then leaves an empty string, which is not a
 * shorter name but no name at all. Those fall back to the subject id, which is
 * the one identifier the desk can also see.
 *
 * @param name - The member's name as entered in our system.
 * @param subjectId - The id this subject is known by, used only for the
 *   fallback. Optional so the formatter stays usable without one.
 * @returns A non-empty name safe to send as `EmpName`.
 *
 * @example
 * formatSubjectName('Kasun Perera')                   // => 'Kasun_Perera'
 * formatSubjectName('Wickramasinghe Rajapaksa Silva') // => 'Wickramasinghe'
 * formatSubjectName('කසුන්', '100001')                // => 'Member_100001'
 */
export function formatSubjectName(name: string, subjectId?: string): string {
  const normalised = name
    .trim()
    // Any run of whitespace collapses to a single underscore.
    .replace(/\s+/g, '_')
    // Strip anything outside a conservative safe set. Vendor behaviour with
    // non-ASCII is undocumented, and a mangled name is not worth the risk.
    .replace(/[^A-Za-z0-9_.-]/g, '')
    // Stripping can leave separators stranded at either end — "Kasun කසුන්"
    // becomes "Kasun_". Trailing punctuation reads as truncation to anyone
    // looking at the reader.
    .replace(/^[_.-]+|[_.-]+$/g, '')

  if (normalised.length === 0) {
    const fallback = subjectId
      ? `${SUBJECT_NAME_FALLBACK}_${subjectId}`
      : SUBJECT_NAME_FALLBACK

    return fallback.slice(0, EMP_NAME_MAX_LENGTH)
  }

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
