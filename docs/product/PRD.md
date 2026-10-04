# Product Requirements Document (PRD)

## Gym Management SaaS Platform

**Version:** 1.0  
**Date:** February 11, 2026  
**Author:** Systems Engineering Inc.

---

## 1. Executive Summary

### 1.1 Product Overview

A streamlined gym management SaaS platform designed for Sri Lankan gyms to manage member registrations, automate payment reminders via SMS, and track revenue metrics. The system focuses on simplicity and essential features without overwhelming complexity.

### 1.2 Target Users

- Small to medium-sized gym owners and administrators in Sri Lanka
- Single admin per gym (no multi-user access)

### 1.3 Core Value Proposition

- Automated SMS payment reminders through text.lk
- Simple member management with payment tracking
- Revenue insights without complex accounting features
- Affordable flat-fee pricing per gym

---

## 2. Product Goals & Success Metrics

### 2.1 Goals

- Reduce payment collection friction for gym owners
- Automate reminder workflows to improve cash flow
- Provide clear revenue visibility
- Maintain simple, focused feature set

### 2.2 Success Metrics

- SMS delivery rate > 95%
- Payment collection rate improvement (baseline vs. post-implementation)
- Monthly Active Gyms (MAG)
- Average members per gym
- User session duration and engagement

---

## 3. User Personas

### Persona: Gym Owner/Admin

**Name:** Rajesh, 35  
**Role:** Gym Owner  
**Goals:**

- Track member payments efficiently
- Reduce time spent on manual reminders
- Understand monthly/yearly revenue trends
- Minimize member churn due to payment lapses

**Pain Points:**

- Manual SMS reminders are time-consuming
- Difficult to track who has paid and who hasn't
- No centralized system for member data
- Revenue calculation is manual and error-prone

---

## 4. Functional Requirements

### 4.1 Landing Page & Authentication

#### 4.1.1 Landing Page

**Description:** Simple login interface with registration option

**UI Elements:**

- Login modal (centered)
- "Don't have an account? Register your gym" link below modal

#### 4.1.2 Gym Registration Flow

**Required Fields (in order):**

1. Gym Name (text input, required)
2. Gym Address (text area, required)
3. Username (text input, required, unique)
4. Email (email input, required, unique)
5. Password (password input, required, min 8 characters)
6. Confirm Password (password input, required)
7. Gym Website (URL input, optional)

**Process:**

1. User submits registration form
2. System sends email verification to provided email address
3. User must verify email before being able to log in
4. Upon email verification, account is activated
5. User can now log in

**Validation Rules:**

- Email must be valid format and verified
- Username must be unique across platform
- Password strength: minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number
- All required fields must be filled

#### 4.1.3 Login Options

**Option 1: Username/Email & Password**

- Fields: Username or Email (single input accepts both)
- Password field
- "Remember Me" checkbox for session persistence
- "Forgot Password?" link

**Option 2: Phone Number OTP**

- Phone number input (auto-formatted to +94 Sri Lankan format)
- Phone number must match the one registered in Settings
- "Send OTP" button
- OTP input field (appears after OTP sent)
- OTP expires in 60 seconds
- Resend OTP option after expiry

**Forgot Password Flow:**

1. User clicks "Forgot Password?"
2. Enters registered email
3. Supabase sends password reset email
4. User clicks link in email
5. Redirected to password change page
6. Sets new password
7. Redirected to login

**Session Management:**

- Default session timeout: 24 hours
- "Remember Me" option: 30 days session persistence
- Auto-logout on browser close (if Remember Me not checked)

---

### 4.2 Dashboard Overview

**Layout:**

- Side navigation bar (left)
- Main content area (right)
- Top header with gym name and logout button

**Side Navigation Tabs:**

1. Members (default/home)
2. Revenue
3. Payment Collection
4. Settings

---

### 4.3 Members Tab

#### 4.3.1 Member Table Layout

**Two Sections:**

**Section 1: Overdue Payments (Top, Highlighted)**

