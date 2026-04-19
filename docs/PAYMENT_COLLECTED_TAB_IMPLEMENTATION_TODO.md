# Payment Collected Tab - Implementation Checklist

**Feature**: Add "Payment Collected" subtab to `/payment-collection` page
**Estimated Time**: 2.5 hours
**Status**: Not Started

---

## Step 1: Create API Endpoint (45 min)

**File**: `src/app/api/payment-collection/collected/route.ts` (NEW)

### Tasks
- [ ] Create new file `src/app/api/payment-collection/collected/route.ts`
- [ ] Import required dependencies (NextRequest, NextResponse, getCurrentGymProfile, createClient)
- [ ] Implement GET handler with query parameter parsing (month, planType, search)
- [ ] Add month format validation (YYYY-MM regex)
- [ ] Implement `getCurrentMonth()` helper function
- [ ] Implement `getMonthDateRange()` helper function
- [ ] Build Supabase query with payments + members JOIN
- [ ] Add gym_id filter for multi-tenant isolation
- [ ] Add date range filters (gte/lte payment_date)
- [ ] Add plan type filter (conditional)
- [ ] Add order by payment_date DESC
- [ ] Transform data to include both camelCase and snake_case fields
- [ ] Implement client-side search filtering (name or phone)
- [ ] Implement `calculateSummaryMetrics()` helper function
- [ ] Calculate totalRevenue (sum of amount_paid)
- [ ] Calculate paymentCount (array length)
- [ ] Calculate revenueByPlanType (group by plan_type)
- [ ] Return standardized response format: `{ success: true, data: { ... } }`
- [ ] Add error handling for unauthorized (401)
- [ ] Add error handling for general errors (500)
- [ ] Test endpoint with Thunder Client/Postman

---

## Step 2: Create Component (60 min)

**File**: `src/components/payment-collection/PaymentCollectedTable.tsx` (NEW)

### Tasks
- [ ] Create new file `src/components/payment-collection/PaymentCollectedTable.tsx`
- [ ] Add 'use client' directive
- [ ] Import required dependencies (useState, useQuery, useMemberModal, UI components, utils)
- [ ] Define TypeScript interfaces (PaymentCollectedRow, PaymentCollectedSummary, CollectedPaymentsResponse)
- [ ] Initialize state: month (default: current month)
- [ ] Initialize state: planType (default: 'all')
- [ ] Initialize state: search (default: '')
- [ ] Implement `getCurrentMonth()` helper function
- [ ] Set up React Query with queryKey ['payment-collected', month, planType, search]
- [ ] Implement queryFn to fetch from API endpoint
- [ ] Add error state rendering (red alert banner)
- [ ] Build Summary Metrics Banner (green gradient)
- [ ] Add Total Revenue metric with Banknote icon
- [ ] Add Payment Count metric with Users icon
- [ ] Add Revenue Breakdown metric with TrendingUp icon
- [ ] Build Filters section (3 controls in flex container)
- [ ] Add Month picker (HTML5 input type="month")
- [ ] Add Plan Type dropdown (Select component with 7 options)
- [ ] Add Search input (text input with placeholder)
- [ ] Add "Showing X payments" counter
- [ ] Build Table structure (7 columns)
- [ ] Add table headers (Payment Date, Member Name, Phone, Plan Type, Amount Paid, Discount, Next Due Date)
- [ ] Map payments to table rows
- [ ] Add onClick handler to open member modal
- [ ] Format payment date with formatDate()
- [ ] Add plan type badge with getPlanBadgeColor()
- [ ] Format amount paid (Rs. X.XX)
- [ ] Display discount (name + percentage) or "—"
- [ ] Format next due date with formatDate()
- [ ] Add loading state (centered "Loading payments...")
- [ ] Add empty state ("No payments collected this month")
- [ ] Add hover styles (cursor-pointer, hover:bg-gray-50)

---

## Step 3: Update Tab System (15 min)

**File**: `src/app/(dashboard)/payment-collection/PaymentCollectionPageClient.tsx` (MODIFY)

### Tasks
- [ ] **Line 15**: Change Tab type from `'reminders' | 'regular'` to `'reminders' | 'regular' | 'collected'`
- [ ] **Line 7-13**: Add dynamic import for PaymentCollectedTable
  ```typescript
  const PaymentCollectedTable = dynamic(
    () => import('@/components/payment-collection/PaymentCollectedTable'),
    { ssr: false, loading: () => <div className="h-64 animate-pulse rounded bg-gray-100" /> }
  );
  ```
