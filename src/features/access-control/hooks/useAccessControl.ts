'use client'

/**
 * Access Control — React Query hooks.
 *
 * One module rather than one file per hook, because these five queries share a
 * cache-invalidation graph: registering a reader changes the device list, an
 * eviction changes both the device list and a member's status, and an enrolment
 * lands in a member's status while the reader stays untouched. Splitting them
 * would scatter the key definitions those invalidations depend on.
 *
 * ## Refetch cadence, and why it is not aggressive
 *
 * Nothing here polls by default. The one place that does is enrolment, which is
 * a bounded wait a human is actively watching. Everything else is refetched on
 * demand or on mutation, because a door controller's state changes when someone
 * makes it change — and a dashboard that re-queries every few seconds costs a
 * gym's connection more than it tells them.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearMemberBiometric,
  recordMemberBiometricConsent,
  disableAccessDevice,
  enableAccessDevice,
  freeAccessDeviceSpace,
  getAccessAccount,
  getAccessEvents,
  getMemberAccess,
  getMemberEnrolment,
  listAccessDevices,
  openAccessDevice,
  rebootAccessDevice,
  registerAccessDevice,
  saveAccessAccount,
  startMemberEnrolment,
  syncMemberAccess,
  unlinkAccessDevice,
  updateAccessDevice,
  verifyAccessAccount,
  type AccessAccountInput,
  type AccessEventsQuery,
  type AccessEventsPage,
  type FreeSpaceResult,
  type RegisterDeviceInput,
  type SyncMemberResult,
} from '../services/access-control.service'
import type {
  SerializedAccessAccount,
  SerializedAccessDevice,
} from '../utils/serializeAccessForAPI'
import type { MemberAccessStatus } from '../types'
import {
  ENROLMENT_POLL_INTERVAL_MS,
  ENROLMENT_CONFIRM_GRACE_MS,
  ENROLMENT_POLL_TIMEOUT_MS,
} from '../config/AccessControlConfig'

export const ACCESS_ACCOUNT_KEY = ['access-control', 'account'] as const
export const ACCESS_DEVICES_KEY = ['access-control', 'devices'] as const

export const accessEventsKey = (query: AccessEventsQuery) =>
  ['access-control', 'events', query] as const

export const memberAccessKey = (memberId: string) =>
  ['access-control', 'member', memberId] as const

/* ------------------------------------------------------------------ account */

/** The gym's vendor account. `null` data means "not set up", not an error. */
export function useAccessAccount() {
  return useQuery<SerializedAccessAccount | null>({
    queryKey: ACCESS_ACCOUNT_KEY,
    queryFn: getAccessAccount,
    staleTime: 60_000,
  })
}

export function useSaveAccessAccount(): UseMutationResult<
  SerializedAccessAccount,
  Error,
  AccessAccountInput
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: saveAccessAccount,
    onSuccess: (account) => {
      queryClient.setQueryData(ACCESS_ACCOUNT_KEY, account)
      // New credentials can reach a different vendor account entirely, so the
      // reader list we hold may no longer describe anything real.
      queryClient.invalidateQueries({ queryKey: ACCESS_DEVICES_KEY })
    },
  })
}

/**
 * Probe the saved credentials.
 *
 * The result refreshes the account query because a successful probe stamps
 * `lastVerifiedAt`, which is what the settings page shows as proof.
 */
export function useVerifyAccessAccount(): UseMutationResult<
  { verified: boolean },
  Error,
  void
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => verifyAccessAccount(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCESS_ACCOUNT_KEY })
    },
  })
}

/* ------------------------------------------------------------------ devices */

export function useAccessDevices(options: { enabled?: boolean } = {}) {
  return useQuery<SerializedAccessDevice[]>({
    queryKey: ACCESS_DEVICES_KEY,
    queryFn: listAccessDevices,
    staleTime: 30_000,
    enabled: options.enabled ?? true,
  })
}

function useDeviceMutation<TResult, TInput = void>(
  mutationFn: (input: TInput) => Promise<TResult>
): UseMutationResult<TResult, Error, TInput> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCESS_DEVICES_KEY })
    },
  })
}

export function useRegisterAccessDevice() {
  return useDeviceMutation<SerializedAccessDevice, RegisterDeviceInput>(
    registerAccessDevice
  )
}

