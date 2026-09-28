import type { Layout } from './layout'

/** Members-table geometry, shared by the squares (which become rows) and the chrome. */
export function tableGeometry(L: Layout) {
  const { panel, portrait } = L
  const pad = portrait ? 32 : 24
  const tilesH = portrait ? 150 : 104
  const headerH = portrait ? 48 : 36
  const rowH = portrait ? 56 : 40
  const rowGap = portrait ? 6 : 4
  const tilesY = panel.y + pad
  const headerY = tilesY + tilesH + (portrait ? 32 : 20)
  const rowsY = headerY + headerH
  const rowsBottom = panel.y + panel.h - pad
  const visible = Math.floor((rowsBottom - rowsY + rowGap) / (rowH + rowGap))
  const rowX = panel.x + pad
  const rowW = panel.w - pad * 2
  const rowRect = (i: number) => ({
    x: rowX,
    y: rowsY + Math.min(i, visible) * (rowH + rowGap),
    w: rowW,
    h: rowH,
  })
  return { pad, tilesH, tilesY, headerY, headerH, rowsY, rowH, rowGap, visible, rowX, rowW, rowRect }
}
