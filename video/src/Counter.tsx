import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { MEMBERS, uncollectedAt, formatLkr } from './data'
import { C, FONT } from './theme'
import { useLayout } from './layout'
import { LABEL_AT, MORPH_AT } from './timeline'

const FIRST_STALL = Math.min(...MEMBERS.filter((m) => m.stallAt !== null).map((m) => m.stallAt!))
const CHANGES = MEMBERS.flatMap((m) => [
  ...(m.stallAt !== null ? [{ at: m.stallAt, delta: m.fee }] : []),
  ...(m.recoverAt !== null ? [{ at: m.recoverAt, delta: -m.fee }] : []),
]).sort((a, b) => a.at - b.at)

/**
 * The money counter. Unlabelled until the reveal: the viewer sees a number
 * rise in lock-step with squares stalling, and only learns what it is at
 * LABEL_AT.
 */
export const Counter: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const L = useLayout()
  if (frame < FIRST_STALL) return null

  const value = uncollectedAt(frame)
  const last = [...CHANGES].reverse().find((c) => c.at <= frame)
  const since = last ? frame - last.at : 99
  const bump = interpolate(since, [0, 3, 12], [0.12, 0.06, 0], { extrapolateRight: 'clamp' })
  const falling = last !== undefined && last.delta < 0 && since < 12
  const colour = falling ? C.successText : C.warningText

  const appear = spring({ frame: frame - FIRST_STALL, fps, config: { damping: 16 } })
  const label = spring({ frame: frame - LABEL_AT, fps, config: { damping: 11, mass: 0.6 } })
  const exit = interpolate(frame, [MORPH_AT, MORPH_AT + 12], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  const size = 96 * L.s
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: L.counterY,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: appear * exit,
      }}
    >
      <div
        style={{
          height: 44 * L.s,
          fontFamily: FONT.sans,
          fontWeight: 700,
          fontSize: 30 * L.s,
          letterSpacing: '0.32em',
          color: C.textPrimary,
          opacity: frame >= LABEL_AT ? label : 0,
          transform: `translateY(${(1 - label) * 16}px) scale(${0.9 + 0.1 * label})`,
        }}
      >
        UNCOLLECTED
      </div>
      <div
        style={{
          fontFamily: FONT.mono,
          fontWeight: 500,
          fontSize: size,
          color: colour,
          fontVariantNumeric: 'tabular-nums',
          transform: `scale(${1 + bump})`,
        }}
      >
        {formatLkr(value)}
      </div>
      {last && since < 18 && (
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 34 * L.s,
            color: last.delta > 0 ? C.warningText : C.successText,
            opacity: interpolate(since, [0, 4, 18], [0, 1, 0]),
            transform: `translateY(${-since * 1.2}px)`,
          }}
        >
          {last.delta > 0 ? '+' : '−'}
          {Math.abs(last.delta).toLocaleString('en-US')}
        </div>
      )}
    </div>
  )
}
