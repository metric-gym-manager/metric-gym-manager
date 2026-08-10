/**
 * Access control feature factory.
 *
 * Server composition happens here and nowhere else (R7): routes and crons call
 * these, they never `new` up a provider or repository themselves.
 */

import {
  MockAccessControlProvider,
  VftAccessControlProvider,
  isAccessControlEnabled,
  type IAccessControlProvider,
} from '@/lib/access-control'

/**
 * The hardware provider.
 *
 * Mock unless `ACCESS_CONTROL_ENABLED=true`, mirroring `createSMSProvider` and
 * `createStorageProvider`. Local development, CI and every gym that has not
 * opted in therefore never reach real door hardware — which is what lets this
 * feature ship before the integration has been exercised against a terminal.
 */
export function createAccessControlProvider(): IAccessControlProvider {
  if (isAccessControlEnabled()) {
    return new VftAccessControlProvider()
  }

  return new MockAccessControlProvider()
}
