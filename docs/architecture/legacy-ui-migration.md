# Legacy shadcn UI → Metric Design System — Migration Analysis & Plan

> Status: **Phase A executed** (non-breaking token unification). Phase B
> (consumer swap to canonical primitives + legacy deletion) is fully specified
> below and ready to execute behind a visual-QA pass.

This document traces **every** file that still depends on the legacy shadcn
`@/components/ui/*` components or the `.mws-*` / `.mauth-*` class layer, defines
the exact change for each, and sequences the work so execution needs **no
per-file decisions**.

---

## 1. Why two systems exist

Phases 0–3 built the canonical Metric design system (tokens → `@/components/ui`
primitives → `@/components/common/composites`). It was **additive**: the older
shadcn `@/components/ui/<name>` components and the hand-written `.mws-*`
(workspace, light) / `.mauth-*` (auth, dark) CSS layer were left in place so no
screen broke. This migration removes that duplication.

Key fact that lowers risk: in Phase 0 the `.mws-*` / `.mauth-*` CSS variables
were **re-pointed to the `--ds-*` design tokens**. So those ~22 screens already
render from the design tokens and are visually consistent — removing that layer
is architectural cleanup, not a visual fix.

---

## 2. Inventory (traced)

### 2a. Files importing legacy shadcn `@/components/ui/*` — 48 files

**Group 1 — API-compatible primitives only (safe mechanical swap): 13 files**
Uses only Button / Badge / Input / Label / Checkbox / Textarea / Progress /
Tooltip, whose canonical equivalents accept a superset API.

- `components/layout/EmailVerificationBanner.tsx` (Button)
- `components/layout/Header.tsx` (Button)
- `components/layout/Sidebar.tsx` (Button)
- `components/pwa/InstallButton.tsx` (Button)
- `app/(dashboard)/settings/billing/BillingPageClient.tsx` (Button)
- `app/(dashboard)/settings/policies/page.tsx` (Button, Textarea)
- `app/(dashboard)/billing-setup/AdmissionFeeTab.tsx` (Button, Input, Label, Checkbox)
- `features/registration/components/RegistrationQRCard.tsx` (Button)
- `features/settings/components/ProfileImageUpload.tsx` (Button, Label)
- `features/members/components/MemberPhotoSection.tsx` (Button, Badge)
- `features/subscriptions/components/QuotaReachedUpsell.tsx` (Button)
- `features/announcements/components/AnnouncementProgress.tsx` (Card, Button, Badge, Progress)
- `app/(admin)/qr-codes/QrCodesDashboardClient.tsx` (Button, Input, AlertDialog)\*

  \*AlertDialog pushes this to Group 2 in practice.

**Group 2 — compound components (structural rewrite, needs visual QA): 35 files**
Uses `Dialog`, `AlertDialog`, shadcn `Select` (Radix), shadcn `Table`, or `Card`
sub-components whose structure differs from the canonical primitives.

- Members (10): `AddMemberModal`, `BulkAddMemberModal`, `DayPassModal`,
  `EditMemberModal`, `MemberDetailModal`, `MemberDetailModalMobile`,
  `MembersTable`, `PaymentCollectionModal`, `PaymentDetailsModal`,
  `MemberPhotoSection`
- Payments (6): `MarkPaidDialog`, `PaymentCollectedTable`,
  `PaymentRemindersTable`, `RegularPaymentTable`, `ReminderStatusTable`,
  `SMSHistoryModal`
- Subscriptions (8): `BillingHistoryTable`, `CancelSubscriptionDialog`,
  `CurrentPlanCard`, `FeatureGate`, `PricingTable`, `ReactivationLimitDialog`,
  `ReturnStatusPanel`, `UpgradeConfirmDialog`
- Billing-setup (3): `DiscountsTab`, `PlanTypesTab` (Select), (`AdmissionFeeTab` in G1)
- Admin system-health (3): `BillingFailuresTable`, `CronStatusGrid`, `RawSMSFailureTable`
- Settings (2): `settings/security/page.tsx` (Dialog), (`policies` in G1)
- Revenue (1): `RevenueMetricCard` (Card)
- Shared (2): `components/common/ConfirmDialog.tsx`, `hooks/use-confirm-dialog.tsx` (AlertDialog)

### 2b. Files using `.mws-*` / `.mauth-*` classes — 22 files, 365 occurrences

Already token-sourced (Phase 0). Concentrated in workspace shells
(`components/workspace/*`), auth (`components/auth/AuthShell`, auth pages),
member tables/modals, and settings. Full list: `grep -rlE "mws-|mauth-" src`.

---

## 3. Component API mapping (decision-free)

