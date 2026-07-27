import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Button } from '../primitives/Button'

describe('Button', () => {
  it('renders a button with its label (happy path)', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('defaults to type="button" to avoid accidental form submits', () => {
    render(<Button>Go</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('applies the accent variant token classes', () => {
    render(<Button variant="accent">Create</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-accentui')
  })

  it('fires onClick when enabled', () => {
    const onClick = jest.fn()
    render(<Button onClick={onClick}>Click</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClick when disabled (edge case)', () => {
    const onClick = jest.fn()
    render(
      <Button disabled onClick={onClick}>
        Click
      </Button>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows a spinner and blocks interaction while loading', () => {
    const onClick = jest.fn()
    render(
      <Button loading onClick={onClick}>
        Submit
      </Button>
    )
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toBeInTheDocument()
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('supports asChild to render a link with button styles', () => {
    render(
      <Button asChild variant="link">
        <a href="/members">Members</a>
      </Button>
    )
    const link = screen.getByRole('link', { name: 'Members' })
    expect(link).toHaveAttribute('href', '/members')
    expect(link).toHaveClass('text-brand-link')
  })
})
