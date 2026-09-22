'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { MoreHorizontal } from 'lucide-react'
import {
  Badge,
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Pagination,
  Select,
  type DataTableColumn,
} from '@/components/ui'
import { PageHeader, SearchBar } from '@/components/common/composites'
import { useViewportTier } from '@/hooks/useViewportTier'
import { useMemberModal } from '@/contexts/member-modal.context'
import { MemberAvatar } from '@/features/members'
import { memberStatusIndicator } from '@/features/members/utils/memberStatusIndicator'
import type {
  MembersListResponse,
  MemberWithDiscount,
} from '@/features/members/types'

const AddMemberModal = dynamic(
  () =>
    import('@/features/members').then((mod) => ({
      default: mod.AddMemberModal,
    })),
  { ssr: false }
)
const BulkAddMemberModal = dynamic(
  () =>
    import('@/features/members').then((mod) => ({
      default: mod.BulkAddMemberModal,
    })),
  { ssr: false }
)
const DayPassModal = dynamic(
  () =>
    import('@/features/members').then((mod) => ({ default: mod.DayPassModal })),
  { ssr: false }
)
const BulkImportGuidanceSheet = dynamic(
  () =>
    import('@/features/members').then((mod) => ({
      default: mod.BulkImportGuidanceSheet,
    })),
  { ssr: false }
)

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PLAN_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  '3-months': '3 Months',
  '6-months': '6 Months',
  annual: 'Annual',
}

const money = (n: number) => n.toLocaleString('en-US')

/**
 * Members — the primary operational screen.
 *
 * Rebuilt onto `DataTable` from a hand-written `mws-table`, which had its own
 * markup, its own button and input classes, and a `<tr onClick>` with no
 * `tabIndex`, no key handler and no role — so opening a member, the main action
 * of the main screen, was mouse-only.
 *
 * Search and pagination stay **server-side**: `DataTable`'s `searchable` and
 * `pageSize` are client-only and would filter or paginate just the 20 rows
 * already loaded. `SearchBar` (debounced) and the `Pagination` primitive are
 * composed around the table instead, which is why the built-in props are unused
 * here rather than switched on.
 */
