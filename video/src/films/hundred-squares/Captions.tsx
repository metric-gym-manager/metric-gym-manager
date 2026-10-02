import React from 'react'
import { Caption as Line } from '../../shared/Caption'
import { useLayout } from './layout'
import { T, MORPH_AT } from './timeline'

export const Captions: React.FC = () => {
  const L = useLayout()
  return (
    <>
      {/* The hook. "these", never "members" — the word would spoil the reveal. */}
      <Line text="One of these is costing you money." inAt={6} outAt={T.rule.from + 60} top={L.hookY} size={64} />
      <Line text="Every square is a member." inAt={T.reveal.from} outAt={MORPH_AT} top={L.hookY} size={64} />
    </>
  )
}
