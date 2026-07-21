/**
 * QR poster printing (client-side)
 *
 * Opens a print-ready window with one A4 poster per gym. Each poster shows the
 * gym name + profile logo at the top, a "Scan to register" prompt, the QR code,
 * and a prominent "Powered by Metric Gym OS" footer with the brand logo and
 * domain. Used by the gym settings card (single poster) and the admin QR
 * dashboard (single or all gyms).
 */

/** Brand domain shown in the poster footer. */
const BRAND_DOMAIN = 'metricgymos.lk';
/** Metric Gym OS brand blue (from public/logo.svg). */
const BRAND_BLUE = '#1C19FD';

/**
 * Backing-store resolution (in CSS px, before devicePixelRatio) for QR canvases
 * that will be downloaded or printed. The on-screen size is set separately via
 * the canvas `style` prop, so the visible QR stays compact while the exported
 * PNG is large enough for crisp large-format printing, downloading, and
 * scaling. qrcode.react multiplies this by devicePixelRatio for the actual
 * canvas backing store, which is what `canvas.toDataURL()` reads — so the PNG
 * is at least this many pixels wide regardless of the on-screen display size.
 */
export const QR_EXPORT_SIZE = 1024;

export interface QrPoster {
  gymName: string;
  /** PNG data URL of the QR code (from a rendered canvas) */
  qrDataUrl: string;
  joinUrl: string;
  /** Public URL of the gym's profile logo, if it has one. */
  logoUrl?: string | null;
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

  // Absolute URL so the brand logo resolves inside the about:blank print window.
  const brandLogoUrl = `${window.location.origin}/logo.svg`;

  const pages = posters
    .map((poster) => {
      const gymLogo = poster.logoUrl
        ? `<img class="gym-logo" src="${escapeHtml(poster.logoUrl)}" alt="" />`
        : '';
      return `
      <section class="poster">
        <header class="gym">
          ${gymLogo}
          <h1>${escapeHtml(poster.gymName)}</h1>
        </header>
        <p class="subtitle">Scan to register</p>
        <img class="qr" src="${poster.qrDataUrl}" alt="Registration QR code" />
        <p class="url">${escapeHtml(poster.joinUrl)}</p>
        <footer class="powered">
          <div class="powered-brand">
            <span class="powered-by">Powered by</span>
            <img class="brand-logo" src="${brandLogoUrl}" alt="Metric Gym OS" />
            <span class="brand-name">Metric Gym OS</span>
          </div>
          <span class="brand-domain">${BRAND_DOMAIN}</span>
        </footer>
      </section>`;
    })
    .join('\n');

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Registration QR Codes</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .poster {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; text-align: center;
      min-height: 100vh; padding: 48px;
      page-break-after: always;
    }
    .poster:last-child { page-break-after: auto; }
    .gym {
      display: flex; flex-direction: column; align-items: center;
      gap: 16px; margin-bottom: 24px;
    }
    .gym-logo {
      width: 96px; height: 96px; object-fit: contain; border-radius: 12px;
    }
    h1 { font-size: 34px; line-height: 1.1; }
    .subtitle { font-size: 20px; color: #444; margin-bottom: 28px; }
    .qr { width: 320px; height: 320px; }
    .url { margin-top: 24px; font-size: 12px; color: #888; word-break: break-all; }
    .powered {
      margin-top: 48px; display: flex; flex-direction: column;
      align-items: center; gap: 6px;
    }
    .powered-brand { display: flex; align-items: center; gap: 10px; }
    .powered-by {
      font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase;
      color: #666;
    }
    .brand-logo { width: 34px; height: 34px; }
    .brand-name { font-size: 24px; font-weight: 700; color: ${BRAND_BLUE}; }
    .brand-domain {
      font-size: 16px; font-weight: 600; color: ${BRAND_BLUE};
      letter-spacing: 0.02em;
    }
  </style>
</head>
<body>
${pages}
<script>
  window.onload = function () {
    var printed = false;
    function doPrint() {
      if (printed) return;
      printed = true;
      window.print();
    }
    var images = Array.prototype.slice.call(document.images);
    var pending = images.filter(function (img) { return !img.complete; });
    if (pending.length === 0) { doPrint(); return; }
    var remaining = pending.length;
    function onSettled() {
      remaining -= 1;
      if (remaining === 0) doPrint();
    }
    pending.forEach(function (img) {
      img.addEventListener('load', onSettled);
      img.addEventListener('error', onSettled);
    });
    // Fallback so a slow/broken image never blocks the print dialog.
    setTimeout(doPrint, 3000);
  };
</script>
</body>
</html>`);
  printWindow.document.close();
}
