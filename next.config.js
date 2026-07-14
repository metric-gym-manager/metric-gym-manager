const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// Cloudflare R2 public bucket host (member photos). Derived from
// NEXT_PUBLIC_R2_PUBLIC_URL so staging/production can point at different
// buckets without touching this file.
const r2PublicHostname = (() => {
  try {
    return process.env.NEXT_PUBLIC_R2_PUBLIC_URL
      ? new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL).hostname
      : null;
  } catch {
    return null;
  }
})();

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
  experimental: {
    optimizePackageImports: [
      '@supabase/supabase-js',
      'lucide-react',
      'date-fns',
      'recharts',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-label',
      '@radix-ui/react-slot',
      'react-day-picker',
    ],
  },
  async headers() {
    return [
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
    ];
  },
}

module.exports = withBundleAnalyzer(nextConfig)
