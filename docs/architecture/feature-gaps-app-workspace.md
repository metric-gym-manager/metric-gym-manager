# Feature Gaps — App Workspace (Enterprise UI/UX Overhaul)

Implementation notes for `App Workspace.dc.html` (the Claude Design handoff).
The design was rebuilt as the authenticated **App Workspace** — a light-theme,
monochrome, Geist-typeset shell over the existing `(dashboard)` routes. This
document records where the design and the current app capabilities diverge, and
how each divergence was handled:

- **WIRED** — design surface backed by a real endpoint/hook.
- **DEAD-CODE** — design surface with no backing capability; implemented as
  frontend-only (clearly commented in source) so the design is complete and the
  gap is visible.
- **ADAPTED** — design intent kept, but mapped onto what the backend actually
  supports (labels/columns adjusted).

The design system lives in `src/app/globals.css` under the `.mws-*` namespace
(scoped to `.mws-root`), with shared primitives in
`src/components/workspace/`.

---

## Shell

| Design element                              | Status    | Notes                                                                                                                                                                                                                                                        |
| ------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Collapsible sidebar (240/56px), grouped nav | WIRED     | `WorkspaceSidebar`; collapse persisted via `useSyncExternalStore` + localStorage.                                                                                                                                                                            |
| Workspace selector (gym · location · tier)  | WIRED     | Gym name from `/api/auth/profile`; tier from `useSubscription`; location parsed from `gym_address`.                                                                                                                                                          |
| Breadcrumb `Gym / Section`                  | WIRED     | `WorkspaceHeader`, derived from the route via `nav.ts`.                                                                                                                                                                                                      |
| **"ALL SYSTEMS OPERATIONAL" pill**          | DEAD-CODE | Gym managers have **no** platform-health endpoint by design — technical infra detail is SaaS-admin-only (architecture §2.9). Rendered as a static positive indicator. A real per-gym status would need a public health signal that never leaks infra detail. |
| Command palette (⌘K)                        | OMITTED   | Per request — not built. The sidebar search trigger was removed with it.                                                                                                                                                                                     |

## Dashboard (Overview)

| Design element             | Status | Notes                                                                                                                                                                                                                                                                |
| -------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4 stat tiles               | WIRED  | `/api/dashboard/metrics` (overdue, revenue, expiring-this-week, active).                                                                                                                                                                                             |
| Trailing revenue bar chart | WIRED  | `/api/revenue/monthly` `historicalData`, last 8 months, current accented.                                                                                                                                                                                            |
| Recent payments table      | WIRED  | `/api/payment-collection/collected` (current month). Design's **Method** column (CASH/CARD/BANK) dropped — payment method is not on the collected-payments row shape.                                                                                                |
| **Reminder queue panel**   | WIRED  | `GET /api/reminders/queue` (sms `getReminderQueue`) — upcoming automated reminders derived from active members' `next_due_date` + plan reminder thresholds (`ReminderConfig`), the same rules the `send-reminders` cron applies. Header shows the real queued count. |

## Members

| Design element                                  | Status  | Notes                                                                                                                            |
| ----------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Heading with live record count, search, table   | WIRED   | `/api/members` (search + status filter + pagination). Row click opens the existing member drawer (`useMemberModal`).             |
| Add member / Bulk import / Create day pass      | WIRED   | Reuse existing `AddMemberModal` / `BulkAddMemberModal` / `DayPassModal`.                                                         |
| Status badges (ACTIVE / EXPIRES SOON / EXPIRED) | ADAPTED | App statuses are active/expired/suspended/cancelled; "EXPIRES SOON" is derived from an active member's `next_due_date` ≤ 7 days. |
| Member drawer (right slide-out)                 | WIRED   | `MemberDetailModal` migrated onto the Metric Design System (platform DS migration).                                              |

## Revenue

| Design element                | Status | Notes                                                                                                                                                                                                                                                                                         |
| ----------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stat tiles, monthly bar chart | WIRED  | `/api/revenue/monthly`.                                                                                                                                                                                                                                                                       |
| Breakdown by plan type        | WIRED  | Period revenue split from `/api/payment-collection/collected` (collected + payment count + share); the **Members** (enrolment) column restored from `GET /api/members/enrolment-by-plan` (active member count per plan). Rows union collected-this-period plans with actively-enrolled plans. |
| Year/month selector           | ADDED  | Kept a compact period selector so period navigation from the original screen is preserved (design showed a single period).                                                                                                                                                                    |

## Fee Collection

| Design element                               | Status  | Notes                                                                                                                                                                     |
| -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expired / Expires-this-week / Collected tabs | WIRED   | Dues from `/api/regular-payments?filter=all` (partitioned client-side by `daysUntilDue`); collected from `/api/payment-collection/collected`.                             |
| Remind action                                | WIRED   | `POST /api/sms/send` with the age-appropriate `smsType` (overdue/due_today/reminder_3day/reminder_7day).                                                                  |
| Record payment / Receipt                     | WIRED   | Opens the member drawer (record-payment / history).                                                                                                                       |
| **Last reminder** column                     | OMITTED | `/api/regular-payments` does not return last-reminder metadata; column dropped rather than shown empty. (Available per-member via the reminders feed, not this endpoint.) |

