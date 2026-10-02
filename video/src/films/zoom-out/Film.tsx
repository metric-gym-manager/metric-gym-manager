import React from 'react'
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, loadFonts } from '../../shared/theme'
import { Caption } from '../../shared/Caption'
import { EndCard } from '../../shared/EndCard'
import { Cues, type Cue } from '../../shared/Cues'
import { Poster, FOCUS } from './Poster'
import { Phone } from './Phone'
import { MembersPanel } from './MembersPanel'
import { MACRO_SCALE, T, SCAN_AT, NAME, PHONE, PLAN_AT, SELFIE_AT, REGISTER_AT, SUCCESS_AT, PANEL_AT, ROW_AT } from './timeline'

loadFonts()

/**
 * One continuous camera. Scale is interpolated in log space so the pull-back
 * feels constant-speed to the eye; the focus point drifts from inside the QR
 * to the centre of the wall as the camera settles.
 */
const Camera: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame()
  const { width, height } = useVideoConfig()
  // Slow drift during the hook, then a steady log-space pull that eases into the wall.
  const p = interpolate(f, [0, T.hook.to, T.poster.to - 40], [0, 0.06, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  })
  const scale = Math.exp(interpolate(p, [0, 1], [Math.log(MACRO_SCALE), 0]))
  const cx = interpolate(p, [0, 0.85, 1], [FOCUS.x, 540, 540])
  const cy = interpolate(p, [0, 0.85, 1], [FOCUS.y, 870, 870])
  const tilt = interpolate(p, [0, 1], [-9, 0])
  // Push back into the wall as the phone arrives, so the phone owns the frame.
  const recede = interpolate(f, [T.phone.from, T.phone.from + 30], [1, 0.92], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const dim = interpolate(f, [T.phone.from, T.phone.from + 30, PANEL_AT, PANEL_AT + 20], [1, 0.12, 0.12, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ opacity: dim }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 1080,
          height: 1920,
          transformOrigin: '0 0',
          transform: `translate(${width / 2}px, ${height / 2}px) scale(${scale * recede * (height / 1920)}) rotate(${tilt}deg) translate(${-cx}px, ${-cy}px)`,
        }}
      >
        {/* The wall: a soft spotlight on the poster. */}
        <div style={{ position: 'absolute', left: -2000, top: -2000, width: 5080, height: 5920, background: `radial-gradient(ellipse 700px 900px at ${2000 + 540}px ${2000 + 870}px, #1b1b20 0%, ${C.surfaceBase} 100%)` }} />
        {children}
      </div>
    </AbsoluteFill>
  )
}

const cues = (): Cue[] => {
  const c: Cue[] = [
    { at: T.pull.from, sfx: 'whoosh', volume: 0.7 },
    { at: T.poster.from - 20, sfx: 'whoosh', volume: 0.5 },
    { at: T.poster.from + 60, sfx: 'pop', volume: 0.6 },
    { at: T.poster.from + 90, sfx: 'sweep', volume: 0.5 },
    { at: T.phone.from, sfx: 'whoosh', volume: 0.6 },
    { at: SCAN_AT, sfx: 'shutter', volume: 0.9 },
    { at: SCAN_AT + 2, sfx: 'tickUp', volume: 0.6 },
    { at: PLAN_AT, sfx: 'pop', volume: 0.6 },
    { at: SELFIE_AT, sfx: 'shutter', volume: 0.9 },
    { at: REGISTER_AT, sfx: 'pop', volume: 0.7 },
    { at: SUCCESS_AT, sfx: 'ping', volume: 0.8 },
    { at: ROW_AT, sfx: 'pop', volume: 0.8 },
    { at: T.reveal.from, sfx: 'hit', volume: 0.7 },
    { at: T.card.from, sfx: 'chord', volume: 0.9 },
  ]
  for (const t of [NAME, PHONE]) for (let i = 0; i < t.text.length; i++) c.push({ at: t.from + i * t.framesPerChar, sfx: 'key', volume: 0.9 })
  return c.sort((a, b) => a.at - b.at)
}
const CUES = cues()

export const ZoomOutFilm: React.FC<{ muted?: boolean }> = ({ muted }) => (
  <AbsoluteFill style={{ background: C.surfaceBase }}>
    <Camera>
      <Poster />
    </Camera>
    <Phone />
    <MembersPanel />
    <Caption text="What are you looking at?" inAt={4} outAt={T.pull.from + 70} top={220} plate />
    <Caption text="A stranger just joined your gym." inAt={ROW_AT - 6} outAt={T.reveal.from + 46} top={300} />
    <Caption text="Nobody at the front desk typed a thing." inAt={T.reveal.from + 46} outAt={T.card.from} top={300} />
    <EndCard from={T.card.from} />
    {!muted && <Cues cues={CUES} />}
  </AbsoluteFill>
)
