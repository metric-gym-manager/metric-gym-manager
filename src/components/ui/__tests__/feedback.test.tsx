import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Badge } from '../primitives/Badge'
import { Avatar, getInitials } from '../primitives/Avatar'
import { EmptyState } from '../primitives/EmptyState'
import { Alert } from '../primitives/Alert'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../primitives/Table'

describe('Badge', () => {
  it('renders the success variant with a status dot', () => {
    render(
      <Badge variant="success" dot>
        Active
      </Badge>
    )
    const badge = screen.getByText('Active')
    expect(badge).toHaveClass('text-success')
  })

  // Directive §5.7 — status is a signal, not a decorated chip.
  it('shows the dot automatically for a coloured variant', () => {
    render(<Badge variant="error">Expired</Badge>)
    expect(
      screen.getByText('Expired').querySelector('[aria-hidden="true"]')
    ).toBeInTheDocument()
  })

  it('carries no fill or border by default', () => {
    render(<Badge variant="warning">Due</Badge>)
    const badge = screen.getByText('Due')
    expect(badge.className).not.toMatch(/\bbg-/)
    expect(badge.className).not.toMatch(/\bborder\b/)
  })

  it('never conveys status by colour alone — the dot is decorative only', () => {
    render(<Badge variant="success">Paid</Badge>)
    // The label carries the meaning; the dot is aria-hidden so a screen reader
    // reads "Paid", not a colour.
    expect(screen.getByText('Paid')).toHaveTextContent('Paid')
    expect(
      screen.getByText('Paid').querySelector('[aria-hidden="true"]')
    ).toHaveAttribute('aria-hidden', 'true')
  })

  it('restores a bordered container only when explicitly asked', () => {
    render(
      <Badge variant="neutral" chip>
        Draft
      </Badge>
    )
    expect(screen.getByText('Draft').className).toMatch(/\bborder\b/)
  })

  it('omits the dot for the neutral variant, which labels non-status metadata', () => {
    render(<Badge variant="neutral">Monthly</Badge>)
    expect(
      screen.getByText('Monthly').querySelector('[aria-hidden="true"]')
    ).toBeNull()
  })
})

describe('Avatar', () => {
  it('derives up to two uppercase initials from a name', () => {
    expect(getInitials('nimal perera')).toBe('NP')
    expect(getInitials('cher')).toBe('C')
  })

  it('exposes an accessible label', () => {
    render(<Avatar name="Nimal Perera" />)
    expect(screen.getByRole('img', { name: 'Nimal Perera' })).toHaveTextContent(
      'NP'
    )
  })
})

describe('EmptyState', () => {
  it('renders title, description and action', () => {
    render(
      <EmptyState
        title="No members yet"
        description="Add your first member to get started."
        action={<button>Add member</button>}
      />
    )
    expect(screen.getByText('No members yet')).toBeInTheDocument()
    expect(
      screen.getByText('Add your first member to get started.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Add member' })
    ).toBeInTheDocument()
  })
})

describe('Alert', () => {
  it('uses role="alert" for the error variant (assertive)', () => {
    render(<Alert variant="error">Something failed</Alert>)
    expect(screen.getByRole('alert')).toHaveTextContent('Something failed')
  })

  it('uses role="status" for non-critical variants (polite)', () => {
    render(<Alert variant="success">Saved</Alert>)
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
  })
})

describe('Table', () => {
  it('renders semantic table structure with a column header', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead numeric>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Nimal</TableCell>
            <TableCell numeric>4,990</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Amount' })).toHaveClass(
      'text-right'
    )
    expect(screen.getByRole('cell', { name: '4,990' })).toHaveClass(
      'tabular-nums'
    )
  })
})
