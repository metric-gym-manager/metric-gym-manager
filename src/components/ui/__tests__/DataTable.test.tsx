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
