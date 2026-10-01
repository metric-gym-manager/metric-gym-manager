'use client'

/**
 * Readers — the setup half. Adding, naming, capacity, and taking one out of use.
 *
 * ## Registering is not installing
 *
 * The terminal already exists on the vendor's platform before it appears here;
 * this form only tells *us* about one, by the serial printed on it. That is why
 * the copy says "connect" rather than "add" and why unlinking is described as
 * forgetting: the hardware and its stored fingerprints are untouched either
 * way, so both directions are reversible.
 *
 * ## Why disabling is worded so carefully
 *
 * Disabling a reader here stops us sending it changes. It does **not** stop the
 * door working — the terminal keeps admitting members from the validity windows
 * it already holds, judged against its own clock. Staff who assume otherwise
 * would disable a reader expecting a locked door and get an unlocked one, so
 * the row says so outright.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  Skeleton,
  Switch,
} from '@/components/ui'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import {
  useAccessDevices,
  useRegisterAccessDevice,
  useSetAccessDeviceActive,
  useUnlinkAccessDevice,
  useUpdateAccessDevice,
} from '../hooks/useAccessControl'
import type { SerializedAccessDevice } from '../utils/serializeAccessForAPI'

export default function AccessReadersCard() {
  const { data: devices, isLoading } = useAccessDevices()
  const register = useRegisterAccessDevice()

  const [serial, setSerial] = useState('')
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)

  const handleRegister = async () => {
    try {
      await register.mutateAsync({
        deviceSerial: serial.trim(),
        deviceName: name.trim(),
      })

      setSerial('')
      setName('')
      setAdding(false)
      toast.success('Reader connected')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not connect the reader'
      )
    }
  }

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-ink">Readers</h3>
          <p className="mt-1 text-sm text-ink-secondary">
            The fingerprint terminals on your doors. Your installer fits them;
            here you give each one a name your staff will recognise.
          </p>
        </div>

        {!adding && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Connect a reader
          </Button>
        )}
      </div>

      {adding && (
        <div className="space-y-4 border-t border-line-1 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Serial number"
              helperText="Printed on the back of the reader."
            >
              <Input
                value={serial}
                onChange={(event) => setSerial(event.target.value)}
                placeholder="QEM1253800017"
                autoComplete="off"
              />
            </FormField>

            <FormField
              label="Name"
              helperText="What your staff call this door."
            >
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Front entrance"
                autoComplete="off"
              />
            </FormField>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="accent"
              onClick={handleRegister}
              loading={register.isPending}
              disabled={!serial.trim() || !name.trim()}
            >
              Connect
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setAdding(false)}
              disabled={register.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : devices && devices.length > 0 ? (
        <div className="divide-y divide-line-subtle">
          {devices.map((device) => (
            <ReaderRow key={device.id} device={device} />
          ))}
        </div>
      ) : (
        !adding && (
          <EmptyState
            title="No readers connected"
            description="Once your installer has fitted a terminal, connect it here using the serial number on the back."
          />
        )
      )}
    </Card>
  )
}

/** One reader's editable settings. Presence and capacity live on the dashboard. */
function ReaderRow({ device }: { device: SerializedAccessDevice }) {
  const update = useUpdateAccessDevice()
  const setActive = useSetAccessDeviceActive()
  const unlink = useUnlinkAccessDevice()
  const { confirm, ConfirmDialog } = useConfirmDialog()

  const [name, setName] = useState(device.deviceName)
  const [capacity, setCapacity] = useState(
    device.templateCapacity === null ? '' : String(device.templateCapacity)
  )

  const nameChanged =
    name.trim() !== device.deviceName && name.trim().length > 0
  const capacityChanged =
    capacity.trim() !== (device.templateCapacity?.toString() ?? '')

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        deviceId: device.id,
        ...(nameChanged ? { deviceName: name.trim() } : {}),
        ...(capacityChanged && capacity.trim()
          ? { templateCapacity: Number(capacity) }
          : {}),
      })

      toast.success('Reader updated')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not update the reader'
      )
    }
  }

  const handleToggle = async (isActive: boolean) => {
    try {
      await setActive.mutateAsync({ deviceId: device.id, isActive })
      toast.success(isActive ? 'Reader back in use' : 'Reader paused')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not change the reader'
      )
    }
  }

  const handleUnlink = async () => {
    const confirmed = await confirm({
      title: `Forget ${device.deviceName}?`,
      description:
        'We will stop managing this reader. The reader itself and the fingerprints stored on it are not touched, and you can connect it again with the same serial number.',
      confirmText: 'Forget reader',
      variant: 'destructive',
    })

    if (!confirmed) return

    try {
      await unlink.mutateAsync(device.id)
      toast.success('Reader forgotten')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not forget the reader'
      )
    }
  }

  return (
    <div className="space-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">
            {device.deviceName}
          </span>
          <span className="font-mono text-mono-md text-ink-muted">
            {device.deviceSerial}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* §15.1 for Checkbox/Radio/Switch: the control stays 24 px and the
              LABEL carries the 44 px hit area, which is why it wraps the
              control rather than pointing at it (F28). Measured 88×24 on a
              phone before this class; the switch track itself is 44×24 by
              §5.2 and stays that way. */}
          <label className="flex items-center gap-2 text-sm text-ink-secondary phone:min-h-touch">
            <Switch
              checked={device.isActive}
              onCheckedChange={handleToggle}
              disabled={setActive.isPending}
              aria-label={`Send changes to ${device.deviceName}`}
            />
            In use
          </label>

          <Button
            size="icon"
            variant="destructive-ghost"
            onClick={handleUnlink}
            aria-label={`Forget ${device.deviceName}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {!device.isActive && (
        <p className="text-caption text-ink-muted">
          Paused. We are not sending this reader any changes — but the door
          still works, admitting the members it already knows about.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <FormField label="Name">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>

        <FormField
          label="Fingerprint capacity"
          optional
          helperText="From the reader's spec sheet. Lets us warn you before it fills up."
        >
          <Input
            inputMode="numeric"
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
            placeholder="3000"
          />
        </FormField>

        <Button
          size="sm"
          variant="secondary"
          onClick={handleSave}
          loading={update.isPending}
          disabled={!nameChanged && !capacityChanged}
        >
          Save
        </Button>
      </div>

      <ConfirmDialog />
    </div>
  )
}
