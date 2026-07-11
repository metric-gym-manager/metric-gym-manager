import type { Metadata } from 'next'
import Script from 'next/script'
import { Inter } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { Toaster } from 'sonner'
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration'
import { AuthRecovery } from '@/components/auth/AuthRecovery'
import { PWA_VERSION } from '@/lib/pwa-version'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Metric Gym Manager',
  description: 'Modern gym and fitness center management platform for streamlined operations, member management, and business growth',
  metadataBase: new URL('https://metricgymmanager.com'),
  manifest: '/manifest.json',
  icons: [
    { rel: 'icon', url: '/favicon.svg' },
    { rel: 'apple-touch-icon', url: `/icon-192.png?v=${PWA_VERSION}` },
  ],
  other: {
    'theme-color': '#000000',
  },
  openGraph: {
    title: 'Metric Gym Manager',
    description: 'Modern gym and fitness center management platform for streamlined operations, member management, and business growth',
    url: 'https://metricgymmanager.com',
    siteName: 'Metric Gym Manager',
    images: [
      {
        url: '/linkPreviewLogo.png',
        width: 1200,
        height: 630,
        alt: 'Metric Gym Manager',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Metric Gym Manager',
    description: 'Modern gym and fitness center management platform for streamlined operations, member management, and business growth',
    images: ['/linkPreviewLogo.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <QueryProvider>
          {children}
          <Toaster position="top-right" richColors />
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
