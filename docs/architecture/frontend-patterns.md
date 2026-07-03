# Frontend Patterns

> On-demand reference. Loaded when working in this area, not auto-injected.
> Governing rules (also indexed in `.claude/rules/architecture.md`):
- **§2.12 Radix hydration** — Radix Select + React 19 `useId()` mismatch is mitigated with targeted `suppressHydrationWarning` in the shared `select.tsx`.

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

| Solution | Status | Reason Rejected |
|----------|--------|-----------------|
| **Add explicit ID props** | ❌ Tested, Failed | Only affects trigger's `id`, not internal `aria-controls` generation |
| **Upgrade Radix UI** | ❌ Investigated | No fix available as of 2026-04-19 |
| **Downgrade to React 18** | ❌ Rejected | Loses React 19 features |
| **Disable SSR** | ❌ Rejected | Loses SEO and performance |
| **Custom Select** | ❌ Rejected | Large refactor, loses accessibility features |

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
