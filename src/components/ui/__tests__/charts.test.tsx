import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LineChart, BarChart, Sparkline } from '../primitives/Charts'

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
