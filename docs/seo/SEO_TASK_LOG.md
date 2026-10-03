# SEO Task Log — Metric Gym OS

> **Generated file — do not edit.** Source of truth: [`SEO_TASKS.json`](./SEO_TASKS.json). Regenerate with `npm run seo:report`; `npm run seo:report -- --check` fails when this file is stale. Audit narrative: [`SEO_AUDIT.md`](./SEO_AUDIT.md).

## Current summary

| Measure | Value |
| --- | --- |
| Audit date | 2026-10-01 |
| Last task update | 2026-10-03T01:47:17Z |
| Total tasks | 64 |
| P0 remaining (not verified/rejected) | 2 |
| P1 remaining (not verified/rejected) | 5 |
| Implemented (awaiting verification) | 4 |
| Verified | 41 |
| In progress | 0 |
| Open (discovered/planned) | 6 |
| Blocked | 9 |
| Rejected | 4 |
| External action required | 15 |

## Status by priority

| Priority | discovered | planned | in_progress | implemented | verified | blocked | rejected |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| P0 | 0 | 0 | 0 | 0 | 9 | 2 | 0 |
| P1 | 0 | 0 | 0 | 3 | 18 | 2 | 0 |
| P2 | 0 | 0 | 0 | 1 | 12 | 3 | 0 |
| P3 | 6 | 0 | 0 | 0 | 2 | 2 | 4 |

## All tasks