| Legacy `@/components/ui/*`                                                                                          | Canonical                                               | Prop / structural mapping                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `button` `Button`                                                                                                   | `@/components/ui` `Button`                              | variant: `default`→`primary`, `outline`→`secondary`, `secondary`→`secondary`, `ghost`→`ghost`, `destructive`→`destructive`, `link`→`link`. size: `default`→`md`, `sm`→`sm`, `lg`→`lg`, `icon`→`icon`. `asChild` supported. `buttonVariants` export retained for `alert-dialog`. |
| `badge` `Badge`                                                                                                     | `Badge`                                                 | variant: `default`→`accent`, `secondary`→`neutral`, `destructive`→`error`, `outline`→`neutral`.                                                                                                                                                                                 |
| `input` `Input`                                                                                                     | `Input`                                                 | drop-in (canonical omits native `size` prop — unused in repo).                                                                                                                                                                                                                  |
| `label` `Label`                                                                                                     | `Label`                                                 | drop-in.                                                                                                                                                                                                                                                                        |
| `checkbox` `Checkbox`                                                                                               | `Checkbox`                                              | Radix `onCheckedChange` → native `onChange(e)` (read `e.target.checked`).                                                                                                                                                                                                       |
| `textarea` `Textarea`                                                                                               | `Textarea`                                              | drop-in.                                                                                                                                                                                                                                                                        |
| `progress` `Progress`                                                                                               | `Progress`                                              | `value` drop-in.                                                                                                                                                                                                                                                                |
| `tooltip` (`Tooltip`,`TooltipTrigger`,`TooltipContent`,`TooltipProvider`)                                           | `Tooltip` + `TooltipProvider`                           | collapse trigger/content into `<Tooltip content=…>`.                                                                                                                                                                                                                            |
| `card` (`Card`,`CardHeader`,`CardTitle`,`CardDescription`,`CardContent`,`CardFooter`)                               | `Card`,`CardHeader`,`CardTitle`,`CardBody`,`CardFooter` | `CardContent`→`CardBody`; `CardDescription`→`<p class="text-caption text-ink-muted">`; note canonical `CardHeader` is a bordered flex-row.                                                                                                                                      |
| `table` (`Table`,`TableHeader`,`TableBody`,`TableRow`,`TableHead`,`TableCell`,`TableCaption`)                       | `Table` primitives (same names)                         | near drop-in; wrap in `TableContainer`; prefer `DataTable` where sorting/filtering exists.                                                                                                                                                                                      |
| `select` (Radix: `Select`,`SelectTrigger`,`SelectValue`,`SelectContent`,`SelectItem`)                               | native `Select`                                         | restructure to `<Select><option>…</option></Select>`; move `onValueChange`→`onChange`.                                                                                                                                                                                          |
| `dialog` (`Dialog`,`DialogTrigger`,`DialogContent`,`DialogHeader`,`DialogTitle`,`DialogDescription`,`DialogFooter`) | `Modal`                                                 | `open`/`onOpenChange` pass through; `DialogTitle`→`title`, `DialogFooter`→`footer`, body→children.                                                                                                                                                                              |
| `alert-dialog` (`AlertDialog…`)                                                                                     | `ConfirmDialog` / `DeleteDialog`                        | map action→`onConfirm`, cancel→`onOpenChange(false)`; destructive→`destructive`.                                                                                                                                                                                                |

### `.mws-*` / `.mauth-*` → tokens/composites

`mws-panel`→`Card`; `mws-btn*`→`Button`; `mws-table`→`Table`; `mws-stat`→`StatCard`;
`mws-badge*`→`Badge`; `mws-input/select/textarea`→`Input/Select/Textarea`;
`mws-toggle`→`Switch`; `mws-modal/overlay`→`Modal`; `mws-drawer`→`Drawer`;
`mws-tab*`→`Tabs`; `mws-subnav`→`SideNav`; `mws-row`→`SettingsRow`. Auth (`mauth-*`)
maps the same with `theme="dark"`.

---

## 4. Execution plan

### Phase A — non-breaking token unification (DONE)

Remap the shadcn semantic CSS variables (`--primary`, `--primary-foreground`,
`--ring`, `--destructive`, foregrounds) in `globals.css` to the Metric palette,
and strip decorative shadows from the legacy `button`. Every one of the 48
screens instantly renders with the correct brand colors and accent focus rings.
**Zero consumer or API changes → provably non-breaking.** Verified by
type-check + lint + arch + unit tests + `next build`.

### Phase B — consumer swap + legacy deletion (ready; needs visual QA)

Per feature, in this order (lowest risk first), using the §3 mapping:

1. Group 1 (13 files) — mechanical primitive swap.
2. `common/ConfirmDialog` + `hooks/use-confirm-dialog` → wrap canonical `ConfirmDialog`.
3. Group 2 by feature: settings → admin → subscriptions → payments → billing-setup → members.
4. When a legacy `ui/<name>.tsx` has zero importers, **delete it**.
5. When `.mws-*`/`.mauth-*` have zero usages, delete those CSS blocks + alias
   vars from `globals.css` (keep `--ds-*`).
6. Add ESLint `no-restricted-imports` banning `@/components/ui/<legacy>` paths.

### Verification gate (every phase)

`npm run type-check && npm run lint && npm run arch:check && npm test && npm run build`,
then a **visual pass** of each touched screen in light + dark before master.
Promote to master via PR/CI — never a direct push.
