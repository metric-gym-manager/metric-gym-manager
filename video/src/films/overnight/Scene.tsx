import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion'
import { C, FONT } from '../../shared/theme'
import { EVENTS, LIGHTS_OFF_AT, minutesAt, hhmm, OWNER_WAKES_AT, LAPTOP_AT, T } from './timeline'

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const GROUND = 1480

/** mulberry32: deterministic scatter so every render is identical. */
function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = prng(6102026)
const STARS = Array.from({ length: 70 }, () => ({ x: rand() * 1080, y: rand() * 1100, r: 1 + rand() * 2.2, ph: rand() * 6.28 }))
/** 23 members' homes on the horizon, plus the owner's house on the right. */
export const HOMES = Array.from({ length: 23 }, (_, i) => {
  const side = i % 2 === 0 ? -1 : 1
  const k = Math.floor(i / 2)
  const x = 540 + side * (340 + k * 28 + rand() * 14)
  return { x: Math.max(30, Math.min(1050, x)), y: GROUND - 6 - rand() * 50 - (k % 3) * 22, s: 0.7 + rand() * 0.35 }
})
const OWNER = { x: 170, y: GROUND + 150 }

type RGB = [number, number, number]
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB
const mixRgb = (a: RGB, b: RGB, t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`
/** Sky stops by time of day (minutes after midnight on day 2). */
const SKY: Array<[number, string, string]> = [
  [0, '#04040a', '#0b0b16'],
  [5 * 60, '#05050d', '#11101e'],
  [5 * 60 + 50, '#1d1530', '#5a3346'],
  [6 * 60 + 30, '#2d3a63', '#b9775a'],
  [8 * 60 + 30, '#3d5f8f', '#a9bdd2'],
  [9 * 60 + 30, '#4a6e9e', '#b8c9dc'],
]
function skyAt(mins: number): [string, string] {
  const m = mins >= 24 * 60 ? mins - 24 * 60 : 0
  for (let i = 1; i < SKY.length; i++) {
    if (m <= SKY[i][0]) {
      const t = (m - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0])
      return [mixRgb(hex(SKY[i - 1][1]), hex(SKY[i][1]), t), mixRgb(hex(SKY[i - 1][2]), hex(SKY[i][2]), t)]
    }
  }
  return [SKY[SKY.length - 1][1], SKY[SKY.length - 1][2]]
}

const House: React.FC<{ x: number; y: number; s: number; lit: number; colour?: string }> = ({ x, y, s, lit, colour = '#ffcf7a' }) => (
  <svg style={{ position: 'absolute', left: x - 24 * s, top: y - 40 * s }} width={48 * s} height={40 * s} viewBox="0 0 48 40">
    <path d="M4 18 L24 3 L44 18 L44 40 L4 40 Z" fill="#0e0e14" stroke="#24242c" strokeWidth="1.5" />
    <rect x="18" y="22" width="12" height="10" fill={colour} opacity={0.08 + 0.92 * lit} />
  </svg>
)

const Envelope: React.FC<{ x: number; y: number; o: number }> = ({ x, y, o }) => (
  <svg style={{ position: 'absolute', left: x - 14, top: y - 10, opacity: o }} width={28} height={20} viewBox="0 0 28 20">
    <rect x="1" y="1" width="26" height="18" rx="2" fill={C.accentLink} />
    <path d="M1 2 L14 11 L27 2" fill="none" stroke={C.surfaceBase} strokeWidth="2" />
  </svg>
)

export const Scene: React.FC = () => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const mins = minutesAt(f)
  const [top, bottom] = skyAt(mins)
  const night = interpolate(mins, [24 * 60 + 5 * 60 + 30, 24 * 60 + 7 * 60], [1, 0], clamp)
  const sunY = interpolate(mins, [24 * 60 + 5 * 60 + 50, 24 * 60 + 9 * 60 + 5], [GROUND + 60, 840], { ...clamp, easing: Easing.out(Easing.quad) })
  const gymLit = interpolate(f, [LIGHTS_OFF_AT, LIGHTS_OFF_AT + 2], [1, 0], clamp)
  const send = EVENTS[2].at
  const ownerLit = interpolate(f, [OWNER_WAKES_AT, OWNER_WAKES_AT + 4], [0, 1], clamp)
  return (
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(${top} 0%, ${bottom} ${(GROUND / 1920) * 100}%)` }}>
      {STARS.map((s, i) => (
        <div key={i} style={{ position: 'absolute', left: s.x, top: s.y, width: s.r, height: s.r, borderRadius: s.r, background: '#fff', opacity: night * (0.35 + 0.35 * Math.sin(f / 9 + s.ph)) }} />
      ))}
      <div style={{ position: 'absolute', left: 900 - 70, top: sunY - 70, width: 140, height: 140, borderRadius: 70, background: '#ffd9a0', boxShadow: '0 0 120px 40px rgba(255,190,120,0.35)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: GROUND, bottom: 0, background: '#09090c' }} />
      {HOMES.map((h, i) => {
        const land = send + 6 + i + 22
        const blink = f >= land ? interpolate(f - land, [0, 3, 20], [0, 1, 0.25], clamp) : 0
        return <House key={i} x={h.x} y={h.y} s={h.s} lit={blink} colour={C.accentLink} />
      })}
      <House x={OWNER.x} y={OWNER.y} s={2.2} lit={ownerLit} />

      {/* The gym. Lights go out at closing; after that only the system moves. */}
      <div style={{ position: 'absolute', left: 540 - 300, top: GROUND - 420, width: 600, height: 420, background: '#111116', border: '2px solid #26262e', borderBottom: 'none' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 26, textAlign: 'center', fontFamily: FONT.sans, fontWeight: 700, fontSize: 34, letterSpacing: '0.18em', color: gymLit > 0 ? '#f2f2f5' : '#3a3a44' }}>
          IRON YARD FITNESS
        </div>
        {Array.from({ length: 10 }, (_, i) => {
          const r = Math.floor(i / 5)
          const c = i % 5
          const pulse = EVENTS.slice(0, 2).reduce((acc, e) => acc + interpolate(f - e.at, [0, 3, 24], [0, 1, 0], clamp), 0)
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 40 + c * 108,
                top: 110 + r * 130,
                width: 84,
                height: 96,
                background: gymLit > 0 ? '#ffcf7a' : pulse > 0 ? C.accentLink : '#07070a',
                opacity: gymLit > 0 ? 0.9 : 0.25 + 0.6 * pulse,
                border: '1px solid #26262e',
              }}
            />
          )
        })}
      </div>
      {/* Event rings radiating from the building. */}
      {EVENTS.map((e) => {
        const t = interpolate(f - e.at, [0, 40], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) })
        if (t <= 0 || t >= 1) return null
        return <div key={e.at} style={{ position: 'absolute', left: 540 - 320 * t - 40, top: GROUND - 210 - 320 * t - 40, width: 640 * t + 80, height: 640 * t + 80, borderRadius: '50%', border: `4px solid ${C.accentLink}`, opacity: 1 - t }} />
      })}
      {/* 09:00: one reminder to each of 23 homes. */}
      {HOMES.map((h, i) => {
        const start = send + 6 + i
        const p = interpolate(f, [start, start + 22], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) })
        if (p <= 0 || p >= 1) return null
        const x0 = 540
        const y0 = GROUND - 300
        const x = x0 + (h.x - x0) * p
        const y = y0 + (h.y - 30 - y0) * p - Math.sin(p * Math.PI) * 260
        return <Envelope key={i} x={x} y={y} o={1} />
      })}

      {/* Clock. */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 150, textAlign: 'center', fontFamily: FONT.mono, fontWeight: 500, fontSize: 168, color: C.textPrimary, letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {hhmm(mins)}
      </div>
      <Log />
      <Laptop fps={fps} />
    </div>
  )
}

