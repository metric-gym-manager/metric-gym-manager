import { useEffect, useState } from 'react'

/**
 * Returns a debounced copy of `value` that only updates after `delayMs` has
 * elapsed without a change. Useful for throttling server search as the user
 * types (e.g. the command palette's live member search).
 *
 * @param value - The value to debounce.
 * @param delayMs - Debounce delay in milliseconds (default 250ms).
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
