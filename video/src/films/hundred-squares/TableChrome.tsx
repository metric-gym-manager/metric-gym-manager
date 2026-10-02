import React from 'react'
import { interpolate, useCurrentFrame } from 'remotion'
import { BILLED, countsAt, uncollectedAt, formatLkr } from './data'
import { C, FONT } from '../../shared/theme'
import { useLayout } from './layout'
import { tableGeometry } from './table'
import { MORPH_AT, T } from './timeline'

/**
 * The members screen the grid becomes: panel, KPI tiles, column header. The
 * rows themselves are the squares (see Squares.tsx). Figures are read from
 * the same data as the grid at the end of the resolve.
 */
export const TableChrome: React.FC = () => {
  const frame = useCurrentFrame()
  const L = useLayout()
  const G = tableGeometry(L)
  const o = interpolate(frame, [MORPH_AT + 6, MORPH_AT + 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  if (o <= 0) return null

  const end = T.resolve.to
  const c = countsAt(end)
  const outstanding = uncollectedAt(end)
  const tiles = [
    { k: 'Active', v: String(c.paid), tone: C.successText },
    { k: 'Due', v: String(c.due), tone: C.warningText },
    { k: 'Expired', v: String(c.expired), tone: C.errorText },
    { k: 'Billed', v: formatLkr(BILLED), tone: C.textPrimary },
    { k: 'Collected', v: formatLkr(BILLED - outstanding), tone: C.textPrimary },
  ]
  const fs = L.portrait ? 1 : 0.75
  const { panel } = L

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: panel.x,
          top: panel.y,
          width: panel.w,
          height: panel.h,
          background: C.surfacePanel,
          border: `1px solid ${C.border1}`,
          borderRadius: 12,
          opacity: o,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: G.rowX,
          top: G.tilesY,
          width: G.rowW,
          height: G.tilesH,
          display: 'grid',
          gridTemplateColumns: L.portrait ? 'repeat(3, 1fr) 1.6fr 1.6fr' : 'repeat(3, 1fr) 1.5fr 1.5fr',
          gap: 12,
          opacity: o,
        }}
      >
        {tiles.map((t) => (
          <div
            key={t.k}
            style={{
              background: C.surfaceCard,
              border: `1px solid ${C.border1}`,
              borderRadius: 8,
              padding: `${18 * fs}px ${18 * fs}px`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontFamily: FONT.sans, fontSize: 20 * fs, color: C.textMuted }}>{t.k}</span>
            <span style={{ fontFamily: FONT.mono, fontSize: (t.v.length > 6 ? 26 : 44) * fs, fontWeight: 500, color: t.tone }}>{t.v}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: G.rowX,
          top: G.headerY,
          width: G.rowW,
          height: G.headerH,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: `0 ${L.portrait ? 24 : 16}px`,
          borderBottom: `1px solid ${C.border1}`,
          fontFamily: FONT.sans,
          fontSize: 18 * fs,
          color: C.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          opacity: o,
        }}
      >
        <span style={{ flex: 1.4 }}>Member</span>
        <span style={{ flex: 1.2 }}>Plan</span>
        <span style={{ flex: 1, textAlign: 'right' }}>Fee</span>
        <span style={{ flex: 0.9, textAlign: 'right' }}>Status</span>
      </div>
    </>
  )
}
