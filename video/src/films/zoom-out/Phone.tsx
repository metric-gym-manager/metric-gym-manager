import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT } from '../../shared/theme'
import { QrSvg } from './Poster'
import {
  T, SCAN_AT, FORM_AT, NAME, PHONE, PLAN_AT, SELFIE_AT, REGISTER_AT, SUCCESS_AT, PANEL_AT,
  GYM, PLAN_LABEL, PLAN_AMOUNT, ADMISSION_FEE, AMOUNT_DUE, rs,
} from './timeline'

const W = 620
const H = 1240
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

const typed = (f: number, t: { text: string; from: number; framesPerChar: number }) =>
  t.text.slice(0, Math.max(0, Math.min(t.text.length, Math.floor((f - t.from) / t.framesPerChar) + 1)))

const Field: React.FC<{ label: string; value: string; active: boolean; caret?: boolean }> = ({ label, value, active, caret }) => {
  const f = useCurrentFrame()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 22, color: C.textSecondary }}>{label}</span>
      <div
        style={{
          height: 72,
          borderRadius: 8,
          border: `1px solid ${active ? C.focusBorder : C.border2}`,
          background: C.surfaceInput,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          fontSize: 28,
          color: value ? C.textPrimary : C.textPlaceholder,
        }}
      >
        {value}
        {caret && active && Math.floor(f / 8) % 2 === 0 && <span style={{ color: C.accentLink }}>|</span>}
      </div>
    </div>
  )
}

/** An abstract member avatar: never a real face. */
export const Avatar: React.FC<{ size: number; hue?: string }> = ({ size, hue = C.accentDefault }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
    <circle cx="50" cy="50" r="50" fill={hue} opacity={0.35} />
    <circle cx="50" cy="40" r="17" fill={C.textPrimary} opacity={0.85} />
    <path d="M18 88 C24 64 76 64 82 88 Z" fill={C.textPrimary} opacity={0.85} />
  </svg>
)

const Scanner: React.FC = () => {
  const f = useCurrentFrame()
  const line = interpolate(f, [T.phone.from + 12, SCAN_AT], [0, 1], clamp)
  const flash = interpolate(f, [SCAN_AT, SCAN_AT + 2, SCAN_AT + 8], [0, 0.9, 0], clamp)
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#1a1a1d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: 420, height: 420 }}>
        <QrSvg size={420} />
        {[0, 1, 2, 3].map((k) => (
          <div
            key={k}
            style={{
              position: 'absolute',
              width: 70,
              height: 70,
              borderColor: C.successText,
              borderStyle: 'solid',
              borderWidth: 0,
              ...(k === 0 && { left: -24, top: -24, borderLeftWidth: 6, borderTopWidth: 6 }),
              ...(k === 1 && { right: -24, top: -24, borderRightWidth: 6, borderTopWidth: 6 }),
              ...(k === 2 && { left: -24, bottom: -24, borderLeftWidth: 6, borderBottomWidth: 6 }),
              ...(k === 3 && { right: -24, bottom: -24, borderRightWidth: 6, borderBottomWidth: 6 }),
            }}
          />
        ))}
        <div style={{ position: 'absolute', left: -10, right: -10, top: 420 * line, height: 4, background: C.successText, boxShadow: `0 0 18px ${C.successText}` }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: '#ffffff', opacity: flash }} />
    </div>
  )
}

