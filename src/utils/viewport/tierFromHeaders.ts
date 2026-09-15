import type { ViewportTier } from '@/hooks/useViewportTier'

/**
 * Guess the viewport tier from the request, for the server's first render
 * (mobile rebuild plan §4, risk r02).
 *
 * A phone's first HTML should already be the phone composition. The client
 * measures the real width on its first commit and corrects anything this got
 * wrong, so being wrong here costs a re-render, never a wrong screen — which
 * is why a *hint* is the right shape and a cookie or a redirect is not.
 *
 * **`sec-ch-ua-mobile` first.** It is a one-character answer to exactly this
 * question (`?1` / `?0`) and Chromium sends it on every navigation without
 * any `Accept-CH` opt-in. Safari and Firefox send nothing, so the UA string is
 * the fallback.
 *
 * **An iPad answers `desktop`, deliberately** (ruling M5): iPadOS Safari
 * reports a desktop UA and no client hints, and the plan's tablet decision
 * (d02) gives 768–1023 the desktop composition anyway. A tablet that briefly
 * rendered the phone chrome and flipped would be a worse first paint than one
 * that starts where it ends.
 *
 * Pure and header-shaped rather than `headers()`-shaped so it can be tested
 * without a request: the interesting cases are all strings.
 *
 * @param clientHint `sec-ch-ua-mobile`, or null where it is not sent.
 * @param userAgent  `user-agent`, or null.
 */
export function tierFromHeaders(
  clientHint: string | null | undefined,
  userAgent: string | null | undefined
): ViewportTier {
  // `?1` means "this is a mobile device"; `?0` means it is not, and is just as
  // definite — do not fall through to the UA sniff when the browser has
  // already answered.
  if (clientHint === '?1') return 'phone'
  if (clientHint === '?0') return 'desktop'

  if (!userAgent) return 'desktop'

  // Tablets before phones: "iPad" and "Android ... Tablet" both contain
  // strings the phone patterns would otherwise match.
  if (/\b(iPad|Tablet)\b/i.test(userAgent)) return 'desktop'
  // Android without "Mobile" is a tablet, by Google's own convention.
  if (/\bAndroid\b/i.test(userAgent) && !/\bMobile\b/i.test(userAgent)) {
    return 'desktop'
  }

  return /\b(Android|iPhone|iPod|IEMobile|Opera Mini|Mobile Safari)\b/i.test(
    userAgent
  )
    ? 'phone'
    : 'desktop'
}
