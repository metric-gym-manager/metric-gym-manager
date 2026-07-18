'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  UserPlus,
  Ticket,
  CreditCard,
  Megaphone,
  LogOut,
  User,
  type LucideIcon,
} from 'lucide-react'

import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'
import { useCommandPalette } from './command-palette.context'
import { matchesQuery } from './filter'
import { useMemberModal } from '@/contexts/member-modal.context'
import {
  primaryNavigation,
  settingsNavigation,
} from '@/components/layout/navigation'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

/** Shape we rely on from GET /api/members (camelCase preferred, snake_case fallback). */
interface MemberSearchResult {
  id: string
  name: string
  phoneNumber?: string
  phone_number?: string
  status?: string
}

interface QuickAction {
  id: string
  label: string
  icon: LucideIcon
  keywords?: string[]
  run: () => void
}

const MEMBER_SEARCH_MIN_CHARS = 2
const MEMBER_SEARCH_LIMIT = 6

/**
 * Global ⌘K command palette. The single keyboard-first entry point to the
 * app: jump to any page, search live member records, or fire a quick action.
 *
 * Wiring is real, not mocked:
 * - Navigation is driven by the shared `primaryNavigation` registry.
 * - Member search hits `GET /api/members?search=` and opens the selected
 *   member through `MemberModalProvider.openMember`.
 * - Quick actions route to the pages that own the real flows (e.g. the Add
 *   Member modal opens via `/members?action=add`).
 *
 * Filtering is handled here (`shouldFilter={false}`) so async member results
 * and static commands coexist predictably.
 */
export function CommandPalette() {
  const { open, setOpen } = useCommandPalette()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { openMember } = useMemberModal()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), 250)
  const memberSearchEnabled =
    open && debouncedSearch.length >= MEMBER_SEARCH_MIN_CHARS

  const { data: members = [], isFetching } = useQuery<MemberSearchResult[]>({
    queryKey: ['command-palette-members', debouncedSearch],
    queryFn: async () => {
      const res = await fetch(
        `/api/members?search=${encodeURIComponent(debouncedSearch)}&limit=${MEMBER_SEARCH_LIMIT}`
      )
      if (!res.ok) return []
      const json = await res.json()
      return (json?.data?.members ?? []) as MemberSearchResult[]
    },
    enabled: memberSearchEnabled,
    staleTime: 30_000,
  })

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (!next) setSearch('')
    },
    [setOpen]
  )

  /** Close the palette, then run the action (so the dialog is gone first). */
  const runCommand = useCallback(
    (fn: () => void) => {
      setOpen(false)
      setSearch('')
      fn()
    },
    [setOpen]
  )

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Always clear cache + redirect even if the request fails.
    } finally {
      queryClient.clear()
      router.replace('/login')
    }
  }, [queryClient, router])

  const quickActions: QuickAction[] = [
    {
      id: 'new-member',
      label: 'New Member',
      icon: UserPlus,
      keywords: ['add', 'register', 'create', 'signup'],
      run: () => router.push('/members?action=add'),
    },
    {
      id: 'day-pass',
      label: 'Create Day Pass',
      icon: Ticket,
      keywords: ['drop-in', 'guest', 'visitor'],
      run: () => router.push('/members?action=daypass'),
    },
    {
      id: 'collect-fee',
      label: 'Collect a Fee',
      icon: CreditCard,
      keywords: ['payment', 'pay', 'dues', 'collection'],
      run: () => router.push('/payment-collection'),
    },
    {
      id: 'announcement',
      label: 'Make an Announcement',
      icon: Megaphone,
      keywords: ['broadcast', 'sms', 'notify', 'message'],
      run: () => router.push('/make-announcement'),
    },
    {
      id: 'logout',
      label: 'Log Out',
      icon: LogOut,
      keywords: ['sign out', 'exit'],
      run: handleLogout,
    },
  ]

  const actionMatches = quickActions.filter((a) =>
    matchesQuery(search, a.label, a.keywords)
  )
  const navMatches = primaryNavigation.filter((i) =>
    matchesQuery(search, i.name, i.keywords)
  )
  const settingsMatches = settingsNavigation.filter((i) =>
    matchesQuery(search, i.name, i.keywords)
  )

  const showMemberLoading =
    memberSearchEnabled && isFetching && members.length === 0
  const hasStaticResults =
    actionMatches.length + navMatches.length + settingsMatches.length > 0
  const showEmpty =
    !hasStaticResults && members.length === 0 && !showMemberLoading

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder="Search pages, members, or actions…"
      />
      <CommandList>
        {showEmpty && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No results found.
          </div>
        )}

        {members.length > 0 && (
          <CommandGroup heading="Members">
            {members.map((member) => (
              <CommandItem
                key={member.id}
                value={`member-${member.id}`}
                onSelect={() => runCommand(() => openMember(member.id))}
              >
                <User />
                <span className="truncate">{member.name}</span>
                {(member.phoneNumber ?? member.phone_number) && (
                  <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                    {member.phoneNumber ?? member.phone_number}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showMemberLoading && (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching members…
          </div>
        )}

        {actionMatches.length > 0 && (
          <CommandGroup heading="Quick Actions">
            {actionMatches.map((action) => {
              const Icon = action.icon
              return (
                <CommandItem
                  key={action.id}
                  value={`action-${action.id}`}
                  onSelect={() => runCommand(action.run)}
                >
                  <Icon />
                  <span>{action.label}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {navMatches.length > 0 && (
          <CommandGroup heading="Navigation">
            {navMatches.map((item) => {
              const Icon = item.icon
              return (
                <CommandItem
                  key={item.href}
                  value={`nav-${item.href}`}
                  onSelect={() => runCommand(() => router.push(item.href))}
                >
                  <Icon />
                  <span>{item.name}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {settingsMatches.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Settings">
              {settingsMatches.map((item) => {
                const Icon = item.icon
                return (
                  <CommandItem
                    key={item.href}
                    value={`settings-${item.href}`}
                    onSelect={() => runCommand(() => router.push(item.href))}
                  >
                    <Icon />
                    <span>{item.name}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>

      {/* Keyboard hint bar — the "surgical tool" affordance. */}
      <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 font-mono">↑</kbd>
            <kbd className="rounded border bg-muted px-1 font-mono">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 font-mono">↵</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 font-mono">esc</kbd>
            close
          </span>
        </div>
        <span className="font-mono tracking-wider">Metric ⌘K</span>
      </div>
    </CommandDialog>
  )
}
