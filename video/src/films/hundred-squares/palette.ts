import { C } from '../../shared/theme'
import type { Status } from './data'

/** Square fills. Paid is deliberately dim so due/expired read as anomalies. */
export const FILL: Record<Exclude<Status, 'hidden'>, string> = {
  paid: 'rgba(63,185,80,0.40)',
  due: C.warningText,
  expired: C.errorText,
}
export const FILL_BRIGHT_PAID = C.successText
export const REMINDER = C.accentLink
