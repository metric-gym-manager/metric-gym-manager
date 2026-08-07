# Navigation Schema

This document provides a comprehensive overview of the application's navigation structure, including all pages, sub-tabs, and their key functionalities.

---

## Main Navigation Structure

```
Metric Gym Manager
├── Dashboard
├── Members
├── Revenue
├── Member Analytics
├── Renewals
│   ├── Regular Payments (tab)
│   └── Reminders (tab)
├── Announcements
├── Billing Setup
│   ├── Plan Types (tab)
│   └── Discounts (tab)
├── Settings
│   ├── Gym Information (sub-page)
│   └── Account Security (sub-page)
└── Support
```

---

## Detailed Page Descriptions

### 1. Dashboard (`/dashboard`)

**Icon:** Home
**Purpose:** Central hub displaying key business metrics and insights
**Mobile:** Visible in bottom navigation

**Key Features:**

- **Overdue Members Card**
  - Displays count of members with overdue payments
  - Breakdown by urgency (Over 14 days, 7-14 days, Under 7 days)
  - Color-coded badges (red, orange, yellow)
  - Links to Renewals page filtered by overdue status

- **Revenue This Month Card**
  - Shows total revenue collected in current month
  - Currency formatted with "Rs." prefix
  - Displays current month and year
  - Links to Revenue page

- **Due This Week Card**
  - Count of members with payments due in next 7 days
  - Expected total amount to be collected
  - Member count breakdown
  - Links to Renewals page filtered by upcoming payments

- **Active Members Card**
  - Count of currently active members
  - Shows status indicator
  - Displays count of expired members
  - Links to Members page filtered by active status

**Access Level:** All authenticated gym owners
**Real-time Updates:** Metrics refresh on page load via React Query

---

### 2. Members (`/members`)

**Icon:** Users
**Purpose:** Comprehensive member management and registration
**Mobile:** Visible in bottom navigation

**Key Features:**

- **Member List Table**
  - Sortable columns (Name, Phone, Plan Type, Amount, Status, Next Due Date)
  - Pagination (20 members per page)
  - Status indicators (Active, Expired, Suspended, Cancelled)
  - Click-to-view member details

- **Add Member Button**
  - Opens modal for single member registration
  - Collects: Name, Phone, Plan Type, Custom Amount, Discount, Start Date
  - Automatic next due date calculation
  - Visible on all screen sizes

- **Bulk Register Button** _(Desktop/Tablet Only)_
  - CSV upload for bulk member registration
  - Template download available
  - Validation and preview before import
  - Hidden on mobile to reduce clutter

- **Member Details Modal** (View/Edit)
  - Full member information display
  - Edit capabilities for all fields
  - Payment history view
  - Status management

**Filtering Options:**

- Status filter (Active, Expired, Suspended, Cancelled)
- Search by name or phone
- Sort by registration date (newest/oldest)

**Access Level:** All authenticated gym owners
**Data Isolation:** RLS enforced - users only see their gym's members

---

### 3. Revenue (`/revenue`)

**Icon:** DollarSign
**Purpose:** Track and analyze payment revenue
**Mobile:** Visible in bottom navigation

**Key Features:**

- **Revenue Summary**
  - Total revenue for selected period
  - Monthly breakdown
  - Year-to-date totals

- **Payment History Table**
  - List of all recorded payments
  - Filterable by date range
  - Member name and payment details
  - Discount information (if applied)

- **Export Functionality**
  - Download revenue reports
  - CSV format for accounting

**Access Level:** All authenticated gym owners
**Data Source:** Payments table with member joins

---

### 3a. Member Analytics (`/member-analytics`)

**Icon:** LineChart
**Purpose:** Membership trend analytics — sign-up, renewal, churn and retention
insight over a stock-chart style range selector
**Mobile:** Visible in bottom navigation
**Placement:** Primary group, immediately after Revenue

**Range Selector (stock-chart style):**

- `1M` / `3M` — trailing days (daily buckets)
- `YTD` — Jan 1 of the current year → today (monthly buckets)
- `1Y` — a selected calendar year, this or any past year (year picker)
- `MAX` — gym creation → today (monthly, or yearly for long spans)

**Key Features:**

- **Headline KPI tiles**
  - Active members (with total count)
  - New sign-ups this month, with year-over-year same-month delta
  - Renewal rate (over the selected range)
  - Churn rate (with retention shown alongside)

- **Membership trend chart** — range-switchable primary time-series that toggles
  between Sign-ups, Active members, Renewal %, Churn % and Retention %

- **Year-over-year sign-ups** — this year vs. last year, month by month

- **At-risk / due-soon** — members overdue or due within 7 days, bucketed by
  days-until-due (churn early warning)

- **Cohort retention** — retention of each sign-up-month cohort over subsequent
  months

