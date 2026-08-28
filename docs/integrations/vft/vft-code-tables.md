# VFT / ZKTeco — vendor code tables

> **Provenance.** Transcribed verbatim from the reference VFT supplied with
> `VFT_GYM_API_V2.0` on **2026-08-28**. This is vendor fact, not inference —
> unlike most of `vft-api-assumptions.md`. The importable collection is
> `vft-gym-api-v2-collection.json` in this directory.

Two tables, consumed by two different pieces of code:

| Table                 | Arrives in                        | Classified by                                            | Coverage asserted by                                    |
| --------------------- | --------------------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| Command return values | `Return` on a device command      | `src/lib/access-control/returnCodes.ts`                  | `src/lib/access-control/__tests__/vendorTables.test.ts` |
| Event codes           | `Event` in the attendance webhook | `src/features/access-control/config/DeviceEventCodes.ts` | same file, plus `DeviceEventCodes.test.ts`              |

**Do not edit a classification here without editing the code and the test.**
The tables below are the vendor's; the "Our handling" column is ours, and the
test is what keeps the two honest. That guard is not theoretical — the event
table in that test was once transcribed 38 codes short, so it asserted full
coverage against a list trimmed to fit the implementation and passed while a
real entry (219) and a real refusal (75) fell through to `Other`.

---

## 1. Command return values

`>= 0` is success. Everything below is a failure, and _how_ we treat it decides
whether the outbox retries, dead-letters, or asks a human.