export default function MembersPageClient() {
  const tier = useViewportTier()
  const { openMember } = useMemberModal()
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkGuidanceOpen, setBulkGuidanceOpen] = useState(false)
  const [dayPassModalOpen, setDayPassModalOpen] = useState(false)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)

  const { data, isLoading, error } = useQuery<MembersListResponse>({
    queryKey: ['members', search, status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.append('search', search)
      if (status !== 'all') params.append('status', status)
      const response = await fetch(`/api/members?${params}`)
      if (!response.ok) throw new Error('Failed to fetch members')
      const result = await response.json()
      return result.data
    },
  })

  const members = data?.members ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  const columns: DataTableColumn<MemberWithDiscount>[] = [
    {
      id: 'name',
      header: 'Name',
      // The avatar is the row's `leading` slot on a phone, so the cell would
      // otherwise render it twice — once beside the name and once in front of
      // it. The desktop branch is the cell this column has always had.
      cell: (m) =>
        tier === 'phone' ? (
          <span className="font-medium">{m.name}</span>
        ) : (
          <div className="flex items-center gap-2">
            <MemberAvatar
              name={m.name}
              photoPath={m.photo_path}
              photoUpdatedAt={m.photo_updated_at}
            />
            <span className="font-medium">{m.name}</span>
          </div>
        ),
    },
    {
      id: 'phone',
      header: 'Phone',
      // Dialable on a phone (§9.4). `data-inline-link` is the probe's
      // explicit opt-in for a text link inside a caption — Phase 0 put it in
      // `INLINE_LINK_ALLOW` naming this exact link — so it is held to the
      // 24 px line box rather than the 44 px control box.
      cell: (m) =>
        tier === 'phone' ? (
          <a
            href={`tel:${m.phone_number}`}
            data-inline-link
            onClick={(e) => e.stopPropagation()}
            // `inline-block leading-6` is the touch target, and both halves
            // are needed. §15.1 holds an inline text link to a 24 px line box
            // (WCAG 2.5.8) and this one measured 13. `leading-6` alone does
            // nothing: line-height sizes the line box of the containing
            // block, while `getBoundingClientRect` on an INLINE element
            // returns a box from the font metrics — so the rect stayed at 13.
            // `inline-block` is what makes the element own its height.
            className="inline-block leading-6 text-ink-secondary underline-offset-2 hover:underline"
          >
            {m.phone_number}
          </a>
        ) : (
          <span className="font-mono text-mono-md text-ink-secondary">
            {m.phone_number}
          </span>
        ),
    },
    {
      id: 'plan',
      header: 'Plan',
      cell: (m) => (
        <span className="text-ink-secondary">
          {PLAN_LABEL[m.plan_type] ?? m.plan_type}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (m) => {
        const { variant, label } = memberStatusIndicator(
          m.status,
          m.next_due_date
        )
        return <Badge variant={variant}>{label}</Badge>
      },
    },
    {
      id: 'joined',
      header: 'Joined',
      cell: (m) => (
        <span className="font-mono text-mono-md text-ink-muted">
          {m.membership_start_date}
        </span>
      ),
    },
    {
      id: 'due',
      header: 'Next due',
      cell: (m) => {
        const { variant } = memberStatusIndicator(m.status, m.next_due_date)
        return (
          <span
            className={
              variant === 'error'
                ? 'font-mono text-mono-md text-error'
                : variant === 'warning'
                  ? 'font-mono text-mono-md text-warning'
                  : 'font-mono text-mono-md text-ink-secondary'
            }
          >
            {m.next_due_date}
          </span>
        )
      },
    },
    {
      id: 'fee',
      header: 'Fee (LKR)',
      numeric: true,
      cell: (m) => money(m.plan_amount),
    },
  ]

  return (
    <div className="flex max-w-app flex-col gap-4">
      {/*
       * The count is in the header on a desktop and in the filter row on a
       * phone — never both. `PageHeader`'s `<h1>` is `phone:sr-only` since
       * Phase 2 but its `actions` slot is not, so passing it on both tiers
       * renders the count TWICE on a phone: once under a hidden heading and
       * once where the plan puts it.
       */}
      <PageHeader
        title="Members"
        actions={
          tier === 'phone' ? undefined : (
            <span className="font-mono text-mono-sm text-ink-muted">
              {totalCount} {totalCount === 1 ? 'record' : 'records'}
            </span>
          )
        }
      />

      {/*
       * Two toolbars, one per tier (plan §8.2, §25.4).
       *
       * A tier-switched TREE rather than a `phone:` reflow of one tree,
       * because the two are not the same controls arranged differently: the
       * phone folds Day pass and Bulk import into an overflow menu and moves
       * the record count down beside the filter, while the desktop keeps all
       * three buttons and the count in the `PageHeader`. `useViewportTier()`
       * chooses which to render and never sizes anything (rule 2.21).
       */}
      {tier === 'phone' ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <SearchBar
              defaultValue={search}
              onSearch={(q) => {
                setSearch(q)
                setPage(1)
              }}
              placeholder="Search by name or phone"
              aria-label="Search members"
              // `max-w-none` is load-bearing: `SearchBar` wraps itself in a
              // hardcoded `w-full max-w-[220px]`, so `flex-1` alone leaves the
              // field capped at 220 px and the row — field + Add + ⋯ — wider
              // than a 320 px screen. Same trap as the `Select` wrapper noted
              // in the desktop branch below, one composite along.
              className="min-w-0 max-w-none flex-1"
            />
            <Button size="md" onClick={() => setAddModalOpen(true)}>
              Add
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="More member actions"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent theme="dark" align="end">
                <DropdownMenuItem onSelect={() => setDayPassModalOpen(true)}>
                  Create day pass
                </DropdownMenuItem>
                {/* §14: the phone gets the guidance sheet, not the grid.
                    The sheet's own button opens the grid for anyone who
                    wants it anyway. */}
                <DropdownMenuItem onSelect={() => setBulkGuidanceOpen(true)}>
                  Bulk import
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Select
                value={status}
                aria-label="Filter by status"
                onChange={(e) => {
                  setStatus(e.target.value)
                  setPage(1)
                }}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            {/* The count lives in `PageHeader` on a desktop, and that header's
                title is `phone:sr-only` (Phase 2) — so on a phone it needs a
                home in the content. */}
            <span className="shrink-0 font-mono text-mono-sm text-ink-muted">
              {totalCount} {totalCount === 1 ? 'record' : 'records'}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <SearchBar
            defaultValue={search}
            onSearch={(q) => {
              setSearch(q)
              setPage(1)
            }}
            placeholder="Search by name or phone"
            aria-label="Search members"
            className="w-56"
          />
          {/* Select renders itself inside a hardcoded `w-full` wrapper, so a
              width passed via className lands on the inner <select> while the
              wrapper still claims the whole flex line — which pushed the filter
              and the actions onto separate rows. Size the container instead. */}
          <div className="w-44">
            <Select
              value={status}
              aria-label="Filter by status"
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => setDayPassModalOpen(true)}
            >
              Create day pass
            </Button>
            <Button variant="secondary" onClick={() => setBulkModalOpen(true)}>
              Bulk import
            </Button>
            <Button onClick={() => setAddModalOpen(true)}>Add member</Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={members}
        getRowId={(m) => m.id}
        caption="Members"
        onRowClick={(m) => openMember(m.id)}
        loading={isLoading}
        error={error ? 'Failed to load members.' : undefined}
        empty="No members match your search."
        stickyHeader
        // §9.4 for Members: name, status + due, plan and fee are visible;
        // the phone number is disclosed on the second line. `joined` and the
        // member number are deliberately NOT here — both live in the detail,
        // which is the "listed home" §9.4 requires before a column may leave
        // the row.
        mobileRow={{
          primary: 'name',
          status: ['status', 'due'],
          meta: ['phone', 'plan'],
          value: 'fee',
          leading: (m) => (
            <MemberAvatar
              name={m.name}
              photoPath={m.photo_path}
              photoUpdatedAt={m.photo_updated_at}
            />
          ),
        }}
      />

      <Pagination
        page={page}
        pageCount={totalPages}
        onPageChange={setPage}
        responsive
        className="justify-end"
      />

      <AddMemberModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />
      <BulkAddMemberModal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
      />
      <BulkImportGuidanceSheet
        open={bulkGuidanceOpen}
        onOpenChange={setBulkGuidanceOpen}
        onOpenGrid={() => setBulkModalOpen(true)}
      />
      <DayPassModal
        open={dayPassModalOpen}
        onClose={() => setDayPassModalOpen(false)}
      />
    </div>
  )
}
