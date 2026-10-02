import React from 'react'
import { C } from './theme'

/** An abstract member avatar: never a real face. */
export const Avatar: React.FC<{ size: number; hue?: string }> = ({ size, hue = C.accentDefault }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
    <circle cx="50" cy="50" r="50" fill={hue} opacity={0.35} />
    <circle cx="50" cy="40" r="17" fill={C.textPrimary} opacity={0.85} />
    <path d="M18 88 C24 64 76 64 82 88 Z" fill={C.textPrimary} opacity={0.85} />
  </svg>
)
