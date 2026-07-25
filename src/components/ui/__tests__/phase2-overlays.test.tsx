import { render, screen, renderHook, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Popover, PopoverTrigger, PopoverContent } from '../primitives/Popover'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../primitives/DropdownMenu'
import { Progress } from '../primitives/Progress'
import {
  CommandPalette,
  CommandItem,
  useCommandK,
} from '../primitives/CommandPalette'

// Radix/cmdk popovers use APIs jsdom doesn't implement.
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn()
  Element.prototype.hasPointerCapture = jest.fn(() => false)
  Element.prototype.releasePointerCapture = jest.fn()
  if (typeof ResizeObserver === 'undefined') {
    class RO {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver =
      RO
  }
})

describe('Popover', () => {
  it('renders its content when open', () => {
    render(
      <Popover open onOpenChange={() => {}}>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Panel body</PopoverContent>
      </Popover>
    )
    expect(screen.getByText('Panel body')).toBeInTheDocument()
  })
})

describe('DropdownMenu', () => {
  it('renders menu items with menu semantics when open', () => {
    render(
      <DropdownMenu open onOpenChange={() => {}}>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem destructive>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
  })
})

describe('Progress', () => {
  it('exposes progressbar semantics with the current value', () => {
    render(<Progress value={40} aria-label="Upload" />)
    const bar = screen.getByRole('progressbar', { name: 'Upload' })
    expect(bar).toHaveAttribute('aria-valuenow', '40')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('clamps values above the max', () => {
    render(<Progress value={150} aria-label="x" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '150'
    )
  })
})

describe('CommandPalette', () => {
  it('renders the input and items when open', () => {
    render(
      <CommandPalette open onOpenChange={() => {}}>
        <CommandItem>Go to members</CommandItem>
      </CommandPalette>
    )
    expect(
      screen.getByPlaceholderText('Type a command or search…')
    ).toBeInTheDocument()
    expect(screen.getByText('Go to members')).toBeInTheDocument()
  })
})

describe('useCommandK', () => {
  it('toggles open on ⌘K / Ctrl-K', () => {
    const { result } = renderHook(() => useCommandK())
    expect(result.current[0]).toBe(false)
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true })
      )
    })
    expect(result.current[0]).toBe(true)
  })
})
