# VFT GYM API v2.0 — endpoint reference

> **Provenance.** VFT supplied the `VFT_GYM_API_V2.0` Postman collection and
> the two code tables on **2026-08-28**. The importable collection is
> [`vft-gym-api-v2-collection.json`](./vft-gym-api-v2-collection.json); the code
> tables are [`vft-code-tables.md`](./vft-code-tables.md). **This file is fact.**
> Where it disagrees with [`vft-api-assumptions.md`](./vft-api-assumptions.md),
> this file wins and that one should be corrected.

Our client is `src/lib/access-control/VftAccessControlProvider.ts`, behind the
`IAccessControlProvider` port. Every path below was verified against the
collection on 2026-08-28: **all 17 endpoints we call match exactly**, including
the parameter casing.

---

## 1. Authentication

```
POST {baseurl}/api/user/          →  { "token": "..." }
     body: { "email": "...", "password": "..." }
```

Every other request carries the bearer as a **header named `ApiToken`** — not
`Authorization`, not a query parameter.

Notes that matter:

- **The trailing slash on `/api/user/` is real.** It is in the collection.
- **Token lifetime is undocumented and still unknown.** `TOKEN_CACHE_TTL_SECONDS`
  is a conservative 30-minute ceiling, and a `401` triggers one silent re-auth
  and retry (`isRetry`), so being wrong costs one extra round trip rather than a
  failed command. This is the last genuinely open question in §3.10.
- `POST /api/user/logout` exists. **We never call it.** The token cache is
  process-local on serverless — an instance dies holding its token — and
  logging out would invalidate a token other concurrent instances are still
  using.

## 2. Endpoints we call

| Collection name             | Method   | Path                                                                | Our method                     |
| --------------------------- | -------- | ------------------------------------------------------------------- | ------------------------------ |
| Signin                      | `POST`   | `/api/user/`                                                        | `signIn` / `verifyCredentials` |
| GetAllDevice                | `GET`    | `/api/device`                                                       | `listDevices`                  |
| UpdateDevice                | `PUT`    | `/api/device/{DevSN}`                                               | `renameDevice`                 |
| GetAllCmds                  | `GET`    | `/api/devicecmd`                                                    | `listPendingCommands`          |
| GetCmdsDevice               | `GET`    | `/api/devicecmd/{DevSN}`                                            | `listPendingCommands(serial)`  |
| RebootByDevSN               | `POST`   | `/api/devicecmd/reboot?DevSN=`                                      | `rebootDevice`                 |
| DoorOpenbyDevSN             | `POST`   | `/api/devicecmd/dooropen?DevSN=`                                    | `openDoor`                     |
| AddEmployee                 | `POST`   | `/api/template/add`                                                 | `upsertSubject`                |
| GetAllEmployee              | `GET`    | `/api/template`                                                     | `listSubjects`                 |
| UpdateEmployee              | `PUT`    | `/api/template/edit/{EmpId}`                                        | `renameSubject`                |
| DeleteEmployee              | `DELETE` | `/api/template/{EmpId}`                                             | `removeSubject`                |
| DeleteFromAllDevice         | `DELETE` | `/api/template/fromdev/{EmpId}`                                     | `revokeBiometrics`             |
| SyncSomeEmpTemplateToOneDev | `POST`   | `/api/template/syncsometoone?DevSN=&empidlist=`                     | `syncSubjectsToDevice`         |
| EnrollFinger                | `POST`   | `/api/devicecmd/enrollfinger?DevSN=&employeeId=&fingerId=`          | `startFingerEnrolment`         |
| SetValidTimePeriod          | `POST`   | `/api/devicecmd/validperiod?DevSN=&EmployeeId=&StartDate=&EndDate=` | `setValidPeriod`               |
| AccessGrant                 | `POST`   | `/api/devicecmd/accessgrant?DevSN=&EmployeeId=`                     | `grantAccess`                  |
| AccessBlock                 | `POST`   | `/api/devicecmd/accessblock?DevSN=&EmployeeId=`                     | `blockAccess`                  |

