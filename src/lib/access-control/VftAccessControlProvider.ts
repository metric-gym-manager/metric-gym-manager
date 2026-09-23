/**
 * VFT GYM API v2.0 client — a REST wrapper over ZKTeco's PUSH/ADMS protocol.
 *
 * Everything vendor-specific is confined here: header casing, `YYYYMMDD` dates,
 * token refresh, and the mapping from vendor return codes to our three-valued
 * {@link CommandOutcome}. Nothing above this file knows the vendor exists.
 *
 * ## Responses are parsed, not trusted
 *
 * The vendor documents success payloads only, and the PDF and Postman
 * collection disagree in places. Every response is therefore parsed from
 * `unknown` with Zod and narrowed, rather than cast.
 *
 * ## Queued is not applied
 *
 * `POST /api/devicecmd/*` enqueues a command that the terminal collects on its
 * next poll (roughly every 30s in the PUSH protocol). HTTP 200 means queued.
 * The protocol does define an execution acknowledgement — the device reports
 * `ID=<id>&Return=<code>&CMD=<type>`, where `Return >= 0` is success — so where
 * the wrapper surfaces a return code we report `applied`, and where it does not
 * we report `queued` and let the reconciler confirm later. That is why the
 * result type is three-valued: it is correct either way, without needing the
 * vendor to tell us which it is.
 *
 * Evidence grades for these behaviours: `docs/integrations/vft/vft-api-assumptions.md`.
 */

import { z } from 'zod'
import type {
  AccessCredentials,
  AccessDeviceInfo,
  AccessSubjectInfo,
  CommandOutcome,
  IAccessControlProvider,
  PendingCommand,
  SubjectOnDevice,
  ValidPeriodInput,
} from './IAccessControlProvider'
import {
  TOKEN_CACHE_TTL_SECONDS,
  VENDOR_REQUEST_TIMEOUT_MS,
  isAccessControlEnabled,
} from './config'
import {
  ReturnCodeClass,
  classifyReturnCode,
  describeReturnCode,
} from './returnCodes'
import { assertValidSubjectId, formatSubjectName } from './fieldLimits'

// ============================================================
// Vendor response shapes
// ============================================================

const signInResponseSchema = z.object({
  token: z.string().min(1),
})

/**
 * Device list.
 *
 * Field names follow the vendor's PascalCase. `TimeZone` arrives as a string of
 * minutes ("330"), and the wrapper has been seen returning ids as either number
 * or string, so both are accepted and normalised.
 */
const deviceSchema = z.object({
  DevSN: z.string(),
  // Every optional field here is `nullish`, never `optional`. The live wrapper
  // returns explicit `null` for anything it has no value for, and `optional()`
  // accepts `undefined` but rejects `null` — one null field failed the whole
  // parse and emptied the device list. Probed 2026-09-22: of 27 fields on a
  // real reader, 13 arrived null, `TimeZone` among them.
  DevName: z.string().nullish(),
  TimeZone: z.union([z.string(), z.number()]).nullish(),
  // The collection documents a flat `AreaID`; the live wrapper nests it under
  // `Area`. Both are read — flat first — because only one of them will be
  // present on any given build and the association is worth keeping.
  AreaID: z.union([z.string(), z.number()]).nullish(),
  Area: z
    .object({ AreaID: z.union([z.string(), z.number()]).nullish() })
    .nullish(),
  // Presence fields. NONE of these is documented — the first three are the
  // names ZKTeco-derived wrappers commonly use. The live account answered test
  // A-2 by sending none of them: presence has to come from `LastRequestTime`,
  // the device's own last call home, or from the webhook contact time.
  //
  // `LastUpdateTime` is deliberately NOT read as presence. It moves when the
  // record is edited, so a reader that has been unplugged for a week would
  // look online the moment someone renames it.
  //
  // If nothing arrives we report presence as unknown rather than guessing.
  // Claiming a reader is online on no evidence is worse than admitting we
  // cannot tell.
  LastActivity: z.string().nullish(),
  LastSeen: z.string().nullish(),
  LastRequestTime: z.string().nullish(),
  IsOnline: z.union([z.boolean(), z.string(), z.number()]).nullish(),
})

/**
 * The envelope only. Rows are parsed one at a time by {@link parseRows} so a
 * single malformed reader cannot empty an account's entire device list.
 */
