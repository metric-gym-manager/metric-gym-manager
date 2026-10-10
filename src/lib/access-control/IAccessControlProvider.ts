/**
 * Access Control Provider Interface (Port)
 *
 * The contract for biometric door hardware. Vendor-neutral by design: no VFT or
 * ZKTeco noun appears here, so a second vendor drops in behind the same port.
 *
 * Credentials are a **parameter on every call**, not constructor state. This is
 * a multi-tenant platform and each gym may have its own account; a provider
 * instance is therefore stateless with respect to tenancy.
 *
 * Mirrors the `ISMSProvider` / `IStorageProvider` precedent, and lives in
 * `lib/` alongside `lib/payhere` and `lib/storage` because it wraps an external
 * service (R8). It must contain no gym business rules.
 */

/** Credentials for one gym's vendor account. */
export interface AccessCredentials {
  baseUrl: string
  email: string
  password: string
  /** Cached bearer token, if the caller holds a valid one. */
  apiToken?: string | null
  /** Vendor area id for this gym. Organisational, not a security boundary. */
  areaId?: number | null
}

/**
 * Outcome of a command sent to the hardware.
 *
 * Deliberately three-valued rather than boolean. The hardware protocol queues
 * commands for the terminal to collect on its next poll, and returns an
 * execution result separately — so "the API accepted it" and "the door knows"
 * are genuinely different states, and conflating them into `true` would let
 * silent drift go undetected.
 */
export type CommandOutcome =
  /** The device executed it and reported success. */
  | { status: 'applied'; commandId?: string }
  /** Accepted and queued; the device has not collected it yet. */
  | { status: 'queued'; commandId?: string }
  /** Rejected, or the device reported an execution failure. */
  | {
      status: 'failed'
      error: string
      /** Whether the outbox should try again with backoff. */
      retryable: boolean
      /**
       * A person has to fix this — a full terminal, a template the device
       * rejected. Surfaced to SaaS admins instead of being retried into the
       * void.
       */
      needsAttention?: boolean
      /** The raw device return code, when one was reported. */
      returnCode?: number
      /**
       * The vendor refused our sign-in: a person must re-enter the account.
       * Never retried.
       */
      credentialsRejected?: boolean
      /**
       * Which terminal refused, when the command targeted one.
       *
       * Carried because some failures are *about a specific reader* rather
       * than about the member — "device storage is full" being the one that
       * matters. Without it, a gym with two readers cannot tell which of them
       * refused, and acting on the wrong one is worse than not acting.
       */
      deviceSerial?: string
    }

/** A terminal as the vendor reports it. */
export interface AccessDeviceInfo {
  serial: string
  name: string
  areaId: number | null
  /** Minutes from UTC, as configured on the device. */
  timezoneOffsetMinutes: number | null
  /**
   * When the vendor last heard from this reader, if they say.
   *
   * `null` means the vendor told us nothing — not that the reader is silent.
   * The two are very different to a gym manager, so the distinction survives
   * all the way to the screen rather than collapsing into a false "offline".
   */
  lastSeenAt: Date | null
  /**
   * The vendor's own online verdict, when it offers one.
   *
   * `null` = unknown. Preferred over our inference when present, because the
   * vendor is talking to the device and we are only observing scans.
   */
  online: boolean | null
}

/** A subject (member) as the vendor holds it. */
export interface AccessSubjectInfo {
  subjectId: string
  name: string
  areaId: number | null
  /**
   * Number of biometric templates on record — **when the vendor reports it,
   * which this one does not.**
   *
   * Checked against the live account on 2026-09-23: `GET /api/template`
   * returns no template field at all, and the vendor's own collection contains
   * no endpoint that reports biometric state. Nothing in the API moves when an
   * enrolment is dispatched either — `FpCount`, `UserCount` and `AttCount` are
   * all null on a reader that demonstrably holds the member.
   *
   * So this is always `null` here, and anything deciding "has a fingerprint"
   * from it will always decide no. Do not build on it without first confirming
   * the vendor has started sending it.
   */
  templateCount: number | null
  /**
   * The validity window the vendor holds for this subject, `YYYYMMDD`.
   *
   * The vendor's own account of the state, rather than our record of what we
   * last sent — which is what reconciliation actually wants to compare
   * against. Null on a subject that has never been given a window.
   */
  validFrom?: string | null
  validTo?: string | null
  /** The vendor's own sync flag for this subject. */
  syncedToVendor?: boolean | null
  /**
   * The vendor's soft-delete flag (`IsDelete`).
   *
   * Observed `0` on every subject of the live account on 2026-09-23; the `1`
   * case has never been seen, so callers treat `true` as "the vendor no longer
   * holds this subject" — the conservative reading, since acting on it
   * re-pushes a member and acting on nothing would leave one stranded.
   */
  deleted?: boolean | null
}