- [ ] **After line 45**: Add new "Collected" tab button (copy Regular Payments button pattern)
- [ ] Update activeTab check for "Collected" button
- [ ] Add border-blue-600 styling for active state
- [ ] Add border-transparent for inactive state
- [ ] **After line 59**: Add conditional render `{activeTab === 'collected' && <PaymentCollectedTable />}`

---

## Step 4: Update Query Invalidation (5 min)

**File**: `src/components/payment-collection/RegularPaymentTable.tsx` (MODIFY)

### Tasks
- [ ] **Line 96-101**: Update queryClient.invalidateQueries predicate
- [ ] Add `query.queryKey[0] === 'payment-collected'` to the OR condition
- [ ] Verify existing predicates remain intact (regular-payments, members, sms-reminders)

---

## Testing Checklist

### Manual Testing
- [ ] Navigate to `/payment-collection` page
- [ ] Verify "Collected" tab appears alongside Regular Payments and Reminders
- [ ] Click "Collected" tab - verify it renders without errors
- [ ] Verify summary metrics display (Total Revenue, Payment Count, Revenue Breakdown)
- [ ] Change month picker - verify data refreshes
- [ ] Change plan type filter - verify filtering works
- [ ] Type in search box (member name) - verify filtering works
- [ ] Type in search box (phone number) - verify filtering works
- [ ] Click a payment row - verify member detail modal opens
- [ ] Select a month with no payments - verify empty state shows
- [ ] Check loading state by throttling network in DevTools
- [ ] Go to Regular Payments tab
- [ ] Click "Mark Paid" on a member
- [ ] Go to Collected tab - verify new payment appears (query invalidation)

### API Testing (Thunder Client/Postman)
- [ ] Test `GET /api/payment-collection/collected` (no params) - should return current month
- [ ] Test with `?month=2024-03` - should return March 2024 data
- [ ] Test with `?month=invalid` - should return 400 error
- [ ] Test with `?planType=monthly` - should filter to monthly plans only
- [ ] Test with `?search=John` - should filter to members with "John" in name
- [ ] Test with `?search=0771234567` - should filter by phone number
- [ ] Test without auth - should return 401 error
- [ ] Test with valid auth - should return 200 with data
- [ ] Verify response includes both camelCase and snake_case fields
- [ ] Verify summary.totalRevenue is sum of all amount_paid
- [ ] Verify summary.paymentCount matches payments.length
- [ ] Verify summary.revenueByPlanType groups correctly

### Code Quality Checks
- [ ] Run `npm run type-check` - no TypeScript errors
- [ ] Run `npm run lint` - no ESLint warnings
- [ ] Check for console.log statements - remove debugging logs
- [ ] Verify all imports are used
- [ ] Verify no unused variables
- [ ] Check file formatting (Prettier)

---

## Success Criteria

- [x] ✅ Requirements met: Current month display, summary metrics, filters, search
- [x] ✅ Follows existing patterns: API structure, component structure, tab system
- [x] ✅ Multi-tenant safe: Always filters by `gym_id`
- [x] ✅ Auto-refresh: Invalidates query after payment collection
- [x] ✅ No breaking changes: Existing tabs still work correctly
- [ ] All manual tests pass
- [ ] All API tests pass
- [ ] Code quality checks pass

---

## Notes

- **No database migrations required** - uses existing `payments` table
- **Follows `regular-payments` pattern** - same error handling, same response format
- **Multi-tenant isolation enforced** - filters by `gym_id` from session
- **Date formatting** - YYYY-MM-DD for business dates, formatDate() for display
- **Field naming** - includes both camelCase and snake_case for compatibility

---

## Rollback Plan (If Issues Arise)

1. Delete `src/app/api/payment-collection/collected/route.ts`
2. Delete `src/components/payment-collection/PaymentCollectedTable.tsx`
3. Revert changes to `PaymentCollectionPageClient.tsx` (Tab type + imports + render)
4. Revert changes to `RegularPaymentTable.tsx` (query invalidation)
5. Run `npm run type-check` to verify no broken references

---

**Last Updated**: 2026-04-17
**Tracking**: This file should be checked off as implementation progresses