### The two-step that VFT described on the call

`AddEmployee` writes to **VFT's servers, not to a reader**. Getting the person
onto a door is a second call. That is why registration produces two outbox
intents, in order and serialized per member:

```
AccessIntent.Provision      →  POST /api/template/add
AccessIntent.SyncToDevice   →  POST /api/template/syncsometoone?DevSN=…&empidlist=…
```

The order is not cosmetic: a validity period will not bind to a subject the
terminal has never heard of.

### Casing — do not "fix" it

`enrollfinger` and `enrollface` take **`employeeId`** (lowercase `e`).
`validperiod`, `accessgrant` and `accessblock` take **`EmployeeId`** (capital
`E`). This inconsistency is the vendor's, it is in the collection, and we
reproduce it deliberately. Normalising it breaks enrolment. (Trap 2.)

### Dates

`StartDate` / `EndDate` are `YYYYMMDD` with no separators — `20251214`. The end
date is **inclusive** and evaluated on the terminal's own clock (A5, confirmed).

### GetAllDevice — the live response, probed 2026-09-22

First contact with a real account (`https://acccloudlk.com`, Capitalist One,
two ZAM70 readers). Run it again with `npx tsx scripts/vft-probe.ts` — the
script is read-only and prints raw shape beside parsed result.

`GET /api/device` returns a **bare array** of 27-field objects. One row
verbatim, `null`s included, because the `null`s are the point:

```jsonc
{
  "DevSN": "NYU7251900066", // the serial — the only field we can address a reader by
  "DevName": "Device1",
  "Area": { "AreaName": "Default Area", "AreaID": 1 }, // NESTED, not the flat AreaID the collection shows
  "Company": { "CompanyName": "Capitalist One" },
  "CompanyID": 8,
  "DevIP": "192.168.8.127", // the reader's LAN address — not reachable from us
  "DevFPVersion": "13",
  "DevFaceVersion": null,
  "DevFirmwareVersion": "ZAM70-NF24HA-Ver3.0.15",
  "LockCount": 1,
  "ReaderCount": 2,
  "IsReboot": false,
  "LastUpdateTime": "09/22/2026, 10:36:20", // record edited, NOT device contact
  "CreatedDate": "09/14/2026, 12:08:51",
  "ExpireDate": "2027-09-14, 12:08:51", // vendor-side account expiry, one year on
  "LastRequestTime": null,
  "TimeZone": null,
  "UserCount": null,
  "AttCount": null,
  "FpCount": null,
  "FaceCapacity": null,
  "FaceCount": null,
  "VendorName": null,
  "ATTLOGStamp": null,
  "OPERLOGStamp": null,
  "ATTPHOTOStamp": null,
  "TransFlag": null,
}
```

Four facts that cost us a defect between them:

1. **The wrapper sends explicit `null`, not absence.** Thirteen of the 27 fields
   were `null` on a working, freshly provisioned reader. Zod's `.optional()`
   accepts `undefined` and **rejects `null`**, so a single `"TimeZone": null`
   failed the whole-array parse and `listDevices()` returned `[]` for an account
   that owns two readers — reported to every caller as "this gym has no
   hardware". **Every optional vendor field must be `.nullish()`**, and lists
   are parsed row by row so one odd reader cannot empty an account.
2. **`AreaID` is nested under `Area`.** The collection documents a flat
   `AreaID`; the live wrapper does not send one. Read `AreaID ?? Area.AreaID`.
3. **None of the three presence fields exists** — no `IsOnline`, no `LastSeen`,
   no `LastActivity`. That is simulator test A-2 answered from production: the
   only device-originated timestamp is `LastRequestTime` (null on both readers
   at probe time, so its format and cadence are still unverified). **Do not use
   `LastUpdateTime` for presence** — it moves when the record is edited, so
   renaming an unplugged reader would make it look online.
4. **Dates are `MM/DD/YYYY, HH:mm:ss`** in this response — month-first is not a
   guess, the same payload carried `09/14/2026`. `ExpireDate` alone uses
   `YYYY-MM-DD, HH:mm:ss`. None carries a timezone. Note this is a third date
   format, unrelated to the `YYYYMMDD` that `validperiod` takes.