const deviceListSchema = z.union([
  z.object({ devices: z.array(z.unknown()) }),
  z.array(z.unknown()),
])

const subjectSchema = z.object({
  EmpId: z.union([z.string(), z.number()]),
  // `nullish` for the same reason as the device fields above. The live account
  // held no employees at probe time (2026-09-22), so this shape is inferred
  // from the device response's conventions rather than observed.
  EmpName: z.string().nullish(),
  AreaID: z.union([z.string(), z.number()]).nullish(),
  Area: z
    .object({ AreaID: z.union([z.string(), z.number()]).nullish() })
    .nullish(),
  /**
   * Not documented, and **not present on the live account** (checked
   * 2026-09-23). Kept because a different build may send it, but nothing may
   * depend on it — see the note on `templateCount` in IAccessControlProvider.
   */
  TemplateCount: z.union([z.string(), z.number()]).nullish(),
  /**
   * The validity window the vendor actually holds for this subject, as
   * `YYYYMMDD`. Observed live: a synced member shows `20250120`/`20270309`
   * exactly as pushed, an unsynced one shows null. This is the vendor's own
   * account of the state, which makes it far better evidence for
   * reconciliation than our record of what we last sent.
   */
  StartDate: z.string().nullish(),
  EndDate: z.string().nullish(),
  /** The vendor's own sync flag. 1 on a subject it considers distributed. */
  IsSync: z.union([z.string(), z.number(), z.boolean()]).nullish(),
  /** Soft delete. 0 on every live subject observed; 1 has never been seen. */
  IsDelete: z.union([z.string(), z.number(), z.boolean()]).nullish(),
})

const subjectListSchema = z.union([
  z.object({ templates: z.array(z.unknown()) }),
  z.object({ data: z.array(z.unknown()) }),
  z.array(z.unknown()),
])

const commandSchema = z.object({
  id: z.union([z.string(), z.number()]).nullish(),
  ID: z.union([z.string(), z.number()]).nullish(),
  DevSN: z.string().nullish(),
  // The PUSH acknowledgement code, where the wrapper exposes it.
  //
  // Both spellings: the command-queue listing calls it `ReturnValue` (observed
  // on the live account 2026-09-23), while the collection's command responses
  // show `Return`. Reading only one of them meant every queued command came
  // back with no return code at all.
  Return: z.union([z.string(), z.number()]).nullish(),
  ReturnValue: z.union([z.string(), z.number()]).nullish(),
  /** 0 until the terminal has collected and run the command. */
  IsProcessed: z.union([z.string(), z.number(), z.boolean()]).nullish(),
  /**
   * The template endpoints' only verdict.
   *
   * They carry no return code at all — "Employee was added successfully" on
   * the way through, and the reason in the same field when it did not work.
   * Observed 2026-09-22 against the live account.
   */
  message: z.string().nullish(),
})

const commandListSchema = z.union([
  z.object({ commands: z.array(z.unknown()) }),
  z.array(z.unknown()),
])

/**
 * Phrases the vendor uses when it did not do the thing.
 *
 * Observed on `/api/template/*` (2026-09-22): "Cannot delete Employee with
 * id=… The Employee was not found!", "Validation error", "Error updating
 * Employee with id=…", "Data too long for column 'EmpId' at row 1". The rest
 * are the obvious cousins of those, and they are the only licence this list
 * takes beyond what was seen.
 */
const VENDOR_FAILURE_MARKERS = [
  'cannot',
  'not found',
  'error',
  'invalid',
  'validation',
  'too long',
  'failed',
  'unable',
  'denied',
  'not allowed',
] as const

/**
 * Read the vendor's prose, where it is prose we recognise.
 *
 * Three answers, not two, and the third is the important one.
 *
 * The template endpoints are the only family whose responses have ever been
 * observed. This rule also governs `/api/devicecmd/*` — six methods whose
 * shape nobody has seen — so a rule of "anything not saying success is a
 * failure" would turn an unobserved `{"message":"Command queued"}` into a
 * dead letter needing attention, for every door open, reboot, validity
 * period, grant, block and enrolment.
 *
 * So unfamiliar prose returns `null`, and the caller reports `queued`: that is
 * exactly what the three-valued outcome exists to express, and the reconciler
 * settles it later. Recognised failure wording still fails loudly, which keeps
 * the case this rule was written for — a cancellation that silently did
 * nothing.
 *
 * @returns `true` for success, `false` for a recognised failure, `null` when
 *   the vendor said something we have no grounds to interpret.
 */
