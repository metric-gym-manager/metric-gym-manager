/**
 * PATCH /api/access-control/devices/[id]
 *
 * Renaming only. Enabling, disabling and unlinking a reader are **state
 * transitions** and have their own endpoints (rule 2.5) — a generic update
 * that could flip `is_active` would let a state change ride in on an edit
 * nobody reviewed as one. A name is a plain property (rule 2.5.1).
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  createAccessControlRepository,
  createPushRename,
  serializeAccessDeviceForAPI,
  updateDeviceSchema,
} from '@/features/access-control'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAccessControlGym } from '@/lib/auth/requireAccessControlGym'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { readJsonBody, toErrorResponse } from '@/lib/middleware/apiErrors'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { caller, error } = await requireAccessControlGym()
  if (error) return error

  try {
    const { id } = await context.params
    const parsed = updateDeviceSchema.safeParse(await readJsonBody(request))

    if (!parsed.success) {
      return NextResponse.json(
        ResponseBuilder.validationError(parsed.error.flatten().fieldErrors),
        { status: 400 }
      )
    }

    const repo = createAccessControlRepository(caller!.supabase)

    // Service-role for the writes below: access_devices carries a SELECT-only
    // policy, so the owning gym's own session cannot update it. Safe because
    // the lookup below resolves the reader against the caller's gym first,
    // which is the tenant boundary and ours to enforce (rule 2.20).
    const writeRepo = createAccessControlRepository(createAdminClient())

    // Resolved against the caller's own gym before anything is written.
    const device = await repo.findDeviceById(caller!.gymId, id)
    if (!device) {
      return NextResponse.json(ResponseBuilder.notFound('Reader'), {
        status: 404,
      })
    }

    if (parsed.data.deviceName) {
      await writeRepo.renameDevice(id, parsed.data.deviceName)

      // Push the new name to the vendor so their device list matches ours.
      // Best-effort and non-fatal: a stale label on their console is a
      // confusion, not an outage, and it must not fail the rename the gym
      // just performed.
      await createPushRename(createAdminClient())
        .device(caller!.gymId, id)
        .catch((renameError) => {
          console.error('Device rename did not reach the vendor:', renameError)
        })
    }

    if (parsed.data.templateCapacity !== undefined) {
      // Entered from the reader's spec sheet. Otherwise capacity stays unknown
      // until the hardware refuses an enrolment, which means the capacity bar
      // shows nothing and the proactive eviction sweep cannot fire at all
      // until a gym has already filled a reader.
      await writeRepo.recordDeviceCapacity(
        device.device_serial,
        parsed.data.templateCapacity
      )
    }

    return NextResponse.json(
      ResponseBuilder.success(
        serializeAccessDeviceForAPI({
          ...device,
          device_name: parsed.data.deviceName ?? device.device_name,
          template_capacity:
            parsed.data.templateCapacity ?? device.template_capacity,
        })
      )
    )
  } catch (err) {
    return toErrorResponse(err, 'Failed to rename the reader')
  }
}
