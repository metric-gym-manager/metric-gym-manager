import React from 'react'
import { AbsoluteFill } from 'remotion'
import { C, loadFonts } from '../../shared/theme'
import { Caption } from '../../shared/Caption'
import { EndCard } from '../../shared/EndCard'
import { Cues, type Cue } from '../../shared/Cues'
import { Scene } from './Scene'
import { CLOCK, EVENTS, LIGHTS_OFF_AT, OWNER_WAKES_AT, LAPTOP_AT, T } from './timeline'

loadFonts()

const cues = (): Cue[] => {
  const c: Cue[] = [
    { at: LIGHTS_OFF_AT, sfx: 'thud', volume: 0.6 },
    { at: OWNER_WAKES_AT, sfx: 'tickUp', volume: 0.7 },
    { at: LAPTOP_AT, sfx: 'sweep', volume: 0.6 },
    { at: T.reveal.from, sfx: 'hit', volume: 0.8 },
    { at: T.card.from, sfx: 'chord', volume: 0.9 },
  ]
  // Clock ticks only while time is racing; holds are silent.
  for (let i = 1; i < CLOCK.length; i++) {
    const [f0, m0] = CLOCK[i - 1]
    const [f1, m1] = CLOCK[i]
    if (m1 > m0) for (let f = f0; f < f1; f += 4) c.push({ at: f, sfx: 'clock', volume: 0.5 })
  }
  for (const e of EVENTS) {
    c.push({ at: e.at, sfx: 'ping', volume: 0.9 })
    c.push({ at: e.at, sfx: 'sub', volume: 0.6 })
  }
  // One tick per reminder landing.
  for (let i = 0; i < 23; i++) c.push({ at: EVENTS[2].at + 6 + i + 22, sfx: 'tick', volume: 0.5 })
  return c.sort((a, b) => a.at - b.at)
}
const CUES = cues()

export const OvernightFilm: React.FC<{ muted?: boolean }> = ({ muted }) => (
  <AbsoluteFill style={{ background: C.surfaceBase }}>
    <Scene />
    <Caption text="Your gym is closed. Watch." inAt={LIGHTS_OFF_AT + 4} outAt={T.hook.to + 50} top={430} plate />
    <Caption text="Nobody worked the night shift." inAt={T.reveal.from} outAt={T.card.from} top={1720} plate />
    <EndCard from={T.card.from} />
    {!muted && <Cues cues={CUES} />}
  </AbsoluteFill>
)
