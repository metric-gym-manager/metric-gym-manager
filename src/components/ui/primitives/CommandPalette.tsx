'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Command as CommandPrimitive } from 'cmdk'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * CommandPalette — global ⌘K command menu (spec §11 Command Palette). Radix Dialog
 * (focus trap, Escape, backdrop) hosting a cmdk command list (fuzzy filter,
 * arrow-key navigation). Top-center, 520px, `palIn` animation.
 *
 * ```tsx
 * const [open, setOpen] = useCommandK()
 * <CommandPalette open={open} onOpenChange={setOpen}>
 *   <CommandGroup heading="Members">
 *     <CommandItem onSelect={() => go('/members')}>Go to members</CommandItem>
 *   </CommandGroup>
 *   <CommandEmpty>No results.</CommandEmpty>
 * </CommandPalette>
 * ```
 */

/** Wires the global ⌘K / Ctrl-K shortcut to toggle the palette. */
export function useCommandK(
  initial = false
): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const [open, setOpen] = React.useState(initial)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  return [open, setOpen]
}

export interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  placeholder?: string
  label?: string
  theme?: 'light' | 'dark'
  className?: string
  children: React.ReactNode
}

export function CommandPalette({
  open,
  onOpenChange,
  placeholder = 'Type a command or search…',
  label = 'Command palette',
  theme,
  className,
  children,
}: CommandPaletteProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-theme={theme}
          className="fixed inset-0 z-palette-backdrop bg-surface-overlay"
        />
        <Dialog.Content
          data-theme={theme}
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-24 z-palette w-[520px] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-sm border border-line-2 bg-surface-card font-geist text-ink shadow-overlay animate-pal-in focus:outline-none',
            className
          )}
        >
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          <CommandPrimitive loop className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-line-1 px-3">
              <Search
                aria-hidden="true"
                className="size-3.5 shrink-0 text-ink-muted"
              />
              <CommandPrimitive.Input
                placeholder={placeholder}
                className="h-11 w-full bg-transparent font-geist text-body text-ink placeholder:text-ink-muted focus:outline-none"
              />
            </div>
            <CommandPrimitive.List className="max-h-[280px] overflow-y-auto p-1">
              {children}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className={cn('px-3 py-6 text-center text-body text-ink-muted', className)}
    {...props}
  />
))
CommandEmpty.displayName = 'CommandEmpty'

export const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      'overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-metadata [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-ink-muted',
      className
    )}
    {...props}
  />
))
CommandGroup.displayName = 'CommandGroup'

export const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      'flex cursor-pointer select-none items-center gap-2 rounded-sm px-3 py-2 text-body text-ink outline-none transition-colors duration-fast data-[selected=true]:bg-surface-hover data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-ink-muted',
      className
    )}
    {...props}
  />
))
CommandItem.displayName = 'CommandItem'

export const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-line-1', className)}
    {...props}
  />
))
CommandSeparator.displayName = 'CommandSeparator'
