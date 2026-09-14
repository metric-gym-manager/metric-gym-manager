import fs from 'node:fs'
import path from 'node:path'
import {
  breakpoints,
  darkColors,
  layout,
  safeArea,
  shadow,
  spacing,
  typeScale,
} from '../tokens'

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

/**
 * Every `--ds-*` variable globals.css declares, from anywhere in the file.
 *
 * Distinct from {@link cssTokenNames}, which reads only the colour block — the
 * list `tokens.ts` mirrors one-for-one into `SemanticColorScale`. The safe-area
 * variables are `--ds-*` but are not colours and have no mirror there, so the
 * "is it declared at all" checks must look at the whole file or a correct
 * reference reads as dangling.
 */
function allCssTokenNames(): string[] {
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/app/globals.css'),
    'utf8'
  )
  return [
    ...new Set([...css.matchAll(/--ds-([a-z0-9-]+)\s*:/g)].map((m) => m[1])),
  ]
}

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
    const declared = new Set(allCssTokenNames())
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

/**
 * The non-colour tokens the mobile rebuild adds (plan §5.1).
 *
 * The two suites above only ever compared COLOURS: `darkColors` against the
 * `--ds-*` colour block. Every other token family — spacing, layout, type
 * scale, breakpoints — lived in `tokens.ts` and in `tailwind.config.ts` with
 * nothing comparing the two, so a touch target could read 44 in one file and
 * 40 in the other with the gate green. That is not hypothetical for this
 * phase: the §15.1 rule, the primitives, the probe and the DoD all quote the
 * same two numbers, and the probe is the only one that would notice a drift —
 * in a browser, on a route nobody has rebuilt yet.
 *
 * Each assertion reads the Tailwind config as TEXT rather than importing it,
 * because the value that matters is the one written in the file that Tailwind
 * actually loads.
 */
describe('L1 non-colour token parity (tokens.ts ↔ tailwind.config.ts)', () => {
  const tailwind = fs.readFileSync(
    path.join(process.cwd(), 'tailwind.config.ts'),
    'utf8'
  )

  /** `key: 'value'` or `'key': 'value'` anywhere in the config. */
  const entry = (key: string): string | undefined =>
    tailwind.match(new RegExp(`(?:'${key}'|\\b${key})\\s*:\\s*'([^']+)'`))?.[1]

  it.each([
    ['touch', spacing.touch],
    ['touch-sm', spacing['touch-sm']],
    ['bottom-nav', layout.bottomNavHeight],
    ['safe-top', 'var(--ds-safe-top)'],
    ['safe-bottom', 'var(--ds-safe-bottom)'],
    ['safe-left', 'var(--ds-safe-left)'],
    ['safe-right', 'var(--ds-safe-right)'],
  ])('binds spacing.%s to the tokens.ts value', (key, value) => {
    expect(entry(key)).toBe(value)
  })

  it('binds spacing.sheet to layout.sheetMaxHeight', () => {
    expect(entry('sheet')).toBe(layout.sheetMaxHeight)
  })

  it('binds screens.phone to breakpoints.phoneMax', () => {
    expect(tailwind).toContain(`phone: { max: '${breakpoints.phoneMax}px' }`)
    // The phone tier is the max-width side of `tablet`, never a second number.
    expect(breakpoints.phoneMax).toBe(breakpoints.tablet - 1)
  })

  it('binds fontSize.input to typeScale.input', () => {
    expect(tailwind).toContain(
      `input: ['${typeScale.input.fontSize}', { lineHeight: '${typeScale.input.lineHeight}' }]`
    )
  })

  it('declares every safe-area variable it binds, in globals.css', () => {
    const declared = new Set(allCssTokenNames())
    for (const side of ['top', 'bottom', 'left', 'right']) {
      expect(declared.has(`safe-${side}`)).toBe(true)
    }
  })

  it('mirrors the globals.css safe-area values in tokens.ts', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'src/app/globals.css'),
      'utf8'
    )
    for (const [side, value] of Object.entries(safeArea)) {
      // The `, 0px)` fallback is load-bearing: without it a browser that does
      // not know the inset drops the whole declaration and the padding is
      // unset rather than zero.
      expect(value).toContain(', 0px)')
      expect(css).toContain(`--ds-safe-${side}: ${value};`)
    }
  })

  /**
   * `fontSize` and `textColor` both emit `.text-<key>`, so a colour and a type
   * token sharing a name produce one rule that sets BOTH — which is how
   * `text-input` briefly carried `color: hsl(var(--input))` alongside its font
   * size, painting every phone text control the legacy shadcn grey. Caught by
   * building the CSS; pinned here so the config cannot reintroduce it.
   */
  it('shares no key between the colour palette and the type scale', () => {
    const section = (name: string): string => {
      const start = tailwind.indexOf(`      ${name}: {`)
      expect(start).toBeGreaterThan(-1)
      return tailwind.slice(start, tailwind.indexOf('\n      },', start))
    }
    const keysOf = (src: string) =>
      [...src.matchAll(/^\s{8}'?([A-Za-z][\w-]*)'?:/gm)].map((m) => m[1])

    const colourKeys = new Set(keysOf(section('colors')))
    const clashes = keysOf(section('fontSize')).filter((k) => colourKeys.has(k))
    expect(clashes).toEqual([])
  })
})