**Confirmed live in the same run:** the `POST /api/user/` trailing slash, the
`ApiToken` header (a 160-character JWT), and `GET /api/template` and
`GET /api/devicecmd` both answering `200` with a bare array. What has **not**
been exercised is any write: no command has ever been sent to these readers.

### The template endpoints — exercised live, 2026-09-22

The whole subject lifecycle run against the real account with
`npx tsx scripts/vft-lifecycle.ts --apply` (reversible; it cleans up after
itself). What came back changes several things we had assumed.

**A-4 is answered: we assign `EmpId`, and the vendor keeps it.** `POST
/api/template/add` with `EmpId: "90000001"` stores exactly that; `GET
/api/template` returns `{"EmpId":"90000001","EmpName":"…","AreaID":1}`. VFT
mints nothing. Our allocator is therefore the sole authority on subject
identity, which is what the `MAX_SUBJECT_ID` range exists to protect.

**These endpoints carry no return code.** The 248-code tables belong to the
device command queue. `/api/template/*` answers in prose:

```jsonc
{ "message": "Employee was added successfully" }
{ "message": "Employee was updated successfully" }
{ "message": "Employee was deleted successfully from server and all devices!" }
{ "message": "Employee was deleted successfully from all devices only!" }  // fromdev
```

#### Two conventions that invert the usual reading

| The vendor does this                                                                                                                                                                                                                                                        | Which means                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A business failure arrives as HTTP 200.** `DELETE /api/template/90009999` → `200 {"message":"Cannot delete Employee with id=90009999. The Employee was not found!"}`                                                                                                      | The status line is not the verdict. Reading it alone made a failed cancellation look successful — and a cancellation that did not happen leaves a member able to enter. |
| **A permanent failure arrives as HTTP 500.** Duplicate `EmpId` → `500 {"message":"Validation error"}`; a 40-character `EmpName` → `500 {"message":"Error updating Employee with id=…"}`; a 16-digit `EmpId` → `500 {"message":"Data too long for column 'EmpId' at row 1"}` | "5xx is transient" is wrong here. Retrying any of those repeats it identically until the attempt budget is gone.                                                        |

So `command()` matches success **positively** (`/success/i`) and treats any
other message as a failure needing attention, and `isRetryable` treats a 5xx
that carries a `message` as permanent while a bare 5xx still retries. An
explicit `Return` code still wins over prose.

**Withdrawal uses DeleteEmployee, cancellation uses DeleteFromAllDevice.** Cancelling a membership calls `fromdev`, which takes the person off every reader but leaves the vendor's central copy, so a returning member is restored without enrolling a finger again (trap 5). Removing a fingerprint at a member's request is the opposite case: `fromdev` kept that central copy and any later sync put the withdrawn finger back without consent (visit 1, D2), so withdrawal calls `DELETE /api/template/{EmpId}` and gives the member a new subject id. A cancelled member's templates are therefore kept on purpose and a withdrawn member's are erased on purpose, and `removeSubject` must never be used for cancellation.

#### Field limits, measured rather than quoted