export function useUpdateAccessDevice() {
  return useDeviceMutation<
    SerializedAccessDevice,
    { deviceId: string; deviceName?: string; templateCapacity?: number }
  >(({ deviceId, ...input }) => updateAccessDevice(deviceId, input))
}

export function useSetAccessDeviceActive() {
  return useDeviceMutation<
    { isActive: boolean },
    { deviceId: string; isActive: boolean }
  >(({ deviceId, isActive }) =>
    isActive ? enableAccessDevice(deviceId) : disableAccessDevice(deviceId)
  )
}

export function useUnlinkAccessDevice() {
  return useDeviceMutation<
    { unlinked: boolean; hardwareUnchanged: boolean },
    string
  >(unlinkAccessDevice)
}

/**
 * Remote unlock.
 *
 * Does not invalidate anything: the door opening changes no row we hold. The
 * confirmation arrives independently, as the device's own event 8 on the
 * check-in log — hardware corroborating our claim that it happened.
 */
export function useOpenAccessDevice(): UseMutationResult<
  { opened: boolean },
  Error,
  string
> {
  return useMutation({ mutationFn: openAccessDevice })
}

export function useRebootAccessDevice(): UseMutationResult<
  { rebooting: boolean },
  Error,
  string
> {
  return useMutation({ mutationFn: rebootAccessDevice })
}

/** Manual capacity reclamation. Changes template counts, so devices refetch. */
export function useFreeAccessDeviceSpace() {
  return useDeviceMutation<FreeSpaceResult, string>(freeAccessDeviceSpace)
}

/* ------------------------------------------------------------------- events */

export function useAccessEvents(
  query: AccessEventsQuery,
  options: { enabled?: boolean } = {}
) {
  return useQuery<AccessEventsPage>({
    queryKey: accessEventsKey(query),
    queryFn: () => getAccessEvents(query),
    // Short, because this is the one screen where staleness is visible: a scan
    // that happened ten seconds ago should show when the page is looked at.
    staleTime: 15_000,
    enabled: options.enabled ?? true,
  })
}

/* ------------------------------------------------------------------ members */

export function useMemberAccess(
  memberId: string | null,
  options: { enabled?: boolean } = {}
) {
  return useQuery<MemberAccessStatus>({
    queryKey: memberAccessKey(memberId ?? ''),
    queryFn: () => getMemberAccess(memberId!),
    enabled: Boolean(memberId) && (options.enabled ?? true),
    staleTime: 15_000,
  })
}

export function useSyncMemberAccess(): UseMutationResult<
  SyncMemberResult,
  Error,
  string
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: syncMemberAccess,
    onSuccess: (_result, memberId) => {
      queryClient.invalidateQueries({ queryKey: memberAccessKey(memberId) })
    },
  })
}

export function useRecordMemberBiometricConsent(): UseMutationResult<
  { consentRecorded: boolean },
  Error,
  string
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: recordMemberBiometricConsent,
    onSuccess: (_result, memberId) => {
      queryClient.invalidateQueries({ queryKey: memberAccessKey(memberId) })
      queryClient.invalidateQueries({ queryKey: ACCESS_DEVICES_KEY })
    },
  })
}

export function useClearMemberBiometric(): UseMutationResult<
  { fingerEnrolled: boolean; membershipUnchanged: boolean },
  Error,
  string
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: clearMemberBiometric,
    onSuccess: (_result, memberId) => {
      queryClient.invalidateQueries({ queryKey: memberAccessKey(memberId) })
      // A freed template changes the reader's occupancy.
      queryClient.invalidateQueries({ queryKey: ACCESS_DEVICES_KEY })
    },
  })
}

/**
 * State of a desk-driven enrolment.
 *
 * `awaiting` is not a loading state — it is a person walking to a terminal and
 * putting a finger on it. That is why it has a timeout rather than a spinner:
 * the wait ends when the member arrives, gives up, or the window closes.
 */
export type EnrolmentPollState =
  'idle' | 'starting' | 'awaiting' | 'enrolled' | 'timed-out' | 'failed'

export interface EnrolmentPoll {
  state: EnrolmentPollState
  /** Server's own wording for a refusal; `null` unless `state` is 'failed'. */
  error: string | null
  /**
   * Begin enrolment. `consent` carries the desk's confirmation that the member
   * agreed, and is only needed when none is on file — the server decides.
   */
  start: (input: {
    deviceId: string
    fingerId?: number
    consent?: boolean
  }) => Promise<void>
  reset: () => void
}

