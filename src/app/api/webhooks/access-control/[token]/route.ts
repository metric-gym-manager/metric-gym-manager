/**
 * POST /api/webhooks/access-control/[token] — inbound attendance events.
 *
 * ## Why the secret is in the path
 *
 * The push protocol defines no header signature, so the two available
 * mechanisms are a path token or an IP allowlist. This is the token: one
 * platform-wide value, high-entropy and rotatable, compared in constant time.
 *
 * ## Why one URL serves every gym
 *
 * The vendor callback is configured at account level, so on a shared account
 * there is no per-gym URL to hand out. The gym is therefore resolved from the
 * device serial in the payload against our own `access_devices` table — which
 * is exactly why that column is globally unique. An event for a serial we do
 * not know is counted and dropped, never attributed to a gym on a hunch.
 *
 * A consequence worth stating plainly: on a shared account we receive
 * attendance for gyms that are not our customers. We store only what maps to a
 * device we know, and no gym identity ever comes from the body.
 *
 * ## Always 200
 *
 * Same contract as the PayHere webhook. A non-200 makes the sender retry or
 * disable the callback, and neither helps: a malformed batch will be malformed
 * on the retry too. Genuine transient faults are the one exception — those
 * return 500 so the delivery is repeated.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRecordAccessEvents } from '@/features/access-control'
import { createAdminClient } from '@/lib/supabase/admin'
import { safeCompare } from '@/lib/access-control/crypto'
import {
  describeWebhookTokenProblem,
  getWebhookPathToken,
} from '@/lib/access-control/config'
import { ResponseBuilder } from '@/utils/api/ApiResponse'

// Node crypto for the constant-time compare, service-role for the writes.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Acknowledge without revealing whether anything was stored. */
function acknowledge() {
  return NextResponse.json(ResponseBuilder.success({ received: true }), {
    status: 200,
  })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params
  const expected = getWebhookPathToken()

  if (!expected) {
    // Refuse rather than accept anonymous writes. Logged loudly because it
    // means readers are pushing into a void — and logged with the *specific*
    // reason, because "not configured" and "configured with the placeholder
    // from .env.example" need very different fixes and produce an identical
    // 401 from outside.
    console.error(
      describeWebhookTokenProblem(process.env.ACCESS_CONTROL_WEBHOOK_TOKEN)
    )
    return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 })
  }

  if (!safeCompare(token, expected)) {
    // 401, not 200: this one is not a device we serve, and a caller guessing
    // tokens should not be told their guess parsed.
    return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    // Not JSON. Retrying will not make it JSON.
    return acknowledge()
  }

  try {
    const summary =
      await createRecordAccessEvents(createAdminClient()).execute(payload)

    if (summary.driftingDevices.length > 0) {
      // The expiry cutover is enforced against the device's own clock, so
      // drift moves the moment a member stops being admitted.
      console.warn(
        'Access reader clock drift detected:',
        summary.driftingDevices.join(', ')
      )
    }

    return acknowledge()
  } catch (error) {
    // A database fault is the one case worth a retry.
    console.error('Access webhook ingestion failed:', error)
    return NextResponse.json(
      ResponseBuilder.internalError('Ingestion failed'),
      { status: 500 }
    )
  }
}
