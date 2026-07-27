import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label, HelperText } from './Label'

/**
 * FormField — composes a Label, a control, and helper/validation text with all
 * the ARIA wiring done for you (spec §8 Accessibility, §13 Form Validation).
 *
 * It clones its single child control to inject `id`, `aria-invalid`, and
 * `aria-describedby`, so any input primitive drops in without manual plumbing:
 *
 * ```tsx
 * <FormField label="Email" error={errors.email} helperText="We never share it.">
 *   <Input type="email" />
 * </FormField>
 * ```
 *
 * Error text takes precedence over helper text and is announced politely.
 */
export interface FormFieldProps {
  label?: React.ReactNode
  /** Override the generated control id. */
  htmlFor?: string
  helperText?: React.ReactNode
  error?: React.ReactNode
  optional?: boolean
  className?: string
  children: React.ReactElement
}

export function FormField({
  label,
  htmlFor,
  helperText,
  error,
  optional,
  className,
  children,
}: FormFieldProps) {
  const reactId = React.useId()
  const child = children as React.ReactElement<Record<string, unknown>>
  const controlId = htmlFor ?? (child.props.id as string | undefined) ?? reactId
  const describedById = error
    ? `${controlId}-error`
    : helperText
      ? `${controlId}-helper`
      : undefined

  const control = React.cloneElement(child, {
    id: controlId,
    'aria-invalid': error ? true : child.props['aria-invalid'],
    'aria-describedby':
      cn(
        child.props['aria-describedby'] as string | undefined,
        describedById
      ) || undefined,
  })

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <Label htmlFor={controlId} optional={optional}>
          {label}
        </Label>
      )}
      {control}
      {error ? (
        <HelperText
          id={`${controlId}-error`}
          tone="error"
          role="alert"
          aria-live="polite"
        >
          {error}
        </HelperText>
      ) : helperText ? (
        <HelperText id={`${controlId}-helper`}>{helperText}</HelperText>
      ) : null}
    </div>
  )
}
