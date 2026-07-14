/**
 * QR poster printing (client-side)
 *
 * Opens a print-ready window with one A4 poster per gym: QR code, gym name,
 * and scan instructions. Used by the gym settings card (single poster) and
 * the admin QR dashboard (single or all gyms).
 */

export interface QrPoster {
  gymName: string;
  /** PNG data URL of the QR code (from a rendered canvas) */
  qrDataUrl: string;
  joinUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Open the browser print dialog with one poster page per entry.
 */
export function printQrPosters(posters: QrPoster[]): void {
  const printWindow = window.open('', '_blank', 'width=800,height=1000');
  if (!printWindow) {
    return;
  }

  const pages = posters
    .map(
      (poster) => `
      <section class="poster">
        <h1>${escapeHtml(poster.gymName)}</h1>
        <p class="subtitle">Scan to register as a member</p>
        <img src="${poster.qrDataUrl}" alt="Registration QR code" />
        <p class="url">${escapeHtml(poster.joinUrl)}</p>
      </section>`
    )
    .join('\n');

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Registration QR Codes</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; }
    .poster {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; text-align: center;
      min-height: 100vh; padding: 48px;
      page-break-after: always;
    }
    .poster:last-child { page-break-after: auto; }
    h1 { font-size: 32px; margin-bottom: 8px; }
    .subtitle { font-size: 18px; color: #444; margin-bottom: 32px; }
    img { width: 320px; height: 320px; }
    .url { margin-top: 32px; font-size: 12px; color: #888; word-break: break-all; }
  </style>
</head>
<body>
${pages}
<script>
  window.onload = function () {
    window.print();
  };
</script>
</body>
</html>`);
  printWindow.document.close();
}
