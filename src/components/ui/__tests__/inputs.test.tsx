import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Input } from '../primitives/Input'
import { Select } from '../primitives/Select'
import { Checkbox } from '../primitives/Checkbox'
import { Switch } from '../primitives/Switch'

describe('Input', () => {
  it('sets aria-invalid when error is passed', () => {
    render(<Input error aria-label="amount" />)
    expect(screen.getByLabelText('amount')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
  })

  it('renders a leading icon adornment without breaking the field', () => {
    render(<Input aria-label="search" leftIcon={<svg data-testid="icon" />} />)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByLabelText('search')).toHaveClass('pl-8')
  })
})

describe('Select', () => {
  it('renders native options and is keyboard-focusable', () => {
    render(
      <Select aria-label="plan" defaultValue="pro">
        <option value="lite">Lite</option>
        <option value="pro">Pro</option>
      </Select>
    )
    const select = screen.getByLabelText('plan') as HTMLSelectElement
    expect(select.value).toBe('pro')
    expect(screen.getByRole('option', { name: 'Lite' })).toBeInTheDocument()
  })
})

describe('Checkbox', () => {
  it('reflects the indeterminate state on the DOM node (edge case)', () => {
    render(<Checkbox aria-label="all" indeterminate />)
    const box = screen.getByLabelText('all') as HTMLInputElement
    expect(box.indeterminate).toBe(true)
  })

  it('wraps a clickable label when label is provided', () => {
    render(<Checkbox label="Accept" />)
    expect(screen.getByLabelText('Accept')).toBeInTheDocument()
  })
})

describe('Switch', () => {
  it('toggles aria-checked when uncontrolled', () => {
    render(<Switch aria-label="reminders" />)
    const sw = screen.getByRole('switch')
    expect(sw).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(sw)
    expect(sw).toHaveAttribute('aria-checked', 'true')
  })

  it('respects the controlled value and calls onCheckedChange', () => {
    const onCheckedChange = jest.fn()
    render(
      <Switch
        aria-label="sms"
        checked={false}
        onCheckedChange={onCheckedChange}
      />
    )
    const sw = screen.getByRole('switch')
    fireEvent.click(sw)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
    // Controlled: stays false until parent updates the prop.
    expect(sw).toHaveAttribute('aria-checked', 'false')
  })

  it('does not toggle when disabled', () => {
    const onCheckedChange = jest.fn()
    render(<Switch aria-label="x" disabled onCheckedChange={onCheckedChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onCheckedChange).not.toHaveBeenCalled()
  })
})
