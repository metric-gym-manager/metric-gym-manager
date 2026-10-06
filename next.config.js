const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

// Cloudflare R2 public bucket host (member photos). Derived from
// NEXT_PUBLIC_R2_PUBLIC_URL so staging/production can point at different
// buckets without touching this file.
const r2PublicHostname = (() => {
  try {
    return process.env.NEXT_PUBLIC_R2_PUBLIC_URL
      ? new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL).hostname
      : null
  } catch {
    return null
  }
})()

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      ...(r2PublicHostname
        ? [
            {
              protocol: 'https',
              hostname: r2PublicHostname,
              port: '',
              pathname: '/**',
            },
          ]
        : []),
    ],
  },
  // The QR-poster routes read the bundled Geist fonts and the Metric logo from
  // disk at runtime (next/og). Force those assets into the serverless bundle.
  outputFileTracingIncludes: {
    '/api/settings/qr-poster': [
      './src/features/registration/assets/fonts/**',
      './public/logo.svg',
    ],
    '/api/admin/qr-poster': [
      './src/features/registration/assets/fonts/**',
      './public/logo.svg',
    ],
    // Release emails are compiled from the changelog the route reads at
    // runtime; without this the deployed function has no CHANGELOG.md.
    '/api/cron/send-announcements': ['./CHANGELOG.md'],
  },
  experimental: {
    optimizePackageImports: [
      '@supabase/supabase-js',
      'lucide-react',
      'recharts',
      '@radix-ui/react-dialog',
      '@radix-ui/react-slot',
    ],
  },
  async redirects() {
    return [
      {
        // Feature pages live at /features/<name>, which invites visitors to
        // trim the URL. There is no index page: the commercial hub is the
        // parent of every feature page, so send them there instead of letting
        // the auth middleware answer 307 → /login (a soft 404 for crawlers).
        source: '/features',
        destination: '/gym-management-software-sri-lanka',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        // The production deployment also answers on gym-management-saas.vercel.app
        // (and every deployment on its own *.vercel.app URL) with the full site
        // and no robots header — an indexable duplicate of www.metricgymos.com.
        // It cannot simply redirect: vendor webhooks may be registered against
        // it. A response header changes nothing for a webhook and keeps the
        // duplicate out of the index; canonicals point at www regardless.
        source: '/:path*',
        has: [{ type: 'host', value: '(?<vercelHost>.+)\\.vercel\\.app' }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
      },
      {
        // HTML entry points (all app pages): never reuse a cached copy
        // without revalidating with the server. This prevents "zombie"
        // deployments where a browser/CDN serves stale HTML that references
        // JS chunks deleted by a newer deploy. Excludes /_next/* assets,
        // API routes and static files (dotted paths), which keep their own
        // caching rules below.
        source: '/((?!_next/|api/|.*\\..*).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        // Service worker: never cache — browsers must always check for updates
        source: '/service-worker.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, no-cache, must-revalidate',
          },
        ],
      },
      {
        // PWA manifest: never cache — must always reflect latest start_url and icons
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, no-cache, must-revalidate',
          },
        ],
      },
      {
        // Hashed static assets: aggressive long-term cache (immutable)
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Public images and icons: cache 1 day, revalidate in background for 7 days
        source: '/:path(.+\\.(?:svg|png|jpg|jpeg|gif|ico|webp))',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        // All pages: security headers
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

module.exports = withBundleAnalyzer(nextConfig)
