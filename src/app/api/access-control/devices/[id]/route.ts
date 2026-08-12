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
  serializeAccessDeviceForAPI,
  updateDeviceSchema,
} from '@/features/access-control'
import { requireAccessControlGym } from '@/lib/auth/requireAccessControlGym'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { toErrorResponse } from '@/lib/middleware/apiErrors'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { caller, error } = await requireAccessControlGym()
  if (error) return error

  try {
    const { id } = await context.params
    const parsed = updateDeviceSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json(
        ResponseBuilder.validationError(parsed.error.flatten().fieldErrors),
        { status: 400 }
      )
    }

    const repo = createAccessControlRepository(caller!.supabase)

    // Resolved against the caller's own gym before anything is written.
    const device = await repo.findDeviceById(caller!.gymId, id)
    if (!device) {
      return NextResponse.json(ResponseBuilder.notFound('Reader'), {
        status: 404,
      })
    }

    await repo.renameDevice(id, parsed.data.deviceName)

    return NextResponse.json(
      ResponseBuilder.success(
        serializeAccessDeviceForAPI({
          ...device,
          device_name: parsed.data.deviceName,
        })
      )
    )
  } catch (err) {
    return toErrorResponse(err, 'Failed to rename the reader')
  }
}