| ID | Priority | Status | Category | Title | External |
| --- | --- | --- | --- | --- | --- |
| [SEO-001](#seo-001) | P0 | verified | on-page | Homepage title, description and H1 carry no category or geography signal | no |
| [SEO-002](#seo-002) | P0 | verified | technical | No robots.txt | no |
| [SEO-003](#seo-003) | P0 | verified | technical | No XML sitemap | no |
| [SEO-004](#seo-004) | P0 | verified | technical | No canonical tags; metadataBase and og:url point at the apex host, which 308-redirects to www | no |
| [SEO-011](#seo-011) | P0 | verified | architecture | Any new public page is silently redirected to /login unless it is added to PUBLIC_ROUTES | no |
| [SEO-012](#seo-012) | P0 | verified | architecture | The site is one page: no crawlable URL exists for any commercial sub-intent | no |
| [SEO-013](#seo-013) | P0 | verified | content | Build the commercial hub: /gym-management-software-sri-lanka | no |
| [SEO-019](#seo-019) | P0 | verified | content | Dedicated pricing page in LKR | no |
| [SEO-023](#seo-023) | P0 | verified | trust | Homepage claims contradicted by the codebase | no |
| [SEO-024](#seo-024) | P0 | blocked | trust | Unverifiable proof claims need owner evidence | yes |
| [SEO-036](#seo-036) | P0 | blocked | measurement | Google Search Console access and sitemap submission | yes |
| [SEO-005](#seo-005) | P1 | verified | technical | Production .vercel.app alias serves an indexable duplicate of the site | no |
| [SEO-006](#seo-006) | P1 | verified | on-page | Every public page inherits the homepage title and description | no |
| [SEO-007](#seo-007) | P1 | verified | technical | Open Graph image has the wrong shape and the retired brand; og:url is the homepage on every page | no |
| [SEO-008](#seo-008) | P1 | verified | technical | Two page modules resolve to '/', and only Turbopack's tie-break keeps the homepage | no |
| [SEO-009](#seo-009) | P1 | verified | technical | Auth utility pages are indexable with the homepage title | no |
| [SEO-014](#seo-014) | P1 | verified | content | Feature page: membership management | no |
| [SEO-015](#seo-015) | P1 | verified | content | Feature page: payment collection and renewals | no |
| [SEO-016](#seo-016) | P1 | verified | content | Feature page: SMS reminders and announcements | no |
| [SEO-017](#seo-017) | P1 | verified | content | Feature page: revenue and member analytics | no |
| [SEO-018](#seo-018) | P1 | verified | content | Feature page: fingerprint access control and door attendance | no |
| [SEO-020](#seo-020) | P1 | verified | entity | About page with verifiable company facts | no |
| [SEO-021](#seo-021) | P1 | verified | internal-linking | Homepage navigation and footer use hash anchors and mailto links; /contact is orphaned | no |
| [SEO-025](#seo-025) | P1 | verified | local | Contact details are inconsistent across the site | no |
| [SEO-026](#seo-026) | P1 | blocked | off-site | Retired domain metricgymmanager.com is still indexed with stale claims | yes |
| [SEO-028](#seo-028) | P1 | verified | schema | No Organization or WebSite structured data | no |
| [SEO-029](#seo-029) | P1 | verified | schema | SoftwareApplication structured data with LKR offers | no |
| [SEO-035](#seo-035) | P1 | implemented | measurement | No analytics event for demo requests | yes |
| [SEO-038](#seo-038) | P1 | blocked | off-site | Partner citation from VFT Holdings | yes |
| [SEO-046](#seo-046) | P1 | verified | measurement | Measurement plan | no |
| [SEO-048](#seo-048) | P1 | verified | technical | Design-system TableRow could not render in a Server Component | no |
| [SEO-056](#seo-056) | P1 | implemented | measurement | Trial sign-ups are not measured, and the page after sign-up puts the email address in its URL | yes |
| [SEO-059](#seo-059) | P1 | implemented | measurement | GA4 receives one-time auth tokens: the full URL of /reset-password and /verify-email links, token included | yes |
| [SEO-062](#seo-062) | P1 | verified | trust | Two public pages said QR self-registrations wait for staff before counting as paid; they are created active with the payment recorded | no |
| [SEO-010](#seo-010) | P2 | verified | technical | Authenticated route groups have no defensive noindex | no |
| [SEO-022](#seo-022) | P2 | verified | content | Resources hub with two first-party articles | no |
| [SEO-027](#seo-027) | P2 | verified | technical | Unreferenced public images expose an old UI, the old brand and personal data | no |
| [SEO-030](#seo-030) | P2 | verified | schema | BreadcrumbList on subpages and Article on resources | no |
| [SEO-037](#seo-037) | P2 | blocked | local | Google Business Profile eligibility | yes |
| [SEO-039](#seo-039) | P2 | blocked | off-site | Software directories and review profiles | yes |
| [SEO-042](#seo-042) | P2 | blocked | content | Real case studies and first-party data content | yes |
| [SEO-044](#seo-044) | P2 | verified | performance | Lab performance check of public pages | no |
| [SEO-049](#seo-049) | P2 | verified | technical | Homepage overflowed a 320 px viewport | no |
| [SEO-050](#seo-050) | P2 | verified | on-page | In-text links relied on colour alone; footer contact links below 24 px | no |
| [SEO-054](#seo-054) | P2 | verified | architecture | Record the public-site rules where future work will find them | no |
| [SEO-055](#seo-055) | P2 | implemented | performance | Every public page ships the chart library it never uses | no |
| [SEO-057](#seo-057) | P2 | verified | schema | Every WebPage node claimed to be about the product, on pages that never describe it | no |
| [SEO-061](#seo-061) | P2 | verified | content | Guide: overdue gym memberships — when to expire, when to cancel | no |
| [SEO-063](#seo-063) | P2 | verified | content | Guide: moving a gym's members off a register book or spreadsheet | no |
| [SEO-064](#seo-064) | P2 | verified | content | Guide: Excel and WhatsApp vs gym management software, written honestly | no |
| [SEO-031](#seo-031) | P3 | rejected | schema | FAQPage structured data | no |
| [SEO-032](#seo-032) | P3 | rejected | schema | LocalBusiness structured data | no |
| [SEO-033](#seo-033) | P3 | rejected | technical | llms.txt or AI-specific markup | no |
| [SEO-034](#seo-034) | P3 | rejected | local | Mass location pages (Colombo, Kandy, Galle …) | no |
| [SEO-040](#seo-040) | P3 | blocked | entity | Social and entity profiles | yes |
| [SEO-041](#seo-041) | P3 | blocked | entity | Founder and team information | yes |
| [SEO-043](#seo-043) | P3 | discovered | performance | Marketing pages preload a font they do not render | no |
| [SEO-045](#seo-045) | P3 | verified | technical | Unknown public-looking paths redirect to /login | no |
| [SEO-047](#seo-047) | P3 | discovered | content | Sinhala and Tamil content | yes |
| [SEO-051](#seo-051) | P3 | discovered | on-page | Decorative dashboard preview on the homepage fails colour contrast | no |
| [SEO-052](#seo-052) | P3 | discovered | trust | Weekly members get their '7 days before' reminder on the day they pay | yes |
| [SEO-053](#seo-053) | P3 | discovered | trust | Automated reminders and receipts do not name the gym | yes |
| [SEO-058](#seo-058) | P3 | verified | internal-linking | Seven related-page cards linked the hub with the same exact-match anchor | no |
| [SEO-060](#seo-060) | P3 | discovered | performance | Public pages still load the signed-in app's providers: Supabase client, react-query, service-worker registration, AuthRecovery | no |

## External tasks (cannot be completed in code)

- **SEO-024** (P0, blocked) — Unverifiable proof claims need owner evidence
- **SEO-036** (P0, blocked) — Google Search Console access and sitemap submission
- **SEO-026** (P1, blocked) — Retired domain metricgymmanager.com is still indexed with stale claims
- **SEO-035** (P1, implemented) — No analytics event for demo requests
- **SEO-038** (P1, blocked) — Partner citation from VFT Holdings
- **SEO-056** (P1, implemented) — Trial sign-ups are not measured, and the page after sign-up puts the email address in its URL
- **SEO-059** (P1, implemented) — GA4 receives one-time auth tokens: the full URL of /reset-password and /verify-email links, token included
- **SEO-037** (P2, blocked) — Google Business Profile eligibility
- **SEO-039** (P2, blocked) — Software directories and review profiles
- **SEO-042** (P2, blocked) — Real case studies and first-party data content
- **SEO-040** (P3, blocked) — Social and entity profiles
- **SEO-041** (P3, blocked) — Founder and team information
- **SEO-047** (P3, discovered) — Sinhala and Tamil content
- **SEO-052** (P3, discovered) — Weekly members get their '7 days before' reminder on the day they pay
- **SEO-053** (P3, discovered) — Automated reminders and receipts do not name the gym

## Task detail

### SEO-001

**Homepage title, description and H1 carry no category or geography signal**

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | verified |
| Category | on-page |
| Intent | commercial |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:22:49Z |
| Completed | 2026-10-01T18:22:49Z |
| Dependencies | — |

**Target queries**

- `gym management software sri lanka`
- `gym management system sri lanka`
- `gym software sri lanka`
- `gym management software`

**Finding**

The only indexable commercial page is titled 'Metric Gym OS' with H1 'The operating system for serious gyms.' and a generic meta description. The phrase 'gym management software' appears nowhere on the site; 'Sri Lanka' appears only in a trust-strip label and the footer.

**Evidence**

- Production HTML (deployment dpl_5Vr1YJREqAiVCJ9nVLt7iibhZ3op, commit 75eff38) fetched via the Vercel connector: <title>Metric Gym OS</title>, meta description 'Modern gym and fitness center management platform for streamlined operations, member management, and business growth'.
- src/app/layout.tsx metadata.title = 'Metric Gym OS'; src/components/landing/LandingPage.tsx H1 'The operating system for serious gyms.'
- Competitor titles observed in the search index: 'Gym Management System in Sri Lanka - Fitnessx', 'Fitrobit — AI-Powered Gym Management Software', 'FitConnect Admin — Gym Management Software for Sri Lanka'.

**Recommended change**

Category + geography in the homepage <title> and meta description; keep the brand line as the visual headline but put a descriptive line inside the same <h1> element (eyebrow + headline), so the heading states what the product is without turning the hero into a keyword block.

**Implementation**

Homepage <title> 'Gym Management Software for Sri Lankan Gyms | Metric Gym OS' and a 153-character description from the page registry. The <h1> now holds two visible lines: the mono eyebrow 'Gym management software · Sri Lanka' and the unchanged brand display line, so the heading states category and geography without altering the hero's look. Subtitle rewritten to describe real capabilities.

**Files**

- `src/app/page.tsx`
- `src/components/landing/LandingPage.tsx`
- `src/features/marketing/config/pages.ts`

**Verification**

- Crawl of the local production build (next build + next start, 2026-10-01): title 59 chars, one H1 whose text contains 'Gym management software · Sri Lanka' and the brand line
- src/app/__tests__/HomePage.test.tsx asserts title/description/canonical and the H1 content
- Screenshots at 1366/390 px: hero visually identical apart from the eyebrow text

### SEO-002

**No robots.txt**

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | verified |
| Category | technical |
| Intent | none |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:22:49Z |
| Completed | 2026-10-01T18:22:49Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

No app/robots.* and no public/robots.txt exist, so /robots.txt returns the app's 404 and no sitemap is advertised.

**Evidence**

- find src/app public -name 'robots*' returns nothing at commit 75eff38.

**Recommended change**

Add src/app/robots.ts: allow all, disallow /api/, advertise https://www.metricgymos.com/sitemap.xml. Do not disallow /join/ — those pages carry noindex, which crawlers must be able to read.

**Implementation**

src/app/robots.ts → features/marketing buildRobots(): allow /, disallow /api/, Sitemap https://www.metricgymos.com/sitemap.xml. /join/ deliberately not disallowed (noindex pages must stay fetchable).

**Files**

- `src/app/robots.ts`
- `src/features/marketing/services/crawl.ts`

**Verification**

- GET /robots.txt on the local production build (next build + next start, 2026-10-01) returns the four expected lines
- crawl.test.ts pins rules, sitemap URL and that /join/ is not blocked

### SEO-003

**No XML sitemap**

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | verified |
| Category | technical |
| Intent | none |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:22:49Z |
| Completed | 2026-10-01T18:22:49Z |
| Dependencies | SEO-011 |

**Target queries**

- —

**Finding**

No sitemap exists, so discovery depends entirely on links — and the homepage links to only four internal URLs.

**Evidence**

- find src/app public -name 'sitemap*' returns nothing at commit 75eff38.

**Recommended change**

Generate src/app/sitemap.ts from a single public-page registry so a page cannot be published without a sitemap entry; use real per-page lastModified dates, not the build time.

**Implementation**

src/app/sitemap.ts → buildSitemap() from the page registry: 16 URLs, absolute www origin, per-page content dates (not build time), no changefreq/priority.

**Files**

- `src/app/sitemap.ts`
- `src/features/marketing/services/crawl.ts`
- `src/features/marketing/config/pages.ts`

**Verification**

- GET /sitemap.xml on the local production build (next build + next start, 2026-10-01) parses as sitemaps.org XML with 16 <url> entries
- Crawl from / reaches all 16 sitemap URLs (200, anonymous Googlebot UA); none orphaned
- crawl.test.ts

### SEO-004

**No canonical tags; metadataBase and og:url point at the apex host, which 308-redirects to www**

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | verified |
| Category | technical |
| Intent | none |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:22:49Z |
| Completed | 2026-10-01T18:22:49Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

Vercel serves www.metricgymos.com as the primary domain (metricgymos.com, metricgymmanager.com and www.metricgymmanager.com all 308 to it), but metadataBase is https://metricgymos.com, so every absolute URL in metadata (og:url, og:image) points at a redirect. No page emits <link rel=canonical>.

**Evidence**

- Vercel project domains (connector list_project_domains): metricgymos.com redirect -> www.metricgymos.com (308); www.metricgymos.com redirect null.
- Production HTML: og:url https://metricgymos.com, og:image https://metricgymos.com/linkPreviewLogo.png, no canonical link.

**Recommended change**

Single SITE_URL constant = https://www.metricgymos.com used for metadataBase; per-page alternates.canonical; never set a canonical in the root layout (it would canonicalise every page to the homepage).

**Implementation**

SITE_URL = https://www.metricgymos.com drives metadataBase, canonicals, og:url, sitemap and JSON-LD @ids. Canonical and og:url set per page by buildPageMetadata(); the root layout sets neither (pinned by a test).

**Files**

- `src/app/layout.tsx`
- `src/features/marketing/config/site.ts`
- `src/features/marketing/utils/metadata.ts`

**Verification**

- Crawl: every public page's canonical and og:url equal its own www URL (the root renders as https://www.metricgymos.com, Next's normalisation of the slash)
- metadata.test.ts; mutation (canonical added to root layout) turns the test red

### SEO-011

**Any new public page is silently redirected to /login unless it is added to PUBLIC_ROUTES**

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | verified |
| Category | architecture |
| Intent | none |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:22:49Z |
| Completed | 2026-10-01T18:22:49Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

authMiddleware sends every path that is not an exact PUBLIC_ROUTES match (or /join/ prefix) to /login with a 307. A marketing page added without that entry would be invisible to Googlebot while every unit test passes.

**Evidence**

- src/lib/auth-config.ts PUBLIC_ROUTES (exact-match list); src/lib/middleware/auth.ts unauthenticated branch.

**Recommended change**

One registry of public marketing pages (features/marketing/config/pages.ts) that drives metadata, breadcrumbs and the sitemap, plus a test asserting every registry path passes isPublicRoute(). Keep PUBLIC_ROUTES explicit (exact matches) as auth-config documents.

**Implementation**

features/marketing/config/pages.ts registry drives metadata, breadcrumbs, navigation and the sitemap; 11 new exact-match PUBLIC_ROUTES; pages.test.ts asserts every registry path is public and has a page module; middleware test pins five marketing pages and guards unlisted paths.

**Files**

- `src/features/marketing/config/pages.ts`
- `src/lib/auth-config.ts`
- `src/features/marketing/tests/pages.test.ts`
- `src/lib/middleware/__tests__/auth-middleware.test.ts`

**Verification**

- Mutation: removing '/pricing' from PUBLIC_ROUTES fails both the registry test and the middleware test
- Crawl as anonymous Googlebot UA: every public page 200

### SEO-012

**The site is one page: no crawlable URL exists for any commercial sub-intent**

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | verified |
| Category | architecture |
| Intent | commercial |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:23:11Z |
| Completed | 2026-10-01T18:23:11Z |
| Dependencies | SEO-011 |

**Target queries**

- `gym management software sri lanka`
- `gym management system sri lanka`
- `gym software sri lanka`
- `gym membership software sri lanka`
- `gym billing software sri lanka`
- `gym access control software sri lanka`
- `gym sms software sri lanka`
- `gym management software pricing sri lanka`

**Finding**

Everything lives on '/', with hash-anchor navigation. Internal links from the homepage reach only /login, /privacy, /terms and /refund-policy; /contact exists but nothing links to it. There is no page that can rank for pricing, access control, SMS, billing or membership intents.

**Evidence**

- src/components/landing/LandingPage.tsx: nav links #platform, #pricing, #platform ('Resources'); footer About/Contact are mailto:founder@metric.lk.
- GymMaster (search index) keeps separate URLs per intent: /gym-management-software/, /cloud-based-gym-management-software/, /gym-software/, /billing-management/, /gym-scheduling-software/ plus a blog.

**Recommended change**

One commercial hub (/gym-management-software-sri-lanka), five substantive feature pages, /pricing, /about, /resources with two first-party articles; deliberate internal link graph; no thin variants.

**Implementation**

New (marketing) route group with 11 pages (hub, 5 features, pricing, about, resources + 2 articles) plus /contact moved in; shared MarketingShell header/footer; every page statically prerendered.

**Files**

- `src/app/(marketing)/layout.tsx`
- `src/features/marketing/**`
- `src/app/(marketing)/**`

**Verification**

- Build: all 16 public routes static (○)
- Crawl from /: 16 sitemap URLs reached, 0 orphans, 0 broken internal links
- MarketingPages.test.tsx: link-graph test (no orphans) and per-page broken-link test

### SEO-013

**Build the commercial hub: /gym-management-software-sri-lanka**

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | verified |
| Category | content |
| Intent | commercial |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:23:11Z |
| Completed | 2026-10-01T18:23:11Z |
| Dependencies | SEO-011, SEO-023 |

**Target queries**

- `gym management software sri lanka`
- `gym management system sri lanka`
- `gym software sri lanka`
- `gym management system for fitness centres`
- `gym management software for fitness businesses`
- `gym software for gyms in sri lanka`

**Finding**

No page answers the commercial query in depth: what the product is, who it is for, what it does day to day, what it costs in LKR, how setup works, how data is protected, who runs it.

**Evidence**

- Fitrobit and FitnessX titles and snippets in the search index combine category + Sri Lanka + LKR pricing + contact details on a single crawlable page.

**Recommended change**

Long-form hub built from verified product behaviour (src/features/*): definitions, member lifecycle, feature summaries linking to feature pages, LKR pricing summary, onboarding steps, data protection (PDPA No. 9 of 2022), company details, visible FAQ.

**Implementation**

/gym-management-software-sri-lanka: definition, scope (what Metric does not do), seven-step member journey, feature grid, LKR pricing, onboarding steps, data protection (RLS isolation, fingerprints never pass through Metric, consent, PayHere tokens, PDPA No. 9 of 2022), company, visible FAQ, CTA. SoftwareApplication JSON-LD.

**Files**

- `src/app/(marketing)/gym-management-software-sri-lanka/page.tsx`

**Verification**

- Render test (one H1, metadata, JSON-LD, links, heading order)
- Lighthouse (local, mobile): SEO 100, accessibility 93, performance 92, CLS 0
- Screenshots 1366/390 reviewed

### SEO-019

**Dedicated pricing page in LKR**

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | verified |
| Category | content |
| Intent | commercial |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:23:12Z |
| Completed | 2026-10-01T18:23:12Z |
| Dependencies | SEO-023 |

**Target queries**

- `gym management software pricing sri lanka`
- `gym software price sri lanka`
- `gym management system price`

**Finding**

Pricing exists only as a homepage section, under tier names (Starter/Growth) that differ from the product's (Lite/Pro), with a trial claim that does not apply to Enterprise.

**Evidence**

- src/features/subscriptions/config/SubscriptionConfig.ts: TIER_DISPLAY_NAME Lite/Pro/Enterprise, LITE_TIER_MEMBER_LIMIT 100, TRIAL_PERIOD_DAYS 30 (Lite/Pro self-serve; Enterprise contact-sales only).
- .env.example PAYHERE_LITE_PRICE_LKR=2990, PAYHERE_PRO_PRICE_LKR=4990, PAYHERE_ENTERPRISE_PRICE_LKR=6990.
- Search-index snippets show competitors publishing LKR prices (FitnessX Rs. 6,000/15,000/45,000; Fitrobit LKR 8,000/15,000).

**Recommended change**

/pricing driven by one pricing config shared with the homepage and SoftwareApplication offers.

**Implementation**

/pricing: PricingPlans from config, comparison table, active-member limit, trial (Lite limit, no card, pauses at end), billing (PayHere, saved card, banked days, 7-day grace with 2-day retries), FAQ, SoftwareApplication offers. Fulfils the refund policy's promise of a pricing page.

**Files**

- `src/app/(marketing)/pricing/page.tsx`
- `src/features/marketing/config/pricing.ts`
- `src/features/marketing/components/PricingPlans.tsx`

**Verification**

- pricing.test.ts pins prices to .env.example and names/limits to SubscriptionConfig; mutation (Lite 2500) turns it red
- Lighthouse (local, mobile): SEO 100, performance 93

### SEO-023

**Homepage claims contradicted by the codebase**

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | verified |
| Category | trust |
| Intent | commercial |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:23:33Z |
| Completed | 2026-10-01T18:23:33Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

The homepage advertises things the product does not do: a HIKVISION integration badge; RFID and facial-recognition entry; WhatsApp sends in the reminder log; 'QR code check-in'; a 30-day trial 'on every tier'; tier names Starter/Growth that do not exist in the product; 'automated fee collection' (members pay at the desk; Metric automates reminders and records payments); a RETRY line implying automatic SMS retries.

**Evidence**

- docs/architecture/access-control-integration.md:299 — 'a future ZKTeco/Hikvision provider' (not built).
- Enrolment is fingerprint (enrollfinger); no WhatsApp provider exists (src/features/sms/services/providers); no check-in feature exists (grep check-in returns only access-control and the landing page).
- SubscriptionConfig.ts: Enterprise is contact-sales only and never enters the trial flow; TIER_DISPLAY_NAME Lite/Pro/Enterprise.
- SendAutomatedReminders.ts sends once and logs; there is no retry loop.

**Recommended change**

Correct every contradicted claim in place; source tier names, limits and trial terms from SubscriptionConfig through the marketing pricing config.

**Implementation**

Removed or corrected every contradicted claim: HIKVISION badge → 'ZKTECO · FINGERPRINT'; RFID/face wording and log lines → fingerprint; WhatsApp and RETRY log lines → real SMS statuses; 'QR code check-in' → QR self-registration; 'trial on every tier' → trial for new accounts, Enterprise via our team; Starter/Growth → Lite/Pro from TIER_DISPLAY_NAME (also in the demo form, mapped to the unchanged LeadInterest values); 'automated fee collection' → accurate subtitle; 'Escalation ladders' → the real reminder schedule.

**Files**

- `src/components/landing/LandingPage.tsx`
- `src/components/landing/DemoModal.tsx`
- `src/features/marketing/config/pricing.ts`

**Verification**

- HomePage.test.tsx forbids hikvision, rfid, facial recognition, whatsapp, check-in, 'trial on every tier', −95%, 'automated fee collection'; mutation (HIKVISION restored) turns it red

### SEO-024

**Unverifiable proof claims need owner evidence**

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | blocked |
| Category | trust |
| Intent | commercial |
| External action | required |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-02T15:36:21Z |
| Completed | — |
| Dependencies | — |

**Target queries**

- —

**Finding**

The homepage shows a 'Trusted by leading gyms across Sri Lanka' strip naming six businesses, a testimonial attributed to 'Zulfi Ahamath — Owner, Fitness Empire, Wattala' claiming 80% less admin time, a '−95% late payments' badge and 'Running nationwide'. Nothing in the repository supports or refutes them. They were left in place, are not repeated on any new page and are excluded from structured data.

**Evidence**

- src/components/landing/LandingPage.tsx trust strip, quote section, feature badge, hero eyebrow.
- Search index still shows older, larger claims from metricgymmanager.com ('25+ gyms', '7.9K+ active members', '99.99% uptime') that also have no evidence in the repository.
- Found 2026-10-02: the same figures are live in the product, not only in the old index. src/components/auth/AuthShell.tsx renders 'Gyms on platform 25+', 'Members managed 7,900+' and 'Uptime, trailing 12 mo 99.99%', plus a 'metricgym.lk' domain label, beside every auth form: /register (indexable, canonicalised), /login, /forgot-password, /reset-password and /verify-email. Seen in a 1366 px screenshot of /verify-email.

**Recommended change**

Owner to confirm: each named gym is a current customer that agreed to be shown; the testimonial is real, attributed with consent and its 80% figure is the customer's own; the −95% figure has a dataset behind it; and the auth panel's 25+ gyms, 7,900+ members and 99.99% uptime have evidence behind them (and whether 'metricgym.lk' is a domain Metric uses, against the canonical www.metricgymos.com). Remove anything that cannot be confirmed. Once confirmed, consider real case studies (SEO-042).

**Implementation**

Partially actioned: the '−95% LATE PAYMENTS' statistic and 'RUNNING NATIONWIDE' were replaced with verifiable text (reminder schedule badge; descriptive eyebrow). The six named gyms in the trust strip and the Zulfi Ahamath / Fitness Empire testimonial remain unchanged pending owner confirmation, are repeated nowhere else, and are excluded from structured data.

**Files**

- `src/components/landing/LandingPage.tsx`
- `src/components/auth/AuthShell.tsx`

**Verification**

- Not yet verified

### SEO-036

**Google Search Console access and sitemap submission**

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | blocked |
| Category | measurement |
| Intent | none |
| External action | required |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T17:40:00Z |
| Completed | — |
| Dependencies | — |

**Target queries**

- —

**Finding**

No Search Console verification exists in the repository and this environment has no Search Console access, so indexing, queries, CTR and AI-feature traffic cannot be read.

**Evidence**

- No google-site-verification meta tag or file in the repository.

**Recommended change**

Owner: verify a Domain property for metricgymos.com via DNS, submit /sitemap.xml, inspect '/', '/gym-management-software-sri-lanka' and '/pricing', then follow the measurement plan in SEO_AUDIT.md.

**Implementation**

—

**Files**

- —

**Verification**

- Not yet verified

### SEO-005

**Production .vercel.app alias serves an indexable duplicate of the site**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | verified |
| Category | technical |
| Intent | none |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:22:49Z |
| Completed | 2026-10-01T18:22:49Z |
| Dependencies | SEO-004 |

**Target queries**

- —

**Finding**

gym-management-saas.vercel.app answers 200 with the full site, no X-Robots-Tag and no canonical, so it is a crawlable duplicate host. It cannot simply be redirected: vendor webhooks may be registered against it.

**Evidence**

- Vercel connector fetch of https://gym-management-saas.vercel.app/: status 200, headers contain no x-robots-tag.
- docs/architecture/access-control-master.md B5 discusses the project alias as a handover URL.

**Recommended change**

Absolute canonicals on every public page (SEO-004) plus an X-Robots-Tag: noindex header for any *.vercel.app host in next.config.js. Headers do not change webhook behaviour.

**Implementation**

next.config.js headers(): X-Robots-Tag: noindex for any request whose Host matches *.vercel.app; canonicals point at www regardless. No redirect, so vendor webhooks on the alias keep working.

**Files**

- `next.config.js`

**Verification**

- local production build (next build + next start, 2026-10-01): Host gym-management-saas.vercel.app → X-Robots-Tag: noindex; Host www.metricgymos.com → no header
- Re-check on the real alias after deploy (curl -I https://gym-management-saas.vercel.app/)

### SEO-006

**Every public page inherits the homepage title and description**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | verified |
| Category | on-page |
| Intent | navigational |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:22:49Z |
| Completed | 2026-10-01T18:22:49Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

/contact, /privacy, /terms, /refund-policy, /login, /register and the password/verification pages export no metadata, so all of them render <title>Metric Gym OS</title> with the same description.

**Evidence**

- grep for 'export const metadata' in src/app/contact, privacy, terms, refund-policy and (auth) returns nothing.
- next build lists these routes as static (○) with the root layout's metadata.

**Recommended change**

Root title template '%s | Metric Gym OS'; unique title, description and canonical per public page via one metadata helper.

**Implementation**

Root title template '%s | Metric Gym OS'; unique registry titles/descriptions for every public page; segment layouts give /login and /register their own titles.

**Files**

- `src/app/layout.tsx`
- `src/app/privacy/page.tsx`
- `src/app/terms/page.tsx`
- `src/app/refund-policy/page.tsx`
- `src/app/(auth)/login/layout.tsx`
- `src/app/(auth)/register/layout.tsx`

**Verification**

- Crawl: 16 distinct titles and descriptions; pages.test.ts asserts uniqueness and length bounds

### SEO-007

**Open Graph image has the wrong shape and the retired brand; og:url is the homepage on every page**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | verified |
| Category | technical |
| Intent | none |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:22:49Z |
| Completed | 2026-10-01T18:22:49Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

linkPreviewLogo.png is 2000x2000 but declared as 1200x630 and reads 'metric gym manager' (the previous brand). Because openGraph.url is set in the root layout, every page claims the homepage as its URL when shared.

**Evidence**

- public/linkPreviewLogo.png PNG header: 2000x2000.
- src/app/layout.tsx openGraph.images width 1200 height 630; openGraph.url 'https://metricgymos.com'.

**Recommended change**

Ship a real 1200x630 card branded 'Metric Gym OS' as a static file in /public (static so the auth middleware never intercepts it — a dynamic /opengraph-image route has no file extension and would be redirected to /login), and set og:url per page.

**Implementation**

New 1200×630 public/og-image.png ('Metric Gym OS', generated by scripts/generate-og-image.mjs from the bundled Geist fonts); og:url per page; old 2000×2000 linkPreviewLogo.png removed.

**Files**

- `public/og-image.png`
- `scripts/generate-og-image.mjs`
- `src/features/marketing/config/site.ts`
- `src/app/layout.tsx`

**Verification**

- PNG header 1200×630; GET /og-image.png → 200 image/png (static, not intercepted by middleware)
- Crawl: og:image https://www.metricgymos.com/og-image.png on every page

### SEO-008

**Two page modules resolve to '/', and only Turbopack's tie-break keeps the homepage**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | verified |
| Category | technical |
| Intent | none |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:22:49Z |
| Completed | 2026-10-01T18:22:49Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

src/app/page.tsx (landing) and src/app/(dashboard)/page.tsx (redirect('/dashboard')) both map to '/'. Turbopack silently keeps the landing; the webpack loader throws 'You cannot have two parallel pages that resolve to the same path'. If that tie-break ever flips, the homepage becomes a redirect chain to /login and drops out of the index.

**Evidence**

- node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js:576 throws on duplicate pages.
- Production response for '/': x-matched-path '/', x-nextjs-prerender 1, landing HTML — the redirect page is dead code in production.
- src/lib/middleware/auth.ts never redirects an authenticated visitor at '/', so no visitor reaches the (dashboard) root page.

**Recommended change**

Delete the unreachable src/app/(dashboard)/page.tsx and its test; add a structural test that exactly one page module maps to '/'.

**Implementation**

Deleted the unreachable src/app/(dashboard)/page.tsx and its test; pages.test.ts asserts exactly one page module per URL and that '/' is src/app/page.tsx.

**Files**

- `src/app/(dashboard)/page.tsx (deleted)`
- `src/app/(dashboard)/__tests__/RootDashboardPage.test.tsx (deleted)`
- `src/features/marketing/tests/pages.test.ts`

**Verification**

- Build output lists a single '○ /'
- Mutation: recreating (dashboard)/page.tsx turns pages.test.ts red

### SEO-009

**Auth utility pages are indexable with the homepage title**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | verified |
| Category | technical |
| Intent | navigational |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:22:49Z |
| Completed | 2026-10-01T18:22:49Z |
| Dependencies | — |

**Target queries**

- `metric gym os login`

**Finding**

/forgot-password, /reset-password and /verify-email are public, static and indexable with title 'Metric Gym OS'. /login and /register are legitimate navigational destinations but share the same title.

**Evidence**

- src/app/(auth)/*/page.tsx are 'use client' pages with no metadata and no segment layout.

**Recommended change**

Segment layouts exporting metadata: unique titles for /login and /register (indexable, not in the sitemap); noindex for /forgot-password, /reset-password, /verify-email.

**Implementation**

Segment layouts export metadata: /login and /register indexable with canonicals (folding ?redirect= variants); /forgot-password, /reset-password, /verify-email noindex,nofollow.

**Files**

- `src/app/(auth)/login/layout.tsx`
- `src/app/(auth)/register/layout.tsx`
- `src/app/(auth)/forgot-password/layout.tsx`
- `src/app/(auth)/reset-password/layout.tsx`
- `src/app/(auth)/verify-email/layout.tsx`

**Verification**

- local production build (next build + next start, 2026-10-01): /login and /login?redirect=/members both canonical https://www.metricgymos.com/login; utility pages render <meta name=robots content='noindex, nofollow'>

### SEO-014

**Feature page: membership management**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | verified |
| Category | content |
| Intent | commercial |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:23:12Z |
| Completed | 2026-10-01T18:23:12Z |
| Dependencies | — |

**Target queries**

- `gym membership management software`
- `gym member management software sri lanka`
- `gym membership tracking software`
- `gym membership renewal software`

**Finding**

No page describes member records, plan types, statuses, QR self-registration, discounts or bulk import.

**Evidence**

- src/features/members/config/PlanConfig.ts (daily, weekly, monthly, 3-months, 6-months, annual, custom); RegistrationConfig.ts (manual vs QR, NEW badge until verified); instructions.md member statuses.

**Recommended change**

/features/membership-management grounded in PlanConfig, member lifecycle and the QR join flow.

**Implementation**

/features/membership-management: plan table rendered from PLAN_CONFIGS, statuses, discounts and admission fee, QR self-registration flow, bulk entry, FAQ.

**Files**

- `src/app/(marketing)/features/membership-management/page.tsx`

**Verification**

- Render test suite; crawl 200 with canonical

### SEO-015

**Feature page: payment collection and renewals**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | verified |
| Category | content |
| Intent | commercial |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:23:12Z |
| Completed | 2026-10-01T18:23:12Z |
| Dependencies | — |

**Target queries**

- `gym billing software sri lanka`
- `gym payment tracking software`
- `gym payment collection software`
- `gym overdue payment management`
- `gym payment reminders`

**Finding**

No page explains how dues, renewals, receipts, overdue handling and day passes work.

**Evidence**

- src/features/payments/services/CollectPayment.ts (renewal, next due date, receipt or reactivation SMS); IssueDayPass.ts; architecture rule 2.13 (expire immediately once past due, cancel at 14 days).

**Recommended change**

/features/payment-collection — honest that fees are taken at the desk and recorded in Metric (Metric does not process members' card payments).

**Implementation**

/features/payment-collection: Renewals lists (Expired / Expires this week / Collected), what recording a payment does, no-grace expiry and 14-day auto-cancel, day passes, FAQ — states plainly that members pay at the desk.

**Files**

- `src/app/(marketing)/features/payment-collection/page.tsx`

**Verification**

- Render test suite; crawl 200 with canonical; copy checked against PaymentCollectionPageClient.tsx and CollectPayment.ts

### SEO-016

**Feature page: SMS reminders and announcements**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | verified |
| Category | content |
| Intent | commercial |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:23:12Z |
| Completed | 2026-10-01T18:23:12Z |
| Dependencies | — |

**Target queries**

- `gym sms software sri lanka`
- `gym automated sms reminders`
- `gym member notification software`
- `gym payment reminders`

**Finding**

No page documents the reminder schedule, message content, receipts or delivery tracking.

**Evidence**

- src/features/sms/config/ReminderConfig.ts (per-plan schedule); SendAutomatedReminders.ts (message texts); vercel.json send-reminders 03:30 UTC = 09:00 Sri Lanka time; SmsConfig.ts delivery statuses.

**Recommended change**

/features/sms-reminders with the real schedule table by plan type.

**Implementation**

/features/sms-reminders: schedule table rendered from REMINDER_RULES × PLAN_CONFIGS, the exact message texts, 9:00 run time, delivery statuses, announcements, FAQ (no WhatsApp).

**Files**

- `src/app/(marketing)/features/sms-reminders/page.tsx`

**Verification**

- Render test suite; 320 px render: table scrolls inside its container, page does not overflow

### SEO-017

**Feature page: revenue and member analytics**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | verified |
| Category | content |
| Intent | commercial |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:23:12Z |
| Completed | 2026-10-01T18:23:12Z |
| Dependencies | — |

**Target queries**

- `gym revenue management software`
- `gym revenue dashboard`
- `gym management reporting software`
- `gym membership analytics`
- `gym attendance analytics`

**Finding**

No page describes billed vs collected revenue, plan breakdowns, renewal/churn rates or cohort retention.

**Evidence**

- architecture rule 2.22 (billed, not run-rate); src/app/(dashboard)/revenue/RevenuePageClient.tsx; src/features/analytics/components/MemberAnalyticsClient.tsx labels.

**Recommended change**

/features/revenue-reporting combining revenue and member analytics (one page, not two thin ones).

**Implementation**

/features/revenue-reporting: billed vs collected (rule 2.22), plan breakdown, dashboard tiles, member analytics (renewal, churn, at-risk, cohort retention), FAQ.

**Files**

- `src/app/(marketing)/features/revenue-reporting/page.tsx`

**Verification**

- Render test suite; labels checked against RevenuePageClient.tsx, dashboard and MemberAnalyticsClient.tsx

### SEO-018

**Feature page: fingerprint access control and door attendance**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | verified |
| Category | content |
| Intent | commercial |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:23:12Z |
| Completed | 2026-10-01T18:23:12Z |
| Dependencies | — |

**Target queries**

- `gym access control software sri lanka`
- `gym biometric access control`
- `gym fingerprint attendance system`
- `gym attendance software sri lanka`

**Finding**

Access control is Metric's most differentiated capability (the reader enforces each member's paid-through date from its own clock) but it has two sentences on the homepage, one of them inaccurate.

**Evidence**

- docs/architecture/access-control-master.md §1-§2 (ZKTeco terminals via VFT, validity windows, block-not-delete, outbox), §6 eighth audit (2026-09-23, real ZAM70 readers).
- src/app/privacy/page.tsx: fingerprint template is created on the reader and held by the provider; never passes through Metric.

**Recommended change**

/features/access-control: how it works, what happens on lapse/cancel/return, outage behaviour, privacy, Enterprise availability, hardware via VFT.

**Implementation**

/features/access-control: step-by-step flow, reader-as-authority principle, outage and billing-lapse behaviour, activity log and remote actions, consent/retention (ACCESS_EVENT_RETENTION_DAYS), Enterprise and hardware terms, FAQ (fingerprint only; no other reader brands).

**Files**

- `src/app/(marketing)/features/access-control/page.tsx`

**Verification**

- Render test suite; copy checked against access-control-master.md §1–§2, §6 and DeviceEventCodes.ts

### SEO-020

**About page with verifiable company facts**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | verified |
| Category | entity |
| Intent | navigational |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:23:12Z |
| Completed | 2026-10-01T18:23:12Z |
| Dependencies | — |

**Target queries**

- `metric gym os`
- `capitalist one pvt ltd`

**Finding**

No page says who builds Metric. 'About' in the footer is a mailto link; the operating company appears only in the footer copyright and the contact page.

**Evidence**

- src/app/contact/page.tsx: Capitalist One (Pvt) Ltd, 150/1, 3rd Baptist Rd, Beddagana North, Kotte, Sri Lanka.

**Recommended change**

/about: company, product, operating principles taken from the codebase, support model, location. No invented founder biography.

**Implementation**

/about: company, what we build, five operating rules enforced in code, support channels/hours, company details. No founder biography invented (SEO-041).

**Files**

- `src/app/(marketing)/about/page.tsx`

**Verification**

- Render test suite; crawl 200

### SEO-021

**Homepage navigation and footer use hash anchors and mailto links; /contact is orphaned**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | verified |
| Category | internal-linking |
| Intent | navigational |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:23:12Z |
| Completed | 2026-10-01T18:23:12Z |
| Dependencies | SEO-012 |

**Target queries**

- —

**Finding**

Nav 'Resources' points at #platform; footer 'About' and 'Contact' are mailto:founder@metric.lk although /contact exists. Crawlers find no path from the homepage to any page except login and the three legal documents.

**Evidence**

- src/components/landing/LandingPage.tsx lines ~198-257 (nav) and ~1398-1442 (footer).

**Recommended change**

Real links: hub, features, pricing, resources, about, contact, legal — with descriptive, varied anchors.

**Implementation**

Homepage nav renders HEADER_LINKS (Product, Pricing, Resources, About); hero secondary CTA links the hub; new Capabilities section links all five feature pages and the hub; pricing links /pricing; CTA adds the trial; footer renders FOOTER_GROUPS and config contact details (no more mailto About/Contact).

**Files**

- `src/components/landing/LandingPage.tsx`
- `src/features/marketing/config/navigation.ts`

**Verification**

- HomePage.test.tsx asserts hub, pricing, every feature page, /contact and /about are linked and #platform is gone
- Crawl: /contact now reachable from /

### SEO-025

**Contact details are inconsistent across the site**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | verified |
| Category | local |
| Intent | navigational |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:23:33Z |
| Completed | 2026-10-01T18:23:33Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

Footer: 'Colombo, Sri Lanka' plus coordinates and mailto:founder@metric.lk. Contact page: Kotte postal address, support@ and privacy@metricgymos.com, +94 70 437 9967. Support hours (Mon–Sun 08:00–22:00) appear only inside the authenticated app.

**Evidence**

- src/components/landing/LandingPage.tsx footer; src/app/contact/page.tsx; src/app/(dashboard)/support/page.tsx line 85.

**Recommended change**

One site config (features/marketing/config/site.ts) for name, legal name, address, phone, emails and hours, consumed by footer, contact, about and Organization schema.

**Implementation**

features/marketing/config/site.ts is the single source for name, legal name, Kotte address, phone, emails and support hours; consumed by the homepage footer, marketing footer, /contact, /about and Organization JSON-LD. The off-domain founder@metric.lk mailto and the Colombo coordinates are gone.

**Files**

- `src/features/marketing/config/site.ts`
- `src/features/marketing/components/MarketingFooter.tsx`
- `src/app/(marketing)/contact/page.tsx`
- `src/components/landing/LandingPage.tsx`

**Verification**

- structured-data.test.ts asserts Organization email/telephone/address equal the config printed on /contact

### SEO-026

**Retired domain metricgymmanager.com is still indexed with stale claims**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | blocked |
| Category | off-site |
| Intent | navigational |
| External action | required |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T17:40:00Z |
| Completed | — |
| Dependencies | SEO-036 |

**Target queries**

- `metric gym manager`
- `metric gym os`

**Finding**

A search for '"Metric Gym OS" gym management' returns https://www.metricgymmanager.com/ titled 'Metric Gym Manager' with a cached snippet claiming '25+ gyms', '7.9K+ active members', '99.99% uptime', Hikvision/RFID/face access and multi-location features. The domain already 308-redirects to www.metricgymos.com.

**Evidence**

- WebSearch (US index, not google.lk) 2026-10-01.
- Vercel project domains: metricgymmanager.com and www.metricgymmanager.com redirect 308 to www.metricgymos.com.

**Recommended change**

Verify both domains in Google Search Console and file a Change of Address from metricgymmanager.com to metricgymos.com; keep the 308s permanently; re-check the snippet after recrawl.

**Implementation**

—

**Files**

- —

**Verification**

- Not yet verified

### SEO-028

**No Organization or WebSite structured data**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | verified |
| Category | schema |
| Intent | navigational |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:23:33Z |
| Completed | 2026-10-01T18:23:33Z |
| Dependencies | SEO-025 |

**Target queries**

- `metric gym os`

**Finding**

No JSON-LD anywhere, so the brand/company relationship (Metric Gym OS, operated by Capitalist One (Pvt) Ltd, Kotte, Sri Lanka) is not stated in machine-readable form.

**Evidence**

- Production HTML contains no application/ld+json.

**Recommended change**

Organization (name, legalName, url, logo, email, telephone, address, contactPoint) and WebSite with stable @id values, emitted from the site config so they always match visible text.

**Implementation**

Organization (name, legalName, url, logo, email, telephone, PostalAddress, areaServed LK, ContactPoint with hours) and WebSite with stable @ids on every public page via StructuredData.

**Files**

- `src/features/marketing/utils/structured-data.ts`
- `src/features/marketing/components/StructuredData.tsx`

**Verification**

- Crawl: every marketing page's JSON-LD parses and contains Organization + WebSite + WebPage
- structured-data.test.ts
- Not run through Google's Rich Results Test — the tool's host is outside this environment's network allow-list; do it after deploy

### SEO-029

**SoftwareApplication structured data with LKR offers**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | verified |
| Category | schema |
| Intent | commercial |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:23:33Z |
| Completed | 2026-10-01T18:23:33Z |
| Dependencies | SEO-019 |

**Target queries**

- `gym management software sri lanka`
- `gym management system sri lanka`
- `gym software sri lanka`

**Finding**

The product is not described as software anywhere in structured data.

**Evidence**

- Google's software-app rich result requires a rating or review; Metric has none it can honestly mark up.

**Recommended change**

SoftwareApplication (BusinessApplication, web browser) with three Offers from the pricing config. No aggregateRating or review — the rich result will not appear, but the entity and prices are stated accurately.

**Implementation**

SoftwareApplication (BusinessApplication, Web browser) with three LKR Offers + UnitPriceSpecification per month, on /, the hub and /pricing; no rating or review.

**Files**

- `src/features/marketing/utils/structured-data.ts`

**Verification**

- structured-data.test.ts: offers equal PRICING_TIERS, no aggregateRating/review

### SEO-035

**No analytics event for demo requests**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | implemented |
| Category | measurement |
| Intent | transactional |
| External action | required |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T21:29:53Z |
| Completed | — |
| Dependencies | — |

**Target queries**

- —

**Finding**

GA4 (G-D711W4RE25) loads sitewide but the demo form fires no conversion event, so organic landing pages cannot be tied to leads.

**Evidence**

- src/app/layout.tsx gtag config; src/components/landing/DemoModal.tsx posts to /api/public/leads with no gtag call.

**Recommended change**

Fire GA4's recommended generate_lead event after a successful submission (no personal data in the event); mark it as a key event in GA4 (external).

**Implementation**

src/lib/analytics/gtag.ts trackEvent(); DemoModal fires GA4 'generate_lead' with { form: 'demo_request', interest } after a successful submission — no personal data.

**Files**

- `src/lib/analytics/gtag.ts`
- `src/components/landing/DemoModal.tsx`
- `src/components/landing/__tests__/DemoModal.test.tsx`

**Verification**

- type-check and lint pass; event delivery cannot be observed without GA access — confirm in GA4 DebugView after deploy and mark generate_lead as a key event
- DemoModal.test.tsx: generate_lead fires once, only after /api/public/leads returns success, with { form, interest } and no name, email or phone; three mutations (call removed, email added to params, call moved before the response check) each fail it
- Not verified end to end: delivery to GA4 needs the property (SEO-036 owner) — confirm in DebugView after deploy and mark generate_lead as a key event

### SEO-038

**Partner citation from VFT Holdings**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | blocked |
| Category | off-site |
| Intent | commercial |
| External action | required |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T17:40:00Z |
| Completed | — |
| Dependencies | — |

**Target queries**

- `gym access control system sri lanka`
- `gym management system sri lanka`

**Finding**

VFT Holdings — Metric's access-control hardware partner — ranks for gym-management queries in Sri Lanka with its own gym solution page.

**Evidence**

- Search index: vftholdings.lk/Gym_Management_solution_sri_lanka.php appears for 'gym access control system Sri Lanka fingerprint membership' and 'fitnessx.lk "Sri Lanka's smart gym management system"'.

**Recommended change**

Ask VFT to list Metric Gym OS as compatible membership software on that page, linking to /features/access-control.

**Implementation**

—

**Files**

- —

**Verification**

- Not yet verified

### SEO-046

**Measurement plan**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | verified |
| Category | measurement |
| Intent | none |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T22:20:00Z |
| Completed | 2026-10-01T22:20:00Z |
| Dependencies | — |

**Target queries**

- `gym management software sri lanka`
- `gym management system sri lanka`
- `gym software sri lanka`
- `gym management software colombo`
- `gym membership software sri lanka`
- `gym billing software sri lanka`

**Finding**

There is no written plan for what to measure once Search Console is connected.

**Evidence**

- No measurement documentation in docs/.

**Recommended change**

SEO_AUDIT.md §Measurement: query set, KPIs, segmentation (branded vs non-branded), cadence, and what not to claim.

**Implementation**

SEO_AUDIT.md §17: Search Console Domain-property setup, Change of Address, GA4 linking and redaction check; the brief's six core queries plus cluster and brand queries; KPIs (indexed pages, impressions, clicks, CTR, average position, landing pages, branded vs non-branded, conversions, AI features); weekly/monthly/quarterly cadence; a list of claims not to make. Executing it needs SEO-036.

**Files**

- `docs/seo/SEO_AUDIT.md`

**Verification**

- Checked §17 against brief §19: all six core queries and all nine measures are present (scripted string check, 0 missing)
- The conversion it relies on exists: generate_lead fires after a stored demo request (DemoModal.test.tsx); sign_up is recorded as missing (SEO-056)

### SEO-048

**Design-system TableRow could not render in a Server Component**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | verified |
| Category | technical |
| Intent | none |
| External action | no |
| Created | 2026-10-01T18:24:04Z |
| Updated | 2026-10-01T18:24:04Z |
| Completed | 2026-10-01T18:24:04Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

TableRow attached an onKeyDown handler to every row, interactive or not. A function on a host element cannot cross a Server Component render, so the first static page using a DS table (/resources/billed-vs-collected-revenue) failed `next build` with 'Event handlers cannot be passed to Client Component props'.

**Evidence**

- next build prerender error on /resources/billed-vs-collected-revenue: {…, onKeyDown: function onKeyDown, …}

**Recommended change**

Attach the key handler only when the row is interactive or a handler was supplied.

**Implementation**

src/components/ui/primitives/Table.tsx: handleKeyDown is undefined for static rows; interactive rows unchanged.

**Files**

- `src/components/ui/primitives/Table.tsx`
- `src/components/ui/__tests__/feedback.test.tsx`

**Verification**

- feedback.test.tsx asserts a static row has no onKeyDown/tabIndex and a clickable row keeps both; mutation (always attach) turns it red
- next build passes; DataTable suites (51 tests) pass

### SEO-056

**Trial sign-ups are not measured, and the page after sign-up puts the email address in its URL**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | implemented |
| Category | measurement |
| Intent | transactional |
| External action | required |
| Created | 2026-10-01T21:45:00Z |
| Updated | 2026-10-02T15:36:21Z |
| Completed | — |
| Dependencies | — |

**Target queries**

- —

**Finding**

'Start free trial' is the call to action on every public page, but registration fires no analytics event, so organic landing pages cannot be tied to trials. After a successful sign-up the register page navigates to /verify-email?email=<address>. GA4 is loaded on every route with a plain config call; if the web stream's enhanced measurement counts history changes as page views (GA4's default) and email redaction is not on, that URL — with the address in it — reaches Google Analytics as page_location.

**Evidence**

- src/app/(auth)/register/page.tsx: POST /api/auth/register, then router.push(`/verify-email?email=${encodeURIComponent(email)}`)
- src/app/layout.tsx: gtag('config', 'G-D711W4RE25') on every route; no sign_up event anywhere in src/
- The GA4 stream's enhanced-measurement and data-redaction settings are not visible from the repository

**Recommended change**

Owner, in GA4 now: check Admin → Data streams → web stream → Redact data → Email is on. Then, as one reviewed change to the auth flow (rule 2.15 governs it): fire GA4's recommended sign_up event with { method: 'email' } after a successful registration, mark it as a key event, and stop carrying the address in the URL (the verify-email page can show it from session state). Not changed in this pass: the registration flow is product code with its own tests and rules, outside the public-site scope.

**Implementation**

register/page.tsx fires GA4's recommended sign_up event with { method: 'email' } only after /api/auth/register returns success, then hands the address to /verify-email through this tab's sessionStorage (features/auth/utils/pendingVerificationEmail.ts, a client-safe deep import over the fail-safe @/lib/client-state wrappers) and navigates to plain /verify-email. The verify page reads the address from that storage and no longer reads ?email= at all. Signup creates no session, so router.push stays (rule 2.15: not an auth-boundary navigation). If storage is unavailable, the resend field starts empty and the user types the address.

**Files**

- `src/app/(auth)/register/page.tsx`
- `src/app/(auth)/verify-email/page.tsx`
- `src/features/auth/utils/pendingVerificationEmail.ts`
- `src/features/auth/utils/pendingVerificationEmail.test.ts`
- `src/app/(auth)/register/__tests__/RegisterPage.test.tsx`
- `src/app/(auth)/verify-email/__tests__/VerifyEmailPage.test.tsx`

**Verification**

- Jest: the register, verify-email and pendingVerificationEmail suites pass (31 tests); the full suite passes 195 suites and 2,375 tests (7 skipped), with tsc as pretest, lint 0 errors (the same 11 warnings, none in touched files) and arch:check passing
- Eight mutations, each caught by a named test: the address back in the push URL; the sign_up call deleted; the email added to the event params; sign_up moved before the response check; the verify page reading ?email= again; the verify page no longer reading storage; the module switched to localStorage; the module reading storage unguarded
- Chromium via Playwright against next dev, with /api/auth/register and GA's /g/collect stubbed: after sign-up the URL is exactly /verify-email and the address (owner+probe@example.lk) is echoed; GA received one sign_up hit carrying ep.method=email; none of the 4 collect requests contained the address raw or URL-encoded; the address survives a reload at 390 and at 1366 with no console errors and 0 px horizontal overflow; screenshots reviewed
- Not verified: delivery to the live GA4 property. Owner: mark sign_up as a key event and confirm it in DebugView after deploy, then this task can be marked verified

### SEO-059

**GA4 receives one-time auth tokens: the full URL of /reset-password and /verify-email links, token included**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | implemented |
| Category | measurement |
| Intent | none |
| External action | required |
| Created | 2026-10-02T15:36:21Z |
| Updated | 2026-10-02T16:25:08Z |
| Completed | — |
| Dependencies | — |

**Target queries**

- —

**Finding**

GA4 is configured on every route in the root layout and sends the full page URL, query string included, as page_location (dl). Password-recovery links land on /reset-password?token_hash=…&type=recovery, and that page spends the token only when the form is submitted (rule 2.15), so a still-valid recovery token reaches Google Analytics on every reset visit. Anyone who can read the GA4 property's page_location before the token expires could use it to set the account's password. Email-change links (/verify-email?type=email_change&token_hash=…) send their token the same way, although that one is spent on load. Contentsquare, when NEXT_PUBLIC_ENABLE_ANALYTICS is on, also records URLs. Found while verifying SEO-056.

**Evidence**

- Chromium via Playwright against next dev (2026-10-02), GA's /g/collect intercepted and stubbed: loading /reset-password?token_hash=PROBETOKEN0001&type=recovery produced a collect hit whose dl was that exact URL; loading /verify-email?type=email_change&token_hash=PROBETOKEN0002 did the same (the API it calls was stubbed so no real token was spent)
- src/app/layout.tsx: gtag('config', 'G-D711W4RE25') with no page_location override, rendered for every route including (auth)
- supabase/templates/recovery.html and rule 2.15: the recovery link carries token_hash to /reset-password, which makes no Supabase call until submit

**Recommended change**

Owner, in GA4 now (no deploy needed): Admin → Data streams → the web stream → Redact data → turn on query-parameter redaction for token_hash, token, code and email. Then, as one reviewed change: stop sending auth query strings to analytics at all, either by setting a sanitised page_location in the gtag config (strip token_hash, token, code, type) or by not loading GA on the (auth) routes, with a test that fails if a token-bearing URL reaches gtag. Check Contentsquare's URL masking before NEXT_PUBLIC_ENABLE_ANALYTICS is turned on.

**Implementation**

src/lib/analytics/ga-init.ts gaInitScript() is now the only GA bootstrap; the root layout renders it as one inline afterInteractive Script, in place of the raw gtag.js Script and inline config. It always defines dataLayer and gtag, so trackEvent() stays a no-op, then returns before loading anything when the URL has a token_hash, token, code or email query parameter or a path under /join/. Otherwise it runs the standard snippet: js, config G-D711W4RE25, and an async gtag.js. The check runs at document load, which is enough because every credential URL arrives by a full page load (email link, QR scan, pasted link) and none is reachable by in-app navigation; the JSDoc says the rule must move if that changes. Rule 2.23 records the invariant. Contentsquare is unchanged: it is off in production (NEXT_PUBLIC_ENABLE_ANALYTICS=false) and needs URL masking checked before it is turned on.

**Files**

- `src/lib/analytics/ga-init.ts`
- `src/lib/analytics/__tests__/ga-init.test.ts`
- `src/app/layout.tsx`
- `.claude/rules/architecture.md`

**Verification**

- ga-init.test.ts runs the generated script at global scope, as a browser runs an inline script: six credential URLs (recovery token_hash and token, email-change token_hash, PKCE code, email, /join/tok_abc) leave no config and no gtag.js; six ordinary URLs (/, /pricing, /register, /verify-email, /login?redirect=, /joinery) get exactly one config and one gtag.js; and a source check holds the layout to gaInitScript() with no raw googletagmanager.com or gtag('config')
- Seven mutations, each caught: token_hash removed from the list, path-prefix check removed, query guard inverted, config before the guard, script injected before the guard, prefix loosened to /join, raw gtag.js Script re-added to the layout
- Full suite 196 suites and 2,388 tests passed (7 skipped), with tsc as pretest; lint 0 errors (the same 11 warnings); arch:check passes
- Chromium via Playwright against next dev, every Google request recorded: /reset-password?token_hash=…&type=recovery, /verify-email?type=email_change&token_hash=… and /join/tok_probe made 0 requests to Google and rendered normally; / and /pricing loaded gtag.js and sent page_view; the stubbed register flow still sent sign_up
- Not verified: the live GA4 property. Owner, as defence in depth: GA4 → Admin → Data streams → Redact data → query parameters token_hash, token, code, email

### SEO-062

**Two public pages said QR self-registrations wait for staff before counting as paid; they are created active with the payment recorded**

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | verified |
| Category | trust |
| Intent | none |
| External action | no |
| Created | 2026-10-03T01:03:38Z |
| Updated | 2026-10-03T01:03:38Z |
| Completed | 2026-10-03T01:03:38Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

/features/membership-management said self-registered members carry a NEW badge 'until your staff confirm them, so nobody is treated as a paid member before they have paid', and the hub said 'Self-registrations wait with a NEW badge until your staff confirm them.' The code does otherwise. POST /api/public/registrations creates the member at once through RegisterMember: status active, initial payment recorded, welcome SMS sent. Verifying (/api/members/[id]/verify) only sets verified_at, which clears the badge (registration_source === 'qr' && !verified_at) and changes nothing else. Rule 2.23: public copy states only what the code does.

**Evidence**

- src/app/api/public/registrations/route.ts header: 'the member is created immediately (active, initial payment recorded, welcome SMS sent — the desk collects the cash right after) with registration_source='qr', which renders as a NEW badge until the gym verifies the entry'
- src/features/members/components/MemberPhotoSection.tsx: isNew = member.registration_source === 'qr' && !member.verified_at
- src/app/api/members/[id]/verify/route.ts: 'Marks a QR self-registered member as verified (clears the NEW badge)'

**Recommended change**

Say what happens: the record is created as soon as the member submits, active and with the payment recorded, so the desk takes the money straight away; the NEW badge marks entries staff have not yet verified.

**Implementation**

membership-management: the sentence now reads that the record is created as soon as they submit — active, with the payment recorded and a welcome SMS sent — so take the money at the desk straight away, and that self-registered members carry a NEW badge until staff verify the entry. Hub: 'A self-registration is created straight away, with the payment recorded, and carries a NEW badge until your staff verify it.' Both pages' lastModified moved to 2026-10-03.

**Files**

- `src/app/(marketing)/features/membership-management/page.tsx`
- `src/app/(marketing)/gym-management-software-sri-lanka/page.tsx`
- `src/features/marketing/config/pages.ts`

**Verification**

- next start on a production build: both pages render the corrected sentence, and neither contains the old wording ('nobody is treated as a paid member', 'wait with a NEW badge')
- MarketingPages and pages suites pass for both pages

### SEO-010

**Authenticated route groups have no defensive noindex**

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | verified |
| Category | technical |
| Intent | none |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T21:29:53Z |
| Completed | 2026-10-01T21:29:53Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

Workspace and admin routes are protected by middleware (307 to /login), which is correct, but nothing would keep one out of the index if a route were ever served without a session.

**Evidence**

- src/app/(dashboard)/layout.tsx and src/app/(admin)/layout.tsx export no metadata.

**Recommended change**

metadata.robots = { index: false, follow: false } on the (dashboard), (admin) and (dev) layouts.

**Implementation**

robots noindex,nofollow metadata on the (dashboard), (admin) and new (dev) layouts.

**Files**

- `src/app/(dashboard)/layout.tsx`
- `src/app/(admin)/layout.tsx`
- `src/app/(dev)/layout.tsx`
- `src/features/marketing/tests/metadata.test.ts`

**Verification**

- type-check and build pass; not rendered here because every route needs a session (middleware answers 307 → /login)
- metadata.test.ts 'signed-in route groups' pins robots { index: false, follow: false } on the (dashboard), (admin) and (dev) layouts; mutation (admin → index: true) fails it
- Local production build, Googlebot UA: /dashboard, /members and /design-system answer 307 → /login, so no signed-in route is crawlable; the noindex is the second line for a route ever served without a session

### SEO-022

**Resources hub with two first-party articles**

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | verified |
| Category | content |
| Intent | informational |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:23:12Z |
| Completed | 2026-10-01T18:23:12Z |
| Dependencies | — |

**Target queries**

- `gym membership renewal reminders`
- `when to send gym payment reminders`
- `gym revenue tracking`
- `billed vs collected revenue gym`

**Finding**

No informational content exists. Generic articles would add nothing; Metric's own product rules (reminder timing by plan length, billed-vs-collected revenue) are original, verifiable knowledge.

**Evidence**

- src/features/sms/config/ReminderConfig.ts; docs/architecture/revenue-billing-model.md.

**Recommended change**

/resources plus two articles written from those rules, each linking to the relevant feature page. No blog engine, no bulk content.

**Implementation**

/resources index and two articles written from Metric's own rules: renewal reminder timing by plan length; billed vs collected revenue (worked example computed from labelled illustrative inputs). Article JSON-LD with dates.

**Files**

- `src/app/(marketing)/resources/page.tsx`
- `src/app/(marketing)/resources/membership-renewal-reminders/page.tsx`
- `src/app/(marketing)/resources/billed-vs-collected-revenue/page.tsx`

**Verification**

- Render test suite; crawl 200; Article node present

### SEO-027

**Unreferenced public images expose an old UI, the old brand and personal data**

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | verified |
| Category | technical |
| Intent | none |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:23:33Z |
| Completed | 2026-10-01T18:23:33Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

public/screenshots/*.png show the retired light 'Metric Gym Manager' UI including an owner email address and member phone numbers; public/david.png and public/yaka.jpg are unreferenced. Everything in /public is served and crawlable (Google Images).

**Evidence**

- grep -rn 'screenshots/|david.png|yaka.jpg' src scripts returns no references.
- public/screenshots/member-directory.png visibly contains an email address and phone numbers.

**Recommended change**

Delete the unreferenced images.

**Implementation**

Deleted public/screenshots/* (old light UI with an email address and phone numbers), public/david.png, public/yaka.jpg and public/linkPreviewLogo.png — all unreferenced.

**Files**

- `public/screenshots/ (deleted)`
- `public/david.png (deleted)`
- `public/yaka.jpg (deleted)`
- `public/linkPreviewLogo.png (deleted)`

**Verification**

- grep finds no reference in src, scripts or the service-worker generator
- Local build: /screenshots/member-directory.png and /linkPreviewLogo.png → 404

### SEO-030

**BreadcrumbList on subpages and Article on resources**

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | verified |
| Category | schema |
| Intent | none |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:23:33Z |
| Completed | 2026-10-01T18:23:33Z |
| Dependencies | SEO-012 |

**Target queries**

- —

**Finding**

Subpages need a stated position in the hierarchy; articles need dates and publisher.

**Evidence**

- None of these pages exist yet.

**Recommended change**

Visible breadcrumbs mirrored by BreadcrumbList; Article with datePublished/dateModified and Organization author/publisher.

**Implementation**

Visible breadcrumbs (DS Breadcrumb primitives) mirrored by BreadcrumbList from the same trail; Article with datePublished/dateModified, Organization author/publisher on both articles; WebPage on every page.

**Files**

- `src/features/marketing/components/MarketingBreadcrumbs.tsx`
- `src/features/marketing/utils/structured-data.ts`

**Verification**

- MarketingPages.test.tsx checks BreadcrumbList length equals the visible trail on every page

### SEO-037

**Google Business Profile eligibility**

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | blocked |
| Category | local |
| Intent | navigational |
| External action | required |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T17:40:00Z |
| Completed | — |
| Dependencies | — |

**Target queries**

- `metric gym os`

**Finding**

A profile would strengthen the entity in Sri Lankan results, but Google's guidelines require in-person contact with customers at the address or a service area.

**Evidence**

- Google Business Profile guidelines (eligibility).

**Recommended change**

Owner decides eligibility; if eligible, create the profile with exactly the NAP in features/marketing/config/site.ts.

**Implementation**

—

**Files**

- —

**Verification**

- Not yet verified

### SEO-039

**Software directories and review profiles**

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | blocked |
| Category | off-site |
| Intent | commercial |
| External action | required |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T17:40:00Z |
| Completed | — |
| Dependencies | — |

**Target queries**

- `gym management software sri lanka`
- `gym management system sri lanka`
- `gym software sri lanka`

**Finding**

GymMaster has Capterra and SoftwareAdvice profiles; local competitors appear in Sri Lankan directories. Metric has no third-party profiles found in the search index.

**Evidence**

- Search index results for GymMaster (capterra.com/p/57469/GymMaster/, softwareadvice.com).

**Recommended change**

List Metric on relevant software directories with consistent NAP; collect genuine reviews from real customers (never incentivised fake reviews).

**Implementation**

—

**Files**

- —

**Verification**

- Not yet verified

### SEO-042

**Real case studies and first-party data content**

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | blocked |
| Category | content |
| Intent | informational |
| External action | required |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T17:40:00Z |
| Completed | — |
| Dependencies | SEO-022 |

**Target queries**

- `gym membership renewal sri lanka`
- `gym payment collection sri lanka`

**Finding**

Fitconnect's strongest content is original local data. Metric holds anonymisable aggregate data (reminder delivery outcomes, renewal timing) that no competitor can copy.

**Evidence**

- src/features/sms (sms_logs delivery statuses); revenue and analytics features.

**Recommended change**

Owner approval and customer consent, then publish an aggregate, anonymised study and one or two named case studies.

**Implementation**

—

**Files**

- —

**Verification**

- Not yet verified

### SEO-044

**Lab performance check of public pages**

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | verified |
| Category | performance |
| Intent | none |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T21:29:53Z |
| Completed | 2026-10-01T18:23:33Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

Public pages are statically prerendered (fast TTFB) but no lab numbers exist for LCP/CLS/TBT.

**Evidence**

- next build: '/' and the legal pages are static (○).

**Recommended change**

Run Lighthouse against a local production build for '/', the hub and /pricing; record the numbers in SEO_AUDIT.md.

**Implementation**

Lighthouse 12 (mobile, simulated throttling) against the local production build.

**Files**

- —

**Verification**

- /: performance 91, accessibility 92, best practices 96, SEO 100, LCP 3.3 s, CLS 0, TBT 130 ms
- Hub: 92/93/96/100, LCP 3.3 s, CLS 0
- /pricing: 93/93/96/100, LCP 3.0 s, CLS 0
- Caveats: sandbox font mock serves unsubsetted .woff and GA is blocked, so LCP is overstated vs production; LCP element is text, 86% render delay — measure real users with PageSpeed Insights/CrUX after deploy
- Re-run on a fresh build after the accessibility fixes (warm server, same settings): / 94 and 95 / 96 / 96 / 100, LCP 2.9 s, CLS 0, TBT 50–140 ms; hub 92 / 100 / 96 / 100, LCP 3.3 s; /pricing 96 / 100 / 96 / 100, LCP 2.6 s. A first, cold-server run of / scored 82 (LCP 4.5 s) and is not counted
- Best practices 96 everywhere = one console error: the sandbox proxy refuses the GA script (ERR_TUNNEL_CONNECTION_FAILED); not a site defect
- Largest remaining opportunity: about 255 KiB of unused JavaScript per page, recorded as SEO-055

### SEO-049

**Homepage overflowed a 320 px viewport**

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | verified |
| Category | technical |
| Intent | none |
| External action | no |
| Created | 2026-10-01T18:24:04Z |
| Updated | 2026-10-01T18:24:04Z |
| Completed | 2026-10-01T18:24:04Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

At 320 px the platform grid's columns took the min-content width of the nowrap log lines (362 px), so the whole page scrolled sideways — a mobile-usability defect. The longest line before this change ('RETRY … carrier timeout') was as long, so the pattern predates the copy changes.

**Evidence**

- Chromium at 320 px: documentElement.scrollWidth 378 vs clientWidth 320; widest unclipped elements were #platform-grid children (362 px)

**Recommended change**

min-width:0 on the grid items so the code block's own horizontal scroll and ellipsis take over.

**Implementation**

LandingPage.tsx mobile CSS: #platform-grid > div gains min-width:0.

**Files**

- `src/components/landing/LandingPage.tsx`

**Verification**

- Overflow sweep of 13 public pages at 1366/1024/768/430/390/360/320 px: no page wider than its viewport

### SEO-050

**In-text links relied on colour alone; footer contact links below 24 px**

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | verified |
| Category | on-page |
| Intent | none |
| External action | no |
| Created | 2026-10-01T18:24:04Z |
| Updated | 2026-10-01T21:29:53Z |
| Completed | 2026-10-01T18:24:04Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

Lighthouse flagged link-in-text-block (links distinguishable only by colour, WCAG 1.4.1) on the new pages and the homepage capabilities intro, and target-size on the footer phone/email links (20 px line boxes, adjacent).

**Evidence**

- Lighthouse 12 accessibility audits on the local build: link-in-text-block (4 on the hub, 1 on /), target-size (2 on the hub)

**Recommended change**

Underline in-text links by default; give the footer contact links a 24 px inline-block box.

**Implementation**

Prose, FAQ, About principles and section-intro links underlined; MarketingFooter tel/mailto links inline-block leading-6; homepage capabilities link underlined.

**Files**

- `src/features/marketing/components/MarketingSection.tsx`
- `src/features/marketing/components/FaqSection.tsx`
- `src/features/marketing/components/MarketingFooter.tsx`
- `src/app/(marketing)/about/page.tsx`
- `src/components/landing/LandingPage.tsx`

**Verification**

- Lighthouse re-run on a fresh build: link-in-text-block and target-size no longer reported on /, the hub or /pricing
- Accessibility: hub 93 → 100, /pricing 93 → 100, / 92 → 96; the only remaining failure on / is color-contrast inside the decorative dashboard preview (SEO-051)

### SEO-054

**Record the public-site rules where future work will find them**

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | verified |
| Category | architecture |
| Intent | none |
| External action | no |
| Created | 2026-10-01T18:24:04Z |
| Updated | 2026-10-01T21:29:53Z |
| Completed | 2026-10-01T21:29:53Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

Nothing in the rulebook says a public page must be registered, listed in PUBLIC_ROUTES and statically rendered, or that the root layout must not set a canonical — the two mistakes most likely to undo this work silently.

**Evidence**

- docs/architecture/feature-first-growth-rules.md and .claude/rules/architecture.md predate the marketing feature

**Recommended change**

A Pattern Index row (2.23) pointing at docs/seo/SEO_AUDIT.md; add docs/seo/ to the documented docs taxonomy.

**Implementation**

Pattern Index row 2.23 in .claude/rules/architecture.md (registry + PUBLIC_ROUTES, static public pages, no canonical in the root layout, canonical origin, published pricing source, claims policy, task log); docs/seo/ added to docs/README.md and the docs taxonomy in feature-first-growth-rules.md; marketing/ added to the CLAUDE.md feature map

**Files**

- `.claude/rules/architecture.md`
- `docs/README.md`
- `docs/architecture/feature-first-growth-rules.md`
- `CLAUDE.md`

**Verification**

- npm run arch:check passes, including UI7 (no unescaped pipe drops a Pattern Index cell)
- Row 2.23 is the last row of the table and names docs/seo/SEO_AUDIT.md as its reference

### SEO-055

**Every public page ships the chart library it never uses**

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | implemented |
| Category | performance |
| Intent | none |
| External action | no |
| Created | 2026-10-01T21:30:00Z |
| Updated | 2026-10-02T16:47:44Z |
| Completed | — |
| Dependencies | — |

**Target queries**

- —

**Finding**

Lighthouse reports about 255 KiB of unused JavaScript on each public page. The largest chunk (637 KiB raw, 182 KiB transferred, 176 KiB unused) holds recharts and sonner and loads on /, the hub, /pricing and /login alike; a second (245 KiB raw, 52 KiB unused) holds the Supabase client, react-query, the service-worker registration and AuthRecovery. Likely cause: the root layout imports Toaster through the @/components/ui barrel, which re-exports the 'use client' Charts module, and Next includes every client module a server component's import graph reaches. /login reaches the barrel only through the root layout. Not confirmed by experiment.

**Evidence**

- Lighthouse 12 unused-javascript audit on the hub (fresh local build, 2026-10-01)
- Chunk contents by string search: 0xj4tltvcl4no.js has 102 recharts and 126 sonner references; it is in the HTML of /, /pricing, /login and the hub
- src/app/layout.tsx imports { Toaster } from '@/components/ui'; src/components/ui/index.ts has export * from './primitives/Charts'

**Recommended change**

A design-system decision, not an SEO one: the DS contract requires barrel imports ('always the barrel, never a deep path'), so the fix belongs in the barrel — e.g. move Charts to its own entry point (@/components/ui/charts) or stop re-exporting it from the main barrel — then confirm with a build that recharts leaves the public pages. Separately, consider mounting QueryProvider and AuthRecovery in the signed-in layouts rather than the root. Measure before and after; lab scores are already 92–96, so the benefit is data cost and main-thread time on mobile, not a ranking lever by itself.

**Implementation**

Charts moved to their own design-system barrel, src/components/ui/charts/index.ts, and the main @/components/ui barrel no longer re-exports them. Cause, confirmed from the 23 September production build: the main barrel's export * of the 'use client' Charts module, which imports recharts at module scope, put a 638 KB chunk into every page that imported any primitive, and the root layout's Toaster import made that every page. The four chart consumers (DashboardClient, RevenuePageClient, MemberAnalyticsClient, the dev design-system page) import chart symbols from @/components/ui/charts. arch:check UI4 now reads both barrels so a chart fork is still flagged. DESIGN_SYSTEM.md §3 and rule 2.17 record the exception and its reason. The second chunk the audit named (Supabase client, react-query, service-worker registration, AuthRecovery on public pages) is SEO-060.

**Files**

- `src/components/ui/charts/index.ts`
- `src/components/ui/index.ts`
- `src/components/ui/__tests__/charts-entry.test.ts`
- `src/app/(dashboard)/dashboard/DashboardClient.tsx`
- `src/app/(dashboard)/revenue/RevenuePageClient.tsx`
- `src/features/analytics/components/MemberAnalyticsClient.tsx`
- `src/app/(dev)/design-system/page.tsx`
- `scripts/check-architecture.mjs`
- `.claude/DESIGN_SYSTEM.md`
- `.claude/rules/architecture.md`

**Verification**

- Production builds (next build, Turbopack) before and after, JS each page loads summed from its prerendered HTML or its client reference manifest, gzip -9: /, the hub and /pricing 465.0 → 344.9 KB; /login 468.3 → 348.3 KB; /register 468.9 → 348.8 KB (−120 KB, −26%); recharts references 102 → 0 on all five. Chart pages keep recharts in their own 419 KB chunk: /dashboard 492.7 → 489.9 KB, /revenue 451.8 → 449.0 KB, /member-analytics 452.3 → 449.5 KB
- charts-entry.test.ts: the main barrel loads without evaluating recharts (a jest.doMock factory flag), @/components/ui/charts serves all seven chart components and CHART_SERIES, and the main barrel no longer exposes them. Three mutations, each caught: Charts re-exported from the main barrel, one chart symbol re-exported, a barrel primitive importing recharts
- arch:check UI4: a probe feature-local `export function Sparkline()` fails UI4 with the change; without the new dsNames line, UI4 misses it
- Full suite 197 suites and 2,391 tests passed (7 skipped), with tsc as pretest; lint 0 errors; arch:check passes
- Rendered on next start with the after build, signed in as the seeded E2E Enterprise gym (read-only): /dashboard's bar chart and /member-analytics' trend line, year-over-year bars and at-risk bars draw, matching a capture of the HEAD build taken the same way; /revenue renders its chart surface. /design-system returns 404 under next start (development-only), so it was not checked

### SEO-057

**Every WebPage node claimed to be about the product, on pages that never describe it**

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | verified |
| Category | schema |
| Intent | none |
| External action | no |
| Created | 2026-10-01T22:05:00Z |
| Updated | 2026-10-01T22:05:00Z |
| Completed | 2026-10-01T22:05:00Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

webPageJsonLd() set about → #software on every public page, but only /, the hub and /pricing include the SoftwareApplication node. On the other ten pages the reference pointed at an entity absent from the graph, and on the contact page and the guides it asserted a subject the visible page does not have — against the component's own rule that every @id resolves inside the page's graph.

**Evidence**

- src/features/marketing/utils/structured-data.ts webPageJsonLd(): about: { '@id': SOFTWARE_ID } unconditionally
- Rendered graphs of the 12 marketing pages: 10 referenced https://www.metricgymos.com/#software without defining it

**Recommended change**

Set about only when the subject is in the graph and on the page: the product where the SoftwareApplication node (and its prices) is present, the Organization on /about, nothing elsewhere.

**Implementation**

webPageJsonLd(path, about?) emits about only when given; StructuredData passes SOFTWARE_ID when the page includes the SoftwareApplication node, ORGANIZATION_ID on /about, nothing otherwise. ORGANIZATION_ID, WEBSITE_ID and SOFTWARE_ID exported from the marketing barrel.

**Files**

- `src/features/marketing/utils/structured-data.ts`
- `src/features/marketing/components/StructuredData.tsx`
- `src/features/marketing/index.ts`
- `src/app/(marketing)/__tests__/MarketingPages.test.tsx`

**Verification**

- New test 'references only entities defined in its own graph' failed on 10 of 12 marketing pages before the fix and passes on all 12 after
- New test pins the subject: product on the hub and /pricing, company on /about, none on /features/sms-reminders and the reminders guide
- Mutations each fail the suite: about → product on every page (11 failures), about never set (1), /about not about the company (1)

### SEO-061

**Guide: overdue gym memberships — when to expire, when to cancel**

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | verified |
| Category | content |
| Intent | informational |
| External action | no |
| Created | 2026-10-02T18:11:31Z |
| Updated | 2026-10-02T18:11:31Z |
| Completed | 2026-10-02T18:11:31Z |
| Dependencies | — |

**Target queries**

- `gym membership grace period`
- `when to cancel an unpaid gym membership`
- `overdue gym members`
- `gym membership expired what to do`

**Finding**

SEO_AUDIT.md §8 lists four buying and switching guides built on product facts. Overdue memberships was written first because every claim in it traces to code: no-grace expiry (StatusConfig, update-expired-status), cancellation 14 days after the due date (MEMBER_CANCELLATION_OVERDUE_DAYS), late payments dated from the payment day (CollectPayment), expired members still billable and cancelled ones not (rule 2.22), reactivation with a welcome-back SMS, and readers that block on cancel and restore on return (rule 2.20).

**Evidence**

- docs/seo/SEO_AUDIT.md §8 item 3: 'Overdue memberships: when to expire, when to cancel (Metric's no-grace expiry and 14-day cancellation rules)'

**Recommended change**

Publish the guide at /resources/overdue-gym-memberships, with its timeline derived from the product's own constants, and link it from /resources, the payment-collection page, the reminders guide and the footer.

**Implementation**

src/app/(marketing)/resources/overdue-gym-memberships/page.tsx: Article page in the reminders guide's pattern (MarketingHero, MarketingSection, Prose, RelatedPages, Article + BreadcrumbList JSON-LD, buildPageMetadata). Its worked timeline is computed from REMINDER_RULES[Monthly], MEMBER_CANCELLATION_OVERDUE_DAYS and calculateNextDueDate, so it cannot drift from the product. Registry entry and ARTICLE_PATHS.overdue in features/marketing/config/pages.ts (the /resources description now names three guides); PUBLIC_ROUTES entry; body links from /features/payment-collection and the reminders guide; footer Resources link; added to the MarketingPages screen-test table. Left out on purpose: suspension (it does not pause the clock and Metric has no freeze) and the dashboard's >14-day 'critical' tier.

**Files**

- `src/app/(marketing)/resources/overdue-gym-memberships/page.tsx`
- `src/features/marketing/config/pages.ts`
- `src/features/marketing/config/navigation.ts`
- `src/lib/auth-config.ts`
- `src/app/(marketing)/features/payment-collection/page.tsx`
- `src/app/(marketing)/resources/membership-renewal-reminders/page.tsx`
- `src/app/(marketing)/__tests__/MarketingPages.test.tsx`

**Verification**

- Jest: the registry, public-route and MarketingPages suites pass for the new page (one H1, registered metadata, JSON-LD graph, links that resolve, heading outline, linked from another page); removing the path from PUBLIC_ROUTES fails pages.test; full suite 197 suites and 2,400 tests passed (7 skipped), with tsc as pretest; lint 0 errors; arch:check passes
- next build prerenders /resources/overdue-gym-memberships as static. On next start: 200, one H1, self canonical https://www.metricgymos.com/resources/overdue-gym-memberships, no robots meta, title 'Overdue Gym Members: When to Expire or Cancel | Metric Gym OS', JSON-LD Organization, WebSite, WebPage, BreadcrumbList, Article; sitemap.xml has 17 <loc> including the guide; /resources, /features/payment-collection, the reminders guide and the footer link it; a vercel.app host gets X-Robots-Tag: noindex
- Chromium at 1366, 390 and 320: 0 px horizontal overflow, no page errors; full-page screenshots and the timeline table at 320 read by eye. The timeline shows 12 Nov reminder, 15 Nov due-date SMS, 16 Nov expired, 16–28 Nov follow-up, 29 Nov cancelled, payment on 20 Nov → next due 20 Dec
- Not verified: indexing or ranking (needs Search Console, SEO-036)

### SEO-063

**Guide: moving a gym's members off a register book or spreadsheet**

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | verified |
| Category | content |
| Intent | informational |
| External action | no |
| Created | 2026-10-03T01:03:38Z |
| Updated | 2026-10-03T01:03:38Z |
| Completed | 2026-10-03T01:03:38Z |
| Dependencies | — |

**Target queries**

- `move gym members to software`
- `gym register book to software`
- `import gym members from excel`
- `switch gym management software sri lanka`

**Finding**

The second guide from SEO_AUDIT.md §8, built on the real bulk-entry and QR self-registration flows. The facts that shape the advice: registration creates the member active, sets the next due date as start date + plan period, and records the first payment on the start date (RegisterMember); every added member gets a welcome SMS that does not name the gym; there is one member per mobile number (ConflictError), and only Sri Lankan mobiles are accepted; the bulk API takes at most 50 rows per submission; every new row counts as active against the plan limit (Lite 100); QR sign-ups are created active with the payment recorded and carry a NEW badge until verified.

**Evidence**

- docs/seo/SEO_AUDIT.md §8 item 3: 'Moving a gym from a register book or spreadsheet (the real bulk entry and QR self-registration flows)'

**Recommended change**

Publish a step-by-step guide that says which date to enter (the last payment), what members receive, the batch size and the plan limit, and the QR route for new members.

**Implementation**

src/app/(marketing)/resources/move-gym-members-from-register-book/page.tsx: Article page in the guide pattern. The worked example's next due date is computed with calculateNextDueDate, the sample welcome SMS is formatted with formatDateForDisplay (the SMS's own formatter), and the Lite limit comes from LITE_MEMBER_LIMIT. Registry entry ARTICLE_PATHS.move; the /resources description now names four guides; PUBLIC_ROUTES entry; body link from /features/membership-management; footer Resources link; added to the MarketingPages screen-test table.

**Files**

- `src/app/(marketing)/resources/move-gym-members-from-register-book/page.tsx`
- `src/features/marketing/config/pages.ts`
- `src/features/marketing/config/navigation.ts`
- `src/lib/auth-config.ts`
- `src/app/(marketing)/features/membership-management/page.tsx`
- `src/app/(marketing)/__tests__/MarketingPages.test.tsx`

**Verification**

- Jest: the registry, public-route and MarketingPages suites pass for the new page; removing the path from PUBLIC_ROUTES fails pages.test; full suite 197 suites and 2,409 tests passed (7 skipped), with tsc as pretest; lint 0 errors; arch:check passes
- next build prerenders the page as static. On next start: 200, one H1, self canonical, indexable, title 'How to Move Your Gym's Members into Software | Metric Gym OS', JSON-LD Organization, WebSite, WebPage, BreadcrumbList, Article; sitemap.xml has 18 <loc> including it; linked from /resources, /features/membership-management and the footer
- The sample welcome SMS renders as 'Welcome to our gym, Nimal! Your monthly membership is active. Amount paid: Rs.4000.00. Next due: 20/10/2026. Thank you!', and the prose dates as 20 September → 20 October
- Chromium at 1366, 390 and 320: 0 px horizontal overflow, no page errors; the 1366 screenshot read by eye
- Not verified: indexing or ranking (needs Search Console, SEO-036)

### SEO-064

**Guide: Excel and WhatsApp vs gym management software, written honestly**

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | verified |
| Category | content |
| Intent | commercial |
| External action | no |
| Created | 2026-10-03T01:47:17Z |
| Updated | 2026-10-03T01:47:17Z |
| Completed | 2026-10-03T01:47:17Z |
| Dependencies | — |

**Target queries**

- `gym management excel vs software`
- `manage gym members whatsapp`
- `gym software vs spreadsheet`
- `do I need gym management software`

**Finding**

The third guide from SEO_AUDIT.md §8, the 'whether to switch' page: 'Running a gym on Excel and WhatsApp vs dedicated software — written honestly, since Metric sends SMS, not WhatsApp.' Metric has no WhatsApp sender, no inbound SMS (the text.lk webhook carries delivery receipts only), no online member payments, no member app, no class booking or check-in, no Sinhala or Tamil interface, and one login per gym (rule 2.20). SMS reminders, receipts and announcements are included in every plan.

**Evidence**

- docs/seo/SEO_AUDIT.md §8 item 3
- src/app/__tests__/HomePage.test.tsx pins /whatsapp/i off the homepage because no WhatsApp sender exists

**Recommended change**

Publish a comparison that concedes what a spreadsheet and WhatsApp do well, says where they break, states each Metric difference as a product fact, explains SMS vs WhatsApp with the trade-off, quotes prices from the pricing config, says when a spreadsheet is still enough, and lists what Metric does not do.

**Implementation**

src/app/(marketing)/resources/excel-whatsapp-vs-gym-software/page.tsx: Article page in the guide pattern; prices, the Lite limit and the trial length are rendered from PRICING_TIERS, LITE_MEMBER_LIMIT and TRIAL_DAYS. Registry entry ARTICLE_PATHS.compare, with the navigation and breadcrumb label 'Spreadsheet vs gym software': the footer is on the homepage, whose /whatsapp/i pin is deliberately blunt, so the label avoids the word rather than the pin being weakened. The /resources description names five guides. PUBLIC_ROUTES entry; body link from /features/sms-reminders (Delivery section); footer Resources link. MarketingPages.test.tsx: the page is in the screen-test table, plus three tests — it says 'sends SMS, not WhatsApp', never claims WhatsApp delivery (three patterns), and quotes every plan price from the pricing config.

**Files**

- `src/app/(marketing)/resources/excel-whatsapp-vs-gym-software/page.tsx`
- `src/features/marketing/config/pages.ts`
- `src/features/marketing/config/navigation.ts`
- `src/lib/auth-config.ts`
- `src/app/(marketing)/features/sms-reminders/page.tsx`
- `src/app/(marketing)/__tests__/MarketingPages.test.tsx`

**Verification**

- Four mutations, each caught by a named test: the path removed from PUBLIC_ROUTES; 'Metric sends WhatsApp reminders too' added; the 'sends SMS, not WhatsApp' sentence removed; a price typed instead of read from the config. The homepage's /whatsapp/i pin caught the first draft's footer label, which led to the relabel
- Full suite 197 suites and 2,423 tests passed (7 skipped), with tsc as pretest; lint 0 errors; arch:check passes
- next build prerenders the page as static. On next start: 200, one H1, self canonical, indexable, title 'Excel and WhatsApp vs Gym Management Software | Metric Gym OS', JSON-LD Organization, WebSite, WebPage, BreadcrumbList, Article; prices on the page LKR 2,990, 4,990 and 6,990; sitemap.xml has 19 <loc>; linked from /resources, /features/sms-reminders and the footer on every page
- Chromium at 1366, 390 and 320: 0 px horizontal overflow, no page errors; the 1366 screenshot read by eye
- Not verified: indexing or ranking (needs Search Console, SEO-036)

### SEO-031

**FAQPage structured data**

| Field | Value |
| --- | --- |
| Priority | P3 |
| Status | rejected |
| Category | schema |
| Intent | informational |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T17:40:00Z |
| Completed | 2026-10-01T17:40:00Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

Considered for the hub and pricing FAQs.

**Evidence**

- Google limits FAQ rich results to well-known authoritative government and health sites (Search Central, FAQPage documentation).

**Recommended change**

Rejected: keep visible FAQ sections for people and for AI features that read indexed text; do not add FAQPage markup that cannot produce a result.

**Implementation**

—

**Files**

- —

**Verification**

- Not yet verified

### SEO-032

**LocalBusiness structured data**

| Field | Value |
| --- | --- |
| Priority | P3 |
| Status | rejected |
| Category | schema |
| Intent | navigational |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T17:40:00Z |
| Completed | 2026-10-01T17:40:00Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

Considered for local relevance.

**Evidence**

- Metric is software sold to gyms; its Kotte address is a registered office, not premises customers visit. Google's LocalBusiness markup describes a physical business customers visit.

**Recommended change**

Rejected: use Organization with a PostalAddress instead.

**Implementation**

—

**Files**

- —

**Verification**

- Not yet verified

### SEO-033

**llms.txt or AI-specific markup**

| Field | Value |
| --- | --- |
| Priority | P3 |
| Status | rejected |
| Category | technical |
| Intent | none |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T17:40:00Z |
| Completed | 2026-10-01T17:40:00Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

Considered because AI search visibility is a stated goal.

**Evidence**

- Google Search Central (AI features and your website): AI Overviews and AI Mode use the same index; no special file, markup or schema is required.

**Recommended change**

Rejected: AI-search readiness is handled by crawlable text, clear headings, answer-first sections and accurate structured data.

**Implementation**

—

**Files**

- —

**Verification**

- Not yet verified

### SEO-034

**Mass location pages (Colombo, Kandy, Galle …)**

| Field | Value |
| --- | --- |
| Priority | P3 |
| Status | rejected |
| Category | local |
| Intent | commercial |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T17:40:00Z |
| Completed | 2026-10-01T17:40:00Z |
| Dependencies | — |

**Target queries**

- `gym management software colombo`
- `gym management software western province`

**Finding**

The Colombo query shows no Sri Lankan vendor targeting it, which tempts city pages.

**Evidence**

- No repository or business evidence of which cities Metric's customers are in; a page per city with swapped names is a doorway page under Google's spam policies.

**Recommended change**

Rejected: state the true location once (company based in Kotte, Colombo District) on the hub, about and contact pages. Revisit only with real local customers and city-specific information.

**Implementation**

—

**Files**

- —

**Verification**

- Not yet verified

### SEO-040

**Social and entity profiles**

| Field | Value |
| --- | --- |
| Priority | P3 |
| Status | blocked |
| Category | entity |
| Intent | navigational |
| External action | required |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T17:40:00Z |
| Completed | — |
| Dependencies | — |

**Target queries**

- `metric gym os`

**Finding**

No social profile URLs exist in the repository, so Organization.sameAs cannot be populated.

**Evidence**

- grep for linkedin/facebook/instagram/youtube in src returns no company profile.

**Recommended change**

Create or confirm official profiles; then add them to site.ts sameAs.

**Implementation**

—

**Files**

- —

**Verification**

- Not yet verified

### SEO-041

**Founder and team information**

| Field | Value |
| --- | --- |
| Priority | P3 |
| Status | blocked |
| Category | entity |
| Intent | navigational |
| External action | required |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T17:40:00Z |
| Completed | — |
| Dependencies | SEO-020 |

**Target queries**

- —

**Finding**

The about page can state company facts but not who runs Metric; nothing in the repository identifies the team.

**Evidence**

- No founder or team data in the repository.

**Recommended change**

Owner supplies names, roles and photos with consent; add to /about.

**Implementation**

—

**Files**

- —

**Verification**

- Not yet verified

### SEO-043

**Marketing pages preload a font they do not render**

| Field | Value |
| --- | --- |
| Priority | P3 |
| Status | discovered |
| Category | performance |
| Intent | none |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T17:40:00Z |
| Completed | — |
| Dependencies | — |

**Target queries**

- —

**Finding**

The root layout loads Inter, Geist and Geist Mono for every route; the landing and marketing surfaces render in Geist, so Inter's preload is unused there.

**Evidence**

- Production HTML preloads three woff2 files; .landing-root sets font-family Geist.

**Recommended change**

Measure first; if confirmed, scope Inter to the surfaces that use it. Not changed in this pass (root-layout font changes affect the whole product).

**Implementation**

—

**Files**

- —

**Verification**

- Not yet verified

### SEO-045

**Unknown public-looking paths redirect to /login**

| Field | Value |
| --- | --- |
| Priority | P3 |
| Status | verified |
| Category | technical |
| Intent | none |
| External action | no |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T18:23:33Z |
| Completed | 2026-10-01T18:23:33Z |
| Dependencies | — |

**Target queries**

- —

**Finding**

Any path outside PUBLIC_ROUTES (for example /features) answers 307 to /login?redirect=… for an anonymous visitor rather than a 404, which can be read as a soft 404.

**Evidence**

- src/lib/middleware/auth.ts unauthenticated branch.

**Recommended change**

Add a permanent redirect for /features to the hub (the one path the new URL scheme invites). A general 404 for unknown anonymous paths is a middleware change outside this pass.

**Implementation**

next.config.js permanent redirect /features → /gym-management-software-sri-lanka. The general case (any unknown anonymous path → 307 /login) is unchanged: a middleware change outside this pass.

**Files**

- `next.config.js`

**Verification**

- Local build: GET /features → 308 location /gym-management-software-sri-lanka

### SEO-047

**Sinhala and Tamil content**

| Field | Value |
| --- | --- |
| Priority | P3 |
| Status | discovered |
| Category | content |
| Intent | commercial |
| External action | required |
| Created | 2026-10-01T17:40:00Z |
| Updated | 2026-10-01T17:40:00Z |
| Completed | — |
| Dependencies | — |

**Target queries**

- —

**Finding**

Fitconnect offers Sinhala; Metric's product UI and SMS templates are English only.

**Evidence**

- SMS templates in SendAutomatedReminders.ts and sms.service.ts are English.

**Recommended change**

Only translate marketing pages once the product, SMS and support can serve those languages; otherwise the pages over-promise.

**Implementation**

—

**Files**

- —

**Verification**

- Not yet verified

### SEO-051

**Decorative dashboard preview on the homepage fails colour contrast**

| Field | Value |
| --- | --- |
| Priority | P3 |
| Status | discovered |
| Category | on-page |
| Intent | none |
| External action | no |
| Created | 2026-10-01T18:24:04Z |
| Updated | 2026-10-01T18:24:04Z |
| Completed | — |
| Dependencies | — |

**Target queries**

- —

**Finding**

The hero's mock dashboard uses 10–11 px #5c5c64 labels on black (about 3:1), which Lighthouse counts as 32 contrast failures on '/'. It is decorative, pre-existing and the owner's design.

**Evidence**

- Lighthouse color-contrast audit on /: 32 nodes, all inside the preview mock

**Recommended change**

Lift those labels to #8b8b93, or mark the mock as decorative (aria-hidden) — a design decision for the owner.

**Implementation**

—

**Files**

- —

**Verification**

- Not yet verified

### SEO-052

**Weekly members get their '7 days before' reminder on the day they pay**

| Field | Value |
| --- | --- |
| Priority | P3 |
| Status | discovered |
| Category | trust |
| Intent | none |
| External action | required |
| Created | 2026-10-01T18:24:04Z |
| Updated | 2026-10-01T18:24:04Z |
| Completed | — |
| Dependencies | — |

**Target queries**

- —

**Finding**

REMINDER_RULES gives weekly plans the 7-day reminder, but a weekly period is seven days long, so the 7-days-before date is the payment day itself. The SMS reminders page shows the schedule exactly as the product runs it; the guide article does not recommend it.

**Evidence**

- src/features/sms/config/ReminderConfig.ts PlanType.Weekly reminderDays [7, 3, 0]; SendAutomatedReminders.determineSMSType sends SevenDay at 7 ≤ daysUntilDue < 8

**Recommended change**

Product decision: drop the 7-day reminder for weekly plans (as monthly already does). Update the reminders page table automatically by changing the config.

**Implementation**

—

**Files**

- —

**Verification**

- Not yet verified

### SEO-053

**Automated reminders and receipts do not name the gym**

| Field | Value |
| --- | --- |
| Priority | P3 |
| Status | discovered |
| Category | trust |
| Intent | none |
| External action | required |
| Created | 2026-10-01T18:24:04Z |
| Updated | 2026-10-01T18:24:04Z |
| Completed | — |
| Dependencies | — |

**Target queries**

- —

**Finding**

The sender ID is platform-wide (TEXT_LK_SENDER_ID) and the automated reminder and receipt texts omit the gym's name (the manual-send templates include it), so a member may not know which gym is texting. The public pages quote the real texts and make no 'names your gym' claim.

**Evidence**

- SendAutomatedReminders.generateReminderMessage and CollectPayment.generateReceiptMessage have no gymName; sms.service formatSMSMessage does

**Recommended change**

Product decision: include the gym name in automated reminder and receipt texts.

**Implementation**

—

**Files**

- —

**Verification**

- Not yet verified

### SEO-058

**Seven related-page cards linked the hub with the same exact-match anchor**

| Field | Value |
| --- | --- |
| Priority | P3 |
| Status | verified |
| Category | internal-linking |
| Intent | commercial |
| External action | no |
| Created | 2026-10-01T22:20:00Z |
| Updated | 2026-10-01T22:20:00Z |
| Completed | 2026-10-01T22:20:00Z |
| Dependencies | — |

**Target queries**

- `gym management software sri lanka`

**Finding**

Every feature page and both guides closed with a related card titled 'Gym management software for Sri Lanka' linking the hub — the same exact-match anchor seven times, which the brief asks to avoid and which tells a reader nothing about why to click.

**Evidence**

- Contextual-anchor extraction from the served build: 7× 'Gym management software for Sri Lanka' → /gym-management-software-sri-lanka

**Recommended change**

Give each card a title and summary that say what the hub adds from that page's point of view.

**Implementation**

Seven card titles and summaries rewritten per page (e.g. 'From registration to the door: the full system' on access control, 'A gym management system that does this arithmetic' on the revenue guide).

**Files**

- `src/app/(marketing)/features/membership-management/page.tsx`
- `src/app/(marketing)/features/payment-collection/page.tsx`
- `src/app/(marketing)/features/sms-reminders/page.tsx`
- `src/app/(marketing)/features/revenue-reporting/page.tsx`
- `src/app/(marketing)/features/access-control/page.tsx`
- `src/app/(marketing)/resources/membership-renewal-reminders/page.tsx`
- `src/app/(marketing)/resources/billed-vs-collected-revenue/page.tsx`

**Verification**

- Served build: contextual anchors to the hub are the five-page breadcrumb label plus 13 distinct anchors; none repeated outside the breadcrumb
- No horizontal overflow at 7 widths; the access-control and revenue-guide cards inspected at 320 px

### SEO-060

**Public pages still load the signed-in app's providers: Supabase client, react-query, service-worker registration, AuthRecovery**

| Field | Value |
| --- | --- |
| Priority | P3 |
| Status | discovered |
| Category | performance |
| Intent | none |
| External action | no |
| Created | 2026-10-02T16:47:44Z |
| Updated | 2026-10-02T16:47:44Z |
| Completed | — |
| Dependencies | SEO-055 |

**Target queries**

- —

**Finding**

Split from SEO-055. After the chart library left the public pages, they still load about 345 KB of gzipped JS. A chunk the audit measured at 245 KB raw (52 KB unused) carries the Supabase client, @tanstack/react-query, the service-worker registration and AuthRecovery, all mounted by the root layout for every route. They sit in the root on purpose: AuthRecovery is the hard-navigation escape for a broken session (rule 2.15), and the service worker's single-reload rule (2.19) assumes it runs on every full-document navigation. So moving them is an auth and PWA decision, not a bundle tweak.

**Evidence**

- src/app/layout.tsx mounts QueryProvider, ServiceWorkerRegistration and AuthRecovery around every route, the (marketing) group included
- SEO-055's after-build: / still loads 344.9 KB gzip over 12 chunks with no recharts

**Recommended change**

Measure first: which of these modules the public pages actually execute, and what each costs. Then decide with rules 2.15 and 2.19 in hand whether QueryProvider can move to the signed-in layouts, and whether AuthRecovery and the service-worker registration can load lazily on public routes. Lab scores are already 92–96, so this is a data and main-thread cost on mobile, not a ranking lever.

**Implementation**

—

**Files**

- `src/app/layout.tsx`

**Verification**

- Not yet verified