function readVendorMessage(message: string): boolean | null {
  const text = message.toLowerCase()

  // Checked first: "deleted successfully from all devices only!" is a success
  // even though a failure marker could plausibly appear in a longer sentence.
  if (text.includes('success')) return true

  if (VENDOR_FAILURE_MARKERS.some((marker) => text.includes(marker))) {
    return false
  }

  return null
}

/** Thrown when the vendor rejects our credentials or token. */
export class VendorAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VendorAuthError'
  }
}

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  query?: Record<string, string | number | undefined>
  body?: unknown
  /** Set once we have already refreshed the token for this call. */
  isRetry?: boolean
}

export class VftAccessControlProvider implements IAccessControlProvider {
  /**
   * Per-account token cache, keyed by base URL + email.
   *
   * Process-local, which is the right scope on serverless: a new instance
   * simply signs in again. The vendor issues independent tokens, so concurrent
   * instances do not invalidate each other.
   *
   * Entries expire after {@link TOKEN_CACHE_TTL_SECONDS}. The vendor documents
   * no lifetime, so the ceiling is a guess — but it is a guess that costs one
   * extra sign-in, where the alternative is discovering expiry as a 401 on a
   * command someone is waiting for. The 401 path still exists underneath as
   * the thing that makes being wrong survivable.
   */
  private readonly tokenCache = new Map<
    string,
    { token: string; expiresAt: number }
  >()

  getProviderName(): string {
    return 'VFT'
  }

  isEnabled(): boolean {
    return isAccessControlEnabled()
  }