const Form: React.FC = () => {
  const f = useCurrentFrame()
  const name = typed(f, NAME)
  const phone = f >= PHONE.from ? typed(f, PHONE) : ''
  const plan = f >= PLAN_AT
  const selfie = f >= SELFIE_AT
  const pressed = interpolate(f, [REGISTER_AT, REGISTER_AT + 3, REGISTER_AT + 9], [1, 0.95, 1], clamp)
  const activeName = f < PHONE.from
  const activePhone = f >= PHONE.from && f < PLAN_AT
  const flash = interpolate(f, [SELFIE_AT, SELFIE_AT + 2, SELFIE_AT + 7], [0, 0.8, 0], clamp)
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.surfaceBase, padding: '84px 44px 40px', display: 'flex', flexDirection: 'column', gap: 26, fontFamily: FONT.sans }}>
      <div style={{ fontSize: 22, color: C.textMuted, letterSpacing: '0.1em' }}>{GYM.toUpperCase()}</div>
      <div style={{ fontSize: 44, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.02em', marginBottom: 4 }}>Join the gym</div>
      <Field label="Full Name" value={name} active={activeName} caret />
      <Field label="Phone Number" value={phone} active={activePhone} caret />
      <Field label="Membership Plan" value={plan ? `${PLAN_LABEL} · ${rs(PLAN_AMOUNT)}` : 'Select a plan'} active={plan && !selfie} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: C.textSecondary, opacity: plan ? 1 : 0, gap: 16 }}>
        <span>Due today, incl. admission {rs(ADMISSION_FEE)}</span>
        <span style={{ fontFamily: FONT.mono, color: C.textPrimary, whiteSpace: 'nowrap' }}>{rs(AMOUNT_DUE)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <span style={{ fontSize: 22, color: C.textSecondary, width: 160 }}>Your Photo</span>
        {selfie ? (
          <Avatar size={96} />
        ) : (
          <div style={{ width: 96, height: 96, borderRadius: 48, border: `2px dashed ${C.borderDashed}` }} />
        )}
        <span style={{ fontSize: 22, color: C.accentLink }}>{selfie ? 'Retake' : 'Take a Selfie'}</span>
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          height: 84,
          borderRadius: 8,
          background: C.primaryDefault,
          color: C.primaryText,
          fontSize: 30,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${pressed})`,
          opacity: selfie ? 1 : 0.4,
        }}
      >
        {f >= REGISTER_AT ? 'Registering...' : 'Register'}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: '#ffffff', opacity: flash }} />
    </div>
  )
}

const Success: React.FC = () => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame: f - SUCCESS_AT, fps, config: { damping: 12 } })
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.surfaceBase, padding: '160px 44px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34, fontFamily: FONT.sans, textAlign: 'center' }}>
      <svg width={140} height={140} viewBox="0 0 100 100" style={{ transform: `scale(${pop})` }}>
        <circle cx="50" cy="50" r="46" fill="none" stroke={C.successText} strokeWidth="6" />
        <path d="M30 52 L45 66 L71 38" fill="none" stroke={C.successText} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ fontSize: 46, fontWeight: 700, color: C.textPrimary }}>Welcome, {NAME.text}!</div>
      <div style={{ width: '100%', border: `1px solid ${C.border1}`, background: C.surfaceCard, borderRadius: 8, padding: 36, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span style={{ fontSize: 24, color: C.textMuted }}>{PLAN_LABEL}</span>
        <span style={{ fontSize: 64, fontFamily: FONT.mono, color: C.textPrimary }}>{rs(AMOUNT_DUE)}</span>
        <span style={{ fontSize: 26, fontWeight: 600, color: C.accentLink, lineHeight: 1.35 }}>
          Show this screen at the front desk and pay to complete your registration.
        </span>
      </div>
    </div>
  )
}

export const Phone: React.FC = () => {
  const f = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  if (f < T.phone.from || f >= PANEL_AT + 30) return null
  const enter = spring({ frame: f - T.phone.from, fps, config: { damping: 18 } })
  const exit = interpolate(f, [PANEL_AT, PANEL_AT + 24], [0, 1], { ...clamp, easing: (t) => t * t })
  const x = (width - W) / 2
  const y = interpolate(enter, [0, 1], [height, (height - H) / 2]) + exit * height
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: W,
        height: H,
        borderRadius: 72,
        background: '#050506',
        border: `3px solid ${C.border3}`,
        padding: 16,
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 58, overflow: 'hidden' }}>
        {f < FORM_AT ? <Scanner /> : f < SUCCESS_AT ? <Form /> : <Success />}
        <div style={{ position: 'absolute', top: 22, left: '50%', width: 150, height: 40, marginLeft: -75, borderRadius: 20, background: '#050506' }} />
      </div>
    </div>
  )
}
