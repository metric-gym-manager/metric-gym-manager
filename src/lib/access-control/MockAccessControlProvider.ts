/**
 * Mock access-control provider.
 *
 * The default whenever `ACCESS_CONTROL_ENABLED` is not `true`, so local
 * development, CI and every gym that has not opted in never touch real door
 * hardware. Mirrors `MockSMSProvider` / `MockStorageProvider`.
 *
 * Deterministic and inspectable: it records every command so tests can assert
 * on what *would* have been sent, which is how the use-case suites verify
 * invariants like "never push a validity period to a blocked subject" without
 * a terminal.
 */

import type {
  AccessCredentials,
  AccessDeviceInfo,
  AccessSubjectInfo,
  CommandOutcome,
  IAccessControlProvider,
  PendingCommand,
  SubjectOnDevice,
  ValidPeriodInput,
} from './IAccessControlProvider'

/** A command the mock was asked to send. */
export interface RecordedCommand {
  operation: string
  subjectId?: string
  deviceSerial?: string
  details?: Record<string, unknown>
}

export class MockAccessControlProvider implements IAccessControlProvider {
  private readonly commands: RecordedCommand[] = []
  private readonly subjects = new Map<string, AccessSubjectInfo>()
  private devices: AccessDeviceInfo[] = []

  /** Seed the device list a test expects to see. */
  setDevices(devices: AccessDeviceInfo[]): void {
    this.devices = devices
  }

  /** Everything sent so far, in order. */
  getCommands(): readonly RecordedCommand[] {
    return this.commands
  }

  /** Commands matching one operation name. */
  getCommandsOfType(operation: string): RecordedCommand[] {
    return this.commands.filter((c) => c.operation === operation)
  }

  /** Forget all recorded state. */
  reset(): void {
    this.commands.length = 0
    this.subjects.clear()
    this.devices = []
  }

  getProviderName(): string {
    return 'Mock'
  }

  isEnabled(): boolean {
    return false
  }

  async signIn(_credentials: AccessCredentials): Promise<string> {
    this.record({ operation: 'signIn' })
    return 'mock-token'
  }

  async verifyCredentials(_credentials: AccessCredentials): Promise<boolean> {
    this.record({ operation: 'verifyCredentials' })
    return true
  }

  async listDevices(
    _credentials: AccessCredentials
  ): Promise<AccessDeviceInfo[]> {
    this.record({ operation: 'listDevices' })
    return this.devices
  }

  async upsertSubject(
    _credentials: AccessCredentials,
    subject: { subjectId: string; name: string; areaId?: number | null }
  ): Promise<CommandOutcome> {
    this.record({ operation: 'upsertSubject', subjectId: subject.subjectId })
    this.subjects.set(subject.subjectId, {
      subjectId: subject.subjectId,
      name: subject.name,
      areaId: subject.areaId ?? null,
      templateCount: 0,
    })
    return { status: 'applied' }
  }

  async removeSubject(
    _credentials: AccessCredentials,
    subjectId: string
  ): Promise<CommandOutcome> {
    this.record({ operation: 'removeSubject', subjectId })
    this.subjects.delete(subjectId)
    return { status: 'applied' }
  }

  async revokeBiometrics(
    _credentials: AccessCredentials,
    subjectId: string
  ): Promise<CommandOutcome> {
    this.record({ operation: 'revokeBiometrics', subjectId })
    const existing = this.subjects.get(subjectId)
    if (existing) {
      this.subjects.set(subjectId, { ...existing, templateCount: 0 })
    }
    return { status: 'applied' }
  }

  async syncSubjectsToDevice(
    _credentials: AccessCredentials,
    deviceSerial: string,
    subjectIds: string[]
  ): Promise<CommandOutcome> {
    this.record({
      operation: 'syncSubjectsToDevice',
      deviceSerial,
      details: { subjectIds },
    })
    return { status: 'queued' }
  }

  async setValidPeriod(
    _credentials: AccessCredentials,
    input: ValidPeriodInput
  ): Promise<CommandOutcome> {
    this.record({
      operation: 'setValidPeriod',
      subjectId: input.subjectId,
      deviceSerial: input.deviceSerial,
      details: { startDate: input.startDate, endDate: input.endDate },
    })
    return { status: 'queued' }
  }

  async grantAccess(
    _credentials: AccessCredentials,
    target: SubjectOnDevice
  ): Promise<CommandOutcome> {
    this.record({
      operation: 'grantAccess',
      subjectId: target.subjectId,
      deviceSerial: target.deviceSerial,
    })
    return { status: 'queued' }
  }

  async blockAccess(
    _credentials: AccessCredentials,
    target: SubjectOnDevice
  ): Promise<CommandOutcome> {
    this.record({
      operation: 'blockAccess',
      subjectId: target.subjectId,
      deviceSerial: target.deviceSerial,
    })
    return { status: 'queued' }
  }

  async listSubjects(
    _credentials: AccessCredentials
  ): Promise<AccessSubjectInfo[]> {
    this.record({ operation: 'listSubjects' })
    return Array.from(this.subjects.values())
  }

  async startFingerEnrolment(
    _credentials: AccessCredentials,
    target: SubjectOnDevice & { fingerId?: number }
  ): Promise<CommandOutcome> {
    this.record({
      operation: 'startFingerEnrolment',
      subjectId: target.subjectId,
      deviceSerial: target.deviceSerial,
      details: { fingerId: target.fingerId ?? 0 },
    })
    return { status: 'queued' }
  }

  async openDoor(
    _credentials: AccessCredentials,
    deviceSerial: string
  ): Promise<CommandOutcome> {
    this.record({ operation: 'openDoor', deviceSerial })
    return { status: 'queued' }
  }

  async rebootDevice(
    _credentials: AccessCredentials,
    deviceSerial: string
  ): Promise<CommandOutcome> {
    this.record({ operation: 'rebootDevice', deviceSerial })
    return { status: 'queued' }
  }

  async listPendingCommands(
    _credentials: AccessCredentials,
    _deviceSerial?: string
  ): Promise<PendingCommand[]> {
    this.record({ operation: 'listPendingCommands' })
    return []
  }

  private record(command: RecordedCommand): void {
    this.commands.push(command)
  }
}
