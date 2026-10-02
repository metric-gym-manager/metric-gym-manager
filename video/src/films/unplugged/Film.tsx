import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion'
import { C, FONT, loadFonts } from '../../shared/theme'
import { Caption } from '../../shared/Caption'
import { EndCard } from '../../shared/EndCard'
import { Cues, type Cue } from '../../shared/Cues'
import { admits, MEMBERS, READER_CLOCK, SCAN, T, TODAY } from './data'

loadFonts()
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const READER = { x: 300, y: 820, w: 240, h: 360 }
const DOOR = { x: 640, y: 560, w: 340, h: 940 }
const CUT_Y = 1400
const PAD = { x: READER.x + READER.w / 2, y: READER.y + 270 }

/** Which member is at the reader, and what the reader has decided, at a frame. */
function scanState(f: number) {
  const m = [...MEMBERS].reverse().find((x) => f >= x.at)
  if (!m || f >= T.reveal.from) return null
  const local = f - m.at
  const verdict = local >= SCAN.verdict ? (admits(m.paidThrough, TODAY) ? 'granted' : 'denied') : local >= SCAN.press ? 'scanning' : 'idle'
  return { m, local, verdict } as const
}

const Scene: React.FC = () => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const cut = interpolate(f, [T.cut.from, T.cut.from + 10], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) })
  const offline = f >= T.cut.from + 4
  const spark = interpolate(f, [T.cut.from, T.cut.from + 3, T.cut.from + 16], [0, 1, 0], clamp)
  const s = scanState(f)
  const open = s && s.verdict === 'granted' ? spring({ frame: s.local - SCAN.verdict, fps, config: { damping: 18 } }) : 0
  const shake = s && s.verdict === 'denied' ? Math.sin((s.local - SCAN.verdict) * 1.6) * interpolate(s.local - SCAN.verdict, [0, 14], [10, 0], clamp) : 0
  const finger = s ? interpolate(s.local, [0, SCAN.press, SCAN.verdict + 20, SCAN.verdict + 40], [0, 1, 1, 0], clamp) : 0

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(#0c0c10, #121217 60%, #0a0a0c)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1500, bottom: 0, background: '#09090b', borderTop: `1px solid ${C.border1}` }} />

      {/* Door: swings open on a grant. */}
      <div style={{ position: 'absolute', left: DOOR.x - 14, top: DOOR.y - 14, width: DOOR.w + 28, height: DOOR.h + 14, border: '14px solid #1f1f26', borderBottom: 'none', background: '#e8d9b5', opacity: 0.9 }} />
      <div style={{ position: 'absolute', left: DOOR.x, top: DOOR.y, width: DOOR.w, height: DOOR.h, perspective: 1600 }}>
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #24242c, #2c2c35)', border: '2px solid #3a3a44', transformOrigin: '100% 50%', transform: `rotateY(${-72 * open}deg) translateX(${shake}px)` }}>
          <div style={{ position: 'absolute', left: 30, top: DOOR.h / 2 - 50, width: 18, height: 100, borderRadius: 9, background: '#5c5c66' }} />
        </div>
      </div>

      {/* Cable from reader to the internet box; cut at CUT_Y. */}
      <svg style={{ position: 'absolute', inset: 0 }} width={1080} height={1920}>
        <path d={`M ${PAD.x} ${READER.y + READER.h} L ${PAD.x} ${CUT_Y - 10 - 26 * cut}`} stroke="#3a3a44" strokeWidth={10} fill="none" strokeLinecap="round" />
        <path d={`M ${PAD.x} ${CUT_Y + 10 + 26 * cut} L ${PAD.x} 1640 L 300 1640`} stroke="#3a3a44" strokeWidth={10} fill="none" strokeLinecap="round" />
        {spark > 0 && (
          <g opacity={spark}>
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <line key={a} x1={PAD.x} y1={CUT_Y} x2={PAD.x + Math.cos((a * Math.PI) / 180) * 50} y2={CUT_Y + Math.sin((a * Math.PI) / 180) * 50} stroke="#ffd27a" strokeWidth={4} />
            ))}
          </g>
        )}
      </svg>
      <div style={{ position: 'absolute', left: 90, top: 1590, width: 210, height: 100, borderRadius: 12, background: '#16161b', border: '2px solid #2a2a33', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: FONT.mono, fontSize: 24, color: C.textSecondary }}>
        <span style={{ width: 14, height: 14, borderRadius: 7, background: offline ? '#2a2a33' : C.successText }} />
        INTERNET
      </div>

      {/* Network status chip. */}
      <div style={{ position: 'absolute', left: READER.x - 20, top: READER.y - 90, width: READER.w + 40, display: 'flex', justifyContent: 'center' }}>
        <span style={{ fontFamily: FONT.mono, fontSize: 28, fontWeight: 500, letterSpacing: '0.14em', padding: '8px 18px', borderRadius: 6, color: offline ? C.errorText : C.successText, background: offline ? C.errorBg : C.successBg, border: `1px solid ${offline ? C.errorBorder : C.successBorder}` }}>
          ● {offline ? 'OFFLINE' : 'ONLINE'}
        </span>
      </div>

      {/* The reader. Its screen shows its own clock: it decides from that. */}
      <div style={{ position: 'absolute', left: READER.x, top: READER.y, width: READER.w, height: READER.h, borderRadius: 26, background: '#1a1a20', border: '2px solid #33333d' }}>
        <div style={{ position: 'absolute', left: 20, top: 22, right: 20, height: 170, borderRadius: 12, background: s?.verdict === 'granted' ? '#0f2a17' : s?.verdict === 'denied' ? '#2e1214' : '#0b0b0f', border: '1px solid #2a2a33', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: FONT.mono, textAlign: 'center' }}>
          {!s || s.verdict === 'idle' ? (
            <span style={{ fontSize: 24, color: C.textSecondary }}>{READER_CLOCK}</span>
          ) : s.verdict === 'scanning' ? (
            <span style={{ fontSize: 24, color: C.textSecondary }}>Scanning…</span>
          ) : (
            <>
              <span style={{ fontSize: 30, fontWeight: 500, color: s.verdict === 'granted' ? C.successText : C.errorText }}>{s.verdict === 'granted' ? 'ACCESS' : 'ACCESS'}</span>
              <span style={{ fontSize: 30, fontWeight: 500, color: s.verdict === 'granted' ? C.successText : C.errorText }}>{s.verdict === 'granted' ? 'GRANTED' : 'DENIED'}</span>
            </>
          )}
        </div>
        <div style={{ position: 'absolute', left: READER.w / 2 - 50, top: 220, width: 100, height: 100, borderRadius: 50, background: '#101014', border: `3px solid ${s?.verdict === 'scanning' ? C.accentLink : '#2a2a33'}` }} />
      </div>

      {/* Finger approaching the pad. */}
      <div style={{ position: 'absolute', left: PAD.x - 34, top: interpolate(finger, [0, 1], [1900, PAD.y - 10]), width: 68, height: 300, borderRadius: 34, background: '#8b8b95', opacity: finger > 0 ? 1 : 0 }} />

      {/* Who is at the reader. */}
      {s && (
        <div style={{ position: 'absolute', left: 60, right: 60, top: 1740, display: 'flex', justifyContent: 'center', gap: 18, fontFamily: FONT.sans, fontSize: 34, color: C.textPrimary, opacity: interpolate(s.local, [0, 8], [0, 1], clamp) }}>
          <span style={{ fontWeight: 600 }}>{s.m.name}</span>
          <span style={{ color: C.textSecondary }}>paid through</span>
          <span style={{ fontWeight: 600, color: admits(s.m.paidThrough, TODAY) ? C.successText : C.errorText }}>{s.m.label}</span>
        </div>
      )}

      <div style={{ position: 'absolute', left: 60, top: 70, fontFamily: FONT.mono, fontSize: 24, letterSpacing: '0.24em', color: C.accentLink, border: `1px solid ${C.accentBorder}`, background: C.accentBg, borderRadius: 6, padding: '8px 16px' }}>ENTERPRISE</div>
    </>
  )
}

