# Gym Management SaaS - Implementation Plan

## Progress Overview
- ✅ **Phase 0: UI Foundation** - Complete (shadcn/ui + 9 components)
- ✅ **Phase 1: Database Schema** - Complete (7 tables + RLS + helpers)
- ✅ **Phase 2: Authentication** - Complete (Login, Register, OTP, Password Reset)
- ✅ **Phase 3: Dashboard Layout** - Complete (Sidebar, Header, Navigation, Placeholder Pages)
- ✅ **Phase 4: Members Tab** - Complete (CRUD, payments, status management)
- ✅ **Phase 5: Revenue Tab** - Complete (Analytics dashboard with charts)
- ✅ **Phase 6: Payment Collection Tab** - Complete (Overdue tracking, payment collection)
- ✅ **Phase 7: Automated SMS Reminders** - Complete (Cron jobs + text.lk integration)
- ✅ **Phase 8: Settings Tab** - Complete (Gym info, plans, discounts, security) - 2026-02-13
- 🚧 **Phase 9: Testing & QA** - In Progress
- ⏳ **Phase 10: Deployment** - Pending

## Project Overview
Build a complete Gym Management SaaS platform for Sri Lankan gyms with member management, automated SMS reminders, payment tracking, and revenue analytics. Single-tenant architecture (one admin per gym) using Next.js 16, Supabase, and text.lk SMS integration.

## Current State
- ✅ Fresh Next.js 16 + React 19 + TypeScript project
- ✅ Supabase configured (client + server utilities)
- ✅ Tailwind CSS, ESLint, Prettier, testing frameworks ready
- ✅ **Database schema complete** - 7 tables with RLS and helper functions
- ✅ **Authentication complete** - Registration, login (password + OTP), password reset
- ✅ **UI components** - shadcn/ui installed with 9 base components
- ✅ **Auth pages** - Login, register, verify email, forgot/reset password
- ✅ **Dashboard layout complete** - Sidebar nav, header with logout, responsive design
- ✅ **Route protection** - Auth middleware enforcing login for dashboard routes
- ✅ **Members Tab** - Complete with full CRUD, payment collection, status management
- ✅ **Revenue Tab** - Complete with analytics dashboard and interactive charts
- ✅ **Payment Collection Tab** - Complete with overdue tracking and bulk actions
- ✅ **SMS Reminders** - Complete with text.lk integration and cron automation
- ✅ **Settings Tab** - Complete with gym info, plans, discounts, and account security
- 🚧 **Testing & QA** - In progress (Phase 9)

## Implementation Decisions
- **UI Components**: shadcn/ui for consistent, accessible components
- **Email**: Supabase default email provider
- **SMS**: Mock implementation initially (console/database logs), text.lk integration later
- **Development Approach**: Parallel sub-agent execution with Claude Code

## Implementation Phases

---

## **Phase 1: Database Schema & Foundation**

### 1.1 Database Schema Design
Create Supabase migrations for core tables:

**Tables to Create:**
1. **gyms** - Core gym entity
   - id (UUID, PK)
   - username (unique)
   - email (unique, email_verified boolean)
   - phone_number (nullable, for OTP login)
   - gym_name, gym_address, gym_website (nullable)
   - created_at, updated_at
   - Link to auth.users via RLS

2. **members** - Gym members
   - id (UUID, PK)
   - gym_id (FK → gyms)
   - name, phone_number
   - emergency_contact_name, emergency_contact_phone
   - plan_type (enum: monthly, daily, annual)
   - plan_amount (decimal)
   - discount_id (nullable FK → discounts)
   - recurring_discount (boolean)
   - status (enum: active, expired, suspended, cancelled)
   - registered_date, membership_start_date, next_due_date
   - created_at, updated_at

3. **payments** - Payment history
   - id (UUID, PK)
   - member_id (FK → members)
   - payment_date, amount_paid
   - discount_applied (string), discount_percentage (int)
   - next_due_date_calculated
   - created_at

4. **plan_types** - Plan configuration per gym
   - id (UUID, PK)
   - gym_id (FK → gyms)
   - plan_type (enum: monthly, daily, annual)
   - default_amount (decimal)
   - is_active (boolean)
   - created_at, updated_at

5. **discounts** - Discount presets
   - id (UUID, PK)
   - gym_id (FK → gyms)
   - discount_name, discount_percentage (1-100)
   - is_active (boolean)
   - created_at, updated_at