- Background color: Light red (#FFE5E5) or similar warning color
- Shows only members with payments overdue (>7 days past due date)
- Sorted by: Most overdue first (oldest overdue date at top)
- Cannot be re-sorted by user (fixed sort order)

**Section 2: All Members**

- Standard table background
- Shows all members (including those in overdue section)
- Default sort: Newest first (most recent registration date)
- User can change sort order

**Table Columns:**

1. Member Name (clickable)
2. Phone Number (+94 format)
3. Registered Date (DD/MM/YYYY)
4. Plan Type (Monthly/Daily/Annual badge)
5. Status (Active/Expired/Suspended/Cancelled badge)
6. Next Due Date (DD/MM/YYYY)
7. Payment Collected button (only for overdue members)

**Features:**

- Search bar at top (real-time search with suggestions)
  - Searches: Name, Phone Number
  - Shows dropdown suggestions as user types
- Sort dropdown with options:
  - Newest First (default)
  - Oldest First
  - Upcoming Payments (soonest due date first)
  - Recently Expired
- Pagination: 20 members per page
- Total member count displayed

**Status Badge Colors:**

- Active: Green
- Expired: Orange
- Suspended: Gray
- Cancelled: Red

#### 4.3.2 Add New Member

**Button:** "+ Add Member" (top right of Members tab)

**Registration Fields (Modal):**

1. Member Name (text input, required)
2. Phone Number (auto-format +94, required)
3. Emergency Contact Name (text input, required)
4. Emergency Contact Phone (auto-format +94, required)
5. Plan Type (dropdown: Monthly/Daily/Annual, required)
6. Plan Amount (pre-filled from settings, editable, required)
7. Discount (dropdown: None or preset discounts from Settings)
8. Recurring Discount checkbox (if discount selected)
9. Payment Amount (auto-calculated: Plan Amount - Discount)
10. Membership Start Date (date picker, defaults to today, required)

**Calculation Logic:**

- Next Due Date calculation:
  - Monthly: Start Date + 30 days
  - Daily: Start Date + 1 day
  - Annual: Start Date + 365 days
- Initial Status: Active (upon first payment)

**Process:**

1. Admin fills form
2. If discount applied with "Recurring Discount" checked: discount stored with member profile
3. System creates member record
4. System records first payment in payment history
5. System sends welcome SMS receipt (format defined in 4.5.3)
6. Member appears in table

#### 4.3.3 Member Detail Modal

**Trigger:** Click on member name in table

**Modal Content:**

- Member Name
- Phone Number
- Emergency Contact Name
- Emergency Contact Phone
- Plan Type
- Current Plan Amount
- Applied Discount (if any)
- Recurring Discount status (Yes/No)
- Registered Date
- Membership Start Date
- Next Due Date
- Status (with color badge)
- Payment History table:
  - Payment Date
  - Amount Paid
  - Discount Applied (if any)
  - Next Due Date (calculated at that time)
  - Payment Method (assumed cash, future feature)

**Actions:**

- Edit Member (opens edit modal)
- Change Status (dropdown: Active/Suspended/Cancelled)
- View Full Payment History (expandable section)
- Close Modal

**Edit Functionality:**

- Can edit: Name, Phone, Emergency Contact details
- Cannot edit: Plan Type (only through new payment collection), Registered Date
- Can change Plan Amount for future payments

#### 4.3.4 Payment Collection from Member Table

**Trigger:** Click "Payment Collected" button (visible only for overdue members)

**Payment Collection Modal:**

**Pre-filled Information:**

- Member Name (read-only)
- Plan Type (read-only)
- Standard Plan Amount (from settings, editable)
- Current Discount (if recurring discount exists, pre-selected)

**Input Fields:**

1. Payment Amount (auto-calculated based on plan amount and discount)
2. Discount dropdown (None + all preset discounts from Settings)
   - If recurring discount exists: pre-selected
   - Admin can change or remove
3. Apply to future payments checkbox (only if discount selected, not recurring)
4. Payment Date (date picker, defaults to today)
5. Deduct overdue period checkbox (checked by default)
   - Tooltip: "If unchecked, next payment calculated from original due date"

**Calculation Logic:**

**Scenario A: "Deduct overdue period" CHECKED (Default)**

- Example: Monthly plan, due date was Jan 1, payment collected Jan 15 (15 days overdue)
- Next due date: Jan 15 + 30 days = Feb 14 (overdue period deducted from cycle)

**Scenario B: "Deduct overdue period" UNCHECKED**

- Example: Monthly plan, due date was Jan 1, payment collected Jan 15 (15 days overdue)
- Next due date: Jan 1 + 30 days = Jan 31 (calculated from original due date, only 16 days until next payment)

**Process:**

1. Admin reviews/edits payment amount and discount
2. Admin confirms payment
3. System records payment with:
   - Payment date
   - Amount paid
   - Discount applied
   - Next due date (based on calculation logic)
4. Member status changes to "Active"
5. System sends payment receipt SMS (format in 4.5.3)
6. Member moves out of overdue section
7. Modal closes, table refreshes

---

### 4.4 Revenue Tab

#### 4.4.1 Revenue Dashboard Layout

**Time Period Selector:**

- Dropdown: Monthly View / Yearly View
- Month selector (if Monthly View selected)
- Year selector (always visible)

**Monthly View Metrics:**

- Current Month Collected Revenue (total payments received this month)
- Current Month Projected Revenue (based on active members' plan amounts)
- Historical Monthly Chart (bar chart since gym registration)
  - X-axis: Months
  - Y-axis: Revenue amount (LKR)
  - Two bars per month: Collected (green) vs Projected (light blue)

**Yearly View Metrics:**

- Current Year Collected Revenue
- Current Year Projected Revenue
- Historical Yearly Chart (bar chart, each year since registration)
  - X-axis: Years
  - Y-axis: Revenue amount (LKR)
  - Two bars per year: Collected vs Projected

**Calculation Logic:**

- **Collected Revenue:** Sum of all actual payments received in the period
- **Projected Revenue:** Sum of all active members' plan amounts for the period
  - Monthly projection: (# of active monthly members × monthly rate) + (# of active annual members × annual rate / 12) + (# of active daily members × daily rate × 30)
  - Yearly projection: Annual plan members + (Monthly × 12) + (Daily × 365)

**Additional Metrics:**

- Total Active Members (count)
- Total Revenue Since Inception
- Average Revenue Per Member

---

### 4.5 Payment Collection Tab

#### 4.5.1 Reminder Status Table

**Purpose:** Show SMS reminder sending status and history

**Table Columns:**

1. Member Name
2. Phone Number
3. Plan Type
4. Next Due Date
5. Due In (calculated days, e.g., "Due in 5 days", "Overdue by 3 days")
6. Last Reminder Sent (date & time)
7. Reminder Type (7-Day Notice / 3-Day Notice / Due Today / Overdue)
8. Delivery Status (Sent / Delivered / Failed)

**Filters:**

- Show All
- Upcoming (due in 1-7 days)
- Due Today
- Overdue

**Sort Options:**

- Due date (soonest first, default)
- Last reminder sent (most recent first)

**Automated SMS Sending:**

- System automatically sends reminders at 9:00 AM daily
- Checks all members for reminder eligibility
- Sends appropriate reminder type based on due date

**SMS Sending Logic:**

- 7 days before due date: "7-Day Notice"
- 3 days before due date: "3-Day Notice"
- On due date: "Due Today"
- Any day after due date: "Overdue" (sent daily until payment)

**Manual Actions:**

- "Resend Reminder" button per member (for failed deliveries)
- No bulk send option (automatic only)

#### 4.5.2 SMS Reminder Format

> **Updated 2026-10-04.** This is the wording the product sends. The source of truth is
> `src/features/sms/config/SmsTemplates.ts`: when this document and the code disagree,
> the code wins. Every automated text names the gym (SEO-053).

**7-Day / 3-Day Notice:**

```
Hi [Member Name], your [plan] membership at [Gym Name] is due on [Due Date] (Rs.[Amount]). Do not forget to renew and stay consistent!
```

**Due Today Notice** (the member's last active day):

```
Hi [Member Name], your [plan] membership at [Gym Name] expires today (Rs.[Amount]). Renew today and stay consistent!
```

**Overdue Notice** (a safety net for a skipped expiry run):

```
Hi [Member Name], your [plan] membership at [Gym Name] has expired (due [Due Date], Rs.[Amount]). Renew soon and get back to training!
```

**Variables:**

- [Member Name]: Member's registered name
- [plan]: Plan label in lower case (monthly, 3-month, annual …); a custom plan prints just "membership"
- [Gym Name]: Gym's registered name, cut at its last whole word within 30 characters
- [Due Date]: Next due date (DD/MM/YYYY format)
- [Amount]: What the desk will charge: the plan amount less a _recurring_ discount (`effectivePlanAmount`, the formula revenue and the renewals list use; changed 2026-10-04 from "excluding discounts"). Thousands-separated, cents only when non-zero (e.g. 4,000; 3,600 with a recurring 10%)

#### 4.5.3 SMS Receipt Format

> **Updated 2026-10-04.** This is the wording the product sends. The source of truth is
> `src/features/sms/config/SmsTemplates.ts`: when this document and the code disagree,
> the code wins. Every automated text names the gym (SEO-053).

**Without Discount:**

```
[Gym Name]: thank you, [Member Name]! Payment of Rs.[Amount] received. Next due [Next Due Date]. Keep up the great work!
```

**With Discount:**

```
[Gym Name]: thank you, [Member Name]! Payment of Rs.[Amount] received ([Discount Name] [Discount %]% off). Next due [Next Due Date]. Keep up the great work!
```

**Variables:**

- [Amount]: Actual amount paid
- [Discount Name]: e.g., 'Student Discount', cut at its last whole word within 20 characters
- [Discount %]: e.g., '10'
- [Next Due Date]: Calculated next due date (DD/MM/YYYY)

---

### 4.6 Settings Tab

**Sub-tabs within Settings:**

1. Gym Information
2. Plan Types
3. Discounts
4. Account Security
5. SMS Configuration

#### 4.6.1 Gym Information Tab

**Editable Fields:**

- Gym Name
- Gym Address
- Gym Website (optional)

**Actions:**

- Save Changes button
- Changes take effect immediately
- No password confirmation required (already logged in)

#### 4.6.2 Plan Types Tab

**Purpose:** Configure plan types and default pricing

**Fixed Plan Types:**

1. Monthly
2. Daily
3. Annual

**Configuration Per Plan:**

- Plan Name (read-only: Monthly/Daily/Annual)
- Default Amount (LKR, editable)
- Status (Active/Inactive toggle)
  - Inactive plans don't appear in member registration dropdown

**Default Amounts:**

- These amounts pre-fill during member registration
- Can be overridden per member during registration

**UI:**

- Simple table/card layout
- Inline editing for amounts
- Toggle switches for active/inactive

#### 4.6.3 Discounts Tab

**Purpose:** Create and manage discount presets

**Discount List Table:**

- Discount Name (e.g., "Student Discount", "New Member Offer")
- Discount Percentage (%)
- Status (Active/Inactive)
- Actions (Edit / Delete)

**Add New Discount:**

- Discount Name (text input, required)
- Discount Percentage (number input, 1-100, required)
- Active status (checkbox, default checked)

**Usage:**

- Active discounts appear in dropdown during member registration and payment collection
- Inactive discounts are hidden but retained in system for historical records

**Rules:**

- Cannot delete discount if currently applied to any active member
- Can deactivate instead (hides from new selections but preserves history)

#### 4.6.4 Account Security Tab

**Phone Number Management:**

- Current Phone Number (display, masked: +94 XX XXX XXXX)
- Update Phone Number button
  - Opens modal with new phone input
  - Sends OTP to new number
  - Verifies OTP before updating
  - Updates phone used for OTP login

**Password Management:**

- Change Password section
  - Current Password (password input)
  - New Password (password input)
  - Confirm New Password (password input)
  - Same validation rules as registration
  - Save button

**Email Management:**

- Current Email (display)
- Update Email button
  - Opens modal with new email input
  - Sends verification to new email
  - Requires verification before updating
  - Updates email used for login and password reset

#### 4.6.5 SMS Configuration Tab (Future)

**Purpose:** Configure text.lk API credentials

**Fields:**

- API Key (password input)
- Sender ID (text input)
- Test SMS button (sends test message to gym's phone)

**Status Indicators:**

- Connection Status (Connected / Not Connected)
- Last SMS Sent (timestamp)
- SMS Balance (if provided by text.lk API)

---

### 4.7 Member Status Automation

#### 4.7.1 Status Change Rules

**Automatic Status Changes:**

**Active → Expired:**

- Trigger: 7 days after due date with no payment
- Automated: Yes (runs daily at midnight)
- Member remains in system but marked expired

**Manual Status Changes (Admin Only):**

**Any Status → Suspended:**

- Use case: Gym wants to temporarily suspend member (disciplinary, request, etc.)
- Process: Admin clicks status dropdown in member detail modal, selects "Suspended"

**Any Status → Cancelled:**

- Use case: Member requests cancellation or gym terminates membership
- Process: Admin clicks status dropdown in member detail modal, selects "Cancelled"

**Expired/Suspended → Active:**

- Use case: Member wants to reactivate
- Process:
  1. Admin searches for member in member table (expired/suspended members remain searchable)
  2. Opens member detail modal
  3. Clicks "Reactivate Member" button or changes status to "Active"
  4. System prompts for payment collection
  5. Admin processes payment (follows normal payment collection flow)
  6. Status changes to Active
  7. New due date calculated

#### 4.7.2 Data Retention Policy

**Expired Members:**

- Retained in database for 2 years from last activity date
- After 2 years: Automatically archived (soft delete)
- Archived members not searchable in main interface
- Historical revenue data preserved

**Cancelled/Suspended Members:**

- Retained indefinitely (no auto-deletion)
- Admin can manually delete if needed
- Searchable and can be reactivated

---

## 5. Non-Functional Requirements

### 5.1 Performance

- Page load time: < 2 seconds
- Search results: < 500ms
- SMS delivery: Within 30 seconds of trigger
- Dashboard refresh: Real-time or < 5 seconds

### 5.2 Security

- All passwords hashed using bcrypt
- HTTPS only (SSL/TLS)
- Supabase Row Level Security (RLS) enabled
- Session tokens encrypted
- OTP stored securely and expired after 60 seconds
- No data exporting to prevent data leakage

### 5.3 Reliability

- System uptime: 99.5%
- SMS delivery rate: > 95%
- Automated daily backups
- Data redundancy through Supabase

### 5.4 Scalability

- Support 100+ gyms initially
- Support 10,000+ members per gym
- Horizontal scaling capability through Supabase

### 5.5 Usability

- Mobile-responsive design (primarily desktop-focused)
- Intuitive navigation with minimal clicks
- Error messages clear and actionable
- Loading states for all async operations

### 5.6 Compliance

- GDPR-like data protection (Sri Lanka context)
- No data export = data stays locked in system
- Clear data retention policy (2 years for expired)

---

## 6. Technical Architecture

### 6.1 Tech Stack Recommendation

**Frontend:**

- Framework: Next.js 14+ (React)
- Language: TypeScript
- Styling: Tailwind CSS
- State Management: React Context / Zustand
- Forms: React Hook Form + Zod validation
- Charts: Recharts or Chart.js

**Backend:**

- Database & Auth: Supabase (PostgreSQL)
- API: Supabase Edge Functions or Next.js API Routes
- Real-time: Supabase Realtime subscriptions

**SMS Integration:**

- Provider: text.lk API
- Queueing: Supabase Edge Functions with scheduled triggers (cron)

**Hosting:**

- Platform: Vercel (for Next.js)
- Database: Supabase Cloud

### 6.2 Database Schema (Simplified)

**Table: gyms**

- id (UUID, primary key)
- username (string, unique)
- email (string, unique)
- email_verified (boolean)
- password_hash (string)
- phone_number (string, nullable)
- gym_name (string)
- gym_address (text)
- gym_website (string, nullable)
- created_at (timestamp)
- updated_at (timestamp)

**Table: members**

- id (UUID, primary key)
- gym_id (UUID, foreign key → gyms)
- name (string)
- phone_number (string)
- emergency_contact_name (string)
- emergency_contact_phone (string)
- plan_type (enum: monthly, daily, annual)
- plan_amount (decimal)
- discount_id (UUID, nullable, foreign key → discounts)
- recurring_discount (boolean, default false)
- status (enum: active, expired, suspended, cancelled)
- registered_date (date)
- membership_start_date (date)
- next_due_date (date)
- created_at (timestamp)
- updated_at (timestamp)

**Table: payments**

- id (UUID, primary key)
- member_id (UUID, foreign key → members)
- payment_date (date)
- amount_paid (decimal)
- discount_applied (string, nullable)
- discount_percentage (integer, nullable)
- next_due_date_calculated (date)
- created_at (timestamp)

**Table: plan_types**

- id (UUID, primary key)
- gym_id (UUID, foreign key → gyms)
- plan_type (enum: monthly, daily, annual)
- default_amount (decimal)
- is_active (boolean)
- created_at (timestamp)
- updated_at (timestamp)

**Table: discounts**

- id (UUID, primary key)
- gym_id (UUID, foreign key → gyms)
- discount_name (string)
- discount_percentage (integer)
- is_active (boolean)
- created_at (timestamp)
- updated_at (timestamp)

**Table: sms_logs**

- id (UUID, primary key)
- member_id (UUID, foreign key → members)
- gym_id (UUID, foreign key → gyms)
- sms_type (enum: reminder_7day, reminder_3day, due_today, overdue, receipt)
- phone_number (string)
- message_body (text)
- sent_at (timestamp)
- delivery_status (enum: sent, delivered, failed)
- text_lk_message_id (string, nullable)

**Table: otp_tokens**

- id (UUID, primary key)
- phone_number (string)
- otp_code (string)
- expires_at (timestamp)
- used (boolean, default false)
- created_at (timestamp)

### 6.3 API Endpoints (Conceptual)

**Authentication:**

- POST /api/auth/register - Gym registration
- POST /api/auth/verify-email - Email verification
- POST /api/auth/login - Username/email & password login
- POST /api/auth/send-otp - Send OTP to phone
- POST /api/auth/verify-otp - Verify OTP and login
- POST /api/auth/forgot-password - Initiate password reset
- POST /api/auth/reset-password - Complete password reset
- POST /api/auth/logout - Logout

**Members:**

- GET /api/members - List all members (with filters, search, pagination)
- POST /api/members - Add new member
- GET /api/members/:id - Get member details
- PATCH /api/members/:id - Update member info
- PATCH /api/members/:id/status - Change member status
- POST /api/members/:id/payment - Record payment

**Revenue:**

- GET /api/revenue/monthly?year=2026&month=2 - Monthly revenue data
- GET /api/revenue/yearly?year=2026 - Yearly revenue data
- GET /api/revenue/historical - All historical data

**Payment Collection:**

- GET /api/payment-collection/reminders - Reminder status list
- POST /api/payment-collection/resend - Resend failed reminder

**Settings:**

- GET /api/settings/gym - Get gym info
- PATCH /api/settings/gym - Update gym info
- GET /api/settings/plan-types - Get plan configurations
- PATCH /api/settings/plan-types - Update plan configurations
- GET /api/settings/discounts - Get all discounts
- POST /api/settings/discounts - Add discount
- PATCH /api/settings/discounts/:id - Update discount
- DELETE /api/settings/discounts/:id - Delete discount
- PATCH /api/settings/phone - Update phone number
- PATCH /api/settings/email - Update email
- PATCH /api/settings/password - Change password

**SMS (Background Jobs):**

- CRON /api/cron/send-reminders - Daily at 9 AM, sends all eligible reminders
- CRON /api/cron/update-expired-status - Daily at midnight, marks overdue members as expired
- CRON /api/cron/archive-old-members - Monthly, archives members past 2-year retention

---

## 7. User Flows

### 7.1 Gym Owner Registration & Onboarding

1. Owner lands on platform landing page
2. Clicks "Register your gym" link
3. Fills registration form (gym name, address, username, email, password, optional website)
4. Submits form
5. System sends verification email
6. Owner opens email, clicks verification link
7. Email verified, account activated
8. Owner redirected to login page
9. Owner logs in with username/email and password
10. Lands on empty dashboard (Members tab)
11. Prompted to configure plan types in Settings
12. Owner navigates to Settings → Plan Types
13. Sets default amounts for Monthly, Daily, Annual plans
14. (Optional) Creates discount presets in Settings → Discounts
15. Returns to Members tab, ready to add first member

### 7.2 Adding a New Member

1. Admin clicks "+ Add Member" on Members tab
2. Modal opens with registration form
3. Fills member details:
   - Name, phone, emergency contact name & phone
   - Selects plan type from dropdown (shows only active plans)
   - Plan amount pre-filled (can edit)
   - (Optional) Selects discount from dropdown
   - (Optional) Checks "Recurring Discount" if discount should apply to future payments
   - Confirms membership start date (defaults to today)
4. System auto-calculates payment amount (plan amount - discount)
5. Admin clicks "Add Member"
6. System creates member record with status "Active"
7. System calculates next due date based on plan type
8. System records first payment in payment history
9. System sends welcome SMS receipt
10. Member appears in members table
11. Modal closes

### 7.3 Collecting Overdue Payment

1. Admin sees overdue member highlighted at top of Members table
2. Clicks "Payment Collected" button next to member's name
3. Payment collection modal opens:
   - Member name, plan type shown
   - Plan amount pre-filled (editable)
   - Discount dropdown (shows recurring discount if exists, or None)
   - Payment amount auto-calculated
   - "Deduct overdue period" checkbox (checked by default)
   - Payment date (defaults to today)
4. Admin reviews/adjusts details
5. Admin clicks "Confirm Payment"
6. System records payment with all details
7. System calculates next due date:
   - If "Deduct overdue period" checked: Payment date + cycle duration
   - If unchecked: Original due date + cycle duration
8. Member status changes to "Active"
9. System sends payment receipt SMS (with or without discount format)
10. Member moves out of overdue section
11. Table refreshes, modal closes

### 7.4 Automated SMS Reminder Flow (Background)

**Daily at 9:00 AM:**

1. System cron job triggers
2. Queries all active members
3. For each member, checks next due date:
   - If due date is 7 days away: Send "7-Day Notice" SMS
   - If due date is 3 days away: Send "3-Day Notice" SMS
   - If due date is today: Send "Due Today" SMS
   - If due date is in the past (overdue): Send "Overdue" SMS
4. System formats SMS with member name, plan type, gym name, due date, amount
5. Sends SMS via text.lk API
6. Logs SMS in sms_logs table with timestamp and delivery status
7. Admin can view sending history in Payment Collection tab

**Daily at Midnight:**

1. System cron job triggers
2. Queries all active members
3. For each member, checks if payment overdue by >7 days
4. If yes, changes status from "Active" to "Expired"
5. Expired members appear in table with orange badge

### 7.5 Reactivating Expired Member

1. Admin searches for expired member in Members table search bar
2. Clicks on member name
3. Member detail modal opens (status shows "Expired")
4. Admin clicks "Change Status" dropdown, selects "Active" OR clicks "Reactivate Member" button
5. System prompts: "Member reactivation requires payment. Proceed to payment collection?"
6. Admin confirms
7. Payment collection modal opens (same as overdue payment flow)
8. Admin processes payment
9. Status changes to "Active"
10. New next due date calculated
11. Payment receipt SMS sent
12. Member returns to active member list

---

## 8. UI/UX Specifications

### 8.1 Design Principles

- **Simplicity First:** Minimal clicks, clear labels, no clutter
- **Mobile-Responsive:** Works on tablets and phones (though desktop-optimized)
- **Consistent Patterns:** Same modal structure, button styles, color schemes
- **Feedback-Rich:** Loading states, success/error messages, confirmation dialogs
- **Accessible:** High contrast, readable fonts, keyboard navigation

### 8.2 Color Palette (Suggestion)

- **Primary:** Blue (#3B82F6) - Buttons, active states
- **Success:** Green (#10B981) - Active status, collected revenue
- **Warning:** Orange (#F59E0B) - Expired status, upcoming due dates
- **Danger:** Red (#EF4444) - Overdue, cancelled, error states
- **Neutral:** Grays (#F3F4F6, #E5E7EB, #9CA3AF) - Backgrounds, borders, text
- **Overdue Highlight:** Light Red (#FFE5E5) - Overdue member section background

### 8.3 Typography

- **Headings:** Inter or Poppins (Bold, 24px-32px)
- **Body:** Inter or Roboto (Regular, 14px-16px)
- **Small Text:** 12px-14px for labels, timestamps

### 8.4 Component Patterns

**Buttons:**

- Primary: Blue background, white text, rounded
- Secondary: White background, blue border, blue text
- Danger: Red background, white text (for delete/cancel actions)

**Modals:**

- Centered overlay with backdrop
- Close button (X) at top-right
- Action buttons at bottom (Cancel, Confirm/Save)

**Tables:**

- Striped rows for readability
- Hover state on rows
- Sticky header on scroll
- Pagination controls at bottom

**Forms:**

- Clear labels above inputs
- Required fields marked with asterisk (\*)
- Inline validation errors below fields
- Submit button disabled until form valid

**Status Badges:**

- Pill-shaped, colored background, white text
- Consistent sizing across UI

### 8.5 Responsive Breakpoints

- Desktop: > 1024px (default)
- Tablet: 768px - 1024px
- Mobile: < 768px
  - Side nav collapses to hamburger menu
  - Tables scroll horizontally
  - Modals become full-screen

---

## 9. SMS Integration Specifications

### 9.1 text.lk API Integration

**API Documentation:** (Assumed - to be confirmed with text.lk)

- Endpoint: https://api.text.lk/send
- Method: POST
- Authentication: API Key in header
- Request Body:
  ```json
  {
    "api_key": "your_api_key",
    "sender_id": "GymName",
    "recipient": "+94771234567",
    "message": "SMS body text"
  }
  ```
- Response:
  ```json
  {
    "status": "success",
    "message_id": "msg_12345",
    "delivery_status": "sent"
  }
  ```

**Error Handling:**

- Retry failed SMS up to 3 times with exponential backoff
- Log all failures in sms_logs table
- Admin can manually resend from Payment Collection tab

**Rate Limiting:**

- Respect text.lk rate limits (TBD from provider)
- Implement queue system if sending bulk reminders (e.g., 100+ members)

### 9.2 SMS Templates (Detailed)

> **Updated 2026-10-04.** This is the wording the product sends. The source of truth is
> `src/features/sms/config/SmsTemplates.ts`: when this document and the code disagree,
> the code wins. Every automated text names the gym (SEO-053).

**Welcome SMS (registration):**

```
Welcome to [Gym Name], [Member Name]! Your [plan] membership is active and we can't wait to see you training. Paid Rs.[Amount]. Next due [Next Due Date]. Have a great time!
```

**Welcome Back SMS (a suspended or cancelled member paying to return):**

```
Welcome back to [Gym Name], [Member Name]! Great to have you training again. Paid Rs.[Amount]. Next due [Next Due Date].
```

**Reminder SMS (7 and 3 days before the due date):**

```
Hi [Member Name], your [plan] membership at [Gym Name] is due on [Due Date] (Rs.[Amount]). Do not forget to renew and stay consistent!
```

Example:

```
Hi Rajesh Perera, your monthly membership at FitZone Gym is due on 15/03/2026 (Rs.3,000). Do not forget to renew and stay consistent!
```

**Due Today SMS:**

```
Hi [Member Name], your [plan] membership at [Gym Name] expires today (Rs.[Amount]). Renew today and stay consistent!
```

**Overdue SMS:**

```
Hi [Member Name], your [plan] membership at [Gym Name] has expired (due [Due Date], Rs.[Amount]). Renew soon and get back to training!
```

**Receipt SMS (No Discount):**

```
[Gym Name]: thank you, [Member Name]! Payment of Rs.[Amount] received. Next due [Next Due Date]. Keep up the great work!
```

Example:

```
FitZone Gym: thank you, Rajesh Perera! Payment of Rs.3,000 received. Next due 15/04/2026. Keep up the great work!
```

**Receipt SMS (With Discount):**

```
[Gym Name]: thank you, [Member Name]! Payment of Rs.[Amount] received ([Discount Name] [Discount %]% off). Next due [Next Due Date]. Keep up the great work!
```

Example:

```
FitZone Gym: thank you, Rajesh Perera! Payment of Rs.2,700 received (Student Discount 10% off). Next due 15/04/2026. Keep up the great work!
```

**Day Pass SMS:**

```
[Gym Name]: thank you, [Member Name]! Day pass of Rs.[Amount] received, valid until [Date]. Enjoy your workout!
```

**Length:** every text is GSM-7 (no emoji, em dash or curly quote). The welcome is two SMS segments; every other text is one at typical lengths and at most two in the long tail. `SmsTemplates.test.ts` pins both.

### 9.3 SMS Sending Schedule

**Automated Reminders:**

- Time: 9:00 AM Sri Lanka Time (UTC+5:30)
- Frequency: Daily
- Trigger: Cron job (Supabase Edge Function or Vercel Cron)

**Manual Resend:**

- Available in Payment Collection tab
- Admin clicks "Resend" button
- SMS sent immediately

---

## 10. Business Model & Pricing

### 10.1 Pricing Strategy

**Flat Fee Per Gym:**

- Monthly subscription: LKR 2,500 - 5,000 per gym (market research needed)
- Annual subscription: 10-month pricing (2 months free)
- No per-member fees
- No transaction fees on payments

**Payment Collection:**

- Stripe or local payment gateway (e.g., PayHere, Genie)
- Auto-renewal enabled
- Grace period: 3 days after subscription due date
- Suspension: If payment not received after grace period

### 10.2 Free Trial

- 30-day free trial for new gym registrations
- Full feature access during trial
- No credit card required for trial
- Prompt to subscribe on day 12 of trial

### 10.3 Future Monetization

- SMS credits (after certain limit, charge per SMS)
- Premium features: Multi-user access, advanced analytics, integrations
- Whitelabel option for larger gym chains

---

## 11. Development Phases

### Phase 1: MVP (Weeks 1-6)

**Goal:** Core functionality for single gym

**Features:**

- Gym registration & authentication
- Member CRUD operations
- Basic payment collection
- SMS integration (text.lk)
- Simple revenue dashboard

**Deliverables:**

- Functional prototype
- Database schema implemented
- text.lk API integration tested
- Basic UI/UX (desktop-only)

### Phase 2: Enhancement (Weeks 7-10)

**Goal:** Polish and essential features

**Features:**

- Automated SMS reminders (cron jobs)
- Payment Collection tab with reminder history
- Discount management
- Member status automation (expired)
- Historical revenue charts
- Settings tab completion

**Deliverables:**

- Fully automated reminder system
- Revenue analytics
- Mobile-responsive UI

### Phase 3: Testing & Launch (Weeks 11-12)

**Goal:** Beta testing and production launch

**Activities:**

- User acceptance testing with 3-5 pilot gyms
- Bug fixes and performance optimization
- Security audit
- Documentation (user guide, admin guide)
- Launch marketing materials

**Deliverables:**

- Production-ready application
- Onboarding documentation
- Support channels setup

### Phase 4: Post-Launch (Ongoing)

**Goal:** Iteration based on user feedback

**Activities:**

- Monitor usage analytics
- Collect user feedback
- Implement quick wins and bug fixes
- Plan Phase 2 features (installments, multi-user, etc.)

---

## 12. Risk Assessment & Mitigation

### 12.1 Technical Risks

**Risk:** SMS delivery failures

- **Impact:** High - Core feature
- **Mitigation:** Retry logic, fallback to manual resend, monitor delivery rates, partnership SLA with text.lk

**Risk:** Database performance with large member counts

- **Impact:** Medium
- **Mitigation:** Proper indexing, pagination, Supabase scaling, query optimization

**Risk:** OTP expiry too short (60 seconds)

- **Impact:** Low-Medium - User frustration
- **Mitigation:** Clear countdown timer in UI, easy resend option, user testing to validate

### 12.2 Business Risks

**Risk:** Low gym adoption

- **Impact:** High - Business viability
- **Mitigation:** Free trial, pilot program with friendly gyms, localized marketing, competitive pricing

**Risk:** SMS costs higher than expected

- **Impact:** Medium - Margin pressure
- **Mitigation:** Negotiate bulk rates with text.lk, implement SMS credit limits, monitor usage

**Risk:** Churn due to complexity

- **Impact:** Medium
- **Mitigation:** Simple onboarding, video tutorials, responsive support, continuous UX improvement

### 12.3 Compliance Risks

**Risk:** Data privacy violations (Sri Lankan regulations)

- **Impact:** High - Legal penalties
- **Mitigation:** Consult legal expert, implement data retention policy, no data export, secure storage

**Risk:** SMS spam complaints

- **Impact:** Medium - Reputation damage
- **Mitigation:** Clear opt-in during member registration, unsubscribe option (future), professional message formatting

---

## 13. Success Criteria & KPIs

### 13.1 Launch Metrics (First 3 Months)

- **10+ gyms** registered and active
- **500+ members** managed across all gyms
- **95%+ SMS delivery rate**
- **<5% churn rate** (gyms canceling subscription)
- **Average 50+ members per gym**

### 13.2 Product Metrics

- **Daily Active Gyms (DAG):** Gyms logging in daily
- **Payment Collection Rate:** % of payments collected vs. projected
- **SMS Effectiveness:** Correlation between reminders sent and payments received
- **Member Reactivation Rate:** % of expired members reactivated
- **Feature Adoption:** % of gyms using discounts, % configuring plan types

### 13.3 Financial Metrics

- **Monthly Recurring Revenue (MRR):** Subscription revenue
- **Customer Acquisition Cost (CAC):** Marketing spend / new gyms
- **Lifetime Value (LTV):** Average subscription duration × monthly fee
- **LTV:CAC Ratio:** Target > 3:1

---

## 14. Future Feature Roadmap

### 14.1 Phase 2 Features (Post-MVP)

1. **Installment Plans:**
   - Allow members to pay in installments
   - Track installment schedule and payments
   - Partial payment collection

2. **Multi-User Access:**
   - Owner, Manager, Staff roles
   - Permission-based access control
   - Activity logs for accountability

3. **Advanced Analytics:**
   - Member retention rate
   - Churn prediction
   - Revenue forecasting
   - Plan type performance comparison

4. **WhatsApp Integration:**
   - Send reminders via WhatsApp
   - Two-way communication for queries
   - Payment confirmation via WhatsApp

5. **Mobile App:**
   - Native iOS/Android apps for gym admins
   - Push notifications for overdue payments
   - Quick payment collection on-the-go

### 14.2 Phase 3 Features (Long-term)

1. **Member Self-Service Portal:**
   - Members can view their payment history
   - Members can update contact info
   - Members can request membership freeze

2. **Attendance Tracking:**
   - Check-in/check-out system
   - Attendance reports
   - Integration with access control systems

3. **Class/Session Management:**
   - Schedule fitness classes
   - Booking and capacity management
   - Trainer assignment

4. **Inventory Management:**
   - Track gym equipment
   - Maintenance scheduling
   - Locker assignments

5. **Integrations:**
   - Accounting software (Xero, QuickBooks)
   - Payment gateways (auto-collect via cards)
   - Google Calendar for class schedules

---

## 15. Support & Maintenance

### 15.1 Customer Support Channels

- **Email Support:** support@gymmanagersaas.lk (24-48 hour response time)
- **WhatsApp Support:** +94 XX XXX XXXX (business hours)
- **Knowledge Base:** Help articles, video tutorials, FAQs
- **In-App Chat:** (Phase 2 feature)

### 15.2 Maintenance Plan

- **Weekly:** Database backups, performance monitoring
- **Monthly:** Security patches, dependency updates
- **Quarterly:** Feature releases, major updates
- **Annual:** Infrastructure review, cost optimization

### 15.3 SLA Commitments

- **Uptime:** 99.5% (excluding planned maintenance)
- **Support Response:** < 24 hours for critical issues
- **SMS Delivery:** > 95% within 30 seconds
- **Bug Fixes:** Critical bugs fixed within 48 hours

---

## 16. Appendix

### 16.1 Glossary

- **Active Member:** Member with status "Active" and payment up-to-date
- **Overdue Member:** Member past due date but still within 7-day grace period
- **Expired Member:** Member overdue by >7 days, status automatically changed to "Expired"
- **Recurring Discount:** Discount that applies to all future payments for a member
- **Plan Type:** Membership duration category (Monthly, Daily, Annual)
- **OTP:** One-Time Password sent via SMS for login verification

### 16.2 Assumptions

- Gyms have reliable internet connection
- Gym admins are comfortable with basic computer operations
- Members have active mobile phone numbers
- text.lk API is reliable and cost-effective
- Sri Lankan market has demand for gym management software

### 16.3 Dependencies

- text.lk API availability and pricing
- Supabase service reliability
- Vercel hosting stability
- Email delivery service (for verification and password reset)

### 16.4 Open Questions

- Exact text.lk API pricing and rate limits?
- Legal requirements for data storage in Sri Lanka?
- Market research on gym owner willingness to pay?
- Competitive analysis - any existing local solutions?
- Integration requirements with local payment gateways?

---

## 17. Approval & Sign-off

**Prepared by:** Shyan, Systems Engineering Inc.  
**Date:** February 11, 2026  
**Version:** 1.0

**Stakeholders:**

- [ ] Product Owner (Shyan) - Approved
- [ ] Technical Lead - Pending Review
- [ ] Design Lead - Pending Review
- [ ] QA Lead - Pending Review

---

**End of PRD**

---
