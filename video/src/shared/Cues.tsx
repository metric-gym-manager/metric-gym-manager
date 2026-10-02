import React from 'react'
import { Audio, Sequence, staticFile } from 'remotion'

export type Sfx =
  | 'tick' | 'tickUp' | 'thud' | 'sub' | 'hit' | 'ping' | 'sweep' | 'key' | 'chord'
  | 'whoosh' | 'shutter' | 'buzz' | 'grant' | 'deny' | 'snip' | 'pop' | 'clock'

export interface Cue {
  at: number
  sfx: Sfx
  volume: number
}

/** Plays a cue list. Films derive cues from their own data so sound cannot drift from picture. */
export const Cues: React.FC<{ cues: readonly Cue[] }> = ({ cues }) => (
  <>
    {cues.map((c, i) => (
      <Sequence key={i} from={c.at} layout="none">
        <Audio src={staticFile(`sfx/${c.sfx}.wav`)} volume={c.volume} />
      </Sequence>
    ))}
  </>
)
