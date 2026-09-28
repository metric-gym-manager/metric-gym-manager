/**
 * Film palette. Colours come from the app's L1 design tokens so the film and
 * the product it morphs into are the same dark workspace, not a lookalike.
 */
import { darkColors, fontFamily } from '../../src/components/ui/tokens'
import { loadFont } from '@remotion/fonts'
import { staticFile } from 'remotion'
import type { Status } from './data'

export const C = darkColors
export const FONT = fontFamily

/** Square fills. Paid is deliberately dim so due/expired read as anomalies. */
export const FILL: Record<Exclude<Status, 'hidden'>, string> = {
  paid: 'rgba(63,185,80,0.40)',
  due: C.warningText,
  expired: C.errorText,
}
export const FILL_BRIGHT_PAID = C.successText
export const REMINDER = C.accentLink

const FACES = [
  { family: 'Geist', file: 'geist-400.woff', weight: '400' },
  { family: 'Geist', file: 'geist-600.woff', weight: '600' },
  { family: 'Geist', file: 'geist-700.woff', weight: '700' },
  { family: 'Geist Mono', file: 'geist-mono-400.woff', weight: '400' },
  { family: 'Geist Mono', file: 'geist-mono-500.woff', weight: '500' },
]
let loaded = false
export function loadFonts() {
  if (loaded) return
  loaded = true
  for (const f of FACES) loadFont({ family: f.family, url: staticFile(`fonts/${f.file}`), weight: f.weight })
}