  async signIn(credentials: AccessCredentials): Promise<string> {
    const response = await fetch(this.url(credentials, '/api/user/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
      signal: AbortSignal.timeout(VENDOR_REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new VendorAuthError(
        `Sign-in rejected with status ${response.status}`
      )
    }

    const parsed = signInResponseSchema.safeParse(await response.json())

    if (!parsed.success) {
      throw new VendorAuthError('Sign-in response did not contain a token')
    }

    this.tokenCache.set(this.cacheKey(credentials), {
      token: parsed.data.token,
      expiresAt: Date.now() + TOKEN_CACHE_TTL_SECONDS * 1000,
    })

    return parsed.data.token
  }

  async verifyCredentials(credentials: AccessCredentials): Promise<boolean> {
    try {
      await this.signIn(credentials)
      return true
    } catch {
      return false
    }
  }

  async listDevices(
    credentials: AccessCredentials
  ): Promise<AccessDeviceInfo[]> {
    const payload = await this.request(credentials, {
      method: 'GET',
      path: '/api/device',
    })

    const parsed = deviceListSchema.safeParse(payload)
    if (!parsed.success) return []

    const rows = Array.isArray(parsed.data) ? parsed.data : parsed.data.devices

    return parseRows(rows, deviceSchema).map((device) => ({
      serial: device.DevSN,
      name: device.DevName ?? device.DevSN,
      areaId: toNumberOrNull(device.AreaID ?? device.Area?.AreaID),
      timezoneOffsetMinutes: toNumberOrNull(device.TimeZone),
      lastSeenAt: parseVendorDate(
        device.LastActivity ?? device.LastSeen ?? device.LastRequestTime
      ),
      online: toBooleanOrNull(device.IsOnline),
    }))
  }

  async upsertSubject(
    credentials: AccessCredentials,
    subject: { subjectId: string; name: string; areaId?: number | null }
  ): Promise<CommandOutcome> {
    // Identity must never be silently reshaped: a truncated id could collide
    // with another member's and open a door for the wrong person.
    assertValidSubjectId(subject.subjectId)

    return this.command(credentials, {
      method: 'POST',
      path: '/api/template/add',
      body: {
        EmpId: subject.subjectId,
        // 24 characters, underscores for spaces — a vendor constraint, so it is
        // applied here rather than trusted to callers. The id is passed so a
        // name that normalises to nothing still identifies someone.
        EmpName: formatSubjectName(subject.name, subject.subjectId),
        // Included deliberately: the collection sends it and the terminal needs
        // an area to associate the record with. Never set CardNo or Password —
        // the fingerprint must remain the sole credential, or revoking it would
        // not actually lock the member out.
        ...(subject.areaId != null ? { AreaID: subject.areaId } : {}),
      },
    })
  }

  async renameSubject(
    credentials: AccessCredentials,
    subjectId: string,
    name: string
  ): Promise<CommandOutcome> {
    assertValidSubjectId(subjectId)

    // `PUT /api/template/edit/{EmpId}` with `EmpName` alone, exactly as the
    // collection sends it. Deliberately does not include AreaID: re-asserting
    // it on a rename would make a cosmetic edit capable of moving a member
    // between areas.
    return this.command(credentials, {
      method: 'PUT',
      path: `/api/template/edit/${encodeURIComponent(subjectId)}`,
      body: { EmpName: formatSubjectName(name, subjectId) },
    })
  }

  async renameDevice(
    credentials: AccessCredentials,
    deviceSerial: string,
    deviceName: string
  ): Promise<CommandOutcome> {
    // `PUT /api/device/{DevSN}` with `DevName` alone. The collection shows
    // AreaID as a commented-out sibling; sending it would silently re-area the
    // reader, so it stays out.
    return this.command(credentials, {
      method: 'PUT',
      path: `/api/device/${encodeURIComponent(deviceSerial)}`,
      body: { DevName: deviceName },
    })
  }

  async removeSubject(
    credentials: AccessCredentials,
    subjectId: string
  ): Promise<CommandOutcome> {
    return this.command(credentials, {
      method: 'DELETE',
      path: `/api/template/${encodeURIComponent(subjectId)}`,
    })
  }

  async revokeBiometrics(
    credentials: AccessCredentials,
    subjectId: string
  ): Promise<CommandOutcome> {
    // `fromdev` clears templates from the terminals but keeps the subject
    // record, which is what separates "remove the fingerprint" from "delete the
    // membership".
    return this.command(credentials, {
      method: 'DELETE',
      path: `/api/template/fromdev/${encodeURIComponent(subjectId)}`,
    })
  }

  async syncSubjectsToDevice(
    credentials: AccessCredentials,
    deviceSerial: string,
    subjectIds: string[]
  ): Promise<CommandOutcome> {
    return this.command(credentials, {
      method: 'POST',
      path: '/api/template/syncsometoone',
      query: { DevSN: deviceSerial, empidlist: subjectIds.join(',') },
    })
  }

  async setValidPeriod(
    credentials: AccessCredentials,
    input: ValidPeriodInput
  ): Promise<CommandOutcome> {
    return this.command(credentials, {
      method: 'POST',
      path: '/api/devicecmd/validperiod',
      query: {
        DevSN: input.deviceSerial,
        EmployeeId: input.subjectId,
        StartDate: input.startDate,
        EndDate: input.endDate,
      },
    })
  }

  async grantAccess(
    credentials: AccessCredentials,
    target: SubjectOnDevice
  ): Promise<CommandOutcome> {
    return this.command(credentials, {
      method: 'POST',
      path: '/api/devicecmd/accessgrant',
      query: { DevSN: target.deviceSerial, EmployeeId: target.subjectId },
    })
  }

  async blockAccess(
    credentials: AccessCredentials,
    target: SubjectOnDevice
  ): Promise<CommandOutcome> {
    return this.command(credentials, {
      method: 'POST',
      path: '/api/devicecmd/accessblock',
      query: { DevSN: target.deviceSerial, EmployeeId: target.subjectId },
    })
  }

  async listSubjects(
    credentials: AccessCredentials
  ): Promise<AccessSubjectInfo[]> {
    const payload = await this.request(credentials, {
      method: 'GET',
      path: '/api/template',
    })

    const parsed = subjectListSchema.safeParse(payload)
    if (!parsed.success) return []

    const rows = Array.isArray(parsed.data)
      ? parsed.data
      : 'templates' in parsed.data
        ? parsed.data.templates
        : parsed.data.data

    return parseRows(rows, subjectSchema).map((row) => ({
      subjectId: String(row.EmpId),
      name: row.EmpName ?? '',
      areaId: toNumberOrNull(row.AreaID ?? row.Area?.AreaID),
      templateCount: toNumberOrNull(row.TemplateCount),
      validFrom: row.StartDate ?? null,
      validTo: row.EndDate ?? null,
      syncedToVendor: toBooleanOrNull(row.IsSync),
      deleted: toBooleanOrNull(row.IsDelete),
    }))
  }

  async startFingerEnrolment(
    credentials: AccessCredentials,
    target: SubjectOnDevice & { fingerId?: number }
  ): Promise<CommandOutcome> {
    return this.command(credentials, {
      method: 'POST',
      path: '/api/devicecmd/enrollfinger',
      query: {
        DevSN: target.deviceSerial,
        employeeId: target.subjectId,
        fingerId: target.fingerId ?? 0,
      },
    })
  }

  async openDoor(
    credentials: AccessCredentials,
    deviceSerial: string
  ): Promise<CommandOutcome> {
    return this.command(credentials, {
      method: 'POST',
      path: '/api/devicecmd/dooropen',
      query: { DevSN: deviceSerial },
    })
  }

  async rebootDevice(
    credentials: AccessCredentials,
    deviceSerial: string
  ): Promise<CommandOutcome> {
    return this.command(credentials, {
      method: 'POST',
      path: '/api/devicecmd/reboot',
      query: { DevSN: deviceSerial },
    })
  }

  async listPendingCommands(
    credentials: AccessCredentials,
    deviceSerial?: string
  ): Promise<PendingCommand[]> {
    const payload = await this.request(credentials, {
      method: 'GET',
      path: deviceSerial
        ? `/api/devicecmd/${encodeURIComponent(deviceSerial)}`
        : '/api/devicecmd',
    })

    const parsed = commandListSchema.safeParse(payload)
    if (!parsed.success) return []

    const rows = Array.isArray(parsed.data) ? parsed.data : parsed.data.commands

    return parseRows(rows, commandSchema).map((row) => ({
      commandId: String(row.id ?? row.ID ?? ''),
      deviceSerial: row.DevSN ?? deviceSerial ?? '',
      returnCode: toNumberOrNull(row.Return ?? row.ReturnValue),
      // `IsProcessed: 0` is the queue saying the terminal has not collected
      // this yet — the difference between "sent" and "done", which is the
      // whole reason `CommandOutcome` has a `queued` state.
      processed: toBooleanOrNull(row.IsProcessed) ?? false,
    }))
  }

  // ============================================================
  // Transport
  // ============================================================

  /**
   * Issue a command and classify the outcome.
   *
   * Network and 5xx failures are retryable; a 4xx means the request itself was
   * wrong and retrying would only repeat it.
   */
  private async command(
    credentials: AccessCredentials,
    options: RequestOptions
  ): Promise<CommandOutcome> {
    try {
      const payload = await this.request(credentials, options)
      const parsed = commandSchema.safeParse(payload)

      const commandId = parsed.success
        ? (parsed.data.id ?? parsed.data.ID)
        : undefined
      const returnCode = parsed.success
        ? toNumberOrNull(parsed.data.Return ?? parsed.data.ReturnValue)
        : null

      if (returnCode !== null) {
        const classification = classifyReturnCode(returnCode)

        // `>= 0` is success. `-7` (already queued) and `-28` (door already
        // open) are benign: the desired state is in flight or already true, so
        // re-sending would be the actual mistake.
        if (
          classification === ReturnCodeClass.Success ||
          classification === ReturnCodeClass.Benign
        ) {
          return {
            status: 'applied',
            commandId: commandId != null ? String(commandId) : undefined,
          }
        }

        // Not every negative code means the same thing. "Failed to send" is a
        // blip worth retrying; "device storage full" will fail identically
        // until someone clears the terminal. Retrying the second kind burns
        // quota and buries the real problem.
        return {
          status: 'failed',
          error: describeReturnCode(returnCode),
          retryable: classification === ReturnCodeClass.Retryable,
          needsAttention: classification === ReturnCodeClass.NeedsAttention,
          returnCode,
        }
      }

      // No return code. The template endpoints answer in prose instead, so a
      // message is the only verdict they give — and it is a real one, not a
      // hint: "Cannot delete Employee with id=… The Employee was not found!"
      // arrives as HTTP 200 and used to read as queued, i.e. as fine.
      const message = parsed.success ? parsed.data.message : null

      const verdict = message ? readVendorMessage(message) : null

      if (verdict === true) {
        return {
          status: 'applied',
          commandId: commandId != null ? String(commandId) : undefined,
        }
      }

      if (verdict === false) {
        return {
          status: 'failed',
          error: message ?? 'Vendor reported a failure',
          // The vendor named a reason, and the reason will not change by
          // asking again. A person decides what to do about it.
          retryable: false,
          needsAttention: true,
        }
      }

      // Nothing said at all: accepted into the queue, awaiting collection.
      return {
        status: 'queued',
        commandId: commandId != null ? String(commandId) : undefined,
      }
    } catch (error) {
      if (error instanceof VendorAuthError) {
        return { status: 'failed', error: error.message, retryable: false }
      }

      // Already true, or already queued. Re-sending would be the mistake, and
      // reporting failure stops the write-back — which is how a member who
      // rejoined ended up correct on the reader and blocked in our records.
      if (
        error instanceof VendorRequestError &&
        describesBenignConflict(error.detail)
      ) {
        return { status: 'applied' }
      }

      const retryable = isRetryable(error)

      return {
        status: 'failed',
        error:
          error instanceof VendorRequestError && error.detail
            ? `${error.message}: ${error.detail}`
            : error instanceof Error
              ? error.message
              : 'Unknown vendor error',
        retryable,
        // A permanent rejection from the vendor is not something the queue can
        // work through on its own.
        needsAttention: !retryable && error instanceof VendorRequestError,
      }
    }
  }

  /**
   * Perform an authenticated request, refreshing the token once on 401.
   */
  private async request(
    credentials: AccessCredentials,
    options: RequestOptions
  ): Promise<unknown> {
    const token =
      this.cachedToken(credentials) ??
      credentials.apiToken ??
      (await this.signIn(credentials))

    const response = await fetch(
      this.url(credentials, options.path, options.query),
      {
        method: options.method,
        headers: {
          // The vendor docs disagree on casing between endpoints; HTTP headers
          // are case-insensitive, so the collection's form is used throughout.
          ApiToken: token,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(VENDOR_REQUEST_TIMEOUT_MS),
      }
    )

    if (response.status === 401 && !options.isRetry) {
      this.tokenCache.delete(this.cacheKey(credentials))
      await this.signIn(credentials)
      return this.request(credentials, { ...options, isRetry: true })
    }

    if (response.status === 401) {
      throw new VendorAuthError('Vendor rejected the API token')
    }

    if (!response.ok) {
      // The body matters as much as the status: this vendor answers 500 for
      // permanent validation failures, so a 5xx alone cannot decide whether
      // retrying is worth anything.
      const detail = (await response.text()).slice(0, 300)

      throw new VendorRequestError(
        `Vendor returned status ${response.status}`,
        response.status,
        detail
      )
    }

    // Some endpoints answer 200 with an empty body.
    const text = await response.text()
    if (!text) return {}

    try {
      return JSON.parse(text) as unknown
    } catch {
      return {}
    }
  }

  private url(
    credentials: AccessCredentials,
    path: string,
    query?: Record<string, string | number | undefined>
  ): string {
    const url = new URL(path, credentials.baseUrl)

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }

    return url.toString()
  }

  /**
   * The cached token for this account, if it has not aged out.
   *
   * An expired entry is dropped rather than left to accumulate: the cache is
   * keyed per account and a long-lived process serving many gyms would
   * otherwise hold a token for every one of them for the life of the instance.
   */
  private cachedToken(credentials: AccessCredentials): string | null {
    const key = this.cacheKey(credentials)
    const entry = this.tokenCache.get(key)

    if (!entry) return null

    if (entry.expiresAt <= Date.now()) {
      this.tokenCache.delete(key)
      return null
    }

    return entry.token
  }

  /** Keyed by account, never by gym: two gyms can share a vendor account. */
  private cacheKey(credentials: AccessCredentials): string {
    return `${credentials.baseUrl}::${credentials.email}`
  }
}

/** A non-auth HTTP failure from the vendor. */
export class VendorRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** The response body, truncated — the vendor's own reason, when it gave one. */
    readonly detail: string = ''
  ) {
    super(message)
    this.name = 'VendorRequestError'
  }
}

