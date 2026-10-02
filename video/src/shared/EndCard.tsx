import React from 'react'
import { interpolate, useCurrentFrame, Img, staticFile, spring, useVideoConfig } from 'remotion'
import { C, FONT } from './theme'

/** Series end card. Every film closes on this, unchanged, so the brand accrues. */
export const EndCard: React.FC<{ from: number; tag?: string }> = ({ from, tag }) => {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  if (frame < from) return null
  const s = height > width ? 1 : 0.78
  const f = frame - from
  const logo = spring({ frame: f, fps, config: { damping: 15 } })
  const title = interpolate(f, [6, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const tagline = interpolate(f, [16, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: C.surfaceBase,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 36 * s,
        textAlign: 'center',
      }}
    >
      <Img src={staticFile('logo.svg')} style={{ width: 340 * s, height: 340 * s, transform: `scale(${0.8 + 0.2 * logo})`, opacity: logo }} />
      <div style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 92 * s, letterSpacing: '0.06em', color: C.textPrimary, opacity: title }}>
        METRIC GYM OS
      </div>
      <div style={{ fontFamily: FONT.sans, fontSize: 40 * s, color: C.textSecondary, opacity: tagline, maxWidth: 900 }}>
        The operating system for serious gyms.
      </div>
      {tag && (
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 30 * s,
            letterSpacing: '0.24em',
            color: C.accentLink,
            border: `1px solid ${C.accentBorder}`,
            background: C.accentBg,
            borderRadius: 6,
            padding: '8px 20px',
            opacity: tagline,
          }}
        >
          {tag}
        </div>
      )}
    </div>
  )
}
