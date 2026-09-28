import { useVideoConfig } from 'remotion'

export interface Layout {
  w: number
  h: number
  portrait: boolean
  /** Type scale multiplier. */
  s: number
  cell: number
  gap: number
  gridX: number
  gridY: number
  gridSize: number
  hookY: number
  counterY: number
  /** Members table panel. */
  panel: { x: number; y: number; w: number; h: number }
}

export function useLayout(): Layout {
  const { width: w, height: h } = useVideoConfig()
  const portrait = h > w
  const cell = portrait ? 72 : 58
  const gap = portrait ? 12 : 10
  const gridSize = cell * 10 + gap * 9
  const gridX = (w - gridSize) / 2
  const gridY = portrait ? 540 : 150
  const s = portrait ? 1 : 0.78
  const panel = portrait
    ? { x: 60, y: 260, w: w - 120, h: 1400 }
    : { x: 260, y: 90, w: w - 520, h: 900 }
  return {
    w, h, portrait, s, cell, gap, gridX, gridY, gridSize,
    hookY: portrait ? 330 : 36,
    counterY: gridY + gridSize + (portrait ? 110 : 40),
    panel,
  }
}

export function cellRect(L: Layout, row: number, col: number) {
  return { x: L.gridX + col * (L.cell + L.gap), y: L.gridY + row * (L.cell + L.gap), w: L.cell, h: L.cell }
}
