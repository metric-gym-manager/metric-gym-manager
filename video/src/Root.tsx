import React from 'react'
import { Composition } from 'remotion'
import { Film } from './Film'
import { DURATION, FPS } from './timeline'

export const Root: React.FC = () => (
  <>
    {/* Master: 9:16 for Reels / TikTok / Shorts. */}
    <Composition id="HundredSquares" component={Film} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={{ muted: false }} />
    <Composition id="HundredSquaresLandscape" component={Film} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} defaultProps={{ muted: false }} />
  </>
)