| Code   | Vendor description                                                                 | Our handling          |
| ------ | ---------------------------------------------------------------------------------- | --------------------- |
| `>= 0` | Successful                                                                         | Success               |
| `-1`   | Failed to send the command                                                         | Retryable             |
| `-2`   | No response to the command                                                         | Retryable             |
| `-3`   | Insufficient cache                                                                 | Retryable             |
| `-4`   | Failed to decompress                                                               | Retryable             |
| `-5`   | Incorrect length of read data                                                      | Retryable             |
| `-6`   | The length after decompression does not meet the required one                      | Retryable             |
| `-7`   | Repeated command                                                                   | Benign                |
| `-8`   | Unauthorized connection                                                            | Permanent             |
| `-9`   | Incorrect data. CRC failed                                                         | Retryable             |
| `-10`  | Incorrect data. Failed to resolve data API                                         | Retryable             |
| `-11`  | Incorrect data parameter                                                           | Permanent             |
| `-12`  | Command execution error                                                            | Retryable             |
| `-13`  | Incorrect command. The command does not exist                                      | Permanent             |
| `-14`  | Incorrect communication password                                                   | Permanent             |
| `-15`  | Failed to write the file                                                           | Permanent             |
| `-16`  | Failed to read the file                                                            | Permanent             |
| `-17`  | The file does not exist                                                            | Permanent             |
| `-18`  | The device has insufficient space                                                  | **NeedsAttention**    |
| `-19`  | Checksum error                                                                     | Retryable             |
| `-20`  | The length of the received data is inconsistent with the specified data length     | Retryable             |
| `-21`  | No platform parameter is set on the device                                         | Permanent             |
| `-22`  | The received firmware platform for upgrade is not the same as the local platform   | Permanent             |
| `-23`  | The firmware version for upgrade is earlier than that in the device                | Permanent             |
| `-24`  | Incorrect flag of the upgrade file                                                 | Permanent             |
| `-25`  | The name of the received file for firmware upgrade is not emfw.cfg                 | Permanent             |
| `-26`  | The length of the received fingerprint template is 0                               | **NeedsAttention**    |
| `-27`  | The PIN of the received fingerprint template is incorrect. Failed to find the user | **NeedsAttention**    |
| `-28`  | Door opening command is executed during the open time period                       | Benign                |
| `-30`  | The integrated template algorithm's version is inconsistent                        | **NeedsAttention**    |
| `-100` | The table structure does not exist                                                 | Permanent             |
| `-101` | The conditional field in the table structure does not exist                        | Permanent             |
| `-102` | The total field count is inconsistent                                              | Permanent             |
| `-103` | The field sequence is inconsistent                                                 | Permanent             |
| `-104` | Incorrect real-time event data                                                     | Retryable             |
| `-105` | Incorrect data for resolution                                                      | Retryable             |
| `-106` | The size of the delivered data exceeds 4 MB                                        | Permanent             |
| `-107` | Failed to get the table structure                                                  | Permanent             |
| `-108` | Invalid OPTIONS                                                                    | Permanent             |
| `-201` | LoadLibrary failed                                                                 | Retryable             |
| `-202` | Failed to call the interface                                                       | Retryable             |
| `-203` | Communication initialization failed                                                | Retryable             |
| `-206` | Failed to start the serial port agent program (port missing or occupied)           | Retryable             |
| `-301` | Failed to get the TCP/IP version                                                   | Retryable             |
| `-601` | Reserved. For firmware internal use only                                           | _Retryable (default)_ |
| `-603` | Internal error: invalid handle                                                     | Retryable             |
| `-604` | Insufficient memory                                                                | **NeedsAttention**    |
| `-609` | Internal error: invalid handle                                                     | Retryable             |
| `-612` | The device failed to save the parameter                                            | **NeedsAttention**    |
| `-614` | Failed to remotely cancel the alarm                                                | **NeedsAttention**    |
| `-615` | Remote restart failed                                                              | **NeedsAttention**    |
| `-616` | Remotely enabling or canceling normal open failed                                  | **NeedsAttention**    |
| `-618` | Incorrect URL format                                                               | Permanent             |
| `-619` | Firmware internal error: blank input parameter                                     | Permanent             |
| `-620` | The format of the data delivered by the server is incorrect                        | Permanent             |
| `-621` | The table structure does not support this field                                    | Permanent             |
| `-628` | Main failed to load the fingerprint to the memory                                  | **NeedsAttention**    |
| `-629` | Incorrect table name                                                               | Permanent             |
| `-630` | Failed to execute the shell command                                                | Permanent             |
| `-631` | Incorrect base64 length                                                            | Permanent             |
| `-632` | Incorrect file name                                                                | Permanent             |
| `-701` | Reserved. For firmware internal use only                                           | _Retryable (default)_ |
| `-702` | Reserved. For firmware internal use only                                           | _Retryable (default)_ |
| `-703` | Reserved. For firmware internal use only                                           | _Retryable (default)_ |
| `-704` | Reserved. For firmware internal use only                                           | _Retryable (default)_ |
| `-705` | Reserved. For firmware internal use only                                           | _Retryable (default)_ |
| `-706` | Reserved. For firmware internal use only                                           | _Retryable (default)_ |
| `-707` | Reserved. For firmware internal use only                                           | _Retryable (default)_ |
| `-708` | The firmware does not support this command                                         | Permanent             |
| `-709` | Failed to upload options                                                           | Retryable             |
| `-720` | Failed to upgrade the firmware                                                     | **NeedsAttention**    |
| `-721` | The device downloads the file                                                      | Retryable             |
| `-722` | Failed to upload the data to the software                                          | Retryable             |
| `-723` | Reserved. For firmware internal use only                                           | _Retryable (default)_ |
| `-724` | Reserved. For firmware internal use only                                           | _Retryable (default)_ |
| `-725` | It times out when the device waits for the result                                  | Retryable             |
| `-726` | The server returns an HTTP error                                                   | Retryable             |
| `-727` | Reserved. For firmware internal use only                                           | _Retryable (default)_ |
| `-728` | Failed to upload the number of table data entries                                  | Retryable             |
| `-729` | Reserved. For firmware internal use only                                           | _Retryable (default)_ |
| `-730` | No response from the server                                                        | Retryable             |
| `-731` | An error occurs when the server receives the data                                  | Retryable             |
| `-732` | Reserved. For firmware internal use only                                           | _Retryable (default)_ |
| `-801` | Incorrect command format. The correct format is cmd:SN:command                     | Permanent             |

Ranges the vendor documents without enumerating: `[-400, -100]` PULL SDK
internal, `[*, -600]` push-communication exclusive.

### The four that change what a gym sees

- **`-18` device has insufficient space** — the reader is full. Drives the
  nightly capacity eviction (`DEVICE_CAPACITY_EVICT_ABOVE`), not a retry.
- **`-618` incorrect URL format** — the device rejecting **our own callback
  URL**. Classified Permanent on purpose: retrying forever would hide a
  configuration error behind an infinite backoff.
- **`-725` it times out when the device waits for the result** — this is the
  "device timeout, 2 minutes" VFT described verbally. It is _observable as a
  return code_, which is what makes the outbox able to tell a missed command
  from a refused one. Retryable.
- **`-7` repeated command** — the device already has this exact command queued.
  The desired state is in flight, so re-sending would be the mistake. Benign.

The thirteen `Reserved. For firmware internal use only` codes are deliberately
unclassified and fall to the bounded-retry default: we have no documented
meaning to classify them by, and a bounded retry is a safer guess for an
unknown failure than dead-lettering something transient.

---

## 2. Event codes

165 codes. Every one is classified — see the note above about why "every" is
load-bearing here.

