/**
 * ZKTeco command return codes.
 *
 * The device acknowledges every command with a numeric return value:
 * `>= 0` is success, negative values are the documented errors reproduced
 * below. Source: VFT's "Commands Return Values" reference.
 *
 * ## Why this file exists
 *
 * Not every failure means the same thing. "Failed to send the command" is a
 * transient blip worth retrying; "The device has insufficient space" will fail
 * identically forever until a human clears the terminal. Retrying the second
 * kind burns quota and buries the real problem, and giving up on the first kind
 * leaves a member's access unsynced.
 *
 * So each code is classified, and the outbox drains accordingly.
 */

/** How the outbox should react to a device return code. */
export enum ReturnCodeClass {
  /** Command succeeded. */
  Success = 'success',
  /** Transient — retry with backoff. */
  Retryable = 'retryable',
  /** Will fail identically until something changes. Dead-letter it. */
  Permanent = 'permanent',
  /** Not an error in our context — treat as done. */
  Benign = 'benign',
  /** Needs a human at the gym or at VFT. Surfaced, never retried blindly. */
  NeedsAttention = 'needs_attention',
}

/**
 * Codes that are transient: the device or the link was momentarily unhappy.
 */
const RETRYABLE = new Set([
  -1, // Failed to send the command
  -2, // No response to the command
  -3, // Insufficient cache
  -725, // Timed out waiting for the result
  -726, // The server returned an HTTP error
  -730, // No response from the server
  -731, // An error occurred when the server received the data
  -722, // Failed to upload the data to the software
  -728, // Failed to upload the number of table data entries
])

/**
 * Codes that will not improve on their own.
 *
 * Mostly our bugs (malformed payload, unsupported field) or firmware limits.
 * Retrying these is pure waste, so they dead-letter immediately.
 */
const PERMANENT = new Set([
  -8, // Unauthorized connection
  -13, // Incorrect command — the command does not exist
  -14, // Incorrect communication password
  -11, // Incorrect data parameter
  -20, // Received data length inconsistent with the specified length
  -108, // Invalid OPTIONS
  -620, // The format of the data delivered by the server is incorrect
  -621, // The table structure does not support this field
  -629, // Incorrect table name
  -631, // Incorrect base64 length
  -632, // Incorrect file name
  -708, // The firmware does not support this command
  -801, // Incorrect command format
])

/**
 * Codes a person has to resolve — at the gym, or with VFT.
 *
 * These are surfaced to the SaaS-admin health view with a plain-language
 * explanation rather than retried into the void.
 */
const NEEDS_ATTENTION = new Set([
  -18, // The device has insufficient space  → terminal is full
  -26, // The received fingerprint template length is 0
  -27, // Template PIN incorrect — failed to find the user
  -30, // Integrated template algorithm version inconsistent
  -612, // The device failed to save the parameter
  -628, // Failed to load the fingerprint into memory
  -720, // Failed to upgrade the firmware
])

/**
 * Codes that are not really failures for us.
 *
 * `-7` means the device already had this exact command queued — the desired
 * state is in flight, so re-sending would be the actual mistake. `-28` means a
 * remote door-open arrived while the door was already held open, which is a
 * no-op rather than a fault.
 */
const BENIGN = new Set([
  -7, // Repeated command
  -28, // Door opening command executed during the open time period
])

/**
 * Classify a device return code.
 *
 * @param code - The `Return` value reported by the device.
 * @returns How the outbox should treat it.
 *
 * @example
 * classifyReturnCode(0)    // => Success
 * classifyReturnCode(-2)   // => Retryable  (no response; try again)
 * classifyReturnCode(-18)  // => NeedsAttention (terminal is full)
 * classifyReturnCode(-13)  // => Permanent (command does not exist)
 */
export function classifyReturnCode(code: number): ReturnCodeClass {
  if (code >= 0) return ReturnCodeClass.Success
  if (BENIGN.has(code)) return ReturnCodeClass.Benign
  if (NEEDS_ATTENTION.has(code)) return ReturnCodeClass.NeedsAttention
  if (RETRYABLE.has(code)) return ReturnCodeClass.Retryable
  if (PERMANENT.has(code)) return ReturnCodeClass.Permanent

  // Reserved and firmware-internal ranges we have no mapping for. Retrying an
  // unknown failure a bounded number of times is safer than dead-lettering a
  // transient one, and the backoff caps the cost either way.
  return ReturnCodeClass.Retryable
}

/** Whether a code should be retried by the outbox. */
export function isRetryableReturnCode(code: number): boolean {
  return classifyReturnCode(code) === ReturnCodeClass.Retryable
}

/**
 * Human-readable description, for the SaaS-admin health view only.
 *
 * Gym managers never see these — technical detail stays on the admin side
 * (rule 2.9). Only the codes we act on are named; anything else reports its
 * number so it can still be looked up.
 */
const DESCRIPTIONS: Record<number, string> = {
  [-1]: 'Failed to send the command to the device',
  [-2]: 'Device did not respond',
  [-3]: 'Device cache full',
  [-7]: 'Command already queued',
  [-8]: 'Unauthorized connection',
  [-11]: 'Incorrect data parameter',
  [-13]: 'Device does not support this command',
  [-14]: 'Incorrect communication password',
  [-18]: 'Device storage is full',
  [-26]: 'Fingerprint template was empty',
  [-27]: 'Fingerprint template refers to an unknown user',
  [-28]: 'Door was already open',
  [-30]: 'Fingerprint template algorithm version mismatch',
  [-620]: 'Server sent a malformed payload',
  [-621]: 'Device does not support one of the fields sent',
  [-708]: 'Firmware does not support this command',
  [-725]: 'Device timed out waiting for a result',
  [-730]: 'No response from the platform',
  [-801]: 'Malformed command format',
}

/**
 * Describe a return code for operator diagnostics.
 *
 * @param code - The device return value.
 * @returns A short description, falling back to the raw code.
 */
export function describeReturnCode(code: number): string {
  if (code >= 0) return 'Success'
  return DESCRIPTIONS[code] ?? `Device error ${code}`
}
