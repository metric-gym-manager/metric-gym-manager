/**
 * Gym profile image validation helpers.
 *
 * Profile images are stored as a data URL — an SVG that wraps the uploaded
 * raster (`ProfileImageUpload.convertImageToSvg`). WebP is disallowed because
 * the server-side QR-poster renderer (`next/og` / Satori) cannot rasterise
 * WebP, so a WebP logo would silently vanish from the printed poster.
 */

/** MIME type rejected for gym profile images. */
export const DISALLOWED_PROFILE_IMAGE_TYPE = 'image/webp'

/** User-facing message when a disallowed profile image is submitted. */
export const PROFILE_IMAGE_WEBP_MESSAGE =
  'WebP images are not supported. Please upload a PNG or JPG image.'

function decodeDataUrlText(dataUrl: string): string | null {
  try {
    const commaIdx = dataUrl.indexOf(',')
    if (commaIdx === -1) return null
    const isBase64 = dataUrl.slice(0, commaIdx).includes('base64')
    const payload = dataUrl.slice(commaIdx + 1)
    return isBase64
      ? Buffer.from(payload, 'base64').toString('utf8')
      : decodeURIComponent(payload)
  } catch {
    return null
  }
}

/**
 * Detect a WebP payload, whether it is the data URL itself or the raster
 * embedded inside the stored SVG wrapper.
 */
export function profileImageContainsWebp(imageUrl: string): boolean {
  if (/^data:image\/webp/i.test(imageUrl)) {
    return true
  }
  if (imageUrl.startsWith('data:image/svg+xml')) {
    const svg = decodeDataUrlText(imageUrl)
    if (svg && /href\s*=\s*"data:image\/webp/i.test(svg)) {
      return true
    }
  }
  return false
}
