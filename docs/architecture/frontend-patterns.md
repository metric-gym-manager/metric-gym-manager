# Frontend Patterns

> On-demand reference. Loaded when working in this area, not auto-injected.
> Governing rules (also indexed in `.claude/rules/architecture.md`):

- **§2.12 Radix hydration** — Radix Select + React 19 `useId()` mismatch is mitigated with targeted `suppressHydrationWarning` in the shared `select.tsx`.
- **§2.15 Auth-boundary navigation** — crossing into/out of an authenticated session (post-login redirect, logout) uses a full-document navigation (`window.location`), never client-side `router.push`/`replace`.

---

### 2.15 Auth-Boundary Navigation Must Be a Full-Document Navigation

**CRITICAL RULE**: When the session was just changed **server-side** — logging in or out goes through the API routes `/api/auth/login` and `/api/auth/logout`, which set/clear the Supabase auth cookies on the response — the follow-up navigation across the auth boundary MUST be a **full-document navigation** (`window.location.assign` / `window.location.replace`). Do **not** use client-side `router.push` / `router.replace` / `router.refresh` to land on `/dashboard` after login or `/login` after logout.

This mirrors the existing hard-navigation escape hatch in `AuthRecovery` (`src/features/auth/components/AuthRecovery.tsx`) and `browser-auth-recovery.ts`, which already `window.location.replace('/login')` to break out of a broken client-side auth state.

#### Symptom (the bug this rule prevents)

Clicking **Sign In** changed the URL to `/login?redirect=%2Fdashboard`, but the screen stayed on the login page with the button stuck on "Signing in…". The dashboard only appeared after a **manual page refresh**. **Log Out** behaved the same way — the authenticated screen lingered until a refresh.

#### Root Cause

1. **The session mutation is server-side, the navigation was client-side.** The login/logout `fetch` sets/clears the auth cookies via `Set-Cookie` on the API response. A subsequent `router.push`/`replace` resolves from the **Next.js App Router Cache** — it does **not** re-run `middleware.ts` (`authMiddleware`) with the freshly-set cookies. The gate that decides "authenticated → dashboard / unauthenticated → login" never re-evaluates, so the view only corrects on a hard refresh (a real server request).

2. **Prefetch cache-poisoning made login deterministically fail.** The login page ran `router.prefetch('/dashboard')` on mount — i.e. **while still signed out**. That prefetch hit the middleware, which returned `307 → /login?redirect=/dashboard`, and Next cached that result for `/dashboard`. After a successful login, `router.push('/dashboard')` then served the **cached redirect** straight back to `/login?redirect=%2Fdashboard` with no server round-trip, leaving `isLoading` (the "Signing in…" state) stuck.

#### ✅ Applied Solution

- **Login** (`src/app/(auth)/login/page.tsx`): removed the on-mount `router.prefetch('/dashboard')` and navigate on success with `window.location.assign(getSafeRedirect(searchParams.get('redirect')))`. Keep `isLoading` true — the full-page navigation unmounts the component.
- **Logout** (`src/components/layout/Header.tsx`, `src/components/layout/Sidebar.tsx`): after `queryClient.clear()`, navigate with `window.location.replace('/login')` so the cleared session is re-evaluated by middleware and the authenticated layout is fully torn down.

#### Open-Redirect Guard: `getSafeRedirect`

The `?redirect=` query param is user-controlled, and the login page navigates to whatever it resolves to — so it MUST be sanitized. `getSafeRedirect` (`src/features/auth/utils/getSafeRedirect.ts`, exported from `@/features/auth`) allows **internal absolute paths only** and falls back to `/dashboard` for everything else:

```ts
getSafeRedirect('/members') // '/members'
getSafeRedirect('/members?x=1') // '/members?x=1'
getSafeRedirect('//evil.com') // '/dashboard'  (protocol-relative → off-site)
getSafeRedirect('https://evil.com') // '/dashboard'  (absolute external URL)
getSafeRedirect('dashboard') // '/dashboard'  (not rooted at '/')
getSafeRedirect(null) // '/dashboard'  (param absent)
```

Unit tests: `src/features/auth/utils/getSafeRedirect.test.ts`.

#### Rules to Follow

- ✅ Cross the auth boundary (login success → app, logout → login) with `window.location.assign`/`replace`.
- ❌ Never `router.push`/`replace` to land on a route whose access depends on a session that was just changed server-side.
- ❌ Never `router.prefetch()` a middleware-guarded route from an unauthenticated page — it caches the login redirect and poisons the destination.
- ✅ Always run a user-supplied `?redirect=` value through `getSafeRedirect` before navigating to it.

