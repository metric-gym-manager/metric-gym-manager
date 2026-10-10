'use client'

/**
 * One member's door access, inside their record.
 *
 * ## Why this lives in the member modal and not on the access page
 *
 * The question it answers — "why can't Nimal get in?" — is asked while looking
 * at Nimal, usually with Nimal standing there. Making staff leave the member
 * they are helping to go and search a device screen is how a feature ends up
 * unused.
 *
 * ## Three states that must never be confused
 *
 * - **Allowed / not allowed** is our verdict, computed from the same rule the
 *   door uses, so this panel and the terminal cannot disagree about *why*.
 * - **Pending** means a change is queued and has not reached the hardware yet.
 *   It is progress, not failure (rule 2.8) — showing it in red teaches staff to
 *   distrust the screen for something that resolves in seconds.
 * - **Failed** means a change gave up before it landed. Without it, a member
 *   whose job exhausted its retries would read as allowed with nothing queued:
 *   a green tick and a door that stays shut.
 *
 * No vendor detail appears here at all (rule 2.9). "Try again" is the entire
 * remedy a gym manager gets; the return code lives on the SaaS-admin health
 * view where someone can act on it.
 *
 * ## The consent tick is not a formality
 *
 * Pressing "Register fingerprint" is what causes a fingerprint to be taken, so
 * this panel is where the member is asked. The tick is required before the
 * button will fire and the server refuses without it regardless — this is the
 * courteous half of a gate that does not depend on the UI being honest.
 * Removing the fingerprint withdraws it again, which is why the button comes
 * back the next time.
 */

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Fingerprint,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Select,
  Skeleton,
} from '@/components/ui'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import { formatDate } from '@/utils/date/date'
import { useSubscription } from '@/features/subscriptions/hooks/useSubscription'
import {
  useAccessDevices,
  useClearMemberBiometric,
  useEnrolmentPoll,
  useMemberAccess,
  useSyncMemberAccess,
} from '../hooks/useAccessControl'

interface MemberAccessPanelProps {
  memberId: string
}

