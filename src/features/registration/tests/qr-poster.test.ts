// The renderer pulls in next/og (Satori/wasm) at import time; mock it so this
// pure-function test stays fast and environment-independent.
jest.mock('next/og', () => ({ ImageResponse: class {} }))

import { normalizePosterLogo } from '../services/qr-poster'

/** Wrap a raster data URL exactly like ProfileImageUpload.convertImageToSvg. */
function svgWrap(inner: string, useXlink = false): string {
  const attr = useXlink ? 'xlink:href' : 'href'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><image ${attr}="${inner}" width="10" height="10"/></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

describe('normalizePosterLogo', () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='

  it('unwraps the inner raster from a gym SVG-wrapped data URL', () => {
    expect(normalizePosterLogo(svgWrap(png))).toBe(png)
  })

  it('handles the xlink:href variant', () => {
    expect(normalizePosterLogo(svgWrap(png, true))).toBe(png)
  })

  it('passes a plain raster data URL through unchanged', () => {
    expect(normalizePosterLogo(png)).toBe(png)
  })

  it('passes a remote URL through unchanged', () => {
    const url = 'https://media.example.com/logos/gym.png'
    expect(normalizePosterLogo(url)).toBe(url)
  })

  it('returns null for null/undefined/empty', () => {
    expect(normalizePosterLogo(null)).toBeNull()
    expect(normalizePosterLogo(undefined)).toBeNull()
    expect(normalizePosterLogo('')).toBeNull()
  })

  it('falls back to the original when an SVG has no inner raster', () => {
    const emptySvg = `data:image/svg+xml;base64,${Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'
    ).toString('base64')}`
    expect(normalizePosterLogo(emptySvg)).toBe(emptySvg)
  })
})
