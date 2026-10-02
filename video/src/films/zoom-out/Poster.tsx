import React from 'react'
import { QR_SIZE, isDark } from './qr'
import { FONT } from '../../shared/theme'
import { GYM } from './timeline'

/** Print palette: the real poster prints black on white (qr-poster.tsx). */
const INK = '#0b0b0d'
const PAPER = '#f7f7f5'
const INK_SOFT = '#55555c'

export const POSTER = { x: 180, y: 360, w: 720, h: 1020 }
const QR_BOX = { x: 130, y: 380, w: 460 }
/** World-space point the camera starts on: inside the data region, away from finder squares. */
export const FOCUS = {
  x: POSTER.x + QR_BOX.x + (QR_BOX.w * 0.6),
  y: POSTER.y + QR_BOX.y + (QR_BOX.w * 0.57),
}

export const QrSvg: React.FC<{ size: number; fg?: string; bg?: string }> = ({ size, fg = INK, bg = PAPER }) => {
  const quiet = 2
  const n = QR_SIZE + quiet * 2
  const rects: React.ReactNode[] = []
  for (let r = 0; r < QR_SIZE; r++) {
    for (let c = 0; c < QR_SIZE; c++) {
      if (isDark(r, c)) rects.push(<rect key={`${r}-${c}`} x={c + quiet} y={r + quiet} width={1.02} height={1.02} />)
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" style={{ display: 'block' }}>
      <rect width={n} height={n} fill={bg} />
      <g fill={fg}>{rects}</g>
    </svg>
  )
}

export const Poster: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      left: POSTER.x,
      top: POSTER.y,
      width: POSTER.w,
      height: POSTER.h,
      background: PAPER,
      borderRadius: 6,
      fontFamily: FONT.sans,
      color: INK,
      overflow: 'hidden',
    }}
  >
    <div style={{ position: 'absolute', left: 56, top: 52, fontSize: 18, fontWeight: 600, letterSpacing: '0.12em' }}>
      NEW MEMBER · SELF-REGISTRATION
    </div>
    <div style={{ position: 'absolute', left: 56, top: 100, fontSize: 30, fontWeight: 700, color: INK_SOFT }}>{GYM}</div>
    <div style={{ position: 'absolute', left: 56, top: 150, fontSize: 92, fontWeight: 700, letterSpacing: '-0.045em', lineHeight: 0.92 }}>
      Let&apos;s sign
      <br />
      you up.
    </div>
    <div style={{ position: 'absolute', left: QR_BOX.x, top: QR_BOX.y }}>
      <QrSvg size={QR_BOX.w} />
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: QR_BOX.y + QR_BOX.w + 40, textAlign: 'center', fontSize: 34, fontWeight: 700 }}>
      Scan me to register
    </div>
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 64,
        background: INK,
        color: PAPER,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        letterSpacing: '0.2em',
      }}
    >
      POWERED BY METRIC
    </div>
  </div>
)
