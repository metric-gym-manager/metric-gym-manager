import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion'
import { MEMBERS, TABLE_ORDER, statusAt, formatLkr, type Member } from './data'
import { FILL, FILL_BRIGHT_PAID, REMINDER, C, FONT } from './theme'
import { useLayout, cellRect } from './layout'
import { tableGeometry } from './table'
import { MORPH_AT, REMINDER_AT, T, simFrame } from './timeline'

const TABLE_INDEX = new Map(TABLE_ORDER.map((m, i) => [m.id, i]))

/** Frame of this member's most recent status change at or before `frame`. */
function lastChange(m: Member, frame: number): number | null {
  const evts = [m.amberAt, m.returnAt, m.redAt, m.recoverAt].filter((x): x is number => x !== null && x <= frame)
  return evts.length ? Math.max(...evts) : null
}

function colourFor(m: Member, frame: number): string {
  const s = statusAt(m, frame)
  if (s === 'hidden') return 'transparent'
  // A square that just returned to green flashes bright: the "paid" beat.
  if (s === 'paid') {
    const back = m.returnAt !== null && frame >= m.returnAt ? m.returnAt : m.recoverAt !== null && frame >= m.recoverAt ? m.recoverAt : null
    if (back !== null && frame - back < 14) return FILL_BRIGHT_PAID
  }
  return FILL[s]
}

const LABEL: Record<string, string> = { paid: 'Active', due: 'Due', expired: 'Expired' }

const Square: React.FC<{ m: Member }> = ({ m }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const L = useLayout()
  const G = tableGeometry(L)
  const status = statusAt(m, frame)
  if (status === 'hidden') return null

  // Pop-in on appear, bump on every status change.
  const appear = spring({ frame: frame - m.appearAt, fps, config: { damping: 14, mass: 0.5 } })
  const changed = lastChange(m, frame)
  const bump = changed === null ? 0 : interpolate(frame - changed, [0, 3, 10], [0, 0.14, 0], { extrapolateRight: 'clamp' })

  // Stall flash: on the frame the counter rises, the square is outlined.
  const stall = m.stallAt === null ? 0 : interpolate(frame - m.stallAt, [0, 2, 16], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // Expired pulse runs on the simulation clock so it freezes with everything else.
  const sf = simFrame(frame)
  const phase = (m.id * 7) % 36
  const pulse = status === 'expired' ? 0.5 + 0.5 * Math.sin(((sf + phase) / 36) * Math.PI * 2) : 0
  const pulseAmp = status === 'expired' ? interpolate(sf, [T.escalation.from, T.freeze.from], [0.5, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0

  // Morph into a members-table row.
  const idx = TABLE_INDEX.get(m.id)!
  const mp = spring({ frame: frame - MORPH_AT - Math.min(idx, 40) * 0.3, fps, config: { damping: 18, mass: 0.8 } })
  const from = cellRect(L, m.row, m.col)
  const to = G.rowRect(idx)
  const x = interpolate(mp, [0, 1], [from.x, to.x])
  const y = interpolate(mp, [0, 1], [from.y, to.y])
  const w = interpolate(mp, [0, 1], [from.w, to.w])
  const h = interpolate(mp, [0, 1], [from.h, to.h])
  const offTable = idx >= G.visible
  const morphOpacity = offTable ? interpolate(mp, [0.4, 0.9], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1
  const fillOpacity = interpolate(mp, [0.5, 1], [1, 0.14], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const radius = interpolate(mp, [0, 1], [L.portrait ? 10 : 8, 6])

  const bg = colourFor(m, frame)
  const scale = appear * (1 + bump)
  const glow = status === 'expired' && mp < 0.5 ? `0 0 ${18 + 26 * pulse * pulseAmp}px ${2 + 6 * pulse * pulseAmp}px rgba(248,81,73,${0.25 + 0.4 * pulse * pulseAmp})` : 'none'

  // Row content fades in once the square has settled into its row.
  const rowText = offTable ? 0 : interpolate(frame, [MORPH_AT + 24, MORPH_AT + 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const fs = L.portrait ? 22 : 16

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        transform: `scale(${scale})`,
        opacity: morphOpacity,
        borderRadius: radius,
        boxShadow: glow,
        outline: stall > 0 ? `${3 * stall}px solid rgba(210,153,34,${stall})` : undefined,
        outlineOffset: 4,
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: bg, opacity: fillOpacity }} />
      {/* Status stripe survives the morph as the row's left edge. */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: interpolate(mp, [0, 1], [w, 4]), background: bg, opacity: mp > 0.5 ? 1 : 0 }} />
      {rowText > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            padding: `0 ${L.portrait ? 24 : 16}px`,
            gap: 16,
            opacity: rowText,
            fontFamily: FONT.sans,
            fontSize: fs,
            color: C.textPrimary,
          }}
        >
          <span style={{ flex: 1.4 }}>{m.name}</span>
          <span style={{ flex: 1.2, color: C.textSecondary }}>{m.plan}</span>
          <span style={{ flex: 1, fontFamily: FONT.mono, color: C.textSecondary, textAlign: 'right' }}>{formatLkr(m.fee)}</span>
          <span style={{ flex: 0.9, display: 'flex', justifyContent: 'flex-end' }}>
            <span
              style={{
                fontSize: fs * 0.78,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 5,
                color: status === 'paid' ? C.successText : status === 'due' ? C.warningText : C.errorText,
                background: status === 'paid' ? C.successBg : status === 'due' ? C.warningBg : C.errorBg,
                border: `1px solid ${status === 'paid' ? C.successBorder : status === 'due' ? C.warningBorder : C.errorBorder}`,
              }}
            >
              {LABEL[status]}
            </span>
          </span>
        </div>
      )}
    </div>
  )
}

/** Reminder rings radiating from every square still owed at the reminder frame. */
const Rings: React.FC = () => {
  const frame = useCurrentFrame()
  const L = useLayout()
  if (frame < REMINDER_AT || frame > REMINDER_AT + 40) return null
  const owed = MEMBERS.filter((m) => {
    const s = statusAt(m, REMINDER_AT)
    return s === 'due' || s === 'expired'
  })
  return (
    <>
      {owed.map((m) => {
        const r = cellRect(L, m.row, m.col)
        return [0, 10].map((delay) => {
          const t = interpolate(frame - REMINDER_AT - delay, [0, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
          if (t <= 0 || t >= 1) return null
          const grow = L.cell * 1.6 * t
          return (
            <div
              key={`${m.id}-${delay}`}
              style={{
                position: 'absolute',
                left: r.x - grow / 2,
                top: r.y - grow / 2,
                width: r.w + grow,
                height: r.h + grow,
                borderRadius: 14 + grow / 2,
                border: `4px solid ${REMINDER}`,
                opacity: 1 - t,
              }}
            />
          )
        })
      })}
    </>
  )
}

export const Squares: React.FC = () => {
  const frame = useCurrentFrame()
  if (frame >= T.boot.from + 14) return null
  return (
    <>
      {MEMBERS.map((m) => (
        <Square key={m.id} m={m} />
      ))}
      <Rings />
    </>
  )
}
