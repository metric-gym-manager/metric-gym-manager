/**
 * Pure filtering helpers for the command palette.
 *
 * Kept UI-free so the matching behaviour can be unit-tested directly. The
 * palette renders with cmdk's `shouldFilter={false}` and filters its static
 * command groups through {@link matchesQuery}, so async member results (already
 * filtered server-side) and static commands can coexist predictably.
 */

/**
 * Case-insensitive match of a query against a command's visible label and its
 * hidden keywords. An empty/whitespace query matches everything (so the full
 * command list shows when the palette first opens).
 *
 * @param query - The raw search string typed by the user.
 * @param label - The command's visible label.
 * @param keywords - Extra search terms that never render (aliases, synonyms).
 */
export function matchesQuery(
  query: string,
  label: string,
  keywords: string[] = []
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (label.toLowerCase().includes(q)) return true
  return keywords.some((keyword) => keyword.toLowerCase().includes(q))
}