Our four kinds: **Granted** (the door opened), **Denied** (someone was
refused), **Alarm** (urgent human attention), **System** (device/door state,
health only). The check-in log's All / Entries / Refusals / Alerts filter is
built from these as a database `IN (...)`, so a code in no kind is invisible to
every filter while still appearing under All.

| Code  | Vendor description                                                                  | Our kind  | Merged with |
| ----- | ----------------------------------------------------------------------------------- | --------- | ----------- |
| `0`   | The door opens normally after punch / verification                                  | Granted   | 0/14/17     |
| `1`   | Punch in the normal open time period / Verify in the normal open time period        | Granted   | 1/16        |
| `2`   | The first user opens the door by punch / verification                               | Granted   | 2/18/19     |
| `3`   | Multiple users open the door by punch / verification                                | Granted   | 3/15/203    |
| `4`   | Open the door by using the emergency password                                       | Granted   |             |
| `5`   | Open the door in the normal open time period                                        | Granted   |             |
| `6`   | Trigger linkage                                                                     | System    |             |
| `7`   | Cancel the alarm                                                                    | System    |             |
| `8`   | Open the door remotely                                                              | Granted   |             |
| `9`   | Close the door remotely                                                             | System    |             |
| `10`  | Disable the normal open time period of the day                                      | System    |             |
| `11`  | Enable the normal open time period of the day                                       | System    |             |
| `12`  | Enable auxiliary output remotely                                                    | System    |             |
| `13`  | Disable auxiliary output remotely                                                   | System    |             |
| `14`  | The door is normally opened by fingerprint / after verification                     | Granted   | 0/14/17     |
| `15`  | Multiple users open the door by fingerprint / verification                          | Granted   | 3/15/203    |
| `16`  | Check the fingerprint in the normal open time period                                | Granted   | 1/16        |
| `17`  | Open the door by card and fingerprint / verification                                | Granted   | 0/14/17     |
| `18`  | The first user opens the door by fingerprint / verification                         | Granted   | 2/18/19     |
| `19`  | The first user opens the door by card and fingerprint / verification                | Granted   | 2/18/19     |
| `20`  | The punch interval is too short / The operation interval is too short               | Denied    | 20/31/50    |
| `21`  | Punch during the non-valid time period                                              | Denied    | 21/35/49    |
| `22`  | Invalid time period                                                                 | Denied    |             |
| `23`  | Unauthorized access                                                                 | Denied    |             |
| `24`  | APB                                                                                 | Denied    |             |
| `25`  | Interlock                                                                           | Denied    |             |
| `26`  | Multiple users perform verification by punch / Multiple users wait for verification | Denied    | 26/32/51    |
| `27`  | The card is not registered / The user is not registered                             | Denied    | 27/30/34    |
| `28`  | Door opening times out                                                              | System    |             |
| `29`  | The card privilege expires / The user privilege expires                             | Denied    | 29/33/53    |
| `30`  | The password is incorrect / The user is not registered                              | Denied    | 27/30/34    |
| `31`  | The fingerprint check interval is too short                                         | Denied    | 20/31/50    |
| `32`  | Multiple users perform verification by fingerprint                                  | Denied    | 26/32/51    |
| `33`  | The fingerprint expires / The user privilege expires                                | Denied    | 29/33/53    |
| `34`  | The fingerprint is not registered / The user is not registered                      | Denied    | 27/30/34    |
| `35`  | Check the fingerprint during the non-valid time period                              | Denied    | 21/35/49    |
| `36`  | Press the exit button during the non-valid time period                              | System    |             |
| `37`  | The door cannot be closed during the normal open time period                        | System    |             |
| `38`  | The card has been reported as lost                                                  | Denied    |             |
| `39`  | Blacklist                                                                           | Denied    |             |
| `40`  | Multi-user verification by fingerprint failed                                       | Denied    | 40/48/52    |
| `41`  | Incorrect verification mode                                                         | Denied    |             |
| `42`  | Incorrect Wiegand format                                                            | Denied    |             |
| `43`  | The user is focused                                                                 | Denied    |             |
| `44`  | Remote identification failed                                                        | Denied    |             |
| `45`  | Remote identification times out                                                     | Denied    |             |
| `47`  | Failed to send the command                                                          | System    |             |
| `48`  | Multi-user verification by punch failed                                             | Denied    | 40/48/52    |
| `49`  | Open the door by password during the non-valid time period                          | Denied    | 21/35/49    |
| `50`  | The password verification interval is too short                                     | Denied    | 20/31/50    |
| `51`  | Multiple users perform verification by password                                     | Denied    | 26/32/51    |
| `52`  | Multi-user verification by password failed                                          | Denied    | 40/48/52    |
| `53`  | The password expires / The user privilege expires                                   | Denied    | 29/33/53    |
| `54`  | Battery voltage is too low                                                          | System    |             |
| `55`  | Replace the battery immediately                                                     | System    |             |
| `56`  | Unauthorized operation                                                              | Denied    |             |
| `57`  | Backup power supply                                                                 | System    |             |
| `58`  | Normal open alarm                                                                   | **Alarm** |             |
| `59`  | Unauthorized admin                                                                  | Denied    |             |
| `60`  | The door is locked inside                                                           | System    |             |
| `61`  | Repeat verification                                                                 | Denied    |             |
| `62`  | Prohibited user                                                                     | Denied    |             |
| `63`  | Door locked                                                                         | Denied    |             |
| `64`  | The exit button is not operated within the time period                              | System    |             |
| `65`  | Auxiliary input is not operated within the time period                              | System    |             |
| `66`  | Reader upgrade failed                                                               | System    |             |
| `67`  | Remote comparison is successful (device is not authorized)                          | Denied    |             |
| `68`  | High body temperature — access denied                                               | Denied    |             |
| `69`  | Without mask — access denied                                                        | Denied    |             |
| `70`  | The face comparison server communication is abnormal                                | System    |             |
| `71`  | Face server responds abnormally                                                     | System    |             |
| `72`  | Call unanswered                                                                     | System    |             |
| `73`  | Invalid QR code                                                                     | Denied    |             |
| `74`  | QR code has expired                                                                 | Denied    |             |
| `75`  | Combined verification timeout                                                       | Denied    |             |
| `76`  | Cannot get fingerprints in TITAN mode                                               | System    |             |
| `77`  | Internet cable not plugged in                                                       | System    |             |
| `78`  | Device hotspot disconnected abnormally                                              | System    |             |
| `79`  | Mobile network disconnected abnormally                                              | System    |             |
| `80`  | The elevator control floor selection button is triggered without any permission     | System    |             |
| `100` | Tamper alarm                                                                        | **Alarm** |             |
| `101` | Open the door with the duress password                                              | **Alarm** | 101/103     |
| `102` | The door is opened accidentally                                                     | **Alarm** |             |
| `103` | Open the door with the duress fingerprint                                           | **Alarm** | 101/103     |
| `104` | Alarm for punch with an invalid card                                                | **Alarm** |             |
| `105` | Network disconnected / Failed to connect to the server                              | System    |             |
| `106` | Battery power failure                                                               | System    |             |
| `107` | Mains power failure                                                                 | System    |             |
| `108` | Failed to connect to the main controller                                            | System    |             |
| `109` | Reader disassembly alarm                                                            | **Alarm** |             |
| `110` | Reader offline alarm                                                                | **Alarm** |             |
| `111` | POE power down                                                                      | System    |             |
| `112` | Extension board offline alarm                                                       | System    |             |
| `113` | Illegal security level                                                              | System    |             |
| `114` | Line detection, fire alarm input disconnected                                       | **Alarm** |             |
| `115` | Line detection, fire alarm input short circuit                                      | **Alarm** |             |
| `116` | Line detection, auxiliary input disconnect                                          | System    |             |
| `117` | Line detection, auxiliary input short circuit                                       | System    |             |
| `118` | Line detection, the exit button is off                                              | System    |             |
| `119` | Line detection, short circuit of exit button                                        | System    |             |
| `120` | Line detection, door sensor disconnected                                            | System    |             |
| `121` | Line detection, door sensor short circuit                                           | System    |             |
| `132` | Cancel the emergency state of the elevator control                                  | System    |             |
| `133` | It is not possible to cancel the elevator control emergency state                   | System    |             |
| `134` | The elevator control is in a restricted state                                       | System    |             |
| `150` | The elevator control manual button is short-circuited                               | System    |             |
| `151` | The elevator control manual button is disconnected                                  | System    |             |
| `152` | The elevator control emergency button is short-circuited                            | System    |             |
| `153` | The elevator control emergency button is disconnected                               | System    |             |
| `154` | The elevator control fire button is short-circuited                                 | System    |             |
| `155` | The elevator control fire button is disconnected                                    | System    |             |
| `200` | The door is open                                                                    | System    |             |
| `201` | The door is closed                                                                  | System    |             |
| `202` | Open the door by pressing the exit button                                           | Granted   |             |
| `203` | Multiple users open the door by card and fingerprint                                | Granted   | 3/15/203    |
| `204` | The door normal open time period ends                                               | System    |             |
| `205` | Remotely enable normal open for the door                                            | System    |             |
| `206` | Start the device                                                                    | System    |             |
| `207` | Open the door by password                                                           | Granted   |             |
| `208` | The super user opens the door                                                       | Granted   |             |
| `209` | Press the exit button (locked)                                                      | Granted   |             |
| `210` | Start firefighting door opening                                                     | System    |             |
| `211` | The super user closes the door                                                      | System    |             |
| `212` | Enable the elevator control function                                                | System    |             |
| `213` | Disable the elevator control function                                               | System    |             |
| `214` | Successfully connected to the server                                                | System    |             |
| `215` | The first card opens the door by password                                           | Granted   |             |
| `216` | Open the door by password during the normal open time period                        | Granted   |             |
| `217` | Successfully connected to the main controller                                       | System    |             |
| `218` | Pass by identity card                                                               | Granted   |             |
| `219` | Verification within the time period when the exit button is normally open           | Granted   |             |
| `220` | Disconnected from the auxiliary input point                                         | System    |             |
| `221` | The auxiliary input point is short-circuited                                        | System    |             |
| `222` | Remote identification is successful                                                 | Granted   |             |
| `223` | Remote identification                                                               | System    |             |
| `224` | Ring the doorbell                                                                   | System    |             |
| `225` | The auxiliary input point is normal                                                 | System    |             |
| `226` | Trigger the auxiliary input point                                                   | System    |             |
| `227` | The door is in dual-on mode                                                         | System    |             |
| `228` | The door is in dual-off mode                                                        | System    |             |
| `229` | Regularly enable normal open for auxiliary output                                   | System    |             |
| `230` | Regularly disable normal open for auxiliary output                                  | System    |             |
| `231` | IPC firmware linkage event                                                          | System    |             |
| `232` | Passed the verification                                                             | Granted   |             |
| `233` | Remote lock                                                                         | System    |             |
| `234` | Remote unlock                                                                       | Granted   |             |
| `235` | Reader upgrade successfully                                                         | System    |             |
| `236` | Reader disassembly alarm release                                                    | System    |             |
| `237` | Reader online                                                                       | System    |             |
| `239` | Device call                                                                         | System    |             |
| `240` | Call ended                                                                          | System    |             |
| `241` | Linked capture event                                                                | System    |             |
| `242` | Linked recording event                                                              | System    |             |
| `243` | Fire alarm input disconnected                                                       | **Alarm** |             |
| `244` | Fire alarm input short circuit                                                      | **Alarm** |             |
| `245` | Connect to hotspot                                                                  | System    |             |
| `246` | Mobile network connection is successful                                             | System    |             |
| `247` | Expansion board online                                                              | System    |             |
| `248` | Plug in the internet cable                                                          | System    |             |
| `249` | The elevator control direct button triggers                                         | System    |             |
| `250` | The elevator control floor selection button is triggered with the permissions       | System    |             |
| `251` | The elevator control cancels the button via voice                                   | System    |             |
| `252` | The elevator control triggers the button via voice                                  | System    |             |
| `254` | Definition of the extended event number                                             | System    |             |
| `255` | Door status                                                                         | System    |             |