const Log: React.FC = () => {
  const f = useCurrentFrame()
  if (f >= LAPTOP_AT + 10) return null
  return (
    <div style={{ position: 'absolute', left: 90, right: 90, top: 400, display: 'flex', flexDirection: 'column', gap: 18, fontFamily: FONT.mono }}>
      {EVENTS.map((e) => {
        const o = interpolate(f, [e.at, e.at + 6], [0, 1], clamp)
        if (o <= 0) return null
        return (
          <div key={e.at} style={{ opacity: o, transform: `translateY(${(1 - o) * 12}px)`, display: 'flex', gap: 24, fontSize: 34, background: 'rgba(8,8,10,0.72)', padding: '12px 20px', borderRadius: 8 }}>
            <span style={{ color: C.textMuted }}>{e.time}</span>
            <span style={{ color: C.textPrimary }}>
              {e.count} {e.text}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const Laptop: React.FC<{ fps: number }> = ({ fps }) => {
  const f = useCurrentFrame()
  if (f < LAPTOP_AT) return null
  const up = spring({ frame: f - LAPTOP_AT, fps, config: { damping: 18 } })
  return (
    <div
      style={{
        position: 'absolute',
        left: 90,
        right: 90,
        top: 420 + (1 - up) * 900,
        background: C.surfacePanel,
        border: `1px solid ${C.border2}`,
        borderRadius: 14,
        padding: '44px 48px',
        fontFamily: FONT.sans,
        display: 'flex',
        flexDirection: 'column',
        gap: 26,
      }}
    >
      <span style={{ fontSize: 26, color: C.textMuted }}>Iron Yard Fitness · Overnight</span>
      <span style={{ fontSize: 52, fontWeight: 700, color: C.textPrimary }}>Good morning.</span>
      {EVENTS.map((e) => (
        <div key={e.at} style={{ display: 'flex', alignItems: 'baseline', gap: 22, borderTop: `1px solid ${C.border1}`, paddingTop: 22 }}>
          <span style={{ fontFamily: FONT.mono, fontSize: 28, color: C.textMuted, width: 100 }}>{e.time}</span>
          <span style={{ fontFamily: FONT.mono, fontSize: 52, color: C.textPrimary, width: 90 }}>{e.count}</span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 30, color: C.textPrimary }}>{e.text}</span>
            <span style={{ fontSize: 24, color: C.textMuted }}>{e.detail}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

export { T }
