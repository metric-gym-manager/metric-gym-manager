Context
The app's Lighthouse performance score is 60-70 due to: a render-blocking third-party script, zero code splitting across ~3,000 lines of modal/chart components, an overbroad middleware running supabase.auth.getUser() on every request, duplicate auth checks in the dashboard layout, no caching headers anywhere, ES2017 transpilation target shipping legacy polyfills, and no bundle optimization for large dependencies like recharts and lucide-react.

Phase 1: Critical Path Fixes (highest impact)
1.1 Fix ContentSquare Script — blocks TTI
File: src/app/layout.tsx

Move <Script> out of <head>, place after children in <body>
Change strategy="beforeInteractive" → strategy="lazyOnload"
Gate behind process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true'
Improves: TTI, TBT, Third-Party Code Impact

1.2 Eliminate Legacy JavaScript — ES2017 → ES2022
File: tsconfig.json

Change "target": "ES2017" → "target": "ES2022"
Add browserslist to package.json: ["chrome >= 90", "firefox >= 90", "safari >= 15", "edge >= 90"]
Improves: Bundle size, Unused JavaScript

1.3 Aggressive Caching Headers + Package Import Optimization
File: next.config.js

Add async headers() with:

/_next/static/:path* → public, max-age=31536000, immutable
Static images (svg/png/jpg) → public, max-age=86400, stale-while-revalidate=604800
Security headers (X-Content-Type-Options, X-Frame-Options)


Expand optimizePackageImports to include: lucide-react, date-fns, recharts, @radix-ui/react-dialog, @radix-ui/react-select, @radix-ui/react-checkbox, @radix-ui/react-label, @radix-ui/react-slot, react-day-picker
Improves: Repeated visit speed, bundle size, LCP


Phase 2: Code Splitting (reduce initial JS by ~60-80KB gzipped)
2.1 Dynamic Import Modals in Members Page
File: src/app/(dashboard)/members/page.tsx

Replace static imports (lines 6-8) with next/dynamic for:

AddMemberModal (504 lines) → dynamic(() => import(...), { ssr: false })
BulkAddMemberModal (741 lines) → same
PaymentCollectionModal (367 lines) → same


Keep MembersTable static (visible on load)

2.2 Dynamic Import Modals in MemberModalProvider
File: src/contexts/member-modal.context.tsx

Replace static imports (lines 5-6) with next/dynamic for:

MemberDetailModal (602 lines)
EditMemberModal (329 lines)


These modals wrap ALL dashboard pages but only render when opened

2.3 Dynamic Import RevenueChart (recharts ~180KB)
File: src/app/(dashboard)/revenue/page.tsx

Replace line 13 static import with dynamic(() => import(...), { ssr: false, loading: () => <Skeleton /> })
recharts is only used on /revenue — no other page needs it

2.4 Dynamic Import Non-Default Payment Collection Tabs
File: src/app/(dashboard)/payment-collection/page.tsx

Keep ReminderStatusTable static (default tab)
Dynamic import InstallmentPaymentsTable and RegularPaymentTable
Add skeleton loading placeholders


Phase 3: Middleware & Redirect Optimization
3.1 Narrow Middleware Matcher
File: src/middleware.ts

Change matcher from '/((?!_next/static|_next/image|favicon.ico).*)'
to '/((?!_next|api|static|.*\\..*|favicon\\.ico).*)'
This excludes API routes and static assets from middleware entirely
Remove redundant asset checks in src/lib/middleware/auth.ts (lines 37-43)

3.2 Eliminate Duplicate Auth Check in Dashboard Layout
File: src/app/(dashboard)/layout.tsx

Currently calls getCurrentGymProfile() which runs requireAuth() → supabase.auth.getUser() — duplicating the middleware auth check
Simplify to only check gym profile existence (user is already authenticated by middleware)
Create a lighter getGymProfile() helper that skips the redundant getUser() call by reusing the auth session from the middleware-set cookies

3.3 Fix Settings Redirect Chain
File: src/app/(dashboard)/settings/page.tsx

