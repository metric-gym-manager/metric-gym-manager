import React from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT } from './theme'

/** On-screen line. Every film is built to work muted, so captions carry the story. */
export const Caption: React.FC<{
  text: string
  inAt: number
  outAt: number
  top: number
  size?: number
  color?: string
  weight?: number
  /** Dark plate behind the line, for captions over bright footage. */
  plate?: boolean
}> = ({ text, inAt, outAt, top, size = 64, color = C.textPrimary, weight = 600, plate = false }) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const s = height > width ? 1 : 0.78
  const o = interpolate(frame, [inAt, inAt + 6, outAt - 8, outAt], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const y = interpolate(frame, [inAt, inAt + 10], [14, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  if (o <= 0) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        top,
        textAlign: 'center',
        fontFamily: FONT.sans,
        fontWeight: weight,
        fontSize: size * s,
        lineHeight: 1.2,
        letterSpacing: '-0.02em',
        color,
        opacity: o,
        transform: `translateY(${y}px)`,
      }}
    >
      {plate ? (
        <span style={{ background: 'rgba(8,8,10,0.86)', padding: '14px 28px', borderRadius: 10, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>{text}</span>
      ) : (
        text
      )}
    </div>
  )
}
