/**
 * Access Control — browser API client.
 *
 * Unwraps the `ApiResponse` envelope and throws `AccessApiError` carrying the
 * machine-readable code, so the UI can branch on *which* refusal it got.
 *
 * ## Why the types are deep-imported
 *
 * The feature barrel (`@/features/access-control`) re-exports `services/factory`,
 * which pulls in `next/headers` through the Supabase server client. Importing it
 * from a client component fails the build. Same escape as rule 2.15's
 * `getSafeRedirect`: reach past the barrel to the leaf module, which holds
 * types and pure config only.
 *
 * ## What this layer deliberately does not do
 *
 * No vendor concepts appear here. There is no return code, no HTTP status from
 * the terminal, no retry count — every response this talks to was already
 * sanitized server-side (rules 2.8 / 2.9). If a field would let the dashboard
 * render a vendor error, it does not exist in these types.
 */

import type {
  SerializedAccessAccount,
  SerializedAccessDevice,
  SerializedAccessEvent,
} from '@/features/access-control/utils/serializeAccessForAPI'
import type { MemberAccessStatus } from '@/features/access-control/types'
import type { DeviceEventKind } from '@/features/access-control/config/DeviceEventCodes'

export class AccessApiError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'INTERNAL_ERROR',
    public readonly status: number = 500
  ) {
    super(message)
    this.name = 'AccessApiError'
  }
}

/**
 * Read the envelope, or throw with the server's own wording.
 *
 * The message is used verbatim because the routes already phrase refusals for
 * a gym manager. Substituting a generic string here would discard the one
 * explanation written for the person reading it.
 */
async function unwrap<T>(
  response: Response
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const body = await response.json().catch(() => null)

  if (!response.ok || !body?.success) {
    throw new AccessApiError(
      body?.error?.message ?? 'Request failed',
      body?.error?.code ?? 'INTERNAL_ERROR',
      response.status
    )
  }

  return { data: body.data as T, meta: body.meta }
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  })

  return (await unwrap<T>(response)).data
}

/* ------------------------------------------------------------------ account */

export interface AccessAccountInput {
  baseUrl: string
  email: string
  password: string
  areaId?: number
}

/**
 * The gym's vendor account, or `null` when none has been saved.
 *
 * The route answers `null` rather than 404 for a gym that has not set this up,
 * because not having configured a door controller is the ordinary state, not a
 * missing resource. The settings page renders an empty form, not a failure.
 */
export async function getAccessAccount(): Promise<SerializedAccessAccount | null> {
  const response = await fetch('/api/access-control/account')
  return (await unwrap<SerializedAccessAccount | null>(response)).data
}

