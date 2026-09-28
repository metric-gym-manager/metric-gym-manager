import React from 'react'
import { interpolate, useCurrentFrame } from 'remotion'
import { C, FONT } from './theme'
import { useLayout } from './layout'
import { T, MORPH_AT } from './timeline'

const Line: React.FC<{ text: string; inAt: number; outAt: number; top: number; size: number }> = ({ text, inAt, outAt, top, size }) => {
  const frame = useCurrentFrame()
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
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.2,
        letterSpacing: '-0.02em',
        color: C.textPrimary,
        opacity: o,
        transform: `translateY(${y}px)`,
      }}
    >
      {text}
    </div>
  )
}

export const Captions: React.FC = () => {
  const L = useLayout()
  const size = 64 * L.s
  return (
    <>
      {/* The hook. "these", never "members" — the word would spoil the reveal. */}
      <Line text="One of these is costing you money." inAt={6} outAt={T.rule.from + 60} top={L.hookY} size={size} />
      <Line text="Every square is a member." inAt={T.reveal.from} outAt={MORPH_AT} top={L.hookY} size={size} />
    </>
  )
}
