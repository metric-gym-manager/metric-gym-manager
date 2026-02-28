import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'Metric Gym Manager',
  description: 'Modern gym and fitness center management platform for streamlined operations, member management, and business growth',
  metadataBase: new URL('https://metricgymmanager.com'),
  icons: [{ rel: 'icon', url: '/favicon.svg' }],
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
    <html lang="en">
      <body>
        <QueryProvider>
          {children}
          <Toaster position="top-right" richColors />
        </QueryProvider>
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
