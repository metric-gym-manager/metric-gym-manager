/**
 * Series palette and type. Colours come from the app's L1 design tokens so
 * every film and the product it shows are the same dark workspace.
 */
import { darkColors, fontFamily } from '../../../src/components/ui/tokens'
import { loadFont } from '@remotion/fonts'
import { staticFile } from 'remotion'

export const C = darkColors
export const FONT = fontFamily

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