export default function MemberAccessPanel({
  memberId,
}: MemberAccessPanelProps) {
  const { data: subscription } = useSubscription()

  // Gated on the server-computed capability rather than on a failed request,
  // so a Lite gym opening a member does not fire a 403 for every modal.
  const entitled = Boolean(
    subscription?.subscription.capabilities.accessControlHardware
  )

  const { data: status, isLoading } = useMemberAccess(memberId, {
    enabled: entitled,
  })
  const { data: devices } = useAccessDevices({ enabled: entitled })

  const sync = useSyncMemberAccess()
  const clearBiometric = useClearMemberBiometric()
  const enrolment = useEnrolmentPoll(memberId)
  const { confirm, ConfirmDialog } = useConfirmDialog()

  const [deviceId, setDeviceId] = useState('')
  const [consentTicked, setConsentTicked] = useState(false)

  // Re-send is a re-seat (delete from the readers, then add back), so a second
  // click landing mid-way would delete the member again halfway through the
  // first one's pushes. The button's loading state is not enough: it only takes
  // effect after a re-render, and two clicks in one turn both see it enabled
  // (remote day F-13). Declared here, above the early returns, like every hook.
  const syncInFlight = useRef(false)

  if (!entitled) return null

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />
  }

  // The gym has the plan but has not set the hardware up. Nothing useful to
  // say about a member's door access when there are no doors.
  if (!status) return null

  const activeDevices = (devices ?? []).filter((device) => device.isActive)
  const selectedDevice = deviceId || activeDevices[0]?.id || ''

  // No record means ask — whether the member has never been asked or has
  // withdrawn. The two are deliberately indistinguishable here, because the
  // required action is the same.
  const consentNeeded = status.biometricConsentAt === null

  /**
   * A fingerprint exists with no consent recorded for it.
   *
   * Our own enrolment path cannot produce this — the gate refuses first. It
   * means the template arrived some other way: enrolled at the terminal's own
   * admin menu, or already on the vendor account before we were connected.
   * Detection is additive (N3), so it flips the flag on without ever having
   * asked anyone.
   *
   * Shown rather than hidden. The template is real either way, and the only
   * useful thing a screen can do about a fingerprint held without a recorded
   * basis is tell the desk it is there so they can ask or remove it.
   * Suppressing the badge would leave it collected, invisible, and
   * unaccounted for.
   */
  const enrolledWithoutConsent = status.fingerEnrolled && consentNeeded

  const handleSync = async () => {
    if (syncInFlight.current) return
    syncInFlight.current = true

    try {
      const result = await sync.mutateAsync(memberId)

      if (result.failed) {
        toast.warning('Some readers did not respond. We will keep trying.')
      } else if (result.commandsSent === 0) {
        // The route forces, so sending nothing means one thing: there is
        // nothing on any reader to change. "Readers updated" would be a claim
        // about the hardware made on the strength of zero commands.
        toast.info(
          'Nothing to send — this member cannot get in and is not on any reader.'
        )
      } else if (result.commandsPending > 0) {
        toast.success('Queued — the readers will pick this up shortly')
      } else {
        toast.success('Readers updated')
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not update the readers'
      )
    } finally {
      syncInFlight.current = false
    }
  }

  const handleEnrol = async () => {
    if (!selectedDevice) return
    if (consentNeeded && !consentTicked) return

    await enrolment.start({
      deviceId: selectedDevice,
      // Sent only when it is actually being given. A member who consented
      // before is not consenting again by being re-enrolled, and their
      // original timestamp is the one the record keeps.
      ...(consentNeeded ? { consent: true } : {}),
    })
  }

  const handleClearBiometric = async () => {
    const confirmed = await confirm({
      title: 'Remove this fingerprint?',
      description:
        'This also withdraws their consent, so they will be asked again before any new fingerprint is recorded. They will need to scan their finger again before they can use the doors. Their membership and payments are not affected.',
      confirmText: 'Remove fingerprint',
      variant: 'destructive',
    })

    if (!confirmed) return

    try {
      await clearBiometric.mutateAsync(memberId)
      enrolment.reset()
      setConsentTicked(false)
      toast.success('Fingerprint removed. Membership is unchanged.')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not remove the fingerprint'
      )
    }
  }

  return (
    <div className="space-y-3 rounded-sm border border-line-1 bg-surface-input p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">Door Access</h3>

        <Badge variant={status.allowed ? 'success' : 'neutral'} dot>
          {status.allowed ? 'Can get in' : 'Cannot get in'}
        </Badge>
      </div>

      <p className="flex items-start gap-1.5 text-sm text-ink-secondary">
        {status.allowed ? (
          <CheckCircle2
            className="mt-0.5 h-4 w-4 shrink-0 text-success"
            aria-hidden="true"
          />
        ) : (
          <XCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted"
            aria-hidden="true"
          />
        )}
        {status.explanation}
      </p>

      {status.validTo && (
        <p className="text-xs text-ink-muted">
          The readers will let this member in
          {status.validFrom ? ` from ${formatDate(status.validFrom)}` : ''}{' '}
          until {formatDate(status.validTo)}.
        </p>
      )}

      {status.syncFailed ? (
        <Alert variant="warning" title="A change did not reach the readers">
          This member&rsquo;s access on the doors may not match what you see
          here. Try again — if it keeps failing, contact support.
        </Alert>
      ) : status.syncPending ? (
        <p className="flex items-center gap-1.5 text-xs text-ink-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />A
          recent change is still on its way to the readers.
        </p>
      ) : null}

      <div className="space-y-2 border-t border-line-1 pt-3">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-sm text-ink">
            <Fingerprint
              className="h-4 w-4 text-ink-muted"
              aria-hidden="true"
            />
            Fingerprint
          </span>

          <Badge variant={status.fingerEnrolled ? 'success' : 'neutral'}>
            {status.fingerEnrolled ? 'Registered' : 'Not registered'}
          </Badge>
        </div>

        {status.biometricConsentAt ? (
          <p className="text-xs text-ink-muted">
            Consent to record a fingerprint given on{' '}
            {formatDate(status.biometricConsentAt)}.
          </p>
        ) : enrolledWithoutConsent ? (
          <Alert variant="warning" title="No consent recorded">
            This member has a fingerprint on the reader but no record of them
            agreeing to it — so it was most likely registered at the reader
            itself rather than here. Ask them to confirm they are happy with it,
            or remove it below.
          </Alert>
        ) : null}

        {status.fingerEnrolled ? (
          <Button
            size="sm"
            variant="destructive-ghost"
            onClick={handleClearBiometric}
            loading={clearBiometric.isPending}
          >
            Remove fingerprint
          </Button>
        ) : activeDevices.length === 0 ? (
          <p className="text-xs text-ink-muted">
            No readers are in use, so there is nowhere to register a
            fingerprint.
          </p>
        ) : (
          <div className="space-y-2">
            {consentNeeded && (
              <Checkbox
                checked={consentTicked}
                onChange={(event) => setConsentTicked(event.target.checked)}
                label={
                  <span className="text-xs text-ink-secondary">
                    The member agrees to their fingerprint being recorded and
                    used to open the gym&rsquo;s doors. They can ask for it to
                    be removed at any time.
                  </span>
                }
              />
            )}

            <div className="flex flex-wrap items-center gap-2">
              {activeDevices.length > 1 && (
                <Select
                  value={selectedDevice}
                  onChange={(event) => setDeviceId(event.target.value)}
                  aria-label="Reader to register the fingerprint on"
                  className="max-w-56"
                >
                  {activeDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.deviceName}
                    </option>
                  ))}
                </Select>
              )}

              <Button
                size="sm"
                variant="accent"
                onClick={handleEnrol}
                loading={enrolment.state === 'starting'}
                disabled={
                  enrolment.state === 'awaiting' ||
                  (consentNeeded && !consentTicked)
                }
              >
                <Fingerprint className="h-4 w-4" aria-hidden="true" />
                Register fingerprint
              </Button>
            </div>

            <EnrolmentStatus state={enrolment.state} error={enrolment.error} />
          </div>
        )}
      </div>

      <div className="border-t border-line-1 pt-3">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleSync}
          loading={sync.isPending}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Re-send to readers
        </Button>
      </div>

      <ConfirmDialog />
    </div>
  )
}

