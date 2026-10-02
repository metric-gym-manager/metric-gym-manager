import React from 'react'
import { interpolate, useCurrentFrame } from 'remotion'
import { C, FONT } from '../../shared/theme'
import { useLayout } from './layout'
import { T } from './timeline'

export const BOOT_LINE = '$ starting metric-gym-os'
export const TYPE_FROM = T.boot.from + 12
export const TYPE_FRAMES_PER_CHAR = 0.9
export const READY_AT = T.boot.from + 40

/** Dims the members screen as the terminal takes over. */
export const Dimmer: React.FC = () => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [T.boot.from, T.boot.from + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  if (o <= 0) return null
  return <div style={{ position: 'absolute', inset: 0, background: C.surfaceBase, opacity: o }} />
}

export const Boot: React.FC = () => {
  const frame = useCurrentFrame()
  const L = useLayout()
  if (frame < TYPE_FROM || frame >= T.card.from) return null
  const chars = Math.min(BOOT_LINE.length, Math.floor((frame - TYPE_FROM) / TYPE_FRAMES_PER_CHAR) + 1)
  const cursorOn = Math.floor(frame / 8) % 2 === 0
  const size = 52 * L.s
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        fontFamily: FONT.mono,
        fontSize: size,
      }}
    >
      <div style={{ color: C.textPrimary, whiteSpace: 'pre' }}>
        {BOOT_LINE.slice(0, chars)}
        <span style={{ opacity: cursorOn ? 1 : 0, color: C.accentLink }}>▌</span>
      </div>
      <div style={{ color: C.successText, letterSpacing: '0.3em', opacity: frame >= READY_AT ? 1 : 0 }}>SYSTEM READY</div>
    </div>
  )
}