/**
 * Drive one member through enrolment, then watch for the template to appear.
 *
 * ## Why polling, and why it can only ever add
 *
 * The vendor tells us a reader accepted the *request*, never that a finger was
 * presented — the template exists only after the member touches the sensor. No
 * webhook reports it either. Polling `/enrolment` is the sole way to learn it
 * landed.
 *
 * Timing out is not failure. The detection behind the poll is additive: it can
 * mark a member enrolled, never un-enrol one. So a poll that gives up leaves a
 * member who did present a finger correctly enrolled, and the next read of
 * their status shows it. Being wrong in that direction is a stale screen;
 * being wrong in the other would be a member told to re-enrol a finger the
 * reader already has.
 */
export function useEnrolmentPoll(memberId: string | null): EnrolmentPoll {
  const [state, setState] = useState<EnrolmentPollState>('idle')
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Held in a ref so unmounting stops the loop. A poll that outlives its panel
  // would keep writing to the cache for a member nobody is looking at.
  const cancelledRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    cancelledRef.current = false

    return () => {
      cancelledRef.current = true
      clearTimeout(timerRef.current)
    }
  }, [memberId])

  const reset = useCallback(() => {
    clearTimeout(timerRef.current)
    setState('idle')
    setError(null)
  }, [])

  const start = useCallback(
    async (input: {
      deviceId: string
      fingerId?: number
      consent?: boolean
    }) => {
      if (!memberId) return

      clearTimeout(timerRef.current)
      setError(null)
      setState('starting')

      try {
        await startMemberEnrolment(memberId, input)
      } catch (startError) {
        if (cancelledRef.current) return
        setState('failed')
        setError(
          startError instanceof Error
            ? startError.message
            : 'The reader did not accept the enrolment request'
        )
        return
      }

      if (cancelledRef.current) return
      setState('awaiting')

      // The request may have recorded the member's consent server-side, so the
      // panel's copy of their status is already stale. Refreshed here rather
      // than only when the finger lands, so the consent checkbox disappears as
      // soon as it has been answered — including on the runs that then time
      // out waiting for a finger that never came.
      queryClient.invalidateQueries({ queryKey: memberAccessKey(memberId) })

      const startedAt = Date.now()
      // The visible state flips to 'timed-out' once, but the loop carries on
      // quietly for the confirmation grace: the member's first scan is what
      // confirms the finger, and it can come well after the reader's own ~10 s
      // window closed (visit 1, PH-04).
      let timedOut = false

      const tick = async (): Promise<void> => {
        if (cancelledRef.current) return

        try {
          const { enrolled } = await getMemberEnrolment(memberId)

          if (cancelledRef.current) return

          if (enrolled) {
            setState('enrolled')
            queryClient.invalidateQueries({
              queryKey: memberAccessKey(memberId),
            })
            queryClient.invalidateQueries({ queryKey: ACCESS_DEVICES_KEY })
            return
          }
        } catch {
          // A dropped poll is not a failed enrolment. Keep waiting; the member
          // is still standing at the reader either way.
        }

        if (cancelledRef.current) return

        const elapsed = Date.now() - startedAt

        // The flip comes BEFORE the stop, so a tick that fires late (a
        // throttled background tab can skip straight past both limits) still
        // ends on 'timed-out' rather than leaving an 'awaiting' instruction
        // on screen with nothing polling behind it.
        if (elapsed >= ENROLMENT_POLL_TIMEOUT_MS && !timedOut) {
          timedOut = true
          setState('timed-out')
          // Refresh anyway: the finger may have landed on the attempt whose
          // response we lost.
          queryClient.invalidateQueries({ queryKey: memberAccessKey(memberId) })
        }

        if (elapsed >= ENROLMENT_POLL_TIMEOUT_MS + ENROLMENT_CONFIRM_GRACE_MS) {
          return
        }

        timerRef.current = setTimeout(tick, ENROLMENT_POLL_INTERVAL_MS)
      }

      timerRef.current = setTimeout(tick, ENROLMENT_POLL_INTERVAL_MS)
    },
    [memberId, queryClient]
  )

  return { state, error, start, reset }
}
