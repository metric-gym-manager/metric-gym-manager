/**
 * Ingest scans pushed by the readers.
 *
 * This is what lets the front desk answer "why won't it let me in?" with
 * "your membership expired on the 15th" instead of a shrug — the device tells
 * us not just that someone was refused, but which reason it applied.
 *
 * ## Two things it must not do
 *
 * **Never guess at an unknown reader.** The callback is account-wide, so on a
 * shared vendor account we can legitimately receive traffic for hardware that
 * is not ours. An unrecognised serial is counted and dropped, never attributed
 * to a gym on a hunch.
 *
 * **Never trust the payload for identity.** The gym comes from our own
 * `access_devices` lookup on the serial, and the member from our own subject
 * mapping. Nothing in the body decides who anything belongs to.
 */

import type { IAccessControlRepository } from './IAccessControlRepository'
import type { IncomingAccessEvent } from './IAccessControlRepository'
import { accessWebhookPayloadSchema } from '@/features/access-control/schemas/access-control.schemas'
import { DEVICE_CLOCK_SKEW_ALERT_SECONDS } from '@/features/access-control/config/AccessControlConfig'

export interface RecordAccessEventsSummary {
  received: number
  stored: number
  duplicates: number
  /** Events for readers we do not know. Dropped, not guessed at. */
  unknownDevice: number
  /** Readers whose clock looks far enough out to matter. */
  driftingDevices: string[]
  errors: string[]
}

export class RecordAccessEvents {
  constructor(private readonly repo: IAccessControlRepository) {}

  /**
   * Store a batch of scans.
   *
   * @param payload - Raw webhook body. Parsed here, not by the caller.
   * @param receivedAt - When we received it, for clock-skew inference.
   */
  async execute(
    payload: unknown,
    receivedAt: Date = new Date()
  ): Promise<RecordAccessEventsSummary> {
    const summary: RecordAccessEventsSummary = {
      received: 0,
      stored: 0,
      duplicates: 0,
      unknownDevice: 0,
      driftingDevices: [],
      errors: [],
    }

    const parsed = accessWebhookPayloadSchema.safeParse(payload)

    if (!parsed.success) {
      summary.errors.push('Malformed webhook payload')
      return summary
    }

    summary.received = parsed.data.length
    if (parsed.data.length === 0) return summary

    // Readers batch, so one delivery can span several devices.
    const byDevice = new Map<string, typeof parsed.data>()
    for (const event of parsed.data) {
      const existing = byDevice.get(event.DeviceID) ?? []
      existing.push(event)
      byDevice.set(event.DeviceID, existing)
    }

    for (const [deviceSerial, events] of byDevice) {
      try {
        const device = await this.repo.findDeviceBySerial(deviceSerial)

        if (!device) {
          summary.unknownDevice += events.length
          continue
        }

        const normalised: IncomingAccessEvent[] = []
        let firstSkewSeconds: number | null = null

        for (const event of events) {
          const occurredAt = parseDeviceTime(
            event.AttTime,
            device.timezone_offset_minutes
          )

          if (!occurredAt) {
            summary.errors.push(`Unparseable timestamp "${event.AttTime}"`)
            continue
          }

          if (firstSkewSeconds === null) {
            firstSkewSeconds = Math.round(
              (occurredAt.getTime() - receivedAt.getTime()) / 1000
            )
          }

          const subjectId = Number(event.EmpId)
          const memberId = Number.isFinite(subjectId)
            ? await this.repo.findMemberIdBySubjectId(device.gym_id, subjectId)
            : null

          normalised.push({
            deviceSerial,
            subjectId: Number.isFinite(subjectId) ? subjectId : 0,
            occurredAt,
            verifyType: toNumberOrNull(event.VerifyType),
            checkingStatus: toNumberOrNull(event.CheckingStatus),
            eventCode: event.Event ?? null,
            // Kept whole: the code tables are vendor-supplied but not
            // exhaustive, so an unmapped value must still be recoverable.
            raw: { ...event, resolvedMemberId: memberId },
          })
        }

        if (normalised.length > 0) {
          const result = await this.repo.recordEvents(device.gym_id, normalised)
          summary.stored += result.inserted
          summary.duplicates += result.duplicates
        }

        if (firstSkewSeconds !== null) {
          await this.repo.recordDeviceClockSkew(deviceSerial, firstSkewSeconds)

          // The expiry cutover is evaluated against this clock, so drift moves
          // the moment a member stops being admitted. There is no API to read
          // device time, which makes inferring it the only visibility we get.
          if (Math.abs(firstSkewSeconds) > DEVICE_CLOCK_SKEW_ALERT_SECONDS) {
            summary.driftingDevices.push(deviceSerial)
          }
        }
      } catch (error) {
        summary.errors.push(
          `${deviceSerial}: ${error instanceof Error ? error.message : 'Unknown ingestion error'}`
        )
      }
    }

    return summary
  }
}

/**
 * Convert a device-local `YYYY-MM-DD HH:MM:SS` stamp to a real instant.
 *
 * The reader reports its own local time with no offset, so the conversion uses
 * that device's configured offset — not a global constant. Two readers in
 * different timezones on one account would otherwise land hours apart.
 *
 * @param attTime - Timestamp as the device wrote it.
 * @param offsetMinutes - The device's UTC offset in minutes (330 = UTC+5:30).
 * @returns The instant, or `null` if unparseable.
 */
function parseDeviceTime(attTime: string, offsetMinutes: number): Date | null {
  const match = attTime
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/)

  if (!match) return null

  const [, year, month, day, hour, minute, second] = match

  const asUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  )

  if (Number.isNaN(asUtc)) return null

  // The stamp is local to the device, so subtract its offset to get UTC.
  return new Date(asUtc - offsetMinutes * 60_000)
}

function toNumberOrNull(value: string | undefined): number | null {
  if (value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