const cues = (): Cue[] => {
  const c: Cue[] = [
    { at: T.cut.from, sfx: 'snip', volume: 1 },
    { at: T.cut.from + 2, sfx: 'thud', volume: 0.8 },
    { at: T.reveal.from, sfx: 'hit', volume: 0.8 },
    { at: T.card.from, sfx: 'chord', volume: 0.9 },
  ]
  // A steady tick under the whole test: the suspense has a pulse; it stops when the verdicts are in.
  for (let f = 0; f < T.reveal.from; f += 15) c.push({ at: f, sfx: 'clock', volume: 0.6 })
  for (const m of MEMBERS) {
    c.push({ at: m.at + SCAN.press, sfx: 'tick', volume: 0.7 })
    c.push({ at: m.at + SCAN.verdict, sfx: admits(m.paidThrough, TODAY) ? 'grant' : 'deny', volume: 1 })
  }
  return c.sort((a, b) => a.at - b.at)
}
const CUES = cues()

export const UnpluggedFilm: React.FC<{ muted?: boolean }> = ({ muted }) => (
  <AbsoluteFill style={{ background: C.surfaceBase }}>
    <Scene />
    <Caption text="We cut the internet. Watch the door." inAt={6} outAt={T.memberA.from} top={230} />
    <Caption text="Paid. The door opens." inAt={MEMBERS[0].at + SCAN.verdict} outAt={T.memberB.from} top={230} />
    <Caption text="Paid through yesterday. It stays shut." inAt={MEMBERS[1].at + SCAN.verdict} outAt={T.reveal.from} top={230} />
    <Caption text="Every reader keeps each member's paid-through date." inAt={T.reveal.from} outAt={T.reveal.from + 75} top={230} plate />
    <Caption text="It doesn't need the internet to say no." inAt={T.reveal.from + 75} outAt={T.card.from} top={230} plate />
    <EndCard from={T.card.from} tag="ENTERPRISE" />
    {!muted && <Cues cues={CUES} />}
  </AbsoluteFill>
)
