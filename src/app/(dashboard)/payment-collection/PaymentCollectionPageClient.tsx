'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Badge,
  Button,
  DataTable,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type DataTableColumn,
} from '@/components/ui'
import { PageHeader } from '@/components/common/composites'
import { useMemberModal } from '@/contexts/member-modal.context'
import { MemberAvatar } from '@/features/members'

type Tab = 'expired' | 'due' | 'collected'

interface DueRow {
  id: string
  name: string
  planType: string
  effectiveAmount: number
  nextDueDate: string
  daysUntilDue: number
  photoPath?: string | null
  photoUpdatedAt?: string | null
}
interface RegularPaymentsResponse {
  success: boolean
  data: { payments: DueRow[]; totalCount: number }
}
interface CollectedRow {
  paymentId: string
  memberId: string
  memberName: string
  planType: string
  amountPaid: number
  paymentDate: string
  photoPath?: string | null
  photoUpdatedAt?: string | null
}
interface CollectedResponse {
  payments: CollectedRow[]
  summary: { totalRevenue: number; paymentCount: number }
}

function reminderType(daysUntilDue: number): string {
  if (daysUntilDue < 0) return 'overdue'
  if (daysUntilDue < 1) return 'due_today'
  if (daysUntilDue < 4) return 'reminder_3day'
  return 'reminder_7day'
}

const money = (n: number) => n.toLocaleString('en-US')

/**
 * Renewals — three views (Expired / Expires this week / Collected) over live
 * data. Dues come from /api/regular-payments, collected from
 * /api/payment-collection/collected. "Remind" sends a per-member SMS
 * (POST /api/sms/send); "Record payment" / "Receipt" open the member drawer.
 *
 * Rebuilt onto `Tabs` + `DataTable` from a hand-written `mws-tab` bar over an
 * `mws-table`. The tab bar was three plain buttons, so it had none of the
 * roving focus, arrow-key navigation or `aria-selected` wiring that Radix Tabs
 * provides. Unlike members, all three data sets are fetched whole and filtered
 * in the client, so `DataTable`'s own sorting applies directly.
 */
