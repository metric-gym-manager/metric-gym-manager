import fs from 'node:fs'
import path from 'node:path'
import { darkColors, shadow } from '../tokens'

/**
 * L1 parity — `globals.css` and `tokens.ts` must declare the same token set.
 *
 * The design system documents these two files (plus `tailwind.config.ts`) as a
 * single source of truth "split across three synchronized files". Nothing
 * verified that, and they had silently drifted: the CSS declared 44 `--ds-*`
 * variables while the JS mirror carried 34, missing `surfacePanel` and
 * `surfaceSelected` — both load-bearing for the dark-first palette. The gap was
 * found only because a rewritten token test hit `undefined`.
 *
 * See C8 in docs/architecture/workspace-ui-overhaul-log.md.
 */

/** `--ds-accent-link-hover` → `accentLinkHover`, with the naming exceptions. */
const RENAMES: Record<string, string> = {
  primary: 'primaryDefault',
  accent: 'accentDefault',
  destructive: 'destructiveDefault',
}
/** Effect tokens mirror onto `shadow`, not the colour scale. */
const SHADOW_KEYS: Record<string, keyof typeof shadow> = {
  'focus-ring': 'focus',
  'focus-ring-error': 'focusError',
  'shadow-overlay': 'overlay',
}

function cssTokenNames(): string[] {
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/app/globals.css'),
    'utf8'
  )
  const block = css.slice(
    css.indexOf('  :root,'),
    css.indexOf('color-scheme: dark;')
  )
  return [
    ...new Set([...block.matchAll(/--ds-([a-z0-9-]+):/g)].map((m) => m[1])),
  ]
}

const toCamel = (v: string) =>
  v
    .split('-')
    .reduce((a, w, i) => a + (i ? w[0].toUpperCase() + w.slice(1) : w), '')

describe('L1 token parity (globals.css ↔ tokens.ts)', () => {
  it('mirrors every --ds-* variable declared in globals.css', () => {
    const unmirrored = cssTokenNames().filter((v) => {
      if (v in SHADOW_KEYS) return !(SHADOW_KEYS[v] in shadow)
      const key = RENAMES[v] ?? toCamel(v)
      return !(key in darkColors)
    })
    expect(unmirrored).toEqual([])
  })

  it('declares no JS token that globals.css does not', () => {
    const css = new Set(cssTokenNames().map((v) => RENAMES[v] ?? toCamel(v)))
    expect(Object.keys(darkColors).filter((k) => !css.has(k))).toEqual([])
  })
})
