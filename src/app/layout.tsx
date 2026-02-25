import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'Metric Gym Manager',
  description: 'Production-grade gym and fitness center management platform',
  icons: [{ rel: 'icon', url: '/favicon.svg' }],
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
