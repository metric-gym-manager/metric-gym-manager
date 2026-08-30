import type { Metadata } from 'next'
import Script from 'next/script'
import { Inter, Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { Toaster } from '@/components/ui'
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration'
import { AuthRecovery } from '@/features/auth/components/AuthRecovery'
import { PWA_VERSION } from '@/lib/pwa-version'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

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

export const metadata: Metadata = {
  title: 'Metric Gym OS',
  description:
    'Modern gym and fitness center management platform for streamlined operations, member management, and business growth',
  metadataBase: new URL('https://metricgymos.com'),
  manifest: '/manifest.json',
  icons: [
    { rel: 'icon', url: '/favicon.svg' },
    { rel: 'apple-touch-icon', url: `/icon-192.png?v=${PWA_VERSION}` },
  ],
  other: {
    'theme-color': '#000000',
  },
  openGraph: {
    title: 'Metric Gym OS',
    description:
      'Modern gym and fitness center management platform for streamlined operations, member management, and business growth',
    url: 'https://metricgymos.com',
    siteName: 'Metric Gym OS',
    images: [
      {
        url: '/linkPreviewLogo.png',
        width: 1200,
        height: 630,
        alt: 'Metric Gym OS',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Metric Gym OS',
    description:
      'Modern gym and fitness center management platform for streamlined operations, member management, and business growth',
    images: ['/linkPreviewLogo.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <body className="font-sans">
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
