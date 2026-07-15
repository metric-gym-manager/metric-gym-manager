/**
 * Client-side image compression for member photos.
 *
 * Selfies come off phone cameras at 3-12MB; we downscale and re-encode in
 * the browser before upload so the PUT to R2 is ~100-200KB.
 *
 * WebP is preferred. iOS Safari cannot encode WebP from a canvas
 * (canvas.toBlob('image/webp') silently produces a PNG), so we verify the
 * encoder actually produced WebP and fall back to JPEG otherwise.
 */

import type { MemberPhotoContentType } from '@/lib/utils/member-photo';

export interface CompressedImage {
  blob: Blob;
  contentType: MemberPhotoContentType;
}

/** Longest edge of the stored photo in pixels */
const MAX_DIMENSION = 800;

/** Encoder quality for both WebP and JPEG */
const QUALITY = 0.82;

/**
 * Load a File/Blob into an HTMLImageElement via object URL
 */
function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read the selected image'));
    };
    img.src = url;
  });
}

/**
 * Encode a canvas to a Blob of the requested type.
 * Resolves null when the browser can't encode that type.
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Downscale and re-encode an image for upload.
 *
 * @param file - Original image (camera capture or file pick)
 * @returns Compressed blob and its actual content type (webp or jpeg)
 * @throws Error when the input can't be decoded as an image
 */
export async function compressImageForUpload(
  file: Blob
): Promise<CompressedImage> {
  const img = await loadImage(file);

  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight)
  );
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not process the image');
  }
  context.drawImage(img, 0, 0, width, height);

  // Prefer WebP; verify the encoder honoured the request (Safari doesn't)
  const webp = await canvasToBlob(canvas, 'image/webp', QUALITY);
  if (webp && webp.type === 'image/webp') {
    return { blob: webp, contentType: 'image/webp' };
  }

  const jpeg = await canvasToBlob(canvas, 'image/jpeg', QUALITY);
  if (jpeg && jpeg.type === 'image/jpeg') {
    return { blob: jpeg, contentType: 'image/jpeg' };
  }

  throw new Error('Could not compress the image');
}
