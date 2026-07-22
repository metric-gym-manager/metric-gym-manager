/**
 * Client helpers for the server-rendered "2b" QR registration posters.
 *
 * The poster PNG is produced per-gym by the API (`/api/settings/qr-poster` and
 * `/api/admin/qr-poster`), so print and download share one pixel-identical
 * image. These helpers only move that image into the print dialog or a file.
 */

/**
 * Open a print window with one poster image per A5 page and trigger printing
 * once every image has loaded.
 */
export function printPosterImages(urls: string[]): void {
  if (urls.length === 0) return

  const printWindow = window.open('', '_blank', 'width=800,height=1000')
  if (!printWindow) return

  const pages = urls
    .map(
      (url) =>
        `<section class="page"><img src="${url}" alt="Registration poster" /></section>`
    )
    .join('\n')

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Registration QR Posters</title>
  <style>
    @page { size: A5; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; background: #fff; }
    .page {
      display: flex; align-items: center; justify-content: center;
      width: 100vw; height: 100vh; page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    img { max-width: 100%; max-height: 100%; object-fit: contain; }
  </style>
</head>
<body>
${pages}
<script>
  window.onload = function () {
    var printed = false;
    function go() { if (printed) return; printed = true; window.print(); }
    var images = Array.prototype.slice.call(document.images);
    var pending = images.filter(function (img) { return !img.complete; });
    if (pending.length === 0) { go(); return; }
    var remaining = pending.length;
    function settled() { remaining -= 1; if (remaining === 0) go(); }
    pending.forEach(function (img) {
      img.addEventListener('load', settled);
      img.addEventListener('error', settled);
    });
    // Fallback so a slow render never blocks the dialog.
    setTimeout(go, 8000);
  };
</script>
</body>
</html>`)
  printWindow.document.close()
}

/**
 * Fetch a poster PNG and save it to disk with a friendly filename.
 */
export async function downloadPosterImage(
  url: string,
  filename: string
): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to generate poster')
  }
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

/** Build a filesystem-safe poster filename from a gym name. */
export function posterFilename(gymName: string): string {
  const slug = gymName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'gym'}-registration-poster.png`
}
