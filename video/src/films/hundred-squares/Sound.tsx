import React from 'react'
import { Cues, type Cue } from '../../shared/Cues'
import { MEMBERS } from './data'
import { LABEL_AT, MORPH_AT, REMINDER_AT, T } from './timeline'
import { BOOT_LINE, TYPE_FROM, TYPE_FRAMES_PER_CHAR, READY_AT } from './Boot'


/** Every sound is derived from the same data as the picture, so sync cannot drift. */
export function buildCues(): Cue[] {
  const cues: Cue[] = []
  // Fill wave: one tick per diagonal.
  const diagonals = [...new Set(MEMBERS.map((m) => m.appearAt))]
  for (const at of diagonals) cues.push({ at, sfx: 'tick', volume: 0.35 })
  for (const m of MEMBERS) {
    if (m.amberAt !== null) cues.push({ at: m.amberAt, sfx: 'tick', volume: 0.7 })
    if (m.returnAt !== null) cues.push({ at: m.returnAt, sfx: 'tickUp', volume: 0.7 })
    if (m.stallAt !== null) cues.push({ at: m.stallAt, sfx: 'thud', volume: 0.9 })
    if (m.redAt !== null) cues.push({ at: m.redAt, sfx: 'sub', volume: 0.9 })
    if (m.recoverAt !== null) cues.push({ at: m.recoverAt, sfx: 'tickUp', volume: 0.8 })
  }
  // T.freeze: nothing. Silence is the cue.
  cues.push({ at: LABEL_AT, sfx: 'hit', volume: 1 })
  cues.push({ at: REMINDER_AT, sfx: 'ping', volume: 0.8 })
  cues.push({ at: REMINDER_AT + 10, sfx: 'ping', volume: 0.5 })
  cues.push({ at: MORPH_AT - 8, sfx: 'sweep', volume: 0.7 })
  for (let i = 0; i < BOOT_LINE.length; i += 2) cues.push({ at: TYPE_FROM + Math.floor(i * TYPE_FRAMES_PER_CHAR), sfx: 'key', volume: 0.6 })
  cues.push({ at: READY_AT, sfx: 'tickUp', volume: 0.8 })
  cues.push({ at: T.card.from, sfx: 'chord', volume: 0.9 })
  return cues.sort((a, b) => a.at - b.at)
}

const CUES = buildCues()

export const Sound: React.FC = () => <Cues cues={CUES} />