/**
 * Whether a failure is worth retrying.
 *
 * 5xx and transport errors are transient; 4xx means the request was wrong and
 * repeating it just repeats the mistake.
 */
function isRetryable(error: unknown): boolean {
  if (error instanceof VendorRequestError) {
    if (error.status < 500) return false

    // Only a bare 500. This vendor answers 500 for business rejections — a
    // duplicate `EmpId` returns `500 {"message":"Validation error"}` and will
    // return it forever — so a 500 naming a reason is permanent.
    //
    // 502, 503 and 504 are gateway and availability codes, and they carry JSON
    // bodies too. Reading those as permanent would dead-letter an entire queue
    // during a vendor outage, which is the single failure retries exist for.
    if (error.status !== 500) return true

    return !describesVendorRejection(error.detail)
  }
  return true
}

/**
 * The vendor's generic conflict phrase.
 *
 * Bare "Validation error" is what this vendor answers when the thing being
 * asked for is already true or already in flight — a duplicate `EmpId`, a
 * repeat of a validity window, a command that duplicates a queued one. Genuine
 * field failures name themselves instead ("Data too long for column …").
 *
 * So this is the HTTP-level twin of return codes `-7` and `-28`: benign.
 */
const GENERIC_CONFLICT = /^\s*validation error\s*$/i