6. **sms_logs** - SMS delivery tracking
   - id (UUID, PK)
   - member_id (FK → members)
   - gym_id (FK → gyms)
   - sms_type (enum: reminder_7day, reminder_3day, due_today, overdue, receipt)
   - phone_number, message_body
   - sent_at, delivery_status (enum: sent, delivered, failed)
   - text_lk_message_id (nullable)

7. **otp_tokens** - OTP login tokens
   - id (UUID, PK)
   - phone_number
   - otp_code, expires_at (60 seconds)
   - used (boolean)
   - created_at

### 1.2 Row Level Security (RLS)
- Enable RLS on all tables
- Create policies for multi-tenant isolation (gym_id based)
- Link gyms to auth.users for authentication

### 1.3 Helper Functions
- `calculate_next_due_date(plan_type, start_date)` - Calculate due dates
- `get_overdue_members(gym_id)` - Query overdue members
- Triggers for `updated_at` columns

**Critical Files:**
- `supabase/migrations/001_create_gym_schema.sql`
- `supabase/migrations/002_create_member_schema.sql`
- `supabase/migrations/003_create_payment_schema.sql`
- `supabase/migrations/004_create_settings_schema.sql`
- `supabase/migrations/005_enable_rls.sql`

---

## **Phase 2: Authentication & Landing Page**

### 2.1 Landing Page
**Path:** `src/app/page.tsx`
- Simple login modal (centered)
- "Don't have an account? Register" link
- Clean, professional design

### 2.2 Registration Flow
**Path:** `src/app/(auth)/register/page.tsx`

**Features:**
- Multi-step form (gym details → credentials)
- Fields: gym_name, gym_address, username, email, password, confirm_password, gym_website (optional)
- Validation: Zod schema, password strength (min 8 chars, 1 upper, 1 lower, 1 number)
- Supabase Auth signup with email verification
- Route: `/register`

### 2.3 Email Verification
- Supabase sends verification email automatically
- Redirect to `/verify-email` page with instructions
- User cannot login until verified

### 2.4 Login Options
**Path:** `src/app/(auth)/login/page.tsx`

**Option 1: Username/Email + Password**
- Single input accepts username OR email
- Password field
- "Remember Me" checkbox (30-day session vs 24-hour)
- "Forgot Password?" link

**Option 2: Phone OTP**
- Phone input (+94 Sri Lankan format auto-formatting)
- Send OTP button → 6-digit code
- 60-second expiry with countdown timer
- Resend option after expiry
- Verify OTP endpoint

### 2.5 Forgot Password Flow
- Email input → Supabase sends reset link
- Reset password page with new password + confirm
- Redirect to login after success

### 2.6 Session Management
- Supabase handles JWT tokens
- Middleware for protected routes
- Auto-logout on session expiry

