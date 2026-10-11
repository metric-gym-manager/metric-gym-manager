/**
 * Who may open a door remotely — the decision, pinned.
 *
 * This was left open when the feature shipped: `canRemoteOpen` defaulted to
 * true with a note that restricting it was "a one-line change plus a role
 * check". The decision is now made — **front-desk staff may open a door
 * remotely** — and this suite exists so it is not quietly reversed by someone
 * reading that default as an oversight.
 *
 * Two things make it the right default rather than a lax one:
 *
 *  - A remote open is the remedy when a paid-up member's finger will not read.
 *    Routing that through an owner is how the button ends up unused and the
 *    door ends up propped open instead.
 *  - There is nobody to distinguish. A gym is one Supabase user
 *    (`gyms.user_id`), so "owner" and "front desk" are the same login; no role
 *    check exists that could express a narrower rule.
 *
 * The offsetting control is the audit trail, not a permission: the request
 * writes a job carrying the actor, and the reader reports event 8 back through
 * the webhook as independent confirmation the door actually opened.
 */

import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import DeviceStatusCard from '../components/DeviceStatusCard'
import {
  classifyDeviceEvent,
  describeDeviceEvent,
  DeviceEventKind,
} from '@/features/access-control/config/DeviceEventCodes'
import type { SerializedAccessDevice } from '../utils/serializeAccessForAPI'

jest.mock('../hooks/useAccessControl', () => ({
  useOpenAccessDevice: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRebootAccessDevice: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRepairAccessDevice: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useFreeAccessDeviceSpace: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}))

jest.mock('@/hooks/use-confirm-dialog', () => ({
  useConfirmDialog: () => ({
    confirm: jest.fn().mockResolvedValue(true),
    ConfirmDialog: () => null,
  }),
}))

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}))

const device: SerializedAccessDevice = {
  id: 'device-1',
  deviceSerial: 'SER-001',
  deviceName: 'Front Door',
  areaId: 1,
  timezoneOffsetMinutes: 330,
  isActive: true,
  lastSeenAt: new Date().toISOString(),
  templateCount: 10,
  templateCapacity: 3000,
  capacityUsed: 10 / 3000,
  clockDrifting: false,
  presence: 'online',
}

describe('remote door open', () => {
  it('is offered to any entitled user by default', () => {
    render(<DeviceStatusCard device={device} />)

    expect(
      screen.getByRole('button', { name: /open door/i })
    ).toBeInTheDocument()
  })

  it('can still be withheld if per-user roles ever arrive', () => {
    render(<DeviceStatusCard device={device} canRemoteOpen={false} />)

    expect(
      screen.queryByRole('button', { name: /open door/i })
    ).not.toBeInTheDocument()
  })

  it('has a hardware-confirmed audit trail for what it does', () => {
    // Event 8 is the reader telling us the door opened remotely — the half of
    // the audit trail we cannot fabricate. It is what makes an unrestricted
    // button acceptable, so it must stay classified and described.
    expect(describeDeviceEvent(8)).toMatch(/remote/i)
    expect(classifyDeviceEvent(8)).not.toBe(DeviceEventKind.Denied)
  })
})
