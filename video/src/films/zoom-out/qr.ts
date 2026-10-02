import QRCode from 'qrcode'

/**
 * A real QR matrix. It encodes plain text rather than a URL so that a viewer
 * who scans the screen lands nowhere: no fictional gym's join page exists.
 */
const qr = QRCode.create('METRIC GYM OS', { errorCorrectionLevel: 'M' })
export const QR_SIZE: number = qr.modules.size
export const isDark = (r: number, c: number): boolean => qr.modules.get(r, c) === 1
