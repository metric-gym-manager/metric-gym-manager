import React from 'react'
import { Composition } from 'remotion'
import { Film } from './films/hundred-squares/Film'
import { DURATION, FPS } from './films/hundred-squares/timeline'
import { ZoomOutFilm } from './films/zoom-out/Film'
import { DURATION as ZOOM_OUT_DURATION } from './films/zoom-out/timeline'
import { OvernightFilm } from './films/overnight/Film'
import { DURATION as OVERNIGHT_DURATION } from './films/overnight/timeline'

export const Root: React.FC = () => (
  <>
    {/* Master: 9:16 for Reels / TikTok / Shorts. */}
    <Composition id="HundredSquares" component={Film} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={{ muted: false }} />
    <Composition id="HundredSquaresLandscape" component={Film} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} defaultProps={{ muted: false }} />
    <Composition id="ZoomOut" component={ZoomOutFilm} durationInFrames={ZOOM_OUT_DURATION} fps={FPS} width={1080} height={1920} defaultProps={{ muted: false }} />
    <Composition id="Overnight" component={OvernightFilm} durationInFrames={OVERNIGHT_DURATION} fps={FPS} width={1080} height={1920} defaultProps={{ muted: false }} />
  </>
)
