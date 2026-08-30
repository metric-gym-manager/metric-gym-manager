'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import {
  Badge,
  Button,
  DataTable,
  Pagination,
  Select,
  type DataTableColumn,
} from '@/components/ui'
import { PageHeader, SearchBar } from '@/components/common/composites'
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
  const { openMember } = useMemberModal()
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
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
      cell: (m) => (
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
      cell: (m) => (
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
      <PageHeader
        title="Members"
        actions={
          <span className="font-mono text-mono-sm text-ink-muted">
            {totalCount} {totalCount === 1 ? 'record' : 'records'}
          </span>
        }
      />

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
          <Button variant="secondary" onClick={() => setDayPassModalOpen(true)}>
            Create day pass
          </Button>
          <Button variant="secondary" onClick={() => setBulkModalOpen(true)}>
            Bulk import
          </Button>
          <Button onClick={() => setAddModalOpen(true)}>Add member</Button>
        </div>
      </div>

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
      />

      <Pagination
        page={page}
        pageCount={totalPages}
        onPageChange={setPage}
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
      <DayPassModal
        open={dayPassModalOpen}
        onClose={() => setDayPassModalOpen(false)}
      />
    </div>
  )
}