**Data Source:** `members` (registrations + current status) and the immutable
`payments` ledger. Renewal, churn, retention and cohort figures are **derived
estimates** from payment coverage (there is no recorded status-change event) and
are labeled as such in the UI.

**Access Level:** All authenticated gym owners
**Data Isolation:** RLS enforced — each gym sees only its own members/payments

---

### 4. Renewals (`/payment-collection`)

**Icon:** CreditCard
**Purpose:** Manage payment collection and send SMS reminders
**Mobile:** Visible as "Renewals" (auto-scaled font)

**Sub-tabs:**

#### 4.1 Regular Payments (Default Tab)

**Key Features:**

- **Payment Table**
  - Members listed by next due date
  - Status indicators (Active, Expired)
  - Plan type and amount display
  - Days until/overdue counter

- **Mark as Paid Button**
  - Opens dialog to record payment
  - Allows custom payment date selection
  - Applies discounts if configured
  - Auto-calculates next due date
  - Generates payment receipt

- **Filter Options**
  - All members
  - Overdue only
  - Due this week
  - Upcoming (next 30 days)

- **SMS Features**
  - Send individual reminders
  - Bulk reminder options
  - Receipt SMS on payment

#### 4.2 Reminders Tab

**Key Features:**

- **Reminder Schedule Overview**
  - Automatic reminders: 7 days before, 3 days before, due date
  - Manual reminder option
  - SMS delivery status tracking

- **Reminders Table**
  - List of all sent reminders
  - Member details
  - Reminder type (7-day, 3-day, due today, overdue, receipt)
  - Sent timestamp
  - Delivery status (Sent, Delivered, Failed)

- **SMS History Modal**
  - Detailed view per member
  - Complete SMS log
  - Message content preview

**Access Level:** All authenticated gym owners
**SMS Provider:** Text.lk integration (configurable mock mode)

---

### 5. Announcements (`/make-announcement`)

**Icon:** Megaphone
**Purpose:** Send bulk SMS announcements to members
**Mobile:** Visible in bottom navigation

**Key Features:**

- **Announcement Composer**
  - Text message input (160 char recommended)
  - Character counter
  - Preview before sending

- **Recipient Selection**
  - All members
  - Active members only
  - Expired members only
  - Custom filter options

- **Announcement History**
  - Past announcements log
  - Sent count / Failed count
  - Timestamp
  - Message preview

- **Status Tracking**
  - Pending: Not yet sent
  - Sending: In progress
  - Completed: Successfully sent
  - Failed: Encountered errors

**Access Level:** All authenticated gym owners
**Rate Limiting:** Controlled send rate to prevent spam

---

### 6. Billing Setup (`/billing-setup`)

**Icon:** Receipt
**Purpose:** Configure membership plans and discount presets
**Mobile:** Visible in bottom navigation

**Sub-tabs:**

#### 6.1 Plan Types (Default Tab)

**Key Features:**

- **Plan List**
  - Plan type name (e.g., monthly, daily, annual)
  - Default amount in LKR
  - Active/Inactive status
  - Created/Updated timestamps

- **Add Plan Type**
  - Custom plan type name (lowercase, alphanumeric)
  - Set default amount
  - Activate/deactivate toggle

- **Edit/Delete Plans**
  - Modify existing plans
  - Deactivate instead of delete (data integrity)

**Usage:**

- Plans are referenced when adding members
- Members can have custom amounts overriding defaults

**Access Level:** All authenticated gym owners
**API Endpoints:** `/api/billing-setup/plans`

#### 6.2 Discounts Tab

**Key Features:**

- **Discount List**
  - Discount name/label
  - Percentage (1-100%)
  - Active/Inactive status

- **Add Discount**
  - Custom name (e.g., "Student Discount", "Early Bird")
  - Percentage value
  - Active toggle

- **Edit/Delete Discounts**
  - Modify existing discounts
  - Deactivate unused discounts

**Usage:**

- Discounts applied when recording payments
- Can be set as recurring (applies to all future payments)
- Discounts snapshotted in payment records

**Access Level:** All authenticated gym owners
**API Endpoints:** `/api/billing-setup/discounts`

---

### 7. Settings (`/settings`)

**Icon:** Settings
**Purpose:** Manage gym profile and account security
**Mobile:** Visible in bottom navigation

**Sub-pages:**

#### 7.1 Gym Information (`/settings/gym` - Default)

**Key Features:**

- **Profile Management**
  - Gym name
  - Username (unique, 3-50 chars)
  - Email address
  - Phone number (+94 format)
  - Gym address
  - Website URL
  - Profile image (SVG data URL)

- **Edit Functionality**
  - Update any field
  - Email verification required for changes
  - Username uniqueness validation

**Access Level:** All authenticated gym owners
**Data Source:** `gyms` table

#### 7.2 Account Security (`/settings/security`)

**Key Features:**

