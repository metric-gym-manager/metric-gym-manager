'use client'

/**
 * One reader, as the front desk needs to see it.
 *
 * ## The three states, and why there are three
 *
 * Presence is `online`, `offline` or `unknown`, and collapsing the last two
 * would be the single most damaging simplification available here. "We have
 * never heard from this reader" is the normal state of one registered five
 * minutes ago; showing that as offline is a false alarm on the one screen whose
 * job is to prevent false alarms — and staff who learn to distrust the alarm
 * start letting people in by hand.
 *
 * ## Why "offline" is not phrased as an emergency
 *
 * The door keeps working. Members were pushed a validity window and the
 * terminal enforces it from its own clock, so a reader we cannot reach still
 * admits the people it should and refuses the people it should. What is
 * actually at stake is that *changes* stop landing — a cancellation made now
 * will not reach that door until it is back. The copy says exactly that,
 * because "reader offline" invites a panic the situation does not warrant.
 */

import { toast } from 'sonner'
import {
  AlarmClock,
  DoorOpen,
  HardDriveDownload,
  Power,
  Wrench,
} from 'lucide-react'
import { Badge, Button, Card, Progress } from '@/components/ui'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import {
  useFreeAccessDeviceSpace,
  useOpenAccessDevice,
  useRebootAccessDevice,
  useRepairAccessDevice,
} from '../hooks/useAccessControl'
import { DEVICE_CAPACITY_EVICT_ABOVE } from '../config/AccessControlConfig'
import type { SerializedAccessDevice } from '../utils/serializeAccessForAPI'

interface DeviceStatusCardProps {
  device: SerializedAccessDevice
  /**
   * Whether the desk may remotely unlock this door. Defaults to **true**, and
   * that is a decision rather than a placeholder.
   *
   * Front-desk staff are meant to be able to open a door remotely — it is the
   * remedy when a paid-up member's finger will not read, and making them fetch
   * an owner defeats the point of having the button. There is also nobody to
   * distinguish: a gym is one Supabase user (`gyms.user_id`), so "owner" and
   * "front desk" are the same login and no role check exists that could
   * express a narrower rule.
   *
   * The prop stays because the affordance is worth keeping addressable if
   * per-user roles ever arrive. Until then, do not "tighten" the default —
   * every caller passing `false` would be locking out the person the feature
   * is for.
   *
   * A remote open is not unaudited. It writes an `access_sync_jobs` row
   * carrying the actor, and the reader reports event **8 — "door opened
   * remotely"** back through the webhook, so the activity log shows it as
   * hardware-confirmed fact rather than as our own claim.
   */
  canRemoteOpen?: boolean
}