**Merged codes.** The vendor notes that several codes carry identical meaning
and differ only by the credential used — card vs fingerprint vs password. Our
members only ever use a fingerprint, so the merged sets are classified
identically and `toDenialReason` maps the whole family to one reason.

### The classifications worth arguing about

- **`219`** is a genuine entry and **`75`** a genuine refusal. Both fell through
  to `Other` until 2026-08-28 and so were missing from the check-in log's
  Entries and Refusals filters while still appearing under All.
- **`114` / `115` / `243` / `244`** are the fire-alarm input, either wired open
  or shorted. They alarm. Every other line-detection code (`116`–`121`: the
  auxiliary input, the exit button, the door sensor) is a real fault worth
  seeing on the health view, but none of them stops a paid member getting in,
  so those are System.
- **`80`** is a refusal in the vendor's table — of an elevator floor-selection
  button. A gym door install has no elevator controller, so every elevator code
  (`80`, `132`–`134`, `150`–`155`, `249`–`252`) is System. Classifying `80` as
  Denied would put "Entry refused" in front of staff for something that is not
  an entry.
- **`254`** is the vendor's escape hatch: 0–253 ran out, so 254 announces an
  extended event number. Classified System rather than left unknown, so a
  firmware that starts using it does not fill a gym's log with "Other".
- **`101` / `103`** are **duress** — the member opened the door under coercion.
  Never buried in a routine list.

### Gaps in the vendor's own numbering

`46`, `238` and `253` are not defined. The coverage test asserts their absence
so a future transcription cannot quietly invent them.
