import { profileImageContainsWebp } from '../utils/profileImage'

/** Wrap a raster data URL exactly like ProfileImageUpload.convertImageToSvg. */
function svgWrap(inner: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><image href="${inner}" width="10" height="10"/></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

describe('profileImageContainsWebp', () => {
  const webp = 'data:image/webp;base64,UklGRabout=='
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='

  it('rejects a bare WebP data URL', () => {
    expect(profileImageContainsWebp(webp)).toBe(true)
  })

  it('rejects a WebP raster embedded in the stored SVG wrapper', () => {
    expect(profileImageContainsWebp(svgWrap(webp))).toBe(true)
  })

  it('allows a PNG raster embedded in the SVG wrapper', () => {
    expect(profileImageContainsWebp(svgWrap(png))).toBe(false)
  })

  it('allows a bare PNG data URL', () => {
    expect(profileImageContainsWebp(png)).toBe(false)
  })

  it('is case-insensitive about the mime type', () => {
    expect(profileImageContainsWebp('data:image/WEBP;base64,UklGRg==')).toBe(
      true
    )
  })
})