Change redirect('/settings/gym') → permanentRedirect('/settings/gym') so browsers cache the 308 response
Eliminates a full server roundtrip on repeated visits


Phase 4: API & React Query Caching
4.1 Add Cache-Control Headers to Read-Only API Routes
Files: GET handlers in:

src/app/api/auth/profile/route.ts → private, max-age=60, stale-while-revalidate=300
src/app/api/settings/plans/route.ts → private, max-age=300, stale-while-revalidate=600
src/app/api/settings/discounts/route.ts → same
src/app/api/installment-templates/route.ts → same
Wrap in a helper to keep DRY

4.2 Standardize React Query Configuration
File: src/components/providers/QueryProvider.tsx

Add gcTime: 10 * 60 * 1000 (10 min garbage collection) to keep cache entries longer

File: src/components/layout/Header.tsx

Change staleTime: 30000 → staleTime: 5 * 60 * 1000 (gym profile rarely changes)
Change refetchOnWindowFocus: true → false (match global default)


Phase 5: LCP Optimization — Server/Client Component Split
5.1 Split Members Page into Server + Client
File: src/app/(dashboard)/members/page.tsx

Remove 'use client' from page.tsx, make it a Server Component
Move interactive logic to new src/app/(dashboard)/members/MembersPageClient.tsx
Server Component renders <h1>, <p>, and action buttons immediately in HTML
Client Component handles state, modals, and MembersTable
Improves: LCP — heading appears in initial HTML without waiting for JS

5.2 Same pattern for Revenue and Payment Collection pages

Extract client logic to RevenuePageClient.tsx and PaymentCollectionPageClient.tsx
Server Component renders the page heading immediately


Phase 6: Bundle Cleanup
6.1 Remove Duplicate bcrypt Package
File: package.json

Remove bcryptjs (only bcrypt is actually imported in source)
Move @types/bcrypt from dependencies to devDependencies

6.2 Add Bundle Analyzer (dev tool)

npm install -D @next/bundle-analyzer
Wrap next.config.js with withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })
Add script: "analyze": "ANALYZE=true next build"


Files Modified (summary)
FileChangesnext.config.jsCaching headers, optimizePackageImports expansion, bundle analyzertsconfig.jsontarget ES2017 → ES2022package.jsonbrowserslist, remove bcryptjs, add bundle-analyzer, analyze scriptsrc/app/layout.tsxContentSquare → lazyOnload + env gatesrc/middleware.tsNarrow matcher patternsrc/lib/middleware/auth.tsRemove redundant asset checks, add lighter gym profile helpersrc/app/(dashboard)/layout.tsxUse lighter auth checksrc/app/(dashboard)/members/page.tsxServer/Client split + dynamic modal importssrc/app/(dashboard)/members/MembersPageClient.tsxNew — extracted client logicsrc/app/(dashboard)/revenue/page.tsxServer/Client split + dynamic RevenueChart importsrc/app/(dashboard)/revenue/RevenuePageClient.tsxNew — extracted client logicsrc/app/(dashboard)/payment-collection/page.tsxServer/Client split + dynamic tab importssrc/app/(dashboard)/payment-collection/PaymentCollectionPageClient.tsxNew — extracted client logicsrc/app/(dashboard)/settings/page.tsxredirect → permanentRedirectsrc/contexts/member-modal.context.tsxDynamic import modalssrc/components/layout/Header.tsxAlign staleTime + refetchOnWindowFocus with global defaultssrc/components/providers/QueryProvider.tsxAdd gcTime configAPI route GET handlers (4 files)Add Cache-Control headers

Verification

Build check: npm run build — verify no errors and check output sizes in build report
Type check: npm run type-check — verify TypeScript passes
Tests: npm test — verify all existing tests pass
Bundle analysis: npm run analyze — verify code splitting is working (modals and recharts in separate chunks)
Lighthouse audit: Run Lighthouse on /members page — target score 85+
Manual smoke test: Navigate between members/revenue/payment-collection/settings and verify:

Modals open correctly (lazy loaded)
Revenue chart renders (lazy loaded)
Tab switching works on payment collection
Settings redirects properly
Header shows gym name without unnecessary refetching