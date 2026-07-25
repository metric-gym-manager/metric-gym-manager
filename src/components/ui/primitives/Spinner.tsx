import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Spinner — indeterminate loading indicator (spec §11 Loading Behavior).
 * Inherits `currentColor`, so it adopts the color of whatever context it sits in
 * (e.g. inside a Button). Respects `prefers-reduced-motion` via the global rule
 * in globals.css.
 */
const sizeMap = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
  xl: 'h-[26px] w-[26px]',
} as const

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: keyof typeof sizeMap
  /** Accessible label announced to screen readers. */
  label?: string
}

export function Spinner({
  size = 'md',
  label = 'Loading',
  className,
  ...props
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('inline-flex text-current', className)}
      {...props}
    >
      <svg
        className={cn('animate-spin', sizeMap[size])}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="2.4"
          className="opacity-25"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}
