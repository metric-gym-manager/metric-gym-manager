import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StatCard } from '../StatCard'

/**
 * `StatCard` value wrapping (mobile rebuild plan §27 "Large money").
 *
 * jsdom applies no stylesheet and computes no geometry, so this cannot prove
 * that `99,999,999` wraps — only that the composite still asks for it. The
 * measurement is the probe's: at 320 the figure is 144 px in a 111 px tile,
 * and without this class the page overflowed by a pixel and mobile Chromium
 * zoomed the whole layout out to 321 (F5). Both KPI bands failed that way on
 * the §28 fixture before the class went in.
 */
describe('StatCard', () => {
  it('lets a long readout wrap inside its tile', () => {
    render(<StatCard label="Collected" value="99,999,999" />)
    expect(screen.getByText('99,999,999').className).toContain('break-words')
  })

  it('keeps the mono tabular readout it has always had', () => {
    render(<StatCard label="Collected" value="126,200" />)
    const value = screen.getByText('126,200').className
    expect(value).toContain('font-mono')
    expect(value).toContain('tabular-nums')
  })
})