> **Note on plain in-app navigation.** This rule is about the **auth boundary**. Ordinary links between already-authenticated pages (the sidebar `<Link>`s, `router.push` within the dashboard) stay client-side — they don't change the session, so the Router Cache is correct for them.

---

### 2.12 Radix UI Select Hydration Pattern (React 19 Incompatibility)

**CRITICAL UNDERSTANDING**: Radix UI Select components have a known React 19 hydration incompatibility due to internal `useId()` usage. This is mitigated with targeted `suppressHydrationWarning` at the component library level.

#### Problem: React 19 + Radix UI `useId()` Incompatibility

**Symptom**:

```
Hydration failed because the server rendered HTML didn't match the client.
Expected: aria-controls="radix-_R_ipaatperaitllb_"
Received: aria-controls="radix-_R_4laatperaitllb_"
```

**Root Cause**:

1. React 19's `useId()` generates IDs based on component tree position
2. Server-side rendering calculates tree position differently than client hydration
3. Radix UI uses `useId()` **internally** to generate ARIA relationship IDs
4. The `aria-controls` attribute value differs between server and client

**Why External ID Props Don't Work**:

- Adding `id` props to `<SelectTrigger>` only affects the trigger's **own** `id` attribute
- It does NOT override Radix UI's **internal** `useId()` call for `aria-controls`
- The hydration mismatch persists because Radix UI's internal logic is unchanged

#### ✅ APPLIED SOLUTION: Targeted Hydration Suppression

**Location**: `src/components/ui/select.tsx` (shared component library)

**Implementation**:

```tsx
const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(...)}
    suppressHydrationWarning  // ⚠️ Suppresses aria-controls mismatch only
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
```

**Why This Is Safe**:

- ✅ **Targeted**: Only suppresses warnings on SelectTrigger element itself
- ✅ **Functional**: The `aria-controls` mismatch is presentation-only, not functional
- ✅ **Accessibility**: Screen readers only use client-rendered values (which are correct)
- ✅ **SEO**: Search engines don't parse ARIA attributes
- ✅ **Centralized**: Applied once, affects all 22 Select instances globally
- ✅ **Reversible**: Can be removed when Radix UI releases React 19 fix

#### Affected Components (22 Total)

All Radix UI `<Select>` components across 10 files:

- RegularPaymentTable.tsx (2 selects)
- PaymentCollectedTable.tsx (1 select)
- PaymentRemindersTable.tsx (2 selects)
- MembersTable.tsx (6 selects - desktop + mobile variants)
- RevenuePageClient.tsx (3 selects)
- PaymentCollectionModal.tsx (1 select)
- AddMemberModal.tsx (2 selects)
- EditMemberModal.tsx (2 selects)
- PlanTypesTab.tsx (1 select)
- ReminderStatusTable.tsx (2 selects)

#### Alternative Solutions Considered

| Solution                  | Status            | Reason Rejected                                                      |
| ------------------------- | ----------------- | -------------------------------------------------------------------- |
| **Add explicit ID props** | ❌ Tested, Failed | Only affects trigger's `id`, not internal `aria-controls` generation |
| **Upgrade Radix UI**      | ❌ Investigated   | No fix available as of 2026-04-19                                    |
| **Downgrade to React 18** | ❌ Rejected       | Loses React 19 features                                              |
| **Disable SSR**           | ❌ Rejected       | Loses SEO and performance                                            |
| **Custom Select**         | ❌ Rejected       | Large refactor, loses accessibility features                         |

#### Exit Strategy: Monitor for Upstream Fix

**Track Issue**:

- Repository: https://github.com/radix-ui/primitives/issues
- Search: "React 19 useId hydration"

**When Fix Available**:

1. Check Radix UI release notes
2. Test upgrade in development
3. Remove `suppressHydrationWarning` from `src/components/ui/select.tsx:25`
4. Verify no hydration errors in console
5. Deploy to production

#### Impact Assessment

**Before Fix**:

- ❌ 22 hydration errors per page load
- ❌ Console pollution obscuring real errors
- ❌ React DevTools warnings
- ❌ Poor developer experience

**After Fix**:

- ✅ Zero hydration warnings
- ✅ Clean console output
- ✅ No functional regressions
- ✅ No accessibility regressions
- ✅ No SEO impact

**Risk Level**: 🟢 **Low** (cosmetic fix for presentation-only issue)

**Key Lesson**: When third-party libraries have internal `useId()` incompatibilities with React 19 SSR, and no external API exists to override the behavior, targeted `suppressHydrationWarning` is an acceptable temporary mitigation until upstream fix is available.
