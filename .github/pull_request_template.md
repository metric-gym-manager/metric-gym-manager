## What

<!-- One sentence: what changed and why. -->

## Type

- [ ] `feat` — new feature (minor bump)
- [ ] `fix` — bug fix (patch bump)
- [ ] `feat!` / `fix!` — breaking change (major bump)
- [ ] `refactor` / `test` / `docs` / `chore` — no version bump

## Scope

<!-- Which feature domain(s) does this touch? -->
<!-- members | payments | subscriptions | sms | auth | announcements | registration | revenue | settings | lib | utils | components | db -->

## Changes

## <!-- Bullet list of concrete changes. One line per file group or concern. -->

## Architecture checklist

- [ ] Business logic lives in `src/features/<domain>/services/`, not in route handlers
- [ ] Route handler does: auth → Zod validation → one `create<UseCase>()` call → `ResponseBuilder` response
- [ ] No raw `any` types — used `unknown` and narrowed, or a Zod schema
- [ ] New API inputs validated with Zod; enum fields use `z.nativeEnum()` (not a duplicate `z.enum()`)
- [ ] New tables/columns have RLS enabled with appropriate policies
- [ ] New UI uses DS primitives/composites (`@/components/ui`, `@/components/common/composites`) — no one-off forks
- [ ] Auth-boundary navigation uses `window.location.assign/replace`, not `router.push`

## Tests

- [ ] Unit tests added/updated for new business logic
- [ ] Integration or E2E tests added for new API routes or critical flows
- [ ] `npm test` passes locally

## Migration

<!-- Delete if no DB changes -->

- Migration file: `supabase/migrations/<timestamp>_<name>.sql`
- RLS policies included: yes / no
- Backwards-compatible: yes / no — if no, explain:

## Screenshots / recordings

<!-- Delete if backend-only. Show before/after for any UI change. -->
