import {
  tokens,
  lightColors,
  darkColors,
  colors,
  getSemanticKeys,
} from '../tokens'

/**
 * Token contract tests — guard the single source of truth.
 *
 * Rewritten 2026-08-29 for the dark-first overhaul
 * (docs/architecture/METRIC_UI_DIRECTIVE.md). The previous assertions pinned
 * the light workspace surface (#f4f4f5) and the full-chroma accent (#1b17ff);
 * the directive replaces both, so pinning them would freeze the state the
 * overhaul exists to change.
 *
 * They are replaced with STRONGER invariants, not weaker ones — in particular
 * the interaction-state direction check below, which encodes the Phase 1 exit
 * gate as a permanent regression guard.
 */
describe('design tokens', () => {
  it('exposes light and dark semantic scales with identical key sets', () => {
    expect(Object.keys(lightColors).sort()).toEqual(
      Object.keys(darkColors).sort()
    )
  })

  it('registers both themes under colors', () => {
    expect(colors.light).toBe(lightColors)
    expect(colors.dark).toBe(darkColors)
  })

  it('has retired the light theme — light is an alias of dark (ruling R2)', () => {
    // Dark is the canonical Metric identity across Workspace, Marketing, Auth
    // and Legal (directive Appendix). globals.css declares no light --ds- block.
    expect(lightColors).toBe(darkColors)
  })

  it('is dark-first: the canvas is near-black and text is high-contrast light', () => {
    expect(darkColors.surfaceBase).toBe('#08080a')
    expect(darkColors.textPrimary).toBe('#f2f2f5')
  })

  it('builds a surface ladder that rises from the canvas', () => {
    // base → panel → card. Cards are exceptional objects (§5.4), so the ladder
    // is shallow, but it must never invert.
    const lum = (hex: string) => parseInt(hex.slice(1, 3), 16)
    expect(lum(darkColors.surfaceCard)).toBeGreaterThan(
      lum(darkColors.surfaceBase)
    )
  })

  it('LIGHTENS every interaction state — never darkens', () => {
    // This is the Phase 1 exit gate. The retired mws-* layer expressed hover,
    // active and selected as rgba(0,0,0,α) — "darken the surface" — which is
    // invisible on a near-black ground. The sidebar active item, settings
    // sub-nav, tab bar and table row hover all failed silently and
    // simultaneously. Any regression here removes navigation affordances
    // without producing a visible error, so it is asserted, not eyeballed.
    for (const key of ['surfaceHover', 'surfaceActive'] as const) {
      expect(darkColors[key]).toMatch(/^rgba\(255,\s*255,\s*255/)
    }
  })

  it('keeps the interaction-state ladder monotonic: hover < active < selected', () => {
    // These are alpha overlays, so "is selected stronger than hover?" cannot be
    // answered by reading the values — it needs the composited luminance. It was
    // not checked during Phase 1, and the ladder was inverted: selected sat at
    // 0.18 indigo (L=0.0082) while active sat at 0.08 white (L=0.0115), so a
    // selected row rendered *dimmer* than one merely being pressed.
    const parse = (v: string) => {
      const m = v.match(
        /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/
      )!
      return {
        r: +m[1],
        g: +m[2],
        b: +m[3],
        a: m[4] ? +m[4] : 1,
      }
    }
    const BASE = { r: 0x08, g: 0x08, b: 0x0a }
    const luminance = (v: string) => {
      const c = parse(v)
      const ch = (x: number, base: number) => {
        const composited = (x * c.a + base * (1 - c.a)) / 255
        return composited <= 0.03928
          ? composited / 12.92
          : ((composited + 0.055) / 1.055) ** 2.4
      }
      return (
        0.2126 * ch(c.r, BASE.r) +
        0.7152 * ch(c.g, BASE.g) +
        0.0722 * ch(c.b, BASE.b)
      )
    }

    const hover = luminance(darkColors.surfaceHover)
    const active = luminance(darkColors.surfaceActive)
    const selected = luminance(darkColors.surfaceSelected)

    expect(hover).toBeGreaterThan(0) // lighter than the near-black canvas
    expect(active).toBeGreaterThan(hover)
    expect(selected).toBeGreaterThan(active)
  })

  it('treats selection as a system state, not a neutral highlight', () => {
    // §5.7: BLUE = interactive/selected/system.
    expect(darkColors.surfaceSelected).toMatch(/^rgba\(74,\s*71,\s*209/)
  })

  it('uses a restrained accent, not the full-chroma brand blue', () => {
    // #1b17ff glows on near-black; §6 bans glow and §9.3 flags excessive blue.
    expect(darkColors.accentDefault).toBe('#4a47d1')
    expect(darkColors.accentDefault).not.toBe('#1b17ff')
  })

  it('never uses a drop shadow for elevation', () => {
    // §5.12: structure via hairlines. An offset/blur shadow has more than the
    // two leading zeros of a ring, so a spread-only ring is the only legal form.
    expect(tokens.shadow.overlay).toMatch(/^0 0 0 1px /)
    expect(tokens.shadow.none).toBe('none')
  })

  it('defines the full radius scale from the spec', () => {
    expect(tokens.radius).toMatchObject({
      xs: '2px',
      sm: '4px',
      md: '5px',
      lg: '6px',
      xl: '8px',
    })
  })

  it('highlights charts with the same accent the rest of the system uses', () => {
    // Asserted as a relationship, not a literal, so the two cannot drift apart.
    expect(tokens.chartPalette.dark.highlight).toBe(darkColors.accentDefault)
    expect(tokens.chartPalette.light).toBe(tokens.chartPalette.dark)
  })
})

describe('getSemanticKeys()', () => {
  it('returns the semantic token key list', () => {
    const keys = getSemanticKeys()
    expect(keys).toContain('surfaceBase')
    expect(keys).toContain('accentDefault')
    expect(keys).toContain('errorText')
  })
})