export default function PaymentCollectionPageClient() {
  const [tab, setTab] = useState<Tab>('expired')
  const { openMember } = useMemberModal()
  const queryClient = useQueryClient()

  const {
    data: dues,
    isLoading: duesLoading,
    error: duesError,
  } = useQuery<RegularPaymentsResponse>({
    queryKey: ['regular-payments', 'all'],
    queryFn: async () => {
      const response = await fetch(
        '/api/regular-payments?filter=all&sortBy=due_date_asc'
      )
      if (!response.ok) throw new Error('Failed to fetch dues')
      return response.json()
    },
  })

  const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const {
    data: collected,
    isLoading: collectedLoading,
    error: collectedError,
  } = useQuery<CollectedResponse>({
    queryKey: ['payment-collection', 'collected', month],
    queryFn: async () => {
      const response = await fetch(
        `/api/payment-collection/collected?month=${month}`
      )
      if (!response.ok) throw new Error('Failed to fetch collected payments')
      const result = await response.json()
      return result.data
    },
  })

  const [pendingId, setPendingId] = useState<string | null>(null)
  const remindMutation = useMutation({
    mutationFn: async ({
      memberId,
      smsType,
    }: {
      memberId: string
      smsType: string
    }) => {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, smsType }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to send reminder')
      }
      return response.json()
    },
    onMutate: ({ memberId }) => setPendingId(memberId),
    onSuccess: () => {
      toast.success('Reminder sent')
      queryClient.invalidateQueries({ queryKey: ['regular-payments'] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Failed to send reminder'),
    onSettled: () => setPendingId(null),
  })

  const allDues = dues?.data.payments ?? []
  const expired = allDues.filter((r) => r.daysUntilDue < 0)
  const dueSoon = allDues.filter(
    (r) => r.daysUntilDue >= 0 && r.daysUntilDue <= 7
  )
  const collectedRows = collected?.payments ?? []

  const memberCell = (
    name: string,
    photoPath?: string | null,
    photoUpdatedAt?: string | null
  ) => (
    <div className="flex items-center gap-2">
      <MemberAvatar
        name={name}
        photoPath={photoPath}
        photoUpdatedAt={photoUpdatedAt}
      />
      <span className="font-medium">{name}</span>
    </div>
  )

  const dueColumns = (
    variant: 'expired' | 'due'
  ): DataTableColumn<DueRow>[] => [
    {
      id: 'member',
      header: 'Member',
      sortValue: (r) => r.name,
      cell: (r) => memberCell(r.name, r.photoPath, r.photoUpdatedAt),
    },
    {
      id: 'when',
      header: variant === 'expired' ? 'Expired' : 'Exp date',
      sortValue: (r) => r.daysUntilDue,
      cell: (r) =>
        variant === 'expired' ? (
          <Badge variant="error">{Math.abs(r.daysUntilDue)} days ago</Badge>
        ) : (
          <span className="font-mono text-mono-md text-warning">
            {r.nextDueDate}
          </span>
        ),
    },
    {
      id: 'amount',
      header: 'Amount (LKR)',
      numeric: true,
      sortValue: (r) => r.effectiveAmount,
      cell: (r) => money(r.effectiveAmount),
    },
    {
      id: 'action',
      header: 'Action',
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (r) => (
        <div className="inline-flex gap-1.5">
          <Button
            size="xs"
            variant="secondary"
            disabled={pendingId === r.id}
            onClick={() =>
              remindMutation.mutate({
                memberId: r.id,
                smsType: reminderType(r.daysUntilDue),
              })
            }
          >
            {pendingId === r.id ? 'Sending…' : 'Remind'}
          </Button>
          <Button
            size="xs"
            variant="success-ghost"
            onClick={() => openMember(r.id)}
          >
            Record payment
          </Button>
        </div>
      ),
    },
  ]

  const collectedColumns: DataTableColumn<CollectedRow>[] = [
    {
      id: 'member',
      header: 'Member',
      sortValue: (r) => r.memberName,
      cell: (r) => memberCell(r.memberName, r.photoPath, r.photoUpdatedAt),
    },
    {
      id: 'paidOn',
      header: 'Paid on',
      sortValue: (r) => r.paymentDate,
      cell: (r) => (
        <span className="font-mono text-mono-md text-ink-muted">
          {r.paymentDate}
        </span>
      ),
    },
    {
      id: 'amount',
      header: 'Amount (LKR)',
      numeric: true,
      sortValue: (r) => r.amountPaid,
      cell: (r) => money(r.amountPaid),
    },
    {
      id: 'action',
      header: 'Action',
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (r) => (
        <Button
          size="xs"
          variant="secondary"
          onClick={() => openMember(r.memberId)}
        >
          Receipt
        </Button>
      ),
    },
  ]

  const counts: Record<
    Tab,
    { count: number; variant: 'error' | 'warning' | 'success' }
  > = {
    expired: { count: expired.length, variant: 'error' },
    due: { count: dueSoon.length, variant: 'warning' },
    collected: {
      count: collected?.summary.paymentCount ?? 0,
      variant: 'success',
    },
  }

  const tabLabel = (id: Tab, label: string) => (
    <span className="flex items-center gap-1.5">
      {label}
      <Badge variant={counts[id].variant} dot={false}>
        {counts[id].count}
      </Badge>
    </span>
  )

  return (
    <div className="flex max-w-app flex-col gap-4">
      <PageHeader title="Renewals" />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="expired">
            {tabLabel('expired', 'Expired')}
          </TabsTrigger>
          <TabsTrigger value="due">
            {tabLabel('due', 'Expires this week')}
          </TabsTrigger>
          <TabsTrigger value="collected">
            {tabLabel('collected', 'Collected')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expired">
          <DataTable
            columns={dueColumns('expired')}
            data={expired}
            getRowId={(r) => r.id}
            caption="Expired memberships"
            loading={duesLoading}
            error={duesError ? 'Failed to load renewals.' : undefined}
            empty="No expired members."
          />
        </TabsContent>

        <TabsContent value="due">
          <DataTable
            columns={dueColumns('due')}
            data={dueSoon}
            getRowId={(r) => r.id}
            caption="Memberships expiring within seven days"
            loading={duesLoading}
            error={duesError ? 'Failed to load renewals.' : undefined}
            empty="Nobody expires in the next 7 days."
          />
        </TabsContent>

        <TabsContent value="collected">
          <DataTable
            columns={collectedColumns}
            data={collectedRows}
            getRowId={(r) => r.paymentId}
            caption="Payments collected this month"
            loading={collectedLoading}
            error={collectedError ? 'Failed to load payments.' : undefined}
            empty="No payments collected this month yet."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
