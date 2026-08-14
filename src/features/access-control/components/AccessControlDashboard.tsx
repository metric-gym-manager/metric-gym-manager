'use client'

/**
 * Door Access — the operations view.
 *
 * ## The ordering is the design
 *
 * Alerts, then readers, then the log. A manager opens this page for one of two
 * reasons: something is wrong, or they want to know who came in. The first
 * question has to be answered before they scroll, and the answer to "is
 * anything wrong" must be *visibly nothing* when nothing is — an empty strip
 * that only ever fills for real problems is what makes the strip worth reading.
 *
 * ## Why setup is not on this page
 *
 * Credentials and reader registration live in Settings. They are done once, by
 * the owner, usually with an installer on the phone. This page is opened daily
 * by whoever is at the desk. Mixing them would put a "forget this reader"
 * button on a screen that gets used in a hurry.
 */

import Link from 'next/link'
import { AlertTriangle, DoorOpen, Settings2 } from 'lucide-react'
import { Alert, Button, Card, Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui'
import { useAccessAccount, useAccessDevices } from '../hooks/useAccessControl'
import { DEVICE_CAPACITY_EVICT_ABOVE } from '../config/AccessControlConfig'
import DeviceStatusCard from './DeviceStatusCard'
import AccessActivityLog from './AccessActivityLog'

export default function AccessControlDashboard() {
  const { data: account, isLoading: accountLoading } = useAccessAccount()
  const { data: devices, isLoading: devicesLoading } = useAccessDevices()

  if (accountLoading || devicesLoading) {
    return <Skeleton className="h-96 w-full" />
  }

  // Nothing set up yet. A single instruction beats an empty dashboard with
  // four empty panels on it.
  if (!account) {
    return (
      <Card className="p-8">
        <EmptyState
          icon={<DoorOpen className="h-5 w-5" aria-hidden="true" />}
          title="Door access is not set up yet"
          description="Connect your access control account and readers, then this page shows who came in and whether every door is healthy."
          action={
            <Button asChild variant="accent">
              <Link href="/settings/access-control">
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                Set up door access
              </Link>
            </Button>
          }
        />
      </Card>
    )
  }

  const offline = (devices ?? []).filter(
    (device) => device.presence === 'offline'
  )
  const drifting = (devices ?? []).filter((device) => device.clockDrifting)
  const nearlyFull = (devices ?? []).filter(
    (device) =>
      device.capacityUsed !== null &&
      device.capacityUsed >= DEVICE_CAPACITY_EVICT_ABOVE
  )

  return (
    <div className="space-y-6">
      {!account.verified && (
        <Alert
          variant="warning"
          icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
          title="Your access control account has not been confirmed"
        >
          Changes to memberships are not reaching your doors.{' '}
          <Link
            href="/settings/access-control"
            className="underline underline-offset-4"
          >
            Check the connection
          </Link>
          .
        </Alert>
      )}

      {offline.length > 0 && (
        <Alert
          variant="warning"
          icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
          title={`${offline.length} reader${offline.length === 1 ? '' : 's'} not responding`}
        >
          {offline.map((device) => device.deviceName).join(', ')}. The doors
          still let in the members they already know about — but cancellations
          and renewals will not reach them until they are back.
        </Alert>
      )}

      {drifting.length > 0 && (
        <Alert
          variant="warning"
          icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
          title="A reader's clock is wrong"
        >
          {drifting.map((device) => device.deviceName).join(', ')}. Readers
          decide who gets in using their own clock, so memberships may end on
          the wrong day. Ask your installer to correct the time.
        </Alert>
      )}

      {nearlyFull.length > 0 && (
        <Alert
          variant="warning"
          icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
          title="A reader is nearly full"
        >
          {nearlyFull.map((device) => device.deviceName).join(', ')}. Free up
          space on the reader below, or new members will not be able to enrol
          their fingerprint.
        </Alert>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Readers</h2>

        {devices && devices.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {devices.map((device) => (
              <DeviceStatusCard key={device.id} device={device} />
            ))}
          </div>
        ) : (
          <Card className="p-8">
            <EmptyState
              title="No readers connected"
              description="Add the terminals on your doors in settings, using the serial number printed on each one."
              action={
                <Button asChild variant="secondary">
                  <Link href="/settings/access-control">Go to settings</Link>
                </Button>
              }
            />
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Recent activity</h2>
        <AccessActivityLog />
      </section>
    </div>
  )
}