**Critical Files:**
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/register/page.tsx`
- `src/app/(auth)/verify-email/page.tsx`
- `src/app/(auth)/forgot-password/page.tsx`
- `src/app/(auth)/reset-password/page.tsx`
- `src/lib/auth/schemas.ts` (Zod validation)
- `src/middleware.ts` (route protection)
- `src/features/auth/services/otp.service.ts`
- `src/features/auth/services/auth.service.ts`

---

## **Phase 0: UI Foundation Setup**

### 0.1 Install shadcn/ui
**Setup Steps:**
1. Initialize shadcn/ui in the project
2. Configure `components.json` with Tailwind config
3. Install base components: Button, Input, Card, Badge, Modal (Dialog), Table, Select, Textarea, DatePicker

**Command:**
```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input card badge dialog table select textarea calendar
```

### 0.2 Configure Tailwind for shadcn/ui
- Update `tailwind.config.ts` with shadcn/ui theme tokens
- Add CSS variables for colors in `globals.css`

**Critical Files:**
- `components.json` (shadcn/ui config)
- `src/components/ui/` (auto-generated shadcn components)
- `tailwind.config.ts` (updated with shadcn theme)
- `src/app/globals.css` (CSS variables)

---

## **Phase 3: Dashboard Layout & Navigation**

### 3.1 Dashboard Layout
**Path:** `src/app/(dashboard)/layout.tsx`

**Structure:**
- Side navigation (left, fixed)
- Top header (gym name, logout button)
- Main content area (right)
- Responsive: hamburger menu on mobile

**Navigation Tabs:**
1. Members (default home) - `/dashboard/members`
2. Revenue - `/dashboard/revenue`
3. Payment Collection - `/dashboard/payment-collection`
4. Settings - `/dashboard/settings`

### 3.2 Shared Components
Build on top of shadcn/ui primitives:
- `<Sidebar />` - Navigation component
- `<Header />` - Top bar with gym name + logout (uses shadcn Button)
- `<StatusBadge />` - Wrapper around shadcn Badge with status colors
- `<DataTable />` - Wrapper around shadcn Table with sorting/pagination
- `<SearchBar />` - Uses shadcn Input with search icon

**Critical Files:**
- `src/app/(dashboard)/layout.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Header.tsx`
- `src/components/shared/StatusBadge.tsx` (wraps shadcn Badge)
- `src/components/shared/DataTable.tsx` (wraps shadcn Table)
- `src/components/shared/SearchBar.tsx` (wraps shadcn Input)

---

## **Phase 4: Members Tab - Core CRUD**

### 4.1 Members List Page
**Path:** `src/app/(dashboard)/members/page.tsx`

**Features:**
- **Two-section table:**
  1. **Overdue Section** (top, light red bg #FFE5E5)
     - Shows members >7 days overdue
     - Sorted by most overdue first (fixed sort)
     - "Payment Collected" button per row
  2. **All Members Section**
     - All members including overdue
     - Default sort: Newest first
     - User can change sort order

- **Table Columns:**
  - Member Name (clickable → detail modal)
  - Phone Number (+94 format)
  - Registered Date (DD/MM/YYYY)
  - Plan Type (badge: Monthly/Daily/Annual)
  - Status (badge: Active/Expired/Suspended/Cancelled)
  - Next Due Date
  - Payment Collected button (overdue only)

- **Features:**
  - Real-time search (name, phone)
  - Sort dropdown: Newest/Oldest/Upcoming Payments/Recently Expired
  - Pagination: 20 per page
  - Total member count

### 4.2 Add Member Modal
**Trigger:** "+ Add Member" button (top right)

**Fields:**
- Name, phone (+94 auto-format)
- Emergency contact (name + phone)
- Plan type dropdown (only active plans from settings)
- Plan amount (pre-filled, editable)
- Discount dropdown (None + presets from settings)
- Recurring discount checkbox
- Payment amount (auto-calculated)
- Membership start date (date picker, defaults today)

**Process:**
1. Validate inputs (Zod)
2. Create member record (status: Active)
3. Record first payment in payments table
4. Calculate next_due_date (Monthly: +30d, Daily: +1d, Annual: +365d)
5. Send welcome SMS receipt via text.lk
6. Refresh table

### 4.3 Member Detail Modal
**Trigger:** Click member name in table

**Content:**
- Display all member info (read-only)
- Current plan, discount, status
- Payment history table (expandable)
- Actions:
  - Edit Member (opens edit modal)
  - Change Status dropdown (Active/Suspended/Cancelled)
  - Close button

### 4.4 Payment Collection Modal
**Trigger:** "Payment Collected" button (overdue members only)

**Fields:**
- Member name, plan type (read-only)
- Plan amount (editable)
- Discount dropdown (pre-selected if recurring)
- Payment amount (auto-calculated)
- Payment date (defaults today)
- "Deduct overdue period" checkbox (checked by default)

**Logic:**
- **Deduct checked:** next_due_date = payment_date + cycle_duration
- **Deduct unchecked:** next_due_date = original_due_date + cycle_duration

**Process:**
1. Record payment with all details
2. Update member status to Active
3. Calculate next due date
4. Send SMS receipt
5. Remove from overdue section
6. Refresh table

**Critical Files:**
- `src/app/(dashboard)/members/page.tsx`
- `src/components/members/MembersTable.tsx`
- `src/components/members/AddMemberModal.tsx`
- `src/components/members/MemberDetailModal.tsx`
- `src/components/members/PaymentCollectionModal.tsx`
- `src/features/members/schemas.ts` (Zod)
- `src/features/members/services/member.service.ts`
- `src/features/members/services/payment.service.ts`
- `src/app/api/members/route.ts` (GET, POST)
- `src/app/api/members/[id]/route.ts` (GET, PATCH)
- `src/app/api/members/[id]/payment/route.ts` (POST)

---

## **Phase 5: Revenue Tab**

### 5.1 Revenue Dashboard
**Path:** `src/app/(dashboard)/revenue/page.tsx`

**Time Period Selector:**
- Dropdown: Monthly View / Yearly View
- Month selector (if Monthly)
- Year selector (always visible)

**Monthly View Metrics:**
- Current Month Collected Revenue (sum of payments received)
- Current Month Projected Revenue (active members × plan amounts)
- Historical bar chart (months since registration)
  - Two bars per month: Collected (green) vs Projected (light blue)

**Yearly View Metrics:**
- Current Year Collected Revenue
- Current Year Projected Revenue
- Historical bar chart (years since registration)
  - Two bars per year: Collected vs Projected

**Additional Metrics:**
- Total Active Members count
- Total Revenue Since Inception
- Average Revenue Per Member

### 5.2 Revenue Calculation Logic
**Collected Revenue:** Sum of all `payments.amount_paid` in period

**Projected Revenue:**
- Monthly: `(#monthly_members × monthly_rate) + (#annual_members × annual_rate / 12) + (#daily_members × daily_rate × 30)`
- Yearly: `(#monthly × 12) + (#annual × 1) + (#daily × 365)`

### 5.3 Charts
- Use Recharts library
- Bar charts with two datasets
- Responsive design
- Tooltips on hover

**Critical Files:**
- `src/app/(dashboard)/revenue/page.tsx`
- `src/components/revenue/RevenueChart.tsx`
- `src/components/revenue/MetricCard.tsx`
- `src/features/revenue/services/revenue.service.ts`
- `src/app/api/revenue/monthly/route.ts`
- `src/app/api/revenue/yearly/route.ts`

---

## **Phase 6: Payment Collection Tab**

### 6.1 Reminder Status Table
**Path:** `src/app/(dashboard)/payment-collection/page.tsx`

**Table Columns:**
- Member Name
- Phone Number
- Plan Type
- Next Due Date
- Due In (calculated: "Due in 5 days" / "Overdue by 3 days")
- Last Reminder Sent (date & time)
- Reminder Type (7-Day/3-Day/Due Today/Overdue)
- Delivery Status (Sent/Delivered/Failed)

**Filters:**
- Show All
- Upcoming (1-7 days)
- Due Today
- Overdue

**Sort Options:**
- Due date (soonest first, default)
- Last reminder sent (most recent first)

**Actions:**
- "Resend Reminder" button per member (for failed deliveries)

### 6.2 SMS Integration Setup
**Service:** `src/features/sms/services/sms.service.ts`

**Mock Implementation (Phase 1):**
- `sendSMS(phone, message)` - Log to console + database (no actual SMS sent)
- `formatReminderSMS(member, gym)` - Format reminder message
- `formatReceiptSMS(member, gym, payment)` - Format receipt message
- `logSMS(sms_data)` - Log to sms_logs table with mock delivery status

**Note:** text.lk integration will be added in Phase 2. For now, all SMS operations are mocked but logged properly for testing workflows.

**SMS Formats (from PRD):**

**Reminder (7-day/3-day/due today):**
```
Dear [Name], your [Plan Type] membership at [Gym Name] is due on [Due Date]. Amount: Rs.[Amount]. Thank you.
```

**Overdue:**
```
Dear [Name], your [Plan Type] membership at [Gym Name] was due on [Due Date]. Amount: Rs.[Amount]. Please make payment. Thank you.
```

**Receipt (no discount):**
```
Dear [Name], payment of Rs.[Amount] received. Next due date: [Next Due Date]. Thank you - [Gym Name]
```

**Receipt (with discount):**
```
Dear [Name], payment of Rs.[Amount] received (Discount: [Discount Name] [%]% applied). Next due date: [Next Due Date]. Thank you - [Gym Name]
```

**Critical Files:**
- `src/app/(dashboard)/payment-collection/page.tsx`
- `src/components/payment-collection/ReminderStatusTable.tsx`
- `src/features/sms/services/sms.service.ts` (mock implementation)
- `src/features/sms/schemas.ts`
- `src/app/api/sms/send/route.ts`
- `src/app/api/sms/resend/route.ts`

---

## **Phase 7: Automated SMS Reminders (Cron Jobs)**

### 7.1 Daily Reminder Cron (9:00 AM Sri Lanka Time)
**Path:** `src/app/api/cron/send-reminders/route.ts`

**Logic:**
1. Query all active members
2. For each member, check `next_due_date`:
   - **7 days away:** Send 7-Day Notice
   - **3 days away:** Send 3-Day Notice
   - **Today:** Send Due Today notice
   - **Past (overdue):** Send Overdue notice
3. Format SMS with member/gym details
4. Send via text.lk API
5. Log to `sms_logs` table

**Scheduling:**
- Use Vercel Cron Jobs or Supabase Edge Function cron
- Time: 9:00 AM Sri Lanka Time (UTC+5:30)
- Frequency: Daily

### 7.2 Status Update Cron (Midnight)
**Path:** `src/app/api/cron/update-expired-status/route.ts`

**Logic:**
1. Query all active members
2. For each member with `next_due_date` >7 days in past:
   - Change status from "Active" to "Expired"
3. Update `members` table

### 7.3 Archive Old Members Cron (Monthly)
**Path:** `src/app/api/cron/archive-old-members/route.ts`

**Logic:**
1. Query all expired members with `updated_at` >2 years ago
2. Soft delete (archive) these members
3. Preserve payment history for revenue data

**Critical Files:**
- `src/app/api/cron/send-reminders/route.ts`
- `src/app/api/cron/update-expired-status/route.ts`
- `src/app/api/cron/archive-old-members/route.ts`
- `src/features/sms/services/reminder.service.ts` (uses mock SMS service)
- `vercel.json` (cron config)

---

## **Phase 8: Settings Tab** ✅ **COMPLETE**

**Status:** 100% Complete - All features implemented and functional

**Completion Date:** 2026-02-13

**Summary:** Full settings management interface with gym information, plan types, discounts, and account security (password, email, phone updates).

### 8.1 Settings Layout ✅
**Path:** `src/app/(dashboard)/settings/layout.tsx`

**Sub-tabs:**
1. Gym Information - `/settings/gym` ✅
2. Plan Types - `/settings/plans` ✅
3. Discounts - `/settings/discounts` ✅
4. Account Security - `/settings/security` ✅
5. SMS Configuration - `/settings/sms` (Phase 2 feature - deferred)

### 8.2 Gym Information Tab ✅
**Path:** `src/app/(dashboard)/settings/gym/page.tsx`

**Editable Fields:**
- Gym Name, Gym Address, Gym Website (optional) ✅
- Save button with validation ✅
- Form state management with react-hook-form + Zod ✅
- Success/error messages with auto-dismiss ✅
- Cancel button with isDirty tracking ✅

**API Endpoint:**
- `GET /api/auth/profile` - Fetch current gym profile ✅
- `PATCH /api/settings/gym` - Update gym information ✅

### 8.3 Plan Types Tab ✅
**Path:** `src/app/(dashboard)/settings/plans/page.tsx`

**Fixed Plans:** Monthly, Daily, Annual

**Configuration per plan:**
- Default Amount (LKR, inline editable) ✅
- Active/Inactive toggle ✅
- Inactive plans hidden in member registration ✅
- Creates default plans on first load if missing ✅
- Edit/Save/Cancel workflow with state management ✅
- Loading states during save operations ✅

**API Endpoints:**
- `GET /api/settings/plans` - Fetch all plan types ✅
- `PATCH /api/settings/plans` - Update plan amounts/status ✅

**Default Amounts:**
- Monthly: LKR 5,000
- Daily: LKR 300
- Annual: LKR 50,000

### 8.4 Discounts Tab ✅
**Path:** `src/app/(dashboard)/settings/discounts/page.tsx`

**Features:**
- List table: Name, Percentage, Status, Actions (Edit/Delete) ✅
- Add New Discount button with modal dialog ✅
- Fields: Name (2-50 chars), Percentage (1-100), Active checkbox ✅
- Create form with react-hook-form + Zod validation ✅
- Activate/Deactivate toggle per discount ✅
- Delete with confirmation and protection ✅
- Empty state messaging when no discounts ✅

**Business Rules:**
- Cannot delete if applied to active member (API enforces) ✅
- Can deactivate instead of deleting ✅
- Validation: percentage must be 1-100 integer ✅

**API Endpoints:**
- `GET /api/settings/discounts` - Fetch all discounts ✅
- `POST /api/settings/discounts` - Create new discount ✅
- `PATCH /api/settings/discounts/[id]` - Update discount status ✅
- `DELETE /api/settings/discounts/[id]` - Delete discount (with protection) ✅

### 8.5 Account Security Tab ✅
**Path:** `src/app/(dashboard)/settings/security/page.tsx`

**Implementation:** Three modal dialogs for security updates (650 lines total)

**Phone Number Management:** ✅
- Display current (masked: +94 XX XXX XXXX) ✅
- Update button → PhoneUpdateModal (2-step flow) ✅
- Step 1: Enter new phone number (+94 format validation) ✅
- Step 2: Enter 6-digit OTP code ✅
- Rate limiting (3 OTP requests per hour, enforced server-side) ✅
- Resend OTP functionality with cooldown ✅
- Back button to change phone number ✅
- OTP expires in 10 minutes ✅
- Updates gyms table on successful verification ✅

**Password Management:** ✅
- Display password as ••••••••
- Update button → PasswordChangeModal ✅
- Fields: Current Password, New Password, Confirm New Password ✅
- Validation: 8+ chars, uppercase, lowercase, number ✅
- Password must be different from current ✅
- Verifies current password via Supabase Auth ✅
- Update via `supabase.auth.updateUser()` ✅
- Success message with auto-close ✅

**Email Management:** ✅
- Display current email address ✅
- Update button → EmailUpdateModal ✅
- Enter new email with format validation ✅
- Prevents duplicate emails (checks gyms table) ✅
- Triggers Supabase verification email flow ✅
- Shows current email (read-only) in modal ✅
- Success message: "Verification email sent. Please check your inbox." ✅

**All Modals Include:**
- Loading states during API calls ✅
- Error handling with clear messages ✅
- Success messages with auto-dismiss ✅
- Cancel buttons that reset form state ✅
- Disabled states during submission ✅
- Form validation with react-hook-form + Zod ✅

**Implementation Files:**

**Frontend Pages (Pre-existing, Updated):**
- `src/app/(dashboard)/settings/layout.tsx` ✅
- `src/app/(dashboard)/settings/page.tsx` ✅
- `src/app/(dashboard)/settings/gym/page.tsx` ✅
- `src/app/(dashboard)/settings/plans/page.tsx` ✅
- `src/app/(dashboard)/settings/discounts/page.tsx` ✅
- `src/app/(dashboard)/settings/security/page.tsx` ✅ (updated with 3 modals - 650 lines)

**API Routes (New for Phase 8):**
- `src/app/api/auth/profile/route.ts` ✅ **NEW** - GET gym profile (41 lines)
- `src/app/api/settings/security/password/route.ts` ✅ **NEW** - Change password (51 lines)
- `src/app/api/settings/security/email/route.ts` ✅ **NEW** - Update email (48 lines)
- `src/app/api/settings/security/phone/request-otp/route.ts` ✅ **NEW** - Request OTP (122 lines with rate limiting)
- `src/app/api/settings/security/phone/verify-otp/route.ts` ✅ **NEW** - Verify OTP (66 lines)

**API Routes (Pre-existing):**
- `src/app/api/settings/gym/route.ts` ✅
- `src/app/api/settings/plans/route.ts` ✅
- `src/app/api/settings/discounts/route.ts` ✅
- `src/app/api/settings/discounts/[id]/route.ts` ✅

**Services & Schemas:**
- `src/features/settings/index.ts` ✅ **NEW** - Feature exports (43 lines)
- `src/features/settings/schemas/settings.schemas.ts` ✅ (pre-existing)
- `src/features/settings/services/settings.service.ts` ✅ (pre-existing)
- `src/features/settings/types/index.ts` ✅ (pre-existing)
- `src/features/auth/services/auth.service.ts` ✅ **UPDATED** - Added `updateEmail()` function (66 lines)

**Database Migrations:**
- `supabase/migrations/20260211000001_create_gyms_table.sql` ✅
- `supabase/migrations/20260211000004_create_settings_tables.sql` ✅

**Technical Implementation:**
- All API inputs validated with Zod schemas ✅
- React Hook Form with zodResolver for all forms ✅
- TanStack React Query for data fetching and mutations ✅
- Proper error handling and user feedback ✅
- Success messages with auto-dismiss (2-3 seconds) ✅
- shadcn/ui Dialog components for all modals ✅
- OTP flow with bcrypt hashing and rate limiting ✅
- Supabase Auth integration for password/email updates ✅
- Profile invalidation after successful updates ✅

**Security Features:**
- OTP codes hashed with bcrypt (BCRYPT_SALT_ROUNDS=10) ✅
- Rate limiting: 3 OTP requests per hour per phone ✅
- OTP expiry: 10 minutes (600 seconds) ✅
- Current password verification before password change ✅
- Duplicate email/phone prevention (database checks) ✅
- Delete protection for discounts applied to active members ✅
- All API routes require authentication via `getCurrentGymProfile()` ✅

**User Experience:**
- Inline editing for plan amounts ✅
- Real-time validation feedback ✅
- Loading states during API calls ✅
- Disabled buttons during submission ✅
- Auto-dismiss success messages ✅
- Clear error messages for validation failures ✅
- Form reset after successful submission ✅
- Modal close on successful update ✅

---

## **Phase 9: Testing & Quality Assurance**

### 9.1 Unit Tests
**Coverage Target: 70%**

**Focus Areas:**
- Validation schemas (Zod)
- Service functions (member, payment, revenue calculations)
- Helper functions (date calculations, SMS formatting)
- Utility functions

**Test Files:**
- `src/features/members/services/__tests__/member.service.test.ts`
- `src/features/members/services/__tests__/payment.service.test.ts`
- `src/features/revenue/services/__tests__/revenue.service.test.ts`
- `src/features/sms/services/__tests__/textlk.service.test.ts`

### 9.2 Integration Tests
**Coverage Target: 20%**

**Focus Areas:**
- API routes (CRUD operations)
- Database operations
- Supabase Auth flows
- SMS integration (mocked)

**Test Files:**
- `tests/integration/api/members.test.ts`
- `tests/integration/api/payments.test.ts`
- `tests/integration/auth/login.test.ts`
- `tests/integration/auth/register.test.ts`

### 9.3 E2E Tests (Critical Flows)
**Coverage Target: 10%**

**Scenarios:**
1. Complete registration → email verify → login
2. Add new member → collect payment
3. Payment collection for overdue member
4. Revenue dashboard navigation and data display

**Test Files:**
- `tests/e2e/auth-flow.spec.ts`
- `tests/e2e/member-management.spec.ts`
- `tests/e2e/payment-collection.spec.ts`

### 9.4 Manual Testing Checklist
- [ ] Registration with email verification
- [ ] Login (username/email + password)
- [ ] Login (phone OTP)
- [ ] Add member with discount
- [ ] Collect overdue payment
- [ ] Change member status
- [ ] Revenue charts (monthly/yearly)
- [ ] Settings: update gym info, plans, discounts
- [ ] SMS reminder sending (test with text.lk sandbox)
- [ ] Mobile responsiveness

---

## **Phase 10: Deployment & Launch Prep**

### 10.1 Environment Configuration
**Production Environment Variables:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TEXT_LK_API_KEY` (optional, not needed for mock SMS)
- `TEXT_LK_SENDER_ID` (optional, not needed for mock SMS)
- `NEXT_PUBLIC_APP_URL`
- `NODE_ENV=production`
- `ENABLE_REAL_SMS=false` (feature flag to switch between mock and real SMS)

### 10.2 Vercel Deployment
1. Connect GitHub repo to Vercel
2. Configure environment variables
3. Enable Vercel Cron Jobs:
   - Daily 9:00 AM: `/api/cron/send-reminders`
   - Daily 12:00 AM: `/api/cron/update-expired-status`
   - Monthly 1st: `/api/cron/archive-old-members`
4. Custom domain setup (optional)

### 10.3 Supabase Production Setup
1. Enable RLS on all tables
2. Configure auth settings (email verification, OTP)
3. Set up database backups (daily)
4. Configure CORS for Vercel domain

### 10.4 Security Checklist
- [ ] All API routes protected with auth middleware
- [ ] RLS policies tested and enabled
- [ ] Environment variables secured (not in repo)
- [ ] HTTPS enforced
- [ ] Rate limiting on OTP endpoints
- [ ] SQL injection prevention (Supabase parameterized queries)

### 10.5 Performance Optimization
- [ ] Database indexes on frequently queried columns (gym_id, member_id, next_due_date)
- [ ] Image optimization (next/image)
- [ ] Code splitting (dynamic imports)
- [ ] React Query caching configured

### 10.6 Monitoring & Logging
- [ ] Vercel Analytics enabled
- [ ] Supabase logs monitoring
- [ ] Error tracking (Sentry or similar)
- [ ] SMS delivery rate monitoring

---

## **Critical Dependencies & Integrations**

### External Services
1. **Supabase** (Database + Auth)
   - Project already configured
   - Need to run migrations
   - Enable email provider for verification

2. **text.lk** (SMS Provider)
   - API credentials needed
   - Test sandbox account for development
   - Production API key for launch

3. **Vercel** (Hosting)
   - Free tier sufficient for MVP
   - Cron jobs available on Pro plan

### NPM Packages to Add
```json
{
  "dependencies": {
    "recharts": "^2.x", // Revenue charts
    "react-hook-form": "^7.x", // Form handling
    "date-fns": "^3.x", // Date calculations
    "@hookform/resolvers": "^3.x", // Zod resolver for react-hook-form
    "@radix-ui/react-icons": "^1.x", // Icons for shadcn/ui
    "class-variance-authority": "^0.x", // For component variants
    "clsx": "^2.x", // Utility for className merging
    "tailwind-merge": "^2.x", // Tailwind class merging
    "@tanstack/react-query": "^5.x", // Already installed
    "zod": "^3.x" // Already installed
  }
}
```

**Note:** Most shadcn/ui dependencies will be added automatically during `shadcn-ui init`

---

## **Open Questions & Assumptions**

### Require Clarification:
1. **text.lk API Details (Future):**
   - ✅ Using mock SMS for now
   - Will need API details when switching to real SMS integration
   - Feature flag `ENABLE_REAL_SMS` controls mock vs real

2. **Business Logic:**
   - What happens if member pays partial amount?
   - Can members have multiple active plans simultaneously?
   - How to handle refunds (if needed)?

3. **Email Provider:**
   - ✅ Using Supabase default email provider (confirmed)

### Assumptions Made:
- Payment is always collected in full (no partial payments in MVP)
- One active membership per member at a time
- No refund functionality in MVP
- Sri Lankan Rupees (LKR) as currency
- All dates in DD/MM/YYYY format (Sri Lankan standard)
- Phone numbers in +94 format only
- Desktop-first design, mobile responsive as secondary

---

## **Risk Mitigation**

### Technical Risks
1. **SMS Delivery Failures:**
   - Implement retry logic (3 attempts, exponential backoff)
   - Manual resend option in UI
   - Log all failures for monitoring

2. **OTP Security:**
   - 60-second expiry
   - Rate limit: 3 OTP requests per phone per hour
   - Hash OTP codes in database

3. **Database Performance:**
   - Implement pagination (20 per page)
   - Add indexes on gym_id, member_id, next_due_date, status
   - Archive old data (2-year retention policy)

### Business Risks
1. **User Onboarding Complexity:**
   - Add onboarding wizard/tutorial
   - Sample data for demo
   - Help tooltips throughout UI

---

## **Success Metrics (First 3 Months)**

### Product Metrics:
- **10+ gyms** registered and active
- **500+ members** managed
- **95%+ SMS delivery rate**
- **<5% gym churn rate**

### Technical Metrics:
- **<2 second page load**
- **<500ms search results**
- **99.5% uptime**
- **Zero critical security issues**

---

## **Phase Priority & Dependencies**

**Phase Order (Recommended):**
1. **Phase 0** - UI Foundation (shadcn/ui setup) - **START HERE**
2. **Phase 1** - Database Schema & Foundation
3. **Phase 2** - Authentication & Landing Page (depends on Phase 1)
4. **Phase 3** - Dashboard Layout (depends on Phase 0, 2)
5. **Phase 4** - Members Tab (depends on Phase 3)
6. **Phase 5** - Revenue Tab (depends on Phase 3, 4)
7. **Phase 6** - Payment Collection Tab (depends on Phase 4)
8. **Phase 7** - Automated Reminders (depends on Phase 6)
9. **Phase 8** - Settings Tab (depends on Phase 3)
10. **Phase 9** - Testing & QA (parallel with implementation)
11. **Phase 10** - Deployment (final phase)

**Parallelization Opportunities:**
- Phases 5, 6, 8 can be worked on in parallel after Phase 4 is complete
- Phase 9 (testing) can run continuously alongside implementation
- UI components can be built ahead of features that use them

---

## **Post-MVP Roadmap (Phase 2)**

Features to consider after successful launch:
1. Installment payment plans
2. Multi-user access (owner, manager, staff roles)
3. WhatsApp integration
4. Member self-service portal
5. Attendance tracking
6. Mobile app (native iOS/Android)
7. Advanced analytics (retention, churn prediction)

---

## **Implementation Notes**

### Code Quality Standards
- **TDD Required**: Write tests before implementation
- **Strict TypeScript**: No `any` types
- **Zod Validation**: All API inputs validated
- **Security Layers**: RLS + middleware + input validation

### Git Workflow
- Feature branches for each phase
- PR reviews before merging to main
- Conventional Commits format
- Automated pre-commit hooks (ESLint, Prettier, tests)

### Documentation
- Update CLAUDE.md with new patterns
- API documentation (endpoints, request/response formats)
- Component Storybook (optional, Phase 2)
- User guide for gym owners

---

## **Immediate Next Steps**

1. ✅ **shadcn/ui setup** (Phase 0) - Install and configure UI components
2. **Database schema creation** (Phase 1) - Create all Supabase migrations
3. **Authentication flows** (Phase 2) - Registration, login, OTP
4. **Dashboard layout** (Phase 3) - Build navigation and shared components
5. **Members management** (Phase 4) - Core feature implementation

**Start with Phase 0 to establish UI foundation before building features.**

---

**End of Implementation Plan**