/**
 * What the desk is told while an enrolment is in flight.
 *
 * The `awaiting` line is an instruction, not a progress bar, because the thing
 * being waited on is a person walking to a terminal. And a timeout says the
 * screen is stale rather than that the enrolment failed: detection is additive,
 * so a member who did present a finger is enrolled regardless of whether we
 * were still watching when it happened.
 *
 * Both lines name the **scan**, because that is what the platform can actually
 * see. VFT, 2026-09-23: the finger count arrives in a future update, and until
 * then a fingerprint "is considered with the attendance record" — so the
 * template is created when the member presses their finger, and confirmed here
 * when they use the door. Telling the desk to wait for a signal that only
 * arrives on the next entry is the difference between a screen that looks
 * broken and one that is merely patient.
 */
function EnrolmentStatus({
  state,
  error,
}: {
  state: ReturnType<typeof useEnrolmentPoll>['state']
  error: string | null
}) {
  if (state === 'awaiting') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-brand-link">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        The reader is waiting for the finger now and gives up after about 10
        seconds. Once it accepts the finger, ask the member to scan once to
        confirm.
      </p>
    )
  }

  if (state === 'enrolled') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-success">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Fingerprint registered.
      </p>
    )
  }

  if (state === 'timed-out') {
    return (
      <p className="text-xs text-ink-muted">
        Not confirmed yet. If the reader accepted the finger, ask the member to
        scan once and this will update by itself for the next few minutes. If
        the reader gave up, start again.
      </p>
    )
  }

  if (state === 'failed') {
    return (
      <p className="text-xs text-warning">
        {error ?? 'The reader did not accept the request.'}
      </p>
    )
  }

  return null
}