| Field                               | Result                                                                                                                                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EmpName` 24 chars                  | Accepted. The stated limit is real.                                                                                                                                                                               |
| `EmpName` 40 chars                  | **Rejected** (500), not truncated.                                                                                                                                                                                |
| `EmpName` empty                     | Accepted. A blank name is the vendor's business, not ours — our `Member_<id>` fallback is a product choice.                                                                                                       |
| `EmpName` in Sinhala (`කසුන්`)      | **Accepted** (200). Persistence not confirmed — the probe overwrote it before listing. Worth re-testing: if Unicode survives, stripping non-ASCII may be costing Sri Lankan gyms readable names on their readers. |
| `EmpId` 15 digits                   | The real ceiling — 16 fails with `Data too long for column 'EmpId'`, which also tells us the store is MySQL.                                                                                                      |
| `EmpId` non-numeric (`NOT-NUMERIC`) | **Accepted**, despite VFT's "numeric recommended". Our `assertValidSubjectId` is stricter than the vendor, deliberately.                                                                                          |

#### One thing the vendor reports untruthfully

`PUT /api/template/edit/90009999` — renaming a subject that does not exist —
answers `200 {"message":"Employee was updated successfully"}`. **A successful
rename is not evidence that the subject exists.** `PushRename` is best-effort
so nothing depends on it today, but no future code may infer existence from it.

## 3. Endpoints we deliberately do not call

| Collection name                   | Path                                          | Why not                                                                                                                                |
| --------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Logout                            | `POST /api/user/logout`                       | Process-local token cache; see §1                                                                                                      |
| AddArea / GetAllArea / UpdateArea | `/api/area`                                   | VFT: default `AreaID` is **1**, "not currently relevant, added for future development". Organisational, never a security boundary (A9) |
| GetAllCmdsLimit                   | `GET /api/devicecmd/limit?limit=&page=`       | Our queue reads are per-device and small                                                                                               |
| SyncTemplateToAllDev              | `POST /api/template/syncall`                  | Pushes every employee to every reader. We always target a specific member on a specific reader                                         |
| SyncTemplateToOneDev              | `POST /api/template/syncone?DevSN=`           | Pushes _all_ employees to one reader. `syncsometoone` is the scoped form                                                               |
| SyncSomeEmpTemplateToAllDev       | `POST /api/template/syncsometoall?empidlist=` | Same reason, other axis                                                                                                                |

## 4. Capabilities the collection reveals that we have not built

Recorded because they are not gaps we chose — they are things nobody knew
existed until the collection arrived.

### 4.1 `GetEventsbyDevSN` — the only recovery path for lost scans

```
POST /api/devicecmd/events?DevSN={serial}
```

A **pull** path for attendance. Today ingestion is push-only: if our webhook
endpoint is down, misconfigured, or the token is wrong, those scans are gone
from our records permanently — the reader keeps enforcing access from its own
clock, so nobody notices until someone asks for a check-in history that has a
hole in it.

This endpoint is the answer to that, and it pairs exactly with the failure mode
`ACCESS_CONTROL_WEBHOOK_TOKEN` being unset produces: a 401 that is
byte-identical to a wrong token, on every event, silently. Worth building as a
backfill the `reconcile-access` cron can run. **Not** a replacement for the
webhook.

### Measured 2026-10-09: pulled events arrive in UTC

Calling this endpoint makes the vendor re-deliver the reader's stored scans through the same webhook, but with `AttTime` in UTC where live deliveries carry the reader's local time, and nothing in the payload marks a delivery as pulled. We therefore treat a scan that equals an existing row shifted by exactly the reader's UTC offset (same subject and event code) as a duplicate (fix plan DEC-08), and production does not call this endpoint until VFT explains the behaviour (fix plan O-5).

### 4.2 `EnrollFace` — face enrolment

```
POST /api/devicecmd/enrollface?DevSN={serial}&employeeId={EmpId}
```

Identical in shape to `enrollfinger` minus `fingerId`. VFT's guidance was a
"fingerprint/face ID action button"; we built fingerprint only.

If this is added, **the consent gate applies unchanged**: a face template is
biometric data under PDPA exactly as a fingerprint is, so it goes through
`ManageMemberBiometric` with `members.biometric_consent_at` written _before_
any command is dispatched, and cleared on removal. Do not add a second path.

### 4.3 Command-queue deletion

```
DELETE /api/devicecmd/{id}
DELETE /api/devicecmd/sn/{DevSN}
DELETE /api/devicecmd
```

Lets a stuck queue be cleared rather than waited out. Relevant because a
command the reader never collects times out with `-725` after roughly two
minutes, and until then it occupies the queue. `DELETE /api/devicecmd` (all
commands, all devices) is destructive across every reader on the account and
should never be wired to a gym-facing control.

## 5. The attendance webhook

VFT `POST`s to a URL configured on their side. The collection's `WebhookCheck`
request is the exact contract:

```json
[
  {
    "EmpId": "168",
    "AttTime": "2024-01-15 08:30:15",
    "CheckingStatus": "0",
    "VerifyType": "1",
    "Event": "3",
    "DeviceID": "QEM1253800017"
  }
]
```

Four properties that are easy to get wrong:

1. **The top level is an array.** Readers batch, and one delivery can span
   several devices — ingestion groups by device before resolving a gym.
2. **Every value is a string**, including the numeric ones. `Event`,
   `VerifyType` and `CheckingStatus` all need coercing.
3. **The device field is `DeviceID`.** Every _request_ in the collection uses
   `DevSN`; the webhook alone uses `DeviceID`. Parsing for `DevSN` here would
   drop every event.
4. **There is no authentication.** VFT confirmed this verbally and the
   collection corroborates it — the `WebhookCheck` request sends no headers at
   all. No signature, no shared secret, no timestamp. The unguessable token in
   our URL path is therefore the entire credential, which is why the URL must be
   handled like a password and why `ACCESS_CONTROL_WEBHOOK_SECRET` exists as an
   optional second factor if VFT ever gains the ability to send a fixed header.

### The token is guarded at runtime

Because the path token is the whole credential and a wrong one is
indistinguishable from an unset one — both `401`, no symptom either way —
`getWebhookPathToken()` refuses a value that was obviously never generated:
anything containing placeholder text (`your-`, `changeme`, `example`,
`placeholder`, `replace`, `xxxx`, `todo`) or shorter than 32 characters. It
fails closed, exactly as if unset, and the route logs the specific reason
rather than a generic "not configured".

This exists because it happened: a `.env.local` copied from `.env.example`
carried `your-hex-64-webhook-token` — a value committed to this repository —
and nothing anywhere reported a problem. Refusing costs a gym nothing: the
terminal enforces access from its own clock, so a refused webhook loses
attendance records and never locks anyone out of a building.

`AttTime` carries no timezone. It is the reader's local wall clock, interpreted
against the device's stored `timezone_offset_minutes`. Retention is measured
from `created_at` — when _we_ stored the row — never from `AttTime`, because a
reader with a reset clock would otherwise have this morning's scans deleted
tonight.

## 6. Field limits

Confirmed by VFT on the call and enforced in `src/lib/access-control/fieldLimits.ts`.

| Field     | Limit                                        | How we enforce it                                                                                                                                                |
| --------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EmpId`   | numeric recommended, **15 characters**       | `assertValidSubjectId` **throws** rather than truncating. A silently shortened identity could collide with another member's and open a door for the wrong person |
| `EmpName` | **24 characters**, spaces become underscores | `formatSubjectName` truncates at the last underscore that fits, so `Kasun_Perera` rather than `Kasun_Perer`                                                      |

Our allocator caps `EmpId` at **79,999,999** (8 digits) — far inside the
platform's 15. That headroom is deliberate: 15 is the _platform_ limit, and
individual K40/F18 firmware may be stricter. Exhaustion is loud and slow;
truncation would be silent.

## 7. Callback registration — per gym

VFT confirmed **one API credential per gym**, and a **callback URL per gym**.

That contradicts the premise the current webhook design was built on. We issue
**one platform-wide** path token and resolve the gym from `DeviceID` against our
own globally-unique `access_devices.device_serial`, because the callback was
believed to be account-level on accounts shared between gyms.

With a callback URL per gym, a **per-gym token** becomes possible: the blast
radius of a leaked URL drops from every customer to one, rotation stops being a
flag day, and `DeviceID` becomes a cross-check rather than the only tenant
boundary that exists. It also removes the documented wart that we receive
attendance for gyms that are not our customers and discard it.

**Not yet done, and deliberately not before the first simulator session** — the
platform-wide token is live and working. Recorded here so the decision is not
lost. One thing to confirm before building it: whether "callback URL per gym"
means a free-text field on each gym's account, or a selection from a list VFT
maintains. The per-gym token plan only works for the former.
