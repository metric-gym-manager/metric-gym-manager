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

/** Every `var(--ds-*)` reference inside tailwind.config.ts. */
function tailwindTokenRefs(): string[] {
  const cfg = fs.readFileSync(
    path.join(process.cwd(), 'tailwind.config.ts'),
    'utf8'
  )
  return [
    ...new Set([...cfg.matchAll(/var\(--ds-([a-z0-9-]+)\)/g)].map((m) => m[1])),
  ]
}

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

/**
 * The third file. The design system calls tokens a single source of truth
 * "split across three synchronized files", and rule 2.21 says a new value must
 * sync `tokens.ts` + `globals.css` + `tailwind.config.ts` — but only the first
 * two were ever checked, so a token could land in two of three and stay green.
 *
 * This asserts the direction that fails silently: a Tailwind utility pointing
 * at a `--ds-*` variable nothing declares resolves to nothing, so the element
 * renders with no colour at all and no error anywhere.
 */
describe('L1 token parity (tailwind.config.ts → globals.css)', () => {
  it('references no --ds-* variable that globals.css does not declare', () => {
    const declared = new Set(cssTokenNames())
    expect(tailwindTokenRefs().filter((v) => !declared.has(v))).toEqual([])
  })
})

/**
 * Every `var(--ds-*)` / `var(--ma-*)` in the source must resolve.
 *
 * The tailwind check above covers one file. A reference that names no declared
 * variable resolves to nothing and the element renders with no colour, no size
 * and no error — in any file, not just that one. `LegalLayout` reaches for
 * `var(--ds-text-secondary)` from an inline style, which no other check here
 * would have looked at.
 *
 * `--ma-*` is the auth surface's own namespace: globals.css declares 14 of them
 * beside the 44 `--ds-*` ones. They have no JS mirror to compare against, so
 * resolvability is the only parity available — and it is the property that
 * actually fails silently. See Pass 6.7 of workspace-ui-inverted-check.md.
 */
describe('CSS custom property resolution (whole source tree)', () => {
  const declared = (() => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'src/app/globals.css'),
      'utf8'
    )
    return new Set(
      [...css.matchAll(/(--(?:ds|ma)-[a-z0-9-]+)\s*:/g)].map((m) => m[1])
    )
  })()

  const sourceFiles = (dir: string, acc: string[] = []): string[] => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) sourceFiles(full, acc)
      else if (/\.tsx?$/.test(entry.name)) acc.push(full)
    }
    return acc
  }

  it('declares every --ds-*/--ma-* variable the source references', () => {
    const dangling: string[] = []
    for (const file of sourceFiles(path.join(process.cwd(), 'src'))) {
      const src = fs.readFileSync(file, 'utf8')
      for (const m of src.matchAll(/var\((--(?:ds|ma)-[a-z0-9-]+)/g)) {
        if (!declared.has(m[1])) {
          dangling.push(`${m[1]} in ${path.relative(process.cwd(), file)}`)
        }
      }
    }
    expect(dangling).toEqual([])
  })

  it('has both namespaces to check, so a rename cannot make this vacuous', () => {
    // If globals.css is restructured and this parses nothing, the test above
    // passes against an empty set and proves nothing.
    const ds = [...declared].filter((v) => v.startsWith('--ds-'))
    const ma = [...declared].filter((v) => v.startsWith('--ma-'))
    expect(ds.length).toBeGreaterThan(30)
    expect(ma.length).toBeGreaterThan(5)
  })
})