/** A command still awaiting collection by a device. */
export interface PendingCommand {
  /**
   * Whether the terminal has collected and run this command.
   *
   * `false` means it is still sitting in the vendor's queue untouched — which
   * is what eight commands looked like after six hours when the readers were
   * not polling at all.
   */
  processed?: boolean
  commandId: string
  deviceSerial: string
  /** Vendor return code, when exposed. `>= 0` is success in the ZKTeco family. */
  returnCode: number | null
}

/** Target of a per-subject command. */
export interface SubjectOnDevice {
  deviceSerial: string
  subjectId: string
}

/** A validity window to push. `validTo` is inclusive of that whole day. */
export interface ValidPeriodInput extends SubjectOnDevice {
  /** `YYYYMMDD`. */
  startDate: string
  /** `YYYYMMDD`, inclusive. */
  endDate: string
}

export interface IAccessControlProvider {
  /** Provider name, for logs. */
  getProviderName(): string

  /** Whether real hardware calls are enabled in this environment. */
  isEnabled(): boolean

  /**
   * Authenticate and return a bearer token.
   *
   * @throws if the credentials are rejected.
   */
  signIn(credentials: AccessCredentials): Promise<string>

  /** Cheap probe that the stored credentials still work. */
  verifyCredentials(credentials: AccessCredentials): Promise<boolean>

  /** All terminals visible to the account. */
  listDevices(credentials: AccessCredentials): Promise<AccessDeviceInfo[]>

  /** Create or update a subject record. */
  upsertSubject(
    credentials: AccessCredentials,
    subject: { subjectId: string; name: string; areaId?: number | null }
  ): Promise<CommandOutcome>

  /**
   * Rename an existing subject on the vendor.
   *
   * Separate from `upsertSubject` because renaming is a plain property edit:
   * the vendor's edit endpoint takes the name alone, so it cannot disturb the
   * area or anything else about the record.
   */
  renameSubject(
    credentials: AccessCredentials,
    subjectId: string,
    name: string
  ): Promise<CommandOutcome>

  /** Rename a terminal on the vendor, so their device list matches ours. */
  renameDevice(
    credentials: AccessCredentials,
    deviceSerial: string,
    deviceName: string
  ): Promise<CommandOutcome>

  /** Delete a subject and its templates. */
  removeSubject(
    credentials: AccessCredentials,
    subjectId: string
  ): Promise<CommandOutcome>

  /**
   * Clear a subject's biometric templates from devices while keeping the
   * subject record. This is what "revoke fingerprint, keep the membership" maps
   * onto.
   */
  revokeBiometrics(
    credentials: AccessCredentials,
    subjectId: string
  ): Promise<CommandOutcome>

  /** Push subjects to one terminal so their records exist in its memory. */
  syncSubjectsToDevice(
    credentials: AccessCredentials,
    deviceSerial: string,
    subjectIds: string[]
  ): Promise<CommandOutcome>

  /** Set the validity window. The device enforces it from its own clock. */
  setValidPeriod(
    credentials: AccessCredentials,
    input: ValidPeriodInput
  ): Promise<CommandOutcome>

  /** Grant access (lift a block). */
  grantAccess(
    credentials: AccessCredentials,
    target: SubjectOnDevice
  ): Promise<CommandOutcome>

  /** Block access immediately, independent of any validity window. */
  blockAccess(
    credentials: AccessCredentials,
    target: SubjectOnDevice
  ): Promise<CommandOutcome>

  /** Read subjects the vendor holds — the basis for reverse reconciliation. */
  listSubjects(credentials: AccessCredentials): Promise<AccessSubjectInfo[]>

  /** Put a terminal into fingerprint enrolment mode for a subject. */
  startFingerEnrolment(
    credentials: AccessCredentials,
    target: SubjectOnDevice & { fingerId?: number }
  ): Promise<CommandOutcome>

  /** Remote unlock. Physically consequential — callers must audit it. */
  openDoor(
    credentials: AccessCredentials,
    deviceSerial: string
  ): Promise<CommandOutcome>

  /** Reboot a terminal. */
  rebootDevice(
    credentials: AccessCredentials,
    deviceSerial: string
  ): Promise<CommandOutcome>

  /** Commands not yet collected, for drift detection. */
  listPendingCommands(
    credentials: AccessCredentials,
    deviceSerial?: string
  ): Promise<PendingCommand[]>
}