- **Password Management**
  - Change password
  - Password strength requirements
  - Current password verification

- **Authentication Settings**
  - OTP login status
  - Phone verification
  - Email verification status

- **Session Management**
  - Active sessions view
  - Logout all devices option

**Access Level:** All authenticated gym owners
**Security:** Supabase Auth integration with RLS

---

### 8. Support (`/support`)

**Icon:** Headset
**Purpose:** Access help resources and contact support
**Mobile:** Visible in bottom navigation

**Key Features:**

- **Contact Information**
  - Phone: 0704379967
  - WhatsApp link
  - Multilingual support info (English, Sinhala, Tamil)

- **Help Resources**
  - FAQs
  - Documentation links
  - Video tutorials

- **Support Ticket System** _(Future)_
  - Submit issues
  - Track ticket status

**Access Level:** All authenticated gym owners

---

## Mobile Navigation Behavior

### Bottom Navigation Bar

- **Visible Pages:** All 8 main navigation items
- **Scroll:** Horizontally swipable
- **Active Indicator:** Blue icon and text
- **Font Scaling:** Labels >8 characters auto-scale to smaller font (10px vs 12px)

### Hidden Elements on Mobile

- **Bulk Register Button** (Members page) - Hidden on screens <640px
- **Long text labels** automatically scaled down

### Responsive Design Breakpoints

- **Mobile:** < 640px (sm)
- **Tablet:** 640px - 1024px (sm to lg)
- **Desktop:** ≥ 1024px (lg+)

---

## Authentication Flow

### Login (`/login`)

**Post-Login Redirect:** `/dashboard`

### Registration (`/register`)

**Post-Registration:** Email verification required → `/login`

### Email Verification (`/verify-email`)

**Success:** Redirects to `/login` with success message

### Forgot Password (`/forgot-password`)

**Reset Link:** Sent via email

---

## Access Control

### Row Level Security (RLS)

All database queries are filtered by `gym_id`, ensuring complete data isolation between gyms.

### Authentication

- **Provider:** Supabase Auth
- **Session:** Cookie-based with automatic refresh
- **Logout:** Clears all client cache and redirects to `/login`

---

## API Endpoints Overview

### Dashboard

- `GET /api/dashboard/metrics` - Fetch dashboard metrics

### Members

- `GET /api/members` - List members (paginated, filtered)
- `POST /api/members` - Add new member
- `PATCH /api/members` - Update member
- `DELETE /api/members` - Soft delete member

### Payments

- `GET /api/payments` - List payments
- `POST /api/payments` - Record payment

### Analytics

- `GET /api/analytics/members` - Member trends for a range/year (`range`, `year`, optional `metric`)

### Billing Setup

- `GET /api/billing-setup/plans` - List plan types
- `POST /api/billing-setup/plans` - Create plan type
- `PATCH /api/billing-setup/plans` - Update plan type
- `DELETE /api/billing-setup/plans` - Delete plan type
- `GET /api/billing-setup/discounts` - List discounts
- `POST /api/billing-setup/discounts` - Create discount
- `PATCH /api/billing-setup/discounts/[id]` - Update discount
- `DELETE /api/billing-setup/discounts/[id]` - Delete discount

### SMS

- `POST /api/sms/send` - Send individual SMS
- `POST /api/sms/bulk` - Send bulk SMS
- `GET /api/sms/logs` - Fetch SMS history

### Auth

- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - End session
- `GET /api/auth/profile` - Fetch gym profile
- `PATCH /api/auth/profile` - Update gym profile

---

## Key Modals & Dialogs

### Add Member Modal

- **Trigger:** "+ Add Member" button on Members page
- **Fields:** Name, Phone, Plan Type, Amount, Discount, Start Date
- **Validation:** Zod schemas
- **Action:** Creates member record

### Edit Member Modal

- **Trigger:** Click member row in table
- **Fields:** All member fields editable
- **Actions:** Save changes, View payment history

### Bulk Add Members Modal

- **Trigger:** "Bulk Register" button (desktop/tablet only)
- **Steps:** Upload CSV → Validate → Preview → Confirm → Import
- **Max:** 1000 members per batch

### Mark as Paid Dialog

- **Trigger:** "Mark Paid" button in Renewals
- **Fields:** Payment date, Amount, Discount, Receipt SMS option
- **Action:** Records payment, updates next due date, sends SMS receipt

### SMS History Modal

- **Trigger:** View history link in Reminders table
- **Content:** Complete SMS log for selected member

---

## Notes

- All dates are stored in ISO 8601 format
- Currency is Sri Lankan Rupees (LKR)
- Phone numbers use +94 format
- Timestamps are stored with timezone (timestamptz)
- File uploads limited to 5MB
- SMS character limit: 160 recommended (longer messages split)

---

**Last Updated:** 2026-08-06
**Version:** 1.1
**Maintained By:** Development Team
