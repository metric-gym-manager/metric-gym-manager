# Access Control — UI flow and device capacity

> On-demand reference. Companion to `access-control-integration.md` (backend
> design) and `../integrations/vft/vft-api-assumptions.md` (vendor facts).
>
> **Status:** PLAN. The backend foundation is built and tested; none of this UI
> exists yet.

---

## 1. Where things live

Two homes, split by how often a gym touches them.

| Route                          | Who, how often         | Contents                                |
| ------------------------------ | ---------------------- | --------------------------------------- |
| **`/access-control`**          | Front desk, daily      | Device health, capacity, activity log   |
| **`/settings/access-control`** | Owner, once at setup   | Credentials, register/remove devices    |
| **Member modal** (existing)    | Front desk, per member | Access status, enrol/remove fingerprint |

Everything sits inside `<FeatureGate feature="accessControlHardware">`, so
non-Enterprise gyms see the upsell panel and never reach a route that would
403 (rule 2.13). All screens compose L2 primitives and L3 composites — the
device list and activity log are `DataTable`s, confirmations use the existing
`ConfirmDialog`. No new foundational patterns (rule 2.17).

**Composition direction matters:** the member-modal panel lives in
`features/access-control/components/MemberAccessPanel.tsx` and is composed at
the **page** level, so `features/members` never imports access-control and
stays deletable in isolation (R2).

---

## 2. Fingerprint enrolment — the flow that carries the product

VFT confirmed: calling `enrollfinger` **changes the state of the terminal** — a
prompt appears on the reader — and the member then presents their finger there.
So the app drives it, and the member walks to the device.

The whole design problem is that **the app cannot see the finger**. There is no
completion callback, so success is discovered by polling. The UI must therefore
be honest about not knowing yet, rather than claiming success optimistically.

```
Member modal
  └─ Access section
       Enrol ID          100 042          (our subject_id, the device's EmpId)
       Fingerprint       Not enrolled
       Door access       Allowed until 15 Jan
       [ Enrol fingerprint ]
```

**Step 1 — pick a device.** If the gym has more than one active reader, a
picker appears (populated from our own `access_devices`, not a live vendor
call — the list is small and already synced). One reader, which is the norm
here: skip straight to step 2.

**Step 2 — trigger and instruct.** We call `enrollfinger`. The dialog switches
to a waiting state with the physical instruction, because the member is about
to walk away from the desk:

> **Go to the reader now**
> Ask the member to place the same finger on the reader **three times**, then
> press OK on the device.
> _Waiting for the reader… 47s_

**Step 3 — poll.** Every 3 seconds, check whether the template has appeared.
The countdown reflects the device's own enrolment timeout, so the UI gives up
at roughly the same moment the hardware does.

**Step 4 — resolve.**

- Template appears → "Enrolled ✓", panel updates, dialog can be closed.
- Countdown ends → "Enrolment didn't complete. Try again." — **not** an error
  state. The overwhelmingly likely cause is that the member walked off or the
  reader timed out, which is not a failure of anything (rule 2.8: pending is
  not error).

**Removing a fingerprint** is a separate action with a `ConfirmDialog`. It
clears the template from the reader and **keeps the membership record
untouched** — deleting someone's fingerprint is not an edit to their
membership.

---

## 3. `/access-control` — the operational page

### 3.1 Device cards (top)

One card per reader:

```
Front Door                                    ● Online
QEM1253800017 · seen 12s ago
Members on device   2,847 / 3,000   [███████████████░]  95%
⚠ Nearly full — 153 slots left        [ Free up space ]
```

**Online/offline** comes from the 2-minute device timeout VFT quoted: a reader
not seen for 2 minutes shows Offline. Offline is stated plainly and _without
alarm_ — the door still works offline, because the terminal enforces validity
from its own clock. The copy says so, so nobody panics or starts letting people
in manually:

> Offline since 14:02. The door still works — members are admitted from the
> reader's own records. New changes will sync when it reconnects.

That sentence is the single most important piece of copy on the page.

### 3.2 Activity log

A `DataTable`, newest first:

| Time  | Member       | What happened                        | Reader     |
| ----- | ------------ | ------------------------------------ | ---------- |
| 18:42 | Nimal Perera | Refused — membership expired         | Front Door |
| 18:31 | Kasun Silva  | Entry allowed                        | Front Door |
| 18:04 | —            | Refused — fingerprint not recognised | Front Door |

Filters: **All · Entries · Refusals · Alerts**.

Refusal reasons come from the vendor event-code table
(`config/DeviceEventCodes.ts`), rendered in plain language. This is what turns
_"the door is broken"_ into _"your membership expired on the 15th"_ at the
front desk, and it is the main reason the log earns a page.

Rows with no member are real and expected — an unrecognised finger has no
`EmpId` to resolve. Show them; they're how a gym notices someone trying it on.

