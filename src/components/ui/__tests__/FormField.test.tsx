import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { FormField } from '../primitives/FormField'
import { Input } from '../primitives/Input'

describe('FormField', () => {
  it('links the label to the control via a generated id (happy path)', () => {
    render(
      <FormField label="Email">
        <Input placeholder="you@example.com" />
      </FormField>
    )
    const input = screen.getByPlaceholderText('you@example.com')
    const label = screen.getByText('Email')
    expect(input).toHaveAttribute('id')
    expect(label).toHaveAttribute('for', input.getAttribute('id')!)
  })

  it('wires aria-invalid and aria-describedby to an error message (validation error)', () => {
    render(
      <FormField label="Email" error="Email is required">
        <Input />
      </FormField>
    )
    const input = screen.getByRole('textbox')
    const error = screen.getByRole('alert')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(error).toHaveTextContent('Email is required')
    expect(input.getAttribute('aria-describedby')).toBe(
      error.getAttribute('id')
    )
  })

  it('describes the field with helper text when there is no error', () => {
    render(
      <FormField label="Password" helperText="12+ chars">
        <Input type="password" />
      </FormField>
    )
    const input = screen.getByLabelText('Password')
    const helper = screen.getByText('12+ chars')
    expect(input.getAttribute('aria-describedby')).toBe(
      helper.getAttribute('id')
    )
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('renders an optional hint on the label', () => {
    render(
      <FormField label="Nickname" optional>
        <Input />
      </FormField>
    )
    expect(screen.getByText('(optional)')).toBeInTheDocument()
  })
})
