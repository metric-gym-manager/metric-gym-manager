import React from 'react'
import { AbsoluteFill } from 'remotion'
import { C, loadFonts } from './theme'
import { Squares } from './Squares'
import { Counter } from './Counter'
import { Captions } from './Captions'
import { TableChrome } from './TableChrome'
import { Boot, Dimmer, EndCard } from './Boot'
import { Sound } from './Sound'

loadFonts()

/**
 * "100 Squares". One continuous clock rather than a <Series>: the grid is a
 * single object that lives from the hook through the morph, and the freeze is
 * a property of the simulation clock (see timeline.simFrame), not a cut.
 */
export const Film: React.FC<{ muted?: boolean }> = ({ muted }) => (
  <AbsoluteFill style={{ background: C.surfaceBase }}>
    <TableChrome />
    <Squares />
    <Counter />
    <Captions />
    <Dimmer />
    <Boot />
    <EndCard />
    {!muted && <Sound />}
  </AbsoluteFill>
)
