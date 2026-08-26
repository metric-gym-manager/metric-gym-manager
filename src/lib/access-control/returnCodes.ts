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
 *
 * Mostly transfer-integrity failures. A CRC or decompression error means the
 * bytes arrived corrupted, and the next attempt may well arrive clean — so
 * these are worth another go, unlike a malformed request which will be just as
 * malformed next time.
 */
const RETRYABLE = new Set([
  -1, // Failed to send the command
  -2, // No response to the command
  -3, // Insufficient cache
  -4, // Failed to decompress
  -5, // Incorrect length of read data
  -6, // Length after decompression does not match
  -9, // Incorrect data: CRC failed
  -10, // Incorrect data: failed to resolve data API
  -12, // Command execution error
  -19, // Checksum error
  -20, // Received length inconsistent with the specified class length
  -104, // Incorrect real-time event data
  -105, // Incorrect data for resolution
  -201, // LoadLibrary failed
  -202, // Failed to call the interface
  -203, // Communication initialization failed
  -206, // Failed to start the serial-port agent
  -301, // Failed to get the TCP/IP version
  -603, // Internal error: invalid handle
  -609, // Internal error: invalid handle
  -709, // Failed to upload options
  -721, // The device downloads the file
  -722, // Failed to upload the data to the software
  -725, // Timed out waiting for the result
  -726, // The server returned an HTTP error
  -728, // Failed to upload the number of table data entries
  -730, // No response from the server
  -731, // An error occurred when the server received the data
])

/**
 * Codes that will not improve on their own.
 *
 * Mostly our bugs (malformed payload, unsupported field, bad URL) or firmware
 * limits. Retrying these is pure waste, so they dead-letter immediately.
 *
 * The file and firmware-upgrade codes are here because **we never perform
 * those operations**. If one appears against a command we did send, something
 * is wrong on a level no retry addresses.
 */
const PERMANENT = new Set([
  -8, // Unauthorized connection
  -11, // Incorrect data parameter
  -13, // Incorrect command — the command does not exist
  -14, // Incorrect communication password
  -15, // Failed to write the file
  -16, // Failed to read the file
  -17, // The file does not exist
  -21, // No platform parameter set on the device
  -22, // Received firmware platform differs from the local platform
  -23, // Firmware version for upgrade is older than the device's
  -24, // Incorrect flag of the upgrade file
  -25, // Received upgrade file is not emfw.cfg
  -100, // The table structure does not exist
  -101, // The conditional field in the table structure does not exist
  -102, // The total field count is inconsistent
  -103, // The field sequence is inconsistent
  -106, // The delivered data exceeds 4 MB
  -107, // Failed to get the table structure
  -108, // Invalid OPTIONS
  -618, // Incorrect URL format
  -619, // Firmware internal error: blank input parameter
  -620, // The format of the data delivered by the server is incorrect
  -621, // The table structure does not support this field
  -629, // Incorrect table name
  -630, // Failed to execute the shell command
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
 *
 * `-618` deserves special mention: "incorrect URL format" is the device
 * rejecting **our own callback URL**. Retrying it forever would hide a
 * configuration error behind an infinite backoff, which is why it also carries
 * an explicit description below.
 */
const NEEDS_ATTENTION = new Set([
  -18, // The device has insufficient space  → terminal is full
  -26, // The received fingerprint template length is 0
  -27, // Template PIN incorrect — failed to find the user
  -30, // Integrated template algorithm version inconsistent
  -604, // Insufficient memory on the device
  -612, // The device failed to save the parameter
  -614, // Failed to remotely cancel the alarm
  -615, // Remote restart failed
  -616, // Remotely enabling or cancelling normal-open failed
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
  // Device / command layer
  [-1]: 'Failed to send the command to the device',
  [-2]: 'Device did not respond',
  [-3]: 'Device cache full',
  [-4]: 'Failed to decompress the payload',
  [-5]: 'Incorrect length of read data',
  [-6]: 'Decompressed length did not match the expected one',
  [-7]: 'Command already queued',
  [-8]: 'Unauthorized connection',
  [-9]: 'Data corrupted in transfer (CRC failed)',
  [-10]: 'Device could not resolve the data API',
  [-11]: 'Incorrect data parameter',
  [-12]: 'Command execution error',
  [-13]: 'Device does not support this command',
  [-14]: 'Incorrect communication password',
  [-15]: 'Device failed to write a file',
  [-16]: 'Device failed to read a file',
  [-17]: 'File does not exist on the device',
  [-18]: 'Device storage is full',
  [-19]: 'Checksum error',
  [-20]: 'Received data length inconsistent with the declared length',
  [-21]: 'No platform parameter set on the device',
  [-22]: 'Firmware platform mismatch',
  [-23]: 'Firmware for upgrade is older than the device version',
  [-24]: 'Incorrect upgrade-file flag',
  [-25]: 'Upgrade file is not named emfw.cfg',
  [-26]: 'Fingerprint template was empty',
  [-27]: 'Fingerprint template refers to an unknown user',
  [-28]: 'Door was already open',
  [-30]: 'Fingerprint template algorithm version mismatch',

  // PULL SDK internal range
  [-100]: 'Table structure does not exist',
  [-101]: 'Conditional field missing from the table structure',
  [-102]: 'Field count inconsistent',
  [-103]: 'Field sequence inconsistent',
  [-104]: 'Incorrect real-time event data',
  [-105]: 'Incorrect data for resolution',
  [-106]: 'Delivered data exceeds 4 MB',
  [-107]: 'Failed to get the table structure',
  [-108]: 'Invalid OPTIONS',
  [-201]: 'LoadLibrary failed',
  [-202]: 'Failed to call the interface',
  [-203]: 'Communication initialization failed',
  [-206]: 'Serial-port agent failed to start',
  [-301]: 'Failed to get the TCP/IP version',

  // Push-communication range
  [-601]: 'Firmware internal (reserved)',
  [-603]: 'Device internal error: invalid handle',
  [-604]: 'Device is out of memory',
  [-609]: 'Device internal error: invalid handle',
  [-612]: 'Device failed to save the parameter',
  [-614]: 'Failed to cancel the alarm remotely',
  [-615]: 'Remote restart failed',
  [-616]: 'Remote normal-open change failed',
  [-618]: 'Device rejected our callback URL as malformed',
  [-619]: 'Firmware internal error: blank input parameter',
  [-620]: 'Server sent a malformed payload',
  [-621]: 'Device does not support one of the fields sent',
  [-628]: 'Device failed to load the fingerprint into memory',
  [-629]: 'Incorrect table name',
  [-630]: 'Device failed to execute the shell command',
  [-631]: 'Incorrect base64 length',
  [-632]: 'Incorrect file name',
  [-708]: 'Firmware does not support this command',
  [-709]: 'Failed to upload options',
  [-720]: 'Firmware upgrade failed',
  [-721]: 'Device is downloading the file',
  [-722]: 'Device failed to upload data to the platform',
  [-725]: 'Device timed out waiting for a result',
  [-726]: 'Platform returned an HTTP error to the device',
  [-728]: 'Device failed to upload the table row count',
  [-730]: 'No response from the platform',
  [-731]: 'Platform errored while receiving the data',
  [-801]: 'Malformed command format (expected cmd:SN:command)',
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
