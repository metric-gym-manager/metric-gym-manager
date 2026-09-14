import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import {
  LineChart,
  BarChart,
  Sparkline,
  compactAxisTick,
  resolveYTickFormatter,
} from '../primitives/Charts'

const series = [{ key: 'revenue', label: 'Revenue' }]
const data = [
  { month: 'Jan', revenue: 100 },
  { month: 'Feb', revenue: 140 },
]

describe('Charts', () => {
  it('shows an empty state when there is no data', () => {
    render(
      <LineChart label="Revenue trend" data={[]} xKey="month" series={series} />
    )
    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  it('shows a loading skeleton', () => {
    render(
      <LineChart
        label="Revenue trend"
        data={data}
        xKey="month"
        series={series}
        loading
      />
    )
    expect(screen.getByLabelText('Revenue trend loading')).toBeInTheDocument()
  })

  it('renders an accessible chart region with a label', () => {
    render(
      <BarChart
        label="Monthly revenue"
        data={data}
        xKey="month"
        series={series}
      />
    )
    expect(
      screen.getByRole('img', { name: 'Monthly revenue' })
    ).toBeInTheDocument()
  })

  it('renders nothing for an empty sparkline', () => {
    const { container } = render(<Sparkline data={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

/**
 * `compactAxis` (mobile rebuild plan §5.9; finding F1).
 *
 * The defect: `YAxis width={40}` with `margin.left: -8` leaves ~32 px for a
 * tick label, which holds five characters at the 10 px mono tick size. The
 * dashboard and revenue charts carry six- and seven-digit LKR figures, so
 * their axes render `0000 / 5000 / 0000 / 5000 / 0` — text that reads as a
 * number and is not one, at EVERY width, desktop included.
 *
 * jsdom gives recharts no dimensions, so the axis does not render here and
 * these test the formatter, which is where the decision actually lives. The
 * rendered comparison is in the design-system showcase; the clipping itself
 * is the probe's, in a browser.
 */
describe('compactAxisTick', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1k'],
    [35000, '35k'],
    [140000, '140k'],
    [1000000, '1M'],
    [1400000, '1.4M'],
    [12000000, '12M'],
    [2500000000, '2.5B'],
    [-35000, '-35k'],
  ])('formats %p as %p', (input, expected) => {
    expect(compactAxisTick(input)).toBe(expected)
  })

  it('never renders a trailing .0', () => {
    // "12.0M" is one character longer for no information, and the whole point
    // is the character budget.
    expect(compactAxisTick(12_000_000)).toBe('12M')
    expect(compactAxisTick(2_000)).toBe('2k')
  })

  it('keeps every label inside the five characters the axis can show', () => {
    for (const n of [0, 999, 35_000, 140_000, 1_400_000, 999_000_000]) {
      expect(compactAxisTick(n).length).toBeLessThanOrEqual(5)
    }
  })

  it('passes a non-numeric tick through rather than rendering NaN', () => {
    expect(compactAxisTick('Mar')).toBe('Mar')
  })
})

describe('Charts — which formatter the Y axis gets', () => {
  it('formats nothing unless asked, so no existing chart changes', () => {
    // The desktop is not being rebuilt in this phase; an opt-in prop is the
    // only shape that leaves 1366 pixel-equivalent.
    expect(resolveYTickFormatter(undefined, undefined)).toBeUndefined()
    expect(resolveYTickFormatter(undefined, false)).toBeUndefined()
  })

  it('compacts when asked', () => {
    expect(resolveYTickFormatter(undefined, true)?.(35000)).toBe('35k')
  })

  it('lets an explicit formatter win over compactAxis', () => {
    const explicit = (v: number | string) => `LKR ${v}`
    expect(resolveYTickFormatter(explicit, true)?.(35000)).toBe('LKR 35000')
  })

  it('still renders the chart with the props set', () => {
    const { container } = render(
      <LineChart
        label="Revenue trend"
        data={data}
        xKey="month"
        series={series}
        compactAxis
      />
    )
    expect(container.querySelector('[role="img"]')).toBeInTheDocument()
  })
})
