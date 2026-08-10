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
import { VENDOR_REQUEST_TIMEOUT_MS, isAccessControlEnabled } from './config'
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
  DevName: z.string().optional(),
  TimeZone: z.union([z.string(), z.number()]).optional(),
  AreaID: z.union([z.string(), z.number()]).nullish(),
})

const deviceListSchema = z.union([
  z.object({ devices: z.array(deviceSchema) }),
  z.array(deviceSchema),
])

const subjectSchema = z.object({
  EmpId: z.union([z.string(), z.number()]),
  EmpName: z.string().optional(),
  AreaID: z.union([z.string(), z.number()]).nullish(),
  // Not documented; present on some builds. Used to detect enrolment.
  TemplateCount: z.union([z.string(), z.number()]).nullish(),
})

const subjectListSchema = z.union([
  z.object({ templates: z.array(subjectSchema) }),
  z.object({ data: z.array(subjectSchema) }),
  z.array(subjectSchema),
])

const commandSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  ID: z.union([z.string(), z.number()]).optional(),
  DevSN: z.string().optional(),
  // The PUSH acknowledgement code, where the wrapper exposes it.
  Return: z.union([z.string(), z.number()]).nullish(),
})

const commandListSchema = z.union([
  z.object({ commands: z.array(commandSchema) }),
  z.array(commandSchema),
])

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
   */
  private readonly tokenCache = new Map<string, string>()

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

    this.tokenCache.set(this.cacheKey(credentials), parsed.data.token)
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

    const devices = Array.isArray(parsed.data)
      ? parsed.data
      : parsed.data.devices

    return devices.map((device) => ({
      serial: device.DevSN,
      name: device.DevName ?? device.DevSN,
      areaId: toNumberOrNull(device.AreaID),
      timezoneOffsetMinutes: toNumberOrNull(device.TimeZone),
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
        // applied here rather than trusted to callers.
        EmpName: formatSubjectName(subject.name),
        // Included deliberately: the collection sends it and the terminal needs
        // an area to associate the record with. Never set CardNo or Password —
        // the fingerprint must remain the sole credential, or revoking it would
        // not actually lock the member out.
        ...(subject.areaId != null ? { AreaID: subject.areaId } : {}),
      },
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

    return rows.map((row) => ({
      subjectId: String(row.EmpId),
      name: row.EmpName ?? '',
      areaId: toNumberOrNull(row.AreaID),
      templateCount: toNumberOrNull(row.TemplateCount),
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

    return rows.map((row) => ({
      commandId: String(row.id ?? row.ID ?? ''),
      deviceSerial: row.DevSN ?? deviceSerial ?? '',
      returnCode: toNumberOrNull(row.Return),
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
        ? toNumberOrNull(parsed.data.Return)
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

      // No return code: accepted into the queue, awaiting collection.
      return {
        status: 'queued',
        commandId: commandId != null ? String(commandId) : undefined,
      }
    } catch (error) {
      if (error instanceof VendorAuthError) {
        return { status: 'failed', error: error.message, retryable: false }
      }

      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown vendor error',
        retryable: isRetryable(error),
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
      this.tokenCache.get(this.cacheKey(credentials)) ??
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
      throw new VendorRequestError(
        `Vendor returned status ${response.status}`,
        response.status
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

  private cacheKey(credentials: AccessCredentials): string {
    return `${credentials.baseUrl}::${credentials.email}`
  }
}

/** A non-auth HTTP failure from the vendor. */
export class VendorRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
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
    return error.status >= 500
  }
  return true
}

/** Coerce a vendor field that may arrive as string, number, null or absent. */
function toNumberOrNull(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
