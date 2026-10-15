# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **SaaS Free/Pro subscription billing via PayHere** — Free tier (50-member
  limit) and Pro tier (unlimited members, monthly recurring billing):
  - Subscription page under Settings with plan comparison, upgrade flow,
    cancel flow (retains Pro until period end), billing history, and a
    past-due grace banner
  - PayHere Recurring checkout with signed hand-off and synchronous,
    idempotent webhook processing (always-200 contract)
  - Gateway cancellation via the PayHere OAuth Subscription Manager API
  - Race-free member quota enforced by a `FOR UPDATE`-locked database
    function wired into the existing registration path (403
    `MEMBER_LIMIT_REACHED` with an inline upgrade prompt)
  - Nightly dunning cron: 7-day grace after failed charges, then downgrade
    to Free — members are never deleted
  - Admin billing-failures panel on the system-health dashboard
- add PWA support with install button on landing page ([a5ae374](../../commit/a5ae374))
- complete Phases 4-8 implementation with full feature set ([45f661c](../../commit/45f661c))
- migrate entire application from PostgreSQL+JWT to Supabase ([b270ebc](../../commit/b270ebc))
- initial commit - Phase 1 MVP implementation ([8c50266](../../commit/8c50266))

### Changed

- **auth**: the gym profile is now created immediately at registration so
  users can log in before verifying their email; unverified users see a
  dismissible verification banner with a resend action

### Fixed

- **auth**: persist sessions across deployments and implement remember-me ([65a4437](../../commit/65a4437))
- remove unused OTP feature and fix failing tests ([fc4612f](../../commit/fc4612f))
- update all login redirects to correct /members route ([82082ee](../../commit/82082ee))
- correct navigation routes and remove duplicate placeholder pages ([c5770b2](../../commit/c5770b2))
- rename UI components to lowercase for case-sensitive filesystems ([1bc1b34](../../commit/1bc1b34))
- resolve Next.js 16 compatibility issues ([9c3f2c8](../../commit/9c3f2c8))

### Performance

- aggressive caching strategy and Lighthouse performance optimization ([e6d7b23](../../commit/e6d7b23))

## [1.5.0] - 2026-10-15

### Added

- After a power cut, use Repair fingerprints on the Door Access page to bring every member's fingerprint back. ([3234972](../../commit/3234972))
- You can now record a member's consent for a fingerprint that was added at the reader. ([18eedc0](../../commit/18eedc0))
- Members can now register a second fingerprint, and each finger is kept. ([25a828c](../../commit/25a828c))

### Fixed

- Confirmation boxes no longer occasionally ignore your click while the page refreshes behind them. ([22d231e](../../commit/22d231e))

## [1.4.0] - 2026-10-10

### Fixed

- The Door Access page now shows how many members each reader holds. ([dbc4952](../../commit/dbc4952))
- If a paid-up member is turned away at the door, their access is sent to the readers again automatically. ([44c5315](../../commit/44c5315))
- Re-send to readers now also repairs fingerprints a reader has lost. ([44ba97b](../../commit/44ba97b))
- Reader serial numbers are now checked against your VFT account when you add a reader. ([7bb7d6e](../../commit/7bb7d6e))
- If the door system rejects your VFT login, the Access Control settings now say so. ([22230af](../../commit/22230af))
- Registering a fingerprint now finishes in about 30 seconds and confirms itself when the member scans. ([6fbdeb0](../../commit/6fbdeb0))
- Removing a member's fingerprint now deletes it everywhere, and it cannot come back without asking the member again. ([fd86dbc](../../commit/fd86dbc))
- Fingerprints keep working after a reader is restarted from the Door Access page. ([d470244](../../commit/d470244))
- Newly registered fingerprints now open the door on the first scan. ([f9f9a91](../../commit/f9f9a91))

## [1.3.1] - 2026-10-07

### Fixed

- "Free up space" no longer suggests buying another reader when the reader's capacity has not been set. ([0e7c99d](../../commit/0e7c99d))
- The "Re-send to readers" button on a member's door access now always sends their access to every reader again. ([ee799c2](../../commit/ee799c2))

## [1.3.0] - 2026-10-07

### Added

- Our emails to you now fit a phone screen, with no words broken onto odd lines. ([b6d7d65](../../commit/b6d7d65))

## [1.2.2] - 2026-10-06

_Behind-the-scenes improvements only: nothing changes in how you use Metric Gym OS._

## [1.2.1] - 2026-10-06

_Behind-the-scenes improvements only: nothing changes in how you use Metric Gym OS._

## [1.2.0] - 2026-10-06

_Behind-the-scenes improvements only: nothing changes in how you use Metric Gym OS._

## [1.1.1] - 2026-10-06

_Behind-the-scenes improvements only: nothing changes in how you use Metric Gym OS._

## [1.1.0] - 2026-10-06

### Added

- We’ll now email you a short summary whenever Metric Gym OS gets new features or fixes, so you always know what has changed. ([fd4294c](../../commit/fd4294c))
