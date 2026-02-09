# Gym Management SaaS - Business Requirements

## Overview
This document defines the gym-specific business logic, feature requirements, and workflows for the multi-tenant gym management platform.

## Core Features

### 1. Member Management

#### Member Lifecycle
1. **Registration**
   - Collect personal information (name, email, phone, DOB, address)
   - Emergency contact information required
   - Photo upload (optional)
   - Medical conditions/waivers
   - Assign membership plan

2. **Active Membership**
   - Access control via QR code/RFID
   - Check-in tracking
   - Attendance history
   - Membership renewal reminders

3. **Member Statuses**
   - `active`: Active membership, full access
   - `pending`: Awaiting payment or activation
   - `frozen`: Membership temporarily suspended
   - `expired`: Membership expired, needs renewal
   - `cancelled`: Membership terminated

#### Member Features
- Personal dashboard with stats
- Signed up services (ex: gym use only, muay thai, boxing etc)
- Payment history

### 2. Membership Plans

#### Plan Types
1. **Drop-in**: Single visit pass
2. **Class Pack**: X number of classes (10, 20, etc.)
3. **Monthly**: Recurring monthly membership
4. **Annual**: Yearly membership with discount
5. **Custom**: Special plans for corporate/groups

#### Plan Configuration
- Name and description
- Pricing (base price, setup fee, discounts)
- Billing frequency (one-time, monthly, annual)
- Access level (24/7, business hours, specific times)
- Contract length (month-to-month, 6 months, 12 months)
- Auto-renewal settings

#### Membership Features
- Trial periods (7, 14, 30 days)
- Family/corporate discounts
- Referral bonuses
- Seasonal promotions
- Membership freezing
- Pro-rated refunds

### 3. Trainer/Staff Management

#### Staff Roles
- **Gym Owner**: Full access, billing management
- **Gym Admin and front desk**: Member management, staff management, check-ins

#### Trainer Features
- Personal profile with bio and certifications
- Class assignment and schedule
- Availability calendar

#### Staff Scheduling
- Shift management
- Time-off requests
- Class coverage requests
- Substitute instructor assignment

### 5. Billing & Payments

#### Payment Processing
- One-time payments (drop-ins, class packs)
- Recurring billing (monthly/annual memberships)
- Failed payment retry logic (3 attempts over 7 days)
- Payment method management (credit card, bank account)
- Multiple payment methods per member
- PCI-compliant payment handling

#### Invoice & Receipt Management
- Automatic invoice generation
- Email receipts
- Payment history
- Outstanding balance tracking
- Manual payment entry (cash, check)

#### Revenue Tracking
- Monthly revenue reports
- Membership revenue vs class revenue
- Refunds and adjustments
- Tax reporting
- Commission calculations

### 6. Access Control

#### Check-in System
- QR code scanning
- RFID card scanning
- Manual check-in by staff
- Photo verification
- Access denied reasons (expired, frozen, unpaid)

#### Access Rules
- 24/7 access for specific plans
- Business hours only
- Peak/off-peak restrictions
- Guest check-in (with member present)
- Banned members list

### 7. Analytics & Reporting

#### Member Analytics
- Total active members
- New member trends
- Churn rate
- Attendance patterns
- Member demographics
- Retention rate by membership type

#### Financial Analytics
- Monthly recurring revenue (MRR)
- Annual recurring revenue (ARR)
- Average revenue per member (ARPM)
- Payment collection rate
- Outstanding balances
- Revenue by membership type

#### Operational Analytics
- Class attendance rates
- Most popular classes
- Peak hours

#### Custom Reports
- Member retention by cohort
- LTV (Lifetime Value) analysis

### 8. Communication

#### Automated Notifications
- Welcome email on signup
- Payment confirmation
- Payment failure alerts
- Membership expiration reminders (30, 7, 1 day)
- Class booking confirmation
- Class cancellation notice
- Waitlist promotion notification
- Birthday greetings

#### Manual Communications
- Bulk email/SMS to segments
- Individual member messaging
- Class announcements
- Promotional campaigns
- Emergency notifications

### 9. Multi-tenant Isolation

#### Gym-Level Data
Each gym operates independently with:
- Own members and staff
- Own class schedules
- Own membership plans
- Own branding (logo, colors)
- Own billing configuration
- Own reports and analytics

#### Cross-gym Features (Optional Future)
- Multi-gym memberships
- Corporate accounts across locations
- Consolidated reporting for gym chains

## Business Rules

### Membership Rules
1. Member can only have one active primary membership at a time
2. Class packs don't expire (configurable)
3. Frozen memberships don't consume billing cycles
4. Cancellation requires notice period (configurable, typically 30 days)
5. Pro-rated refunds calculated from cancellation date

### Class Booking Rules
1. Members can't book more than X classes in advance (configurable)
2. Late cancellation within Y hours incurs penalty
3. Z no-shows in 30 days = membership review
4. Waitlist auto-enrolls when spot opens
5. Class credits deducted at booking time, not check-in

### Payment Rules
1. Failed payment = 3 retry attempts over 7 days
2. After 3 failures, membership moves to `pending` status
3. Late fees applied after grace period (configurable)
4. Refunds require manager approval
5. Payment disputes logged and tracked

### Access Rules
1. Members must check in within 15 minutes of class start
2. Late arrivals (>15 min) may be denied entry if class is full
3. Guest access requires member to check in first
4. After-hours access logged for security
5. Access denied if membership status is not `active`

## Feature Priorities

### Phase 1 (MVP)
- [ ] Member registration and management
- [ ] Basic membership plans (monthly, annual)
- [ ] Class scheduling and booking
- [ ] Check-in system (QR code)
- [ ] Payment processing (Stripe)
- [ ] Basic reporting

### Phase 2
- [ ] Trainer profiles and assignment
- [ ] Waitlist management
- [ ] Email notifications
- [ ] Member mobile app
- [ ] Advanced reporting

### Phase 3
- [ ] SMS notifications
- [ ] Member progress tracking
- [ ] Personal training scheduling
- [ ] Retail/pro-shop integration
- [ ] Mobile check-in

### Phase 4
- [ ] Advanced analytics
- [ ] Marketing automation
- [ ] Multi-location support
- [ ] Equipment tracking
- [ ] Biometric access control

## Integration Requirements

### Required Integrations
- Payment processing (Stripe recommended)
- Email service (SendGrid, Postmark)
- File storage (AWS S3, Cloudinary)

### Optional Integrations
- SMS service (Twilio)
- Calendar sync (Google Calendar, iCal)
- Accounting software (QuickBooks, Xero)
- Marketing tools (Mailchimp, HubSpot)
- Access control hardware

## Compliance & Legal

### Data Privacy
- GDPR compliance for EU members
- CCPA compliance for California members
- Right to data deletion
- Data export functionality

### Liability
- Digital waiver signing
- Medical condition disclosure
- Photo/video consent
- Equipment damage policies

### Financial
- PCI DSS compliance for payment data
- Tax collection and reporting
- Invoice generation requirements
- Refund policy documentation
