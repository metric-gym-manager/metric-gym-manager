# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]

### Added

- add PWA support with install button on landing page ([a5ae374](../../commit/a5ae374))
- complete Phases 4-8 implementation with full feature set ([45f661c](../../commit/45f661c))
- migrate entire application from PostgreSQL+JWT to Supabase ([b270ebc](../../commit/b270ebc))
- initial commit - Phase 1 MVP implementation ([8c50266](../../commit/8c50266))

### Fixed

- **auth**: persist sessions across deployments and implement remember-me ([65a4437](../../commit/65a4437))
- remove unused OTP feature and fix failing tests ([fc4612f](../../commit/fc4612f))
- update all login redirects to correct /members route ([82082ee](../../commit/82082ee))
- correct navigation routes and remove duplicate placeholder pages ([c5770b2](../../commit/c5770b2))
- rename UI components to lowercase for case-sensitive filesystems ([1bc1b34](../../commit/1bc1b34))
- resolve Next.js 16 compatibility issues ([9c3f2c8](../../commit/9c3f2c8))

### Performance

- aggressive caching strategy and Lighthouse performance optimization ([e6d7b23](../../commit/e6d7b23))
