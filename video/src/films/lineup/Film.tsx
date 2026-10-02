import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT, loadFonts } from '../../shared/theme'
import { Caption } from '../../shared/Caption'
import { EndCard } from '../../shared/EndCard'
import { Avatar } from '../../shared/Avatar'
import { Cues, type Cue } from '../../shared/Cues'
import { Figure } from './Figure'
import { PEOPLE, CULPRIT, T, SEARCH, RESULT_AT, TODAY } from './data'

loadFonts()
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const BASE = 1560
const xOf = (i: number) => 90 + i * 180
const BEAT = (T.countdown.to - T.countdown.from) / 6

const Lineup: React.FC = () => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const counting = f >= T.countdown.from && f < T.countdown.to
  const spot = Math.floor((f - T.countdown.from) / BEAT)
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: BASE, bottom: 0, background: '#0d0d10', borderTop: `1px solid ${C.border1}` }} />
      {PEOPLE.map((p, i) => {
        const enter = spring({ frame: f - 4 - i * 4, fps, config: { damping: 16 } })
        const lit = counting ? (spot === i ? 1 : 0.35) : 1
        const caught = p === CULPRIT && f >= RESULT_AT
        const badge = spring({ frame: f - T.badges.from - i * 6, fps, config: { damping: 12 } })
        return (
          <div key={p.n} style={{ position: 'absolute', left: xOf(i) - 75, top: BASE - p.height + (1 - enter) * 300, opacity: enter }}>
            {counting && spot === i && (
              <div style={{ position: 'absolute', left: -40, right: -40, top: -120, height: p.height + 140, background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.16), rgba(255,255,255,0) 70%)' }} />
            )}
            {f >= T.badges.from && (
              <div style={{ position: 'absolute', left: -15, width: 180, top: -78, display: 'flex', justifyContent: 'center', transform: `scale(${badge})` }}>
                <span
                  style={{
                    fontFamily: FONT.sans,
                    fontSize: 24,
                    fontWeight: 600,
                    padding: '6px 14px',
                    borderRadius: 6,
                    color: p.status === 'Active' ? C.successText : C.errorText,
                    background: p.status === 'Active' ? C.successBg : C.errorBg,
                    border: `1px solid ${p.status === 'Active' ? C.successBorder : C.errorBorder}`,
                  }}
                >
                  {p.status}
                </span>
              </div>
            )}
            <Figure p={p} dim={lit} outline={caught ? C.errorText : undefined} />
            <div style={{ position: 'absolute', left: 45, top: p.height + 26, width: 60, height: 60, borderRadius: 30, border: `2px solid ${caught ? C.errorText : C.border3}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.mono, fontSize: 30, color: caught ? C.errorText : C.textPrimary }}>
              {p.n}
            </div>
          </div>
        )
      })}
    </>
  )
}

/** A draining timer bar, not digits: digits would read as a hint at a figure's number. */
const Countdown: React.FC = () => {
  const f = useCurrentFrame()
  if (f < T.countdown.from || f >= T.countdown.to) return null
  const left = interpolate(f, [T.countdown.from, T.countdown.to], [1, 0], clamp)
  return (
    <div style={{ position: 'absolute', left: 140, right: 140, top: 400, height: 14, borderRadius: 7, background: C.surfaceActive, overflow: 'hidden' }}>
      <div style={{ width: `${left * 100}%`, height: '100%', background: left < 0.25 ? C.errorText : C.textPrimary }} />
    </div>
  )
}

const Search: React.FC = () => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (f < T.search.from || f >= T.badges.from + 10) return null
  const o = interpolate(f, [T.search.from, T.search.from + 8, T.badges.from - 6, T.badges.from + 10], [0, 1, 1, 0], clamp)
  const chars = Math.max(0, Math.min(SEARCH.text.length, Math.floor((f - SEARCH.from) / SEARCH.framesPerChar) + 1))
  const card = spring({ frame: f - RESULT_AT, fps, config: { damping: 16 } })
  const p = CULPRIT
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: 180, opacity: o, fontFamily: FONT.sans }}>
      <div style={{ height: 88, borderRadius: 10, border: `1px solid ${C.focusBorder}`, background: C.surfaceInput, display: 'flex', alignItems: 'center', gap: 18, padding: '0 28px', fontSize: 34, color: C.textPrimary }}>
        <svg width={30} height={30} viewBox="0 0 24 24">
          <circle cx="10" cy="10" r="7" fill="none" stroke={C.textMuted} strokeWidth="2.5" />
          <path d="M15 15 L21 21" stroke={C.textMuted} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span>{f >= SEARCH.from ? SEARCH.text.slice(0, chars) : <span style={{ color: C.textPlaceholder }}>Search members</span>}</span>
        {Math.floor(f / 8) % 2 === 0 && <span style={{ color: C.accentLink, marginLeft: -14 }}>|</span>}
      </div>
      {f >= RESULT_AT && (
        <div style={{ marginTop: 20, opacity: card, transform: `translateY(${(1 - card) * 30}px)`, background: C.surfacePanel, border: `1px solid ${C.border2}`, borderRadius: 12, padding: 32, display: 'flex', gap: 28, alignItems: 'center' }}>
          <Avatar size={140} hue={C.border3} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 40, fontWeight: 700, color: C.textPrimary }}>{p.name}</span>
            <span style={{ fontSize: 26, color: C.textSecondary }}>{p.plan}</span>
            <span style={{ fontSize: 26, color: C.textSecondary }}>
              Paid through <b style={{ color: C.textPrimary }}>{p.paidThrough}</b> · today is {TODAY}
            </span>
          </div>
          <span style={{ fontSize: 28, fontWeight: 600, padding: '8px 16px', borderRadius: 6, color: C.errorText, background: C.errorBg, border: `1px solid ${C.errorBorder}` }}>Expired</span>
        </div>
      )}
    </div>
  )
}

const cues = (): Cue[] => {
  const c: Cue[] = [
    { at: T.cantTell.from, sfx: 'hit', volume: 0.8 },
    { at: T.cantTell.from + 45, sfx: 'sub', volume: 0.6 },
    { at: RESULT_AT, sfx: 'deny', volume: 0.8 },
    { at: T.badges.from + 30, sfx: 'hit', volume: 0.7 },
    { at: T.card.from, sfx: 'chord', volume: 0.9 },
  ]
  PEOPLE.forEach((_, i) => c.push({ at: 4 + i * 4, sfx: 'pop', volume: 0.5 }))
  for (let i = 0; i < 6; i++) c.push({ at: Math.round(T.countdown.from + i * BEAT), sfx: 'clock', volume: 0.9 })
  for (let i = 0; i < 5; i++) c.push({ at: Math.round(T.countdown.from + (i * (T.countdown.to - T.countdown.from)) / 5), sfx: 'tick', volume: 0.7 })
  for (let i = 0; i < SEARCH.text.length; i++) c.push({ at: SEARCH.from + i * SEARCH.framesPerChar, sfx: 'key', volume: 0.8 })
  PEOPLE.forEach((p, i) => c.push({ at: T.badges.from + i * 6, sfx: p.status === 'Active' ? 'tickUp' : 'deny', volume: 0.6 }))
  return c.sort((a, b) => a.at - b.at)
}
const CUES = cues()

export const LineupFilm: React.FC<{ muted?: boolean }> = ({ muted }) => (
  <AbsoluteFill style={{ background: C.surfaceBase }}>
    <Lineup />
    <Countdown />
    <Search />
    <Caption text="One of them hasn't paid. Which one?" inAt={4} outAt={T.countdown.from + 10} top={220} />
    <Caption text="Pick a number." inAt={T.countdown.from + 10} outAt={T.countdown.to} top={220} />
    <Caption text="You can't tell by looking." inAt={T.cantTell.from} outAt={T.cantTell.from + 48} top={420} />
    <Caption text="Neither can your front desk." inAt={T.cantTell.from + 45} outAt={T.search.from} top={420} />
    <Caption text="It was number 4. The one who looks most committed." inAt={T.badges.from + 30} outAt={T.card.from} top={300} />
    <EndCard from={T.card.from} />
    {!muted && <Cues cues={CUES} />}
  </AbsoluteFill>
)
