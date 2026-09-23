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
 *
 * ## It is also how we learn a fingerprint was enrolled
 *
 * Asked on 2026-09-23 how the platform is supposed to find out that a
 * fingerprint was actually captured, VFT answered: *"in the next update, the
 * finger count will be displayed. Now it is considered with the attendance
 * record."* So there is nothing to poll for — findings F26/F29, audit Y3 — and
 * the scan itself is the evidence: the reader matched a template against a
 * finger and told us whose it was.
 */

import type { IAccessControlRepository } from './IAccessControlRepository'
import type { IncomingAccessEvent } from './IAccessControlRepository'
import {
  accessWebhookEventSchema,
  accessWebhookPayloadSchema,
} from '@/features/access-control/schemas/access-control.schemas'
import type { AccessWebhookEvent } from '@/features/access-control/schemas/access-control.schemas'
import {
  DEVICE_CLOCK_SKEW_ALERT_SECONDS,
  VerifyType,
} from '@/features/access-control/config/AccessControlConfig'

export interface RecordAccessEventsSummary {
  received: number
  stored: number
  duplicates: number
  /** Events for readers we do not know. Dropped, not guessed at. */
  unknownDevice: number
  /**
   * Events we could not read at all.
   *
   * Counted separately from `errors` because this is the number that means
   * data was lost: the reader has already had its 200 and will not send them
   * again.
   */
  malformed: number
  /**
   * The delivery itself could not be read, so `malformed` is not a count of
   * anything.
   *
   * A body that is neither an array nor a single event — a wrapper such as
   * `{"events":[…]}` — is one unreadable thing containing an unknown number of
   * scans. Reporting that as `malformed: 1` would understate a fifty-scan loss
   * as a single event, and this count is the only alarm this path produces.
   */
  unreadableDelivery: boolean
  /**
   * Members whose fingerprint this delivery confirmed for the first time.
   *
   * Almost always zero: it takes one scan per member, ever. A non-zero value
   * is somebody's first entry after being enrolled.
   */
  enrolmentsConfirmed: number
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
      malformed: 0,
      unreadableDelivery: false,
      enrolmentsConfirmed: 0,
      driftingDevices: [],
      errors: [],
    }

    const envelope = accessWebhookPayloadSchema.safeParse(payload)

    if (!envelope.success) {
      summary.errors.push('Malformed webhook payload')
      summary.unreadableDelivery = true
      return summary
    }

    summary.received = envelope.data.length
    if (envelope.data.length === 0) return summary

    // Readers batch, so one delivery can span several devices.
    //
    // Each event is parsed on its own. A batch is a transport detail — the
    // scans in it are unrelated — so one unreadable row must cost exactly
    // itself. Parsing the array as a unit meant a single unexpected scalar
    // discarded every scan delivered beside it, permanently and silently.
    const byDevice = new Map<string, AccessWebhookEvent[]>()

    for (const [index, candidate] of envelope.data.entries()) {
      const parsed = accessWebhookEventSchema.safeParse(candidate)

      if (!parsed.success) {
        summary.malformed += 1
        // One element that was never an array: the whole delivery is what was
        // lost, and how many scans it held is unknowable.
        if (envelope.data.length === 1 && !Array.isArray(payload)) {
          summary.unreadableDelivery = true
        }
        summary.errors.push(
          `Event ${index}: ${parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'} ${i.message}`).join('; ')}`
        )
        continue
      }

      const event = parsed.data
      const existing = byDevice.get(event.DeviceID) ?? []
      existing.push(event)
      byDevice.set(event.DeviceID, existing)
    }

    for (const [reportedSerial, events] of byDevice) {
      try {
        const device = await this.repo.findDeviceBySerial(reportedSerial)

        if (!device) {
          summary.unknownDevice += events.length
          continue
        }

        // From here on, the REGISTERED spelling — never the one the reader
        // sent. Resolution is deliberately lenient about case and whitespace,
        // but letting a second spelling past this point splits one reader's
        // history into two buckets and, worse, makes `recordDeviceClockSkew`
        // filter on a serial that matches no row: a Supabase update that
        // matches nothing reports success, so drift and last-seen would stop
        // being recorded for that reader with nothing reporting a problem.
        // The reader's own spelling survives in each event's `raw`.
        const deviceSerial = device.device_serial

        const normalised: IncomingAccessEvent[] = []
        let newestScan: Date | null = null

        for (const event of events) {
          const occurredAt = parseDeviceTime(
            event.AttTime,
            device.timezone_offset_minutes
          )

          if (!occurredAt) {
            summary.errors.push(`Unparseable timestamp "${event.AttTime}"`)
            continue
          }

          if (!newestScan || occurredAt > newestScan) {
            newestScan = occurredAt
          }

          const subjectId = Number(event.EmpId)
          const memberId = Number.isFinite(subjectId)
            ? await this.repo.findMemberIdBySubjectId(device.gym_id, subjectId)
            : null

          normalised.push({
            deviceSerial,
            subjectId: Number.isFinite(subjectId) ? subjectId : 0,
            // Stored as a column, not merely inside `raw`: the check-in log
            // filters by member, and a member id buried in a JSON blob cannot
            // answer "show me this member's entries".
            memberId,
            occurredAt,
            verifyType: toNumberOrNull(event.VerifyType),
            checkingStatus: toNumberOrNull(event.CheckingStatus),
            eventCode: event.Event ?? null,
            // Kept whole: the code tables are vendor-supplied but not
            // exhaustive, so an unmapped value must still be recoverable.
            raw: { ...event },
          })
        }

        if (normalised.length > 0) {
          const result = await this.repo.recordEvents(device.gym_id, normalised)
          summary.stored += result.inserted
          summary.duplicates += result.duplicates

          summary.enrolmentsConfirmed += await this.confirmEnrolments(
            normalised,
            summary
          )
        }

        if (newestScan) {
          // Measured from the NEWEST scan in the batch, not the first one.
          //
          // Readers batch, so the oldest scan in a delivery can be an hour old
          // with nothing wrong at all — judging drift from it makes every
          // batching reader look broken, which trains an operator to ignore
          // the one signal we have about the clock the lockout runs on.
          //
          // The asymmetry is deliberate and worth stating: batching can only
          // make a reader look SLOW, never fast. So a fast clock is detected
          // exactly, while a slow one is detected only once it exceeds normal
          // delivery lag. Under-reporting is the right way to be wrong here.
          const skewSeconds = Math.round(
            (newestScan.getTime() - receivedAt.getTime()) / 1000
          )

          await this.repo.recordDeviceClockSkew(deviceSerial, skewSeconds)

          // The expiry cutover is evaluated against this clock, so drift moves
          // the moment a member stops being admitted. There is no API to read
          // device time, which makes inferring it the only visibility we get.
          if (Math.abs(skewSeconds) > DEVICE_CLOCK_SKEW_ALERT_SECONDS) {
            summary.driftingDevices.push(deviceSerial)
          }
        }
      } catch (error) {
        // The reported spelling, deliberately: if resolution is what failed,
        // the registered serial is exactly what we do not have.
        summary.errors.push(
          `${reportedSerial}: ${error instanceof Error ? error.message : 'Unknown ingestion error'}`
        )
      }
    }

    return summary
  }

  /**
   * Take a fingerprint scan as proof that the member has a template.
   *
   * ## Why a REFUSED scan counts too
   *
   * Being turned away for an expired membership means the reader recognised
   * the finger and then applied the window — the identification is what proves
   * the template, not the verdict. Gating on "granted" would leave a lapsed
   * member showing as never enrolled however many times they came to the door.
   *
   * ## Why only `VerifyType` 1
   *
   * A card or password scan says nothing about a fingerprint, and an absent
   * verify type says nothing at all. Both are left alone: this is additive and
   * may never clear the flag, so the only cost of being conservative is a flag
   * that flips on a later scan.
   *
   * A scan that maps to no member of ours cannot confirm anything — a template
   * can legitimately outlive the member row that owned it.
   *
   * ## Why a failure here is not a failure of ingestion
   *
   * The scans are already stored by the time this runs, and they never come
   * again. Losing a reader's check-in history to a failed write on a
   * presentation flag would be a far worse trade, so this is recorded as an
   * error and the batch stands.
   */
  private async confirmEnrolments(
    events: IncomingAccessEvent[],
    summary: RecordAccessEventsSummary
  ): Promise<number> {
    const byMember = new Map<string, Date>()

    for (const event of events) {
      if (!event.memberId) continue
      if (event.verifyType !== VerifyType.Fingerprint) continue

      // Earliest scan in the batch: it is the first moment we could have
      // known, and a batch can carry a whole day of them.
      const existing = byMember.get(event.memberId)
      if (!existing || event.occurredAt < existing) {
        byMember.set(event.memberId, event.occurredAt)
      }
    }

    let confirmed = 0

    for (const [memberId, observedAt] of byMember) {
      try {
        if (
          await this.repo.confirmBiometricEnrolmentFromScan(
            memberId,
            observedAt
          )
        ) {
          confirmed += 1
        }
      } catch (error) {
        summary.errors.push(
          `Enrolment confirmation for member ${memberId}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
      }
    }

    return confirmed
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