/** Whether a 5xx body is the vendor saying "that is already the case". */
function describesBenignConflict(detail: string): boolean {
  if (!detail) return false

  try {
    const parsed: unknown = JSON.parse(detail)
    const message = commandSchema.safeParse(parsed)
    return Boolean(
      message.success &&
      message.data.message &&
      GENERIC_CONFLICT.test(message.data.message)
    )
  } catch {
    return false
  }
}

/** Whether a failed response body carries the vendor's own reason. */
function describesVendorRejection(detail: string): boolean {
  if (!detail) return false

  try {
    const parsed: unknown = JSON.parse(detail)
    const message = commandSchema.safeParse(parsed)
    return Boolean(message.success && message.data.message)
  } catch {
    return false
  }
}

/**
 * Parse list rows individually, discarding only the ones that fail.
 *
 * The vendor returns a bare array, and parsing it as `z.array(schema)` makes
 * every row a single point of failure for the whole account: one reader with an
 * unexpected field emptied a two-device list, and `safeParse` failing is
 * reported to the caller as "no devices" — a state a real gym can legitimately
 * be in, so nothing anywhere looks wrong.
 *
 * Dropping the individual bad row is not silent in the same way: the rest of
 * the account still works, and the missing one is visible against the vendor
 * console.
 */
