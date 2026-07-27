import {
  tokens,
  lightColors,
  darkColors,
  colors,
  getSemanticKeys,
} from '../tokens'

/**
 * Token contract tests — guard the single source of truth. If a semantic key is
 * added/removed, the light and dark scales must stay in lockstep so every
 * primitive resolves in both themes (spec §2 Theme Architecture, "dark mode
 * parity"). These would have failed before the token layer existed (TDD red).
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

  it('uses the spec accent primitive for interactive color in both themes', () => {
    expect(lightColors.accentDefault).toBe('#1b17ff')
    expect(darkColors.accentDefault).toBe('#1b17ff')
  })

  it('keeps the light workspace surface and dark page surface per spec', () => {
    expect(lightColors.surfaceBase).toBe('#f4f4f5')
    expect(darkColors.surfaceBase).toBe('#0a0a0b')
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

  it('exposes chart palettes for both themes with a shared accent highlight', () => {
    expect(tokens.chartPalette.light.highlight).toBe('#1b17ff')
    expect(tokens.chartPalette.dark.highlight).toBe('#1b17ff')
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