## Announcements

| Design element                                        | Status  | Notes                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compose broadcast (audience, message, segments, send) | WIRED   | `POST /api/announcements`; live send progress via `AnnouncementProgress`. Two-step inline confirm before dispatch.                                                                                                                                                                                        |
| Audience options                                      | ADAPTED | Backend supports **all / active / expired**. Design's "Overdue / Due this week" audiences are not backend segments and were not added.                                                                                                                                                                    |
| Delivery log                                          | WIRED   | `/api/announcements` now surfaces the persisted per-broadcast `status` / `sent_count` / `failed_count` (already maintained by the background sender; the gap was exposing them via the list type + UI). Shows **Delivered N/M**, a failed count, and a real DELIVERED / PARTIAL / SENDING / FAILED badge. |

## Membership / Billing Setup

| Design element                                          | Status         | Notes                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Heading + tabs (Plan types / Discounts / Admission fee) | WIRED (framed) | App Workspace heading + `.mws-tab` bar wrapping the existing full-CRUD `PlanTypesTab` / `DiscountsTab`. Their inner tables retain the prior styling — a follow-up can re-cut them to the design's read tables. Design's **Cycle / Enrolled / In-use** columns are not surfaced by the plan/discount endpoints.                                                   |
| **Admission fee** tab                                   | WIRED          | Gym-level one-time registration fee (`admission_fee` / `admission_fee_enabled` on `gyms`). `GET`/`PATCH /api/billing-setup/admission-fee`. When enabled it appears on the public self-registration form and is added to the first payment; the charged amount is always resolved **server-side** (never from client input), same trust model as the plan amount. |

## Settings

| Design element                                               | Status     | Notes                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Left sub-nav shell                                           | WIRED      | `settings/layout.tsx` rebuilt to the 160px left column.                                                                                                                                                                                                                                                                                                                                     |
| Gym Information                                              | WIRED      | Inline control rows; same react-hook-form + `PATCH /api/settings/gym`.                                                                                                                                                                                                                                                                                                                      |
| Registration → QR                                            | WIRED      | Existing `RegistrationQRCard`.                                                                                                                                                                                                                                                                                                                                                              |
| Registration → **Intake rules** (auto-approve, default plan) | REMOVED    | Intake automation is intentionally not offered; the dead-code preview toggle was deleted. Self-registrations land unverified and are approved via `POST /api/members/[id]/verify`.                                                                                                                                                                                                          |
| **Rules & Terms** (gym rules + terms of service)             | WIRED      | Per-gym editable Rules & TOS documents (`gym_rules` / `gym_terms` on `gyms`, pre-seeded with defaults from `features/settings/config/defaultGymPolicies.ts` and backfilled by migration). `GET`/`PATCH /api/settings/policies`; editable with reset-to-default. The rules document is the target the registration forms' "agree to the gym's guidelines & rules" consent checkbox links to. |
| Security (email/password/2FA/sessions)                       | WIRED (DS) | Account security page migrated onto the Metric Design System (platform DS migration). Design's **2FA** and **active-session revoke** remain design-only (no backend).                                                                                                                                                                                                                       |
| Subscription (plan / invoices / change / cancel)             | WIRED (DS) | Subscription/Billing page migrated onto the Metric Design System (platform DS migration); change-plan and cancel wired via the subscriptions feature.                                                                                                                                                                                                                                       |

## Support

| Design element             | Status | Notes                                                                                                                                                       |
| -------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contact rows + ticket form | WIRED  | `POST /api/feedback`. Subject is prepended to the message body (endpoint unchanged). Real contact channel is WhatsApp/phone (not the mock's email address). |

---

## Follow-ups to fully close the design

Status after the App-Workspace follow-up pass:

1. ✅ **Done** — per-announcement delivery aggregation (`status` / `sent_count` /
   `failed_count`) is surfaced in the delivery log (Delivered N/M + real status
   badge). The columns were already persisted by the background sender; the gap
   was exposing them via the list type + UI.
2. ✅ **Done** — reminder-queue read endpoint `GET /api/reminders/queue`
   (`features/sms` → `getReminderQueue`) powers a live dashboard panel.
3. ✅ **Done (enrolment)** — `GET /api/members/enrolment-by-plan` restores the
   Members column on the Revenue breakdown. Discount-usage counts remain a
   future follow-up.
4. ❌ **Removed** — gym-scoped intake automation is intentionally not offered;
   the dead-code toggle was deleted.
5. ✅ **Largely done** — the member drawer, Security and Subscription screens
   were migrated onto the Metric Design System by the platform DS work; the
   Dashboard, Announcements and Revenue pages were migrated onto the DS in this
   pass (`@/components/ui` + `@/components/common/composites`, replacing the
   legacy `.mws-*` markup). Re-cutting the Billing-Setup inner tables to the DS
   remains open.

> **Design-system note.** The original overhaul shipped the `.mws-*` namespace
> (still valid — re-pointed at the `--ds-*` tokens). The platform has since
> adopted the **Metric Design System** (`.claude/DESIGN_SYSTEM.md`); new and
> migrated screens compose its L2 primitives / L3 composites rather than the
> legacy `.mws-*` classes.
