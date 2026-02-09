7. Documentation Requirements
7.1 README.md Template
markdown# [Project Name]

## Quick Start
1. Clone repo: `git clone ...`
2. Copy `.env.example` to `.env` and fill in values
3. Install: `npm install`
4. Run migrations: `npm run db:migrate`
5. Start dev server: `npm run dev`

## Architecture
- **Frontend**: Next.js 14 with App Router
- **Database**: PostgreSQL via Supabase
- **Auth**: Supabase Auth with RLS

## Key Features
- [Feature 1]: Description
- [Feature 2]: Description

## Project Structure
See `/docs/architecture.md`

## Testing
- Run tests: `npm test`
- Coverage: `npm run test:coverage`

## Deployment
See `/docs/deployment.md`
7.2 Code Documentation Standards
All complex functions must include JSDoc:
typescript/**
 * Processes a member check-in and validates subscription status.
 * 
 * @param memberId - UUID of the member checking in
 * @param locationId - UUID of the gym location
 * @returns Check-in record with timestamp
 * @throws {SubscriptionExpiredError} If member's subscription is not active
 * @throws {NotFoundError} If member or location doesn't exist
 * 
 * @example
 * const checkIn = await processCheckIn('123e4567-...', '987fbc97-...');
 */
export async function processCheckIn(
  memberId: string,
  locationId: string
): Promise<CheckInRecord> {
  // Implementation
}
7.3 CHANGELOG.md
Maintain a running log:
markdown# Changelog

## [1.2.0] - 2024-02-09
### Added
- Stripe subscription webhook handling
- Member check-in API with geolocation

### Fixed
- RLS policy for trainer role (#42)

### Changed
- Migrated from Prisma to Drizzle ORM