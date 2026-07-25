'use client'

import * as React from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Avatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui'

/**
 * UserMenu — avatar trigger opening an account dropdown (Layer 3 composite; spec
 * §11 App Shell). Pass extra `children` menu items; `onSignOut` renders a sign-out
 * item. `compact` shows only the avatar (e.g. a collapsed sidebar).
 */
export interface UserMenuProps {
  name: string
  email?: string
  avatarSrc?: string
  compact?: boolean
  onSignOut?: () => void
  theme?: 'light' | 'dark'
  children?: React.ReactNode
  className?: string
}

export function UserMenu({
  name,
  email,
  avatarSrc,
  compact,
  onSignOut,
  theme,
  children,
  className,
}: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 rounded-md p-1 font-geist text-body text-ink transition-colors duration-fast hover:bg-surface-active focus-visible:shadow-focus focus-visible:outline-none',
            className
          )}
        >
          <Avatar size="sm" name={name} src={avatarSrc} />
          {!compact && (
            <>
              <span className="flex min-w-0 flex-col text-left leading-tight">
                <span className="truncate text-body font-medium">{name}</span>
                {email && (
                  <span className="truncate text-caption text-ink-muted">
                    {email}
                  </span>
                )}
              </span>
              <ChevronDown
                className="size-3.5 shrink-0 text-ink-muted"
                aria-hidden="true"
              />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent theme={theme} align="end" className="min-w-[12rem]">
        <DropdownMenuLabel>
          <span className="block truncate normal-case tracking-normal text-body font-medium text-ink">
            {name}
          </span>
          {email && (
            <span className="block truncate font-mono text-mono-sm normal-case tracking-normal text-ink-muted">
              {email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {children}
        {onSignOut && (
          <>
            {children && <DropdownMenuSeparator />}
            <DropdownMenuItem destructive onSelect={onSignOut}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