/** Save credentials. Write-only: they are never read back, not even here. */
export async function saveAccessAccount(
  input: AccessAccountInput
): Promise<SerializedAccessAccount> {
  const response = await fetch('/api/access-control/account', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  return (await unwrap<SerializedAccessAccount>(response)).data
}

/**
 * Probe the saved credentials against the vendor.
 *
 * `verified: false` is a returned value, not a thrown error: wrong credentials
 * are the expected outcome of typing them wrong, and the form needs to say so
 * inline rather than in an error banner.
 */
export async function verifyAccessAccount(): Promise<{ verified: boolean }> {
  return post<{ verified: boolean }>('/api/access-control/account/verify')
}

/* ------------------------------------------------------------------ devices */

export interface RegisterDeviceInput {
  deviceSerial: string
  deviceName: string
  areaId?: number
  timezoneOffsetMinutes?: number
}

export async function listAccessDevices(): Promise<SerializedAccessDevice[]> {
  const response = await fetch('/api/access-control/devices')
  return (await unwrap<SerializedAccessDevice[]>(response)).data
}

export async function registerAccessDevice(
  input: RegisterDeviceInput
): Promise<SerializedAccessDevice> {
  return post<SerializedAccessDevice>('/api/access-control/devices', input)
}

/**
 * Rename a reader, or record its template capacity from the spec sheet.
 *
 * Not a state change — enabling, disabling and unlinking each have their own
 * endpoint (rule 2.5), and there is deliberately no client function that can
 * flip `is_active` as a side effect of an edit.
 */
export async function updateAccessDevice(
  deviceId: string,
  input: { deviceName?: string; templateCapacity?: number }
): Promise<SerializedAccessDevice> {
  const response = await fetch(`/api/access-control/devices/${deviceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  return (await unwrap<SerializedAccessDevice>(response)).data
}

export async function enableAccessDevice(
  deviceId: string
): Promise<{ isActive: boolean }> {
  return post<{ isActive: boolean }>(
    `/api/access-control/devices/${deviceId}/enable`
  )
}

export async function disableAccessDevice(
  deviceId: string
): Promise<{ isActive: boolean }> {
  return post<{ isActive: boolean }>(
    `/api/access-control/devices/${deviceId}/disable`
  )
}

/**
 * Forget a reader.
 *
 * `hardwareUnchanged` is in the payload because it is the whole point: the
 * vendor keeps the terminal and its templates, so this is reversible by
 * registering the same serial again. A client that rendered this as "device
 * deleted" would be ignoring what it was told.
 */
export async function unlinkAccessDevice(
  deviceId: string
): Promise<{ unlinked: boolean; hardwareUnchanged: boolean }> {
  return post<{ unlinked: boolean; hardwareUnchanged: boolean }>(
    `/api/access-control/devices/${deviceId}/unlink`
  )
}

export async function openAccessDevice(
  deviceId: string
): Promise<{ opened: boolean }> {
  return post<{ opened: boolean }>(
    `/api/access-control/devices/${deviceId}/open`
  )
}

export async function rebootAccessDevice(
  deviceId: string
): Promise<{ rebooting: boolean }> {
  return post<{ rebooting: boolean }>(
    `/api/access-control/devices/${deviceId}/reboot`
  )
}

export interface FreeSpaceResult {
  freed: number
  /**
   * Slots still needed after evicting everyone evictable.
   *
   * Non-zero means the reader cannot be freed further without removing someone
   * who can currently enter — a "buy a second reader" conversation, and the UI
   * must say that rather than showing a failed operation.
   */
  shortfall: number
  atCapacityLimit: boolean
}

export async function freeAccessDeviceSpace(
  deviceId: string
): Promise<FreeSpaceResult> {
  return post<FreeSpaceResult>(
    `/api/access-control/devices/${deviceId}/free-space`
  )
}

/* ------------------------------------------------------------------- events */

export interface AccessEventsQuery {
  page?: number
  limit?: number
  memberId?: string
  kind?: DeviceEventKind
}

export interface AccessEventsPage {
  events: SerializedAccessEvent[]
  page: number
  totalPages: number
  total: number
}

export async function getAccessEvents(
  query: AccessEventsQuery = {}
): Promise<AccessEventsPage> {
  const params = new URLSearchParams()

  // Built key by key rather than from the object, so an `undefined` filter
  // cannot reach the query string as the literal text "undefined" and fail
  // the route's Zod parse.
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.limit !== undefined) params.set('limit', String(query.limit))
  if (query.memberId) params.set('memberId', query.memberId)
  if (query.kind) params.set('kind', query.kind)

  const response = await fetch(`/api/access-control/events?${params}`)
  const { data, meta } = await unwrap<SerializedAccessEvent[]>(response)

  return {
    events: data,
    page: (meta?.page as number) ?? 1,
    totalPages: (meta?.totalPages as number) ?? 1,
    total: (meta?.total as number) ?? data.length,
  }
}

/* ------------------------------------------------------------------ members */

export async function getMemberAccess(
  memberId: string
): Promise<MemberAccessStatus> {
  const response = await fetch(`/api/access-control/members/${memberId}`)
  return (await unwrap<MemberAccessStatus>(response)).data
}

export interface SyncMemberResult {
  allowed: boolean
  commandsSent: number
  commandsPending: number
  failed: boolean
}

export async function syncMemberAccess(
  memberId: string
): Promise<SyncMemberResult> {
  return post<SyncMemberResult>(`/api/access-control/members/${memberId}/sync`)
}

/**
 * Put a reader into enrolment mode for this member.
 *
 * `awaitingFinger` is the only honest answer the vendor can give: the template
 * does not exist until the member presents a finger at the terminal, so this
 * never means "enrolled". Poll `getMemberEnrolment` to learn when it lands.
 */
export async function startMemberEnrolment(
  memberId: string,
  input: { deviceId: string; fingerId?: number }
): Promise<{ awaitingFinger: boolean }> {
  return post<{ awaitingFinger: boolean }>(
    `/api/access-control/members/${memberId}/enrol`,
    input
  )
}

export async function getMemberEnrolment(
  memberId: string
): Promise<{ enrolled: boolean }> {
  const response = await fetch(
    `/api/access-control/members/${memberId}/enrolment`
  )

  return (await unwrap<{ enrolled: boolean }>(response)).data
}

/**
 * Clear a member's fingerprint.
 *
 * `membershipUnchanged` comes back from the route deliberately: the desk needs
 * to see that removing a finger did not cancel anyone.
 */
export async function clearMemberBiometric(
  memberId: string
): Promise<{ fingerEnrolled: boolean; membershipUnchanged: boolean }> {
  const response = await fetch(
    `/api/access-control/members/${memberId}/biometric`,
    { method: 'DELETE' }
  )

  return (
    await unwrap<{ fingerEnrolled: boolean; membershipUnchanged: boolean }>(
      response
    )
  ).data
}