export default function DeviceStatusCard({
  device,
  canRemoteOpen = true,
}: DeviceStatusCardProps) {
  const open = useOpenAccessDevice()
  const reboot = useRebootAccessDevice()
  const repair = useRepairAccessDevice()
  const freeSpace = useFreeAccessDeviceSpace()
  const { confirm, ConfirmDialog } = useConfirmDialog()

  const handleOpen = async () => {
    const confirmed = await confirm({
      title: `Open ${device.deviceName}?`,
      description:
        'The door will unlock now. Only do this when you can see who is going through it.',
      confirmText: 'Open the door',
    })

    if (!confirmed) return

    try {
      await open.mutateAsync(device.id)
      toast.success('Door opened')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not open the door'
      )
    }
  }

  const handleReboot = async () => {
    const confirmed = await confirm({
      title: `Restart ${device.deviceName}?`,
      description:
        'The reader will be unusable for about a minute while it restarts. Nobody can scan in during that time. Afterwards, members’ fingerprints are sent to the readers again, which takes a few minutes.',
      confirmText: 'Restart reader',
      variant: 'destructive',
    })

    if (!confirmed) return

    try {
      await reboot.mutateAsync(device.id)
      toast.success('Reader is restarting')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not restart the reader'
      )
    }
  }

  const handleRepair = async () => {
    const confirmed = await confirm({
      title: `Repair fingerprints on ${device.deviceName}?`,
      description:
        'Use this after a power cut, once the reader has been back on for at least a minute. Every member this reader holds is removed from the readers and sent again from VFT’s copy, which takes a few minutes. A fingerprint added at this reader while it was offline is lost if the reader has not reconnected yet.',
      confirmText: 'Repair fingerprints',
    })

    if (!confirmed) return

    try {
      const result = await repair.mutateAsync(device.id)
      toast.success(
        result.membersQueued === 0
          ? 'No members are on this reader.'
          : `Repair queued for ${result.membersQueued} ${result.membersQueued === 1 ? 'member' : 'members'}. Their fingerprints return within about 10 minutes.`
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not queue the repair'
      )
    }
  }

  const handleFreeSpace = async () => {
    try {
      const result = await freeSpace.mutateAsync(device.id)

      if (result.atCapacityLimit) {
        // Not a failed operation. The reader is genuinely full of people who
        // are all entitled to be on it, which is a buy-another-reader problem
        // and must not be dressed up as an error the gym can retry away.
        toast.warning(
          `Freed ${result.freed}, but this reader is still ${result.shortfall} short. Everyone left on it is a current member — you may need a second reader.`
        )
        return
      }

      toast.success(
        result.freed > 0
          ? `Freed ${result.freed} fingerprint ${result.freed === 1 ? 'slot' : 'slots'}`
          : 'Nothing to free — this reader has room'
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not free up space'
      )
    }
  }

  const usedPercent =
    device.capacityUsed === null ? null : Math.round(device.capacityUsed * 100)

  const nearlyFull =
    device.capacityUsed !== null &&
    device.capacityUsed >= DEVICE_CAPACITY_EVICT_ABOVE

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-ink">
            {device.deviceName}
          </h3>
          <p className="mt-0.5 break-all font-mono text-mono-sm text-ink-muted">
            {device.deviceSerial}
          </p>
        </div>

        <PresenceBadge presence={device.presence} />
      </div>

      {device.presence === 'offline' && (
        <p className="text-caption text-ink-secondary">
          We have not heard from this reader recently. The door still works — it
          admits members from the schedule it already holds — but changes you
          make now will not reach it until it is back.
        </p>
      )}

      {device.presence === 'unknown' && (
        <p className="text-caption text-ink-muted">
          No scans yet. This is normal for a reader that was just connected.
        </p>
      )}

      {!device.isActive && (
        <p className="text-caption text-ink-muted">
          Paused in settings. We are not sending it changes.
        </p>
      )}

      {device.clockDrifting && (
        <p className="flex items-start gap-1.5 text-caption text-warning">
          <AlarmClock
            className="mt-px h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
          This reader&rsquo;s clock is wrong. It decides who gets in from its
          own clock, so memberships may end on the wrong day. Ask your installer
          to correct the time.
        </p>
      )}

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-caption text-ink-secondary">
            Members on this reader
          </span>
          <span className="font-mono text-mono-sm text-ink">
            {device.templateCount}
            {device.templateCapacity !== null &&
              ` / ${device.templateCapacity}`}
          </span>
        </div>

        {usedPercent === null ? (
          <p className="text-caption text-ink-muted">
            Add this reader&rsquo;s capacity in settings to see how full it is.
          </p>
        ) : (
          <>
            <Progress
              value={usedPercent}
              tone={nearlyFull ? 'warning' : 'accent'}
              aria-label={`${device.deviceName} fingerprint capacity`}
            />
            {nearlyFull && (
              <p className="text-caption text-warning">
                Nearly full. Free up space to keep new members enrolling.
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {canRemoteOpen && (
          <Button
            size="sm"
            variant="secondary"
            onClick={handleOpen}
            loading={open.isPending}
          >
            <DoorOpen className="h-4 w-4" aria-hidden="true" />
            Open door
          </Button>
        )}

        <Button
          size="sm"
          variant="secondary"
          onClick={handleFreeSpace}
          loading={freeSpace.isPending}
        >
          <HardDriveDownload className="h-4 w-4" aria-hidden="true" />
          Free up space
        </Button>

        <Button
          size="sm"
          variant="secondary"
          onClick={handleRepair}
          loading={repair.isPending}
        >
          <Wrench className="h-4 w-4" aria-hidden="true" />
          Repair fingerprints
        </Button>

        <Button
          size="sm"
          variant="destructive-ghost"
          onClick={handleReboot}
          loading={reboot.isPending}
        >
          <Power className="h-4 w-4" aria-hidden="true" />
          Restart
        </Button>
      </div>

      <ConfirmDialog />
    </Card>
  )
}

function PresenceBadge({
  presence,
}: {
  presence: SerializedAccessDevice['presence']
}) {
  if (presence === 'online') {
    return <Badge variant="success">Online</Badge>
  }

  if (presence === 'offline') {
    return <Badge variant="warning">Not responding</Badge>
  }

  // Deliberately neutral, not a warning. Never having heard from a reader is
  // an absence of information, not a fault.
  return <Badge variant="neutral">No contact yet</Badge>
}