### 3.3 Alerts

Pinned above the log when present, dismissible:

- **Duress** (event 101/103) — someone opened the door under coercion. Never
  buried in a list.
- **Tamper** (100), **reader offline** (110).
- **Reader nearly full** (see §4).

Gym managers see plain language only. Vendor return codes, stack traces and
sync-queue internals stay on the SaaS-admin `/system-health` page (rules
2.8 / 2.9).

---

## 4. Device capacity and eviction

### 4.1 The problem

A reader holds a fixed number of fingerprint templates — 1,000–3,000 depending
on model. A gym that has churned through members for two years will have far
more member records than that, and the reader will fill up. When it does, the
device returns `-18` (_device storage full_) and new members silently stop
being enrolled.

### 4.2 The insight that makes this cheap

VFT holds templates **centrally**, and `DELETE /api/template/fromdev/{EmpId}`
removes a template **from the reader while keeping the VFT record**.

So eviction is **reversible without re-enrolment**. A member evicted today and
returning next year gets pushed back to the reader with `syncsometoone` — they
never touch the scanner again. That is what makes an eviction policy acceptable
rather than a customer-service problem.

This is why the vendor record must never be deleted for a merely inactive
member. `DELETE /api/template/{EmpId}` — which removes the record _and_ the
template — is reserved for genuine erasure requests.

### 4.3 The policy

**A device slot is only worth spending on a member who can actually get in.**

Eviction order, strictly:

1. **Cancelled** members — longest cancelled first.
2. **Expired** members — longest expired first.
3. **Suspended** members.
4. **Never an Active member.** If eviction cannot free space without touching
   an Active member, that is a genuine capacity problem: alert the gym and the
   SaaS admin, and stop. Buying a second reader is the answer, not silently
   locking a paying member out.

Because every candidate above is already `allowed: false`, eviction removes
nothing that was granting access. It is pure reclamation.

### 4.4 When it runs

**Proactively** — the nightly reconcile checks usage. Above **85%**, it evicts
blocked members down to a **70%** target, so the gym gets headroom rather than
teetering at the limit and re-running every night.

**Reactively** — a `-18` return code is already classified `NeedsAttention` by
`lib/access-control/returnCodes.ts`. That handler triggers an eviction pass and
then retries the failed command once. A member joining on a full device
therefore succeeds instead of failing to a support ticket.

**Manually** — the "Free up space" button on the device card, showing what will
be removed before it does it:

> Free up space on Front Door
> This will remove **412 fingerprints** from the reader — members who are
> cancelled, expired or suspended. Their records are kept, and their
> fingerprint is restored automatically if they rejoin. No active member is
> affected.
> [ Cancel ] [ Free up space ]

### 4.5 What the backend needs

Small additions to what is already built:

- `access_devices`: `template_capacity` (nullable — unknown until an operator
  sets it or a `-18` reveals it) and `template_count`.
- `member_access_subjects`: `on_device` plus `device_removed_at`, tracked
  separately from `provisioned_at`. Three distinct states now matter — **exists
  on VFT**, **template on the reader**, **fingerprint enrolled** — and
  collapsing them is what would cause a spurious re-enrolment prompt.
- `deriveAccessCommands` gains `onDevice` in `SubjectSyncState`: an allowed
  member who is not on the device needs `SyncToDevice` before their validity
  window, which is the automatic restoration path for a returning member.
- New use case `EvictInactiveSubjects` (candidate selection is pure and
  unit-testable, like the decision logic).

---

## 5. Build order

| Step                                                    | Why this order                                      |
| ------------------------------------------------------- | --------------------------------------------------- |
| 1. Supabase repository + remaining use cases            | Everything below needs it                           |
| 2. Routes + webhook + crons                             | The UI needs an API to call                         |
| 3. Capacity: schema additions + `EvictInactiveSubjects` | Backend-only, testable without UI                   |
| 4. `/settings/access-control`                           | Nothing works until a gym can enter credentials     |
| 5. Member modal panel + enrolment dialog                | The flow that carries the product                   |
| 6. `/access-control` page                               | Device cards, capacity, activity log                |
| 7. Alerts + `/system-health` surfacing                  | Polish, but duress alerts should not lag far behind |

---

## 6. Open product decisions

1. **Biometric consent.** Fingerprint templates are sensitive personal data and
   we now trigger enrolment from our own UI. The privacy policy needs a
   biometric-processing disclosure, and registration needs a consent alongside
   `accepted_terms_at` / `accepted_gym_rules_at`. **This should land before the
   enrolment dialog ships**, since that dialog is the moment of collection.
2. **Who may open a door remotely?** Currently planned as gym-owner-only,
   rate-limited and audited. Confirm whether front-desk staff need it too.
3. **How long to keep access events.** They are attendance data about
   identifiable people. A retention window (12 months?) should be decided
   rather than defaulting to forever.
