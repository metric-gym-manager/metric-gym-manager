import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT } from '../../shared/theme'
import { Avatar } from '../../shared/Avatar'
import { NAME, PANEL_AT, PLAN_LABEL, ROW_AT, T } from './timeline'

const EXISTING = [
  { name: 'Ayesha Fernando', plan: 'Monthly', joined: 'Yesterday' },
  { name: 'Kasun Dias', plan: 'Student', joined: '2 days ago' },
  { name: 'Dilani Ranasinghe', plan: 'Monthly + PT', joined: '3 days ago' },
  { name: 'Ruwan Silva', plan: 'Monthly', joined: 'Last week' },
  { name: 'Ishara Perera', plan: 'Monthly', joined: 'Last week' },
]
const ROW_H = 112

const Row: React.FC<{ name: string; plan: string; joined: string; qr?: boolean; glow?: number }> = ({ name, plan, joined, qr, glow = 0 }) => (
  <div
    style={{
      height: ROW_H,
      display: 'flex',
      alignItems: 'center',
      gap: 24,
      padding: '0 28px',
      borderBottom: `1px solid ${C.border1}`,
      background: glow > 0 ? `rgba(74,71,209,${0.22 * glow})` : 'transparent',
    }}
  >
    <Avatar size={64} hue={qr ? C.accentDefault : C.border3} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 30, color: C.textPrimary }}>{name}</span>
      <span style={{ fontSize: 22, color: C.textMuted }}>{plan}</span>
    </div>
    {qr && (
      <span style={{ fontFamily: FONT.mono, fontSize: 20, padding: '4px 12px', borderRadius: 5, color: C.accentLink, background: C.accentBg, border: `1px solid ${C.accentBorder}` }}>
        QR
      </span>
    )}
    <span style={{ fontSize: 22, color: qr ? C.textPrimary : C.textMuted, width: 150, textAlign: 'right' }}>{joined}</span>
  </div>
)

/** The gym's member list. The self-registered member lands at the top; nobody typed it in. */
export const MembersPanel: React.FC = () => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (f < PANEL_AT || f >= T.card.from) return null
  const o = interpolate(f, [PANEL_AT, PANEL_AT + 14], [0, 1], { extrapolateRight: 'clamp' })
  const row = spring({ frame: f - ROW_AT, fps, config: { damping: 16 } })
  const glow = interpolate(f, [ROW_AT, ROW_AT + 10, ROW_AT + 90], [0, 1, 0.35], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        top: 560,
        height: 96 + ROW_H * 6 + 2,
        opacity: o,
        background: C.surfacePanel,
        border: `1px solid ${C.border1}`,
        borderRadius: 12,
        overflow: 'hidden',
        fontFamily: FONT.sans,
      }}
    >
      <div style={{ height: 96, display: 'flex', alignItems: 'center', padding: '0 28px', fontSize: 32, fontWeight: 600, color: C.textPrimary, borderBottom: `1px solid ${C.border1}` }}>
        Members
      </div>
      <div style={{ transform: `translateY(${(row - 1) * ROW_H}px)` }}>
        <div style={{ opacity: row }}>
          <Row name={NAME.text} plan={PLAN_LABEL} joined="Just now" qr glow={glow} />
        </div>
        {EXISTING.map((m) => (
          <Row key={m.name} {...m} />
        ))}
      </div>
    </div>
  )
}
