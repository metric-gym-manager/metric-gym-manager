import { render, screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DataTable, type DataTableColumn } from '../primitives/DataTable'

interface Member {
  id: string
  name: string
  amount: number
}

const data: Member[] = [
  { id: '1', name: 'Nimal', amount: 4990 },
  { id: '2', name: 'Sara', amount: 12500 },
  { id: '3', name: 'Amal', amount: 2000 },
]

const columns: DataTableColumn<Member>[] = [
  { id: 'name', header: 'Name', sortValue: (r) => r.name },
  {
    id: 'amount',
    header: 'Amount',
    numeric: true,
    sortValue: (r) => r.amount,
    cell: (r) => r.amount,
  },
]

function bodyNames(): string[] {
  const rows = within(screen.getByRole('table')).getAllByRole('row')
  // row 0 is the header
  return rows
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0].textContent ?? '')
}

describe('DataTable', () => {
  it('renders rows for the data (happy path)', () => {
    render(<DataTable columns={columns} data={data} getRowId={(r) => r.id} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(bodyNames()).toEqual(['Nimal', 'Sara', 'Amal'])
  })

  it('sorts ascending then descending when a header is clicked', () => {
    render(<DataTable columns={columns} data={data} getRowId={(r) => r.id} />)
    const header = screen.getByRole('button', { name: /Name/ })
    fireEvent.click(header) // asc
    expect(bodyNames()).toEqual(['Amal', 'Nimal', 'Sara'])
    fireEvent.click(header) // desc
    expect(bodyNames()).toEqual(['Sara', 'Nimal', 'Amal'])
  })

  it('filters via the built-in search box', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowId={(r) => r.id}
        searchable
      />
    )
    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'sara' },
    })
    expect(bodyNames()).toEqual(['Sara'])
  })

  it('supports select-all with a bulk actions bar', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowId={(r) => r.id}
        selectable
        bulkActions={() => <button>Delete</button>}
      />
    )
    fireEvent.click(screen.getByLabelText('Select all rows'))
    expect(screen.getByText('3 selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('paginates client-side', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowId={(r) => r.id}
        pageSize={2}
      />
    )
    expect(bodyNames()).toEqual(['Nimal', 'Sara'])
    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }))
    expect(bodyNames()).toEqual(['Amal'])
  })

  it('shows a skeleton while loading and no data rows', () => {
    render(
      <DataTable columns={columns} data={data} getRowId={(r) => r.id} loading />
    )
    expect(screen.queryByText('Nimal')).not.toBeInTheDocument()
  })

  it('shows the empty state when there is no data', () => {
    render(<DataTable columns={columns} data={[]} getRowId={(r) => r.id} />)
    expect(screen.getByText('No data yet')).toBeInTheDocument()
  })

  it('shows an error alert when error is provided', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowId={(r) => r.id}
        error="Failed to load"
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load')
  })
})

describe('DataTable column resizing', () => {
  const firstCol = (container: HTMLElement) =>
    container.querySelector('colgroup col') as HTMLTableColElement

  it('renders a keyboard-accessible resize separator for resizable columns', () => {
    const cols: DataTableColumn<Member>[] = [
      { id: 'name', header: 'Name', resizable: true, minWidth: 80 },
      { id: 'amount', header: 'Amount', numeric: true, cell: (r) => r.amount },
    ]
    render(<DataTable columns={cols} data={data} getRowId={(r) => r.id} />)
    const sep = screen.getByRole('separator', { name: /resize name column/i })
    expect(sep).toHaveAttribute('aria-orientation', 'vertical')
    expect(sep).toHaveAttribute('tabindex', '0')
  })

  it('widens a column with the ArrowRight key', () => {
    const cols: DataTableColumn<Member>[] = [
      { id: 'name', header: 'Name', resizable: true, minWidth: 80 },
      { id: 'amount', header: 'Amount', numeric: true, cell: (r) => r.amount },
    ]
    const { container } = render(
      <DataTable columns={cols} data={data} getRowId={(r) => r.id} />
    )
    fireEvent.keyDown(
      screen.getByRole('separator', { name: /resize name column/i }),
      {
        key: 'ArrowRight',
      }
    )
    // measured width is 0 in jsdom → falls back to 160; +8 = 168
    expect(firstCol(container).style.width).toBe('168px')
  })

  it('clamps a column to its minWidth', () => {
    const cols: DataTableColumn<Member>[] = [
      { id: 'name', header: 'Name', resizable: true, minWidth: 160 },
      { id: 'amount', header: 'Amount', numeric: true, cell: (r) => r.amount },
    ]
    const { container } = render(
      <DataTable columns={cols} data={data} getRowId={(r) => r.id} />
    )
    fireEvent.keyDown(
      screen.getByRole('separator', { name: /resize name column/i }),
      {
        key: 'ArrowLeft',
      }
    )
    // 160 − 8 = 152, clamped up to minWidth 160
    expect(firstCol(container).style.width).toBe('160px')
  })

  it('does not render separators when no column is resizable', () => {
    render(<DataTable columns={columns} data={data} getRowId={(r) => r.id} />)
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })
})