function parseRows<T extends z.ZodTypeAny>(
  rows: unknown[],
  schema: T
): z.infer<T>[] {
  const parsed: z.infer<T>[] = []

  for (const row of rows) {
    const result = schema.safeParse(row)
    if (result.success) parsed.push(result.data)
  }

  return parsed
}

/** Coerce a vendor field that may arrive as string, number, null or absent. */
function toNumberOrNull(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Parse a presence flag that may arrive as a boolean, `"1"`, or `"true"`.
 *
 * Returns `null` for anything unrecognised rather than defaulting to `false`:
 * "the vendor did not say" and "the vendor said no" mean different things on a
 * screen a gym manager reads.
 */
function toBooleanOrNull(
  value: boolean | string | number | null | undefined
): boolean | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0

  const normalised = value.trim().toLowerCase()
  if (['true', '1', 'yes', 'online'].includes(normalised)) return true
  if (['false', '0', 'no', 'offline'].includes(normalised)) return false

  return null
}

/**
 * Parse a vendor timestamp, tolerating the space-separated form.
 *
 * These fields are undocumented, so an unparseable value is treated as absent
 * rather than as an error — a presence hint we cannot read is not a reason to
 * fail a device listing.
 */
function parseVendorDate(value: string | null | undefined): Date | null {
  if (!value) return null

  // `MM/DD/YYYY, HH:mm:ss` — the format the live wrapper uses for its own
  // timestamps (`09/22/2026, 10:36:20`). Month-first is not a guess: the same
  // response carried `09/14/2026`, and there is no fourteenth month.
  const slashed = value
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})$/)

  if (slashed) {
    const [, month, day, year, hour, minute, second] = slashed
    // Built as UTC deliberately. These timestamps carry no zone, and a
    // local-time parse would shift them by the server's offset — which on
    // Vercel is UTC and on a developer's laptop is not, making the same value
    // render differently in the two places.
    const parsed = new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      )
    )
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
