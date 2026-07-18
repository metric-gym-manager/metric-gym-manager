'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

interface CommandPaletteContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  openPalette: () => void
  closePalette: () => void
  toggle: () => void
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null
)

/**
 * Access the command-palette open state. Must be called from inside
 * {@link CommandPaletteProvider} (mounted in the dashboard layout).
 */
export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) {
    throw new Error(
      'useCommandPalette must be used within a CommandPaletteProvider'
    )
  }
  return ctx
}

/**
 * Holds the palette's open state and installs the global ⌘K / Ctrl+K
 * shortcut. Kept above both the trigger (Header) and the palette dialog so
 * either can drive it. The shortcut calls preventDefault so it wins over the
 * browser's built-in Cmd+K.
 */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  const toggle = useCallback(() => setOpen((prev) => !prev), [])
  const openPalette = useCallback(() => setOpen(true), [])
  const closePalette = useCallback(() => setOpen(false), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        toggle()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [toggle])

  const value = useMemo(
    () => ({ open, setOpen, openPalette, closePalette, toggle }),
    [open, openPalette, closePalette, toggle]
  )

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
    </CommandPaletteContext.Provider>
  )
}
