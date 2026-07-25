'use client'

import * as React from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui'

/**
 * SearchBar — debounced search input (Layer 3 composite; spec §12 debounced 300ms,
 * §11 Search Input). Uncontrolled text with a debounced `onSearch` callback; shows
 * a clear button when non-empty. Does not fire on initial mount.
 */
export interface SearchBarProps {
  defaultValue?: string
  onSearch: (query: string) => void
  debounceMs?: number
  placeholder?: string
  className?: string
  'aria-label'?: string
}

export function SearchBar({
  defaultValue = '',
  onSearch,
  debounceMs = 300,
  placeholder = 'Search…',
  className,
  'aria-label': ariaLabel = 'Search',
}: SearchBarProps) {
  const [text, setText] = React.useState(defaultValue)

  // Keep the latest callback without restarting the debounce timer.
  const onSearchRef = React.useRef(onSearch)
  React.useEffect(() => {
    onSearchRef.current = onSearch
  }, [onSearch])

  const firstRun = React.useRef(true)
  React.useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    const t = setTimeout(() => onSearchRef.current(text), debounceMs)
    return () => clearTimeout(t)
  }, [text, debounceMs])

  return (
    <div className={cn('w-full max-w-[220px]', className)}>
      <Input
        aria-label={ariaLabel}
        leftIcon={<Search />}
        rightIcon={
          text ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setText('')}
              className="rounded-sm text-ink-muted transition-colors duration-fast hover:text-ink focus-visible:shadow-focus focus-visible:outline-none"
            >
              <X className="size-3.5" />
            </button>
          ) : undefined
        }
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </div>
  )
}
