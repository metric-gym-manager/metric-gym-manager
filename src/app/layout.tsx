import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { Toaster } from '@/components/ui'
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration'
import { AuthRecovery } from '@/features/auth/components/AuthRecovery'
import { gaInitScript } from '@/lib/analytics/ga-init'
import { PWA_VERSION } from '@/lib/pwa-version'
import { OG_IMAGE, SITE_NAME, SITE_URL } from '@/features/marketing'

// Geist / Geist Mono power the enterprise surfaces — the light "App Workspace"
// (`.mws-root`), the dark auth pages (`.mauth-root`) and the marketing landing
// page. Exposed as CSS variables only; the light/dark scoping lives in
// globals.css so each surface opts in.
const geist = Geist({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-geist',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-geist-mono',
  display: 'swap',
})

/**
 * Viewport and theme colour (mobile rebuild plan §16).
 *
 * `viewport-fit=cover` lets the document paint under a notch and the home
 * indicator; the safe-area insets (`--ds-safe-*`) are what keeps content
 * clear of them, and they stay 0 until this is set — so the tokens and this
 * export are one change, not two.
 *
 * `themeColor` lives HERE and not in `metadata.other`. It used to be
 * `metadata.other['theme-color'] = '#000000'`, the pre-`viewport`-API way;
 * adding this export beside it would have shipped TWO `theme-color` meta tags
 * with different values, which `tests/e2e/spikes/viewport-export.spec.ts` pins
 * against. The value is `surface-base`, matching the manifest.
 *
 * No `user-scalable=no` and no `maximumScale`: pinch-zoom is an accessibility
 * affordance, and 16 px inputs (`text-input`) are how the focus-zoom problem
 * is solved instead.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#08080a',
}

/**
 * Site-wide metadata defaults.
 *
 * - `metadataBase` is the canonical `www` origin. The apex and the retired
 *   metricgymmanager.com domains 308-redirect to it, so absolute URLs built on
 *   the apex (as they were) all pointed at a redirect.
 * - No `alternates.canonical` and no `openGraph.url` here, deliberately: both
 *   are inherited by every page beneath this layout, so a value here would
 *   declare every route a copy of the homepage. Public pages set their own via
 *   `buildPageMetadata()` (features/marketing).
 * - `title.template` names the product on in-app pages that set only a short
 *   title (e.g. "Join Gym"); public pages use absolute titles.
 */
export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'Gym management software for Sri Lankan gyms: members, renewals, SMS reminders, revenue reporting and fingerprint door access.',
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  manifest: '/manifest.json',
  icons: [
    { rel: 'icon', url: '/favicon.svg' },
    { rel: 'apple-touch-icon', url: `/icon-192.png?v=${PWA_VERSION}` },
  ],
  openGraph: {
    siteName: SITE_NAME,
    title: SITE_NAME,
    description:
      'Gym management software for Sri Lankan gyms: members, renewals, SMS reminders, revenue reporting and fingerprint door access.',
    images: [
      {
        url: OG_IMAGE.path,
        width: OG_IMAGE.width,
        height: OG_IMAGE.height,
        alt: OG_IMAGE.alt,
      },
    ],
    locale: 'en_LK',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description:
      'Gym management software for Sri Lankan gyms: members, renewals, SMS reminders, revenue reporting and fingerprint door access.',
    images: [OG_IMAGE.path],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="font-sans">
        {/* GA4, never on a URL that carries a credential (SEO-059). */}
        <Script id="google-analytics" strategy="afterInteractive">
          {gaInitScript()}
        </Script>
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
        <ServiceWorkerRegistration />
        <AuthRecovery />
        {process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true' && (
          <Script
            src="https://t.contentsquare.net/uxa/2337d6ffa89d1.js"
            strategy="lazyOnload"
          />
        )}
      </body>
    </html>
  )
}
