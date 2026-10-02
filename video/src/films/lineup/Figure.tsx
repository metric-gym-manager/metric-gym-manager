import React from 'react'
import type { Person } from './data'

const SKIN = '#8b8b95'
const DARK = '#1c1c22'

/** A geometric full-body figure. Abstract by design: no faces, no real people. */
export const Figure: React.FC<{ p: Person; dim: number; outline?: string }> = ({ p, dim, outline }) => {
  const H = p.height
  const torsoTop = 78
  const torsoBottom = H * 0.56
  const has = (k: Person['props'][number]) => p.props.includes(k)
  return (
    <svg width={150} height={H} viewBox={`0 0 150 ${H}`} style={{ display: 'block', opacity: 0.25 + 0.75 * dim, filter: outline ? `drop-shadow(0 0 10px ${outline})` : undefined }}>
      {/* legs */}
      <rect x={45} y={torsoBottom - 10} width={26} height={H - torsoBottom + 10} rx={12} fill={DARK} />
      <rect x={79} y={torsoBottom - 10} width={26} height={H - torsoBottom + 10} rx={12} fill={DARK} />
      {/* arms */}
      <rect x={14} y={torsoTop + 8} width={22} height={torsoBottom - torsoTop + 10} rx={11} fill={SKIN} />
      <rect x={114} y={torsoTop + 8} width={22} height={torsoBottom - torsoTop + 10} rx={11} fill={SKIN} />
      {/* torso */}
      <rect x={34} y={torsoTop} width={82} height={torsoBottom - torsoTop} rx={24} fill={p.shirt} />
      {/* head */}
      <circle cx={75} cy={40} r={30} fill={SKIN} />
      {has('cap') && <path d="M45 34 Q75 2 105 34 L118 36 L105 40 L45 40 Z" fill="#2a2d3a" />}
      {has('headphones') && (
        <>
          <path d="M44 42 Q44 4 75 4 Q106 4 106 42" fill="none" stroke="#e4e4e7" strokeWidth={6} />
          <rect x={38} y={34} width={12} height={22} rx={5} fill="#e4e4e7" />
          <rect x={100} y={34} width={12} height={22} rx={5} fill="#e4e4e7" />
        </>
      )}
      {has('towel') && <path d="M44 80 Q60 120 52 170 L68 168 Q72 118 64 78 Z" fill="#d4d4d8" />}
      {has('band') && <rect x={12} y={torsoBottom + 4} width={26} height={12} rx={4} fill="#f85149" />}
      {has('shaker') && (
        <>
          <rect x={116} y={torsoBottom - 4} width={26} height={54} rx={6} fill="#3a3a44" />
          <rect x={116} y={torsoBottom - 14} width={26} height={12} rx={3} fill="#1b17ff" />
        </>
      )}
      {has('bag') && <rect x={0} y={torsoBottom + 20} width={46} height={64} rx={10} fill="#33333c" stroke="#55555c" strokeWidth={2} />}
    </svg>
  )
}
