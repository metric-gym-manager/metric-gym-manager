'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Badge,
  Button,
  ListRow,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyState,
  Skeleton,
} from '@/components/ui'
import { useViewportTier } from '@/hooks/useViewportTier'
import { SmsDeliveryStatus } from '../config/SmsConfig'
import type { SmsType } from '../config/SmsConfig'
import { cn } from '@/lib/utils'

/**
 * A member's SMS history, as a gym manager may see it.
 *
 * This is the UI half of OPEN-6: `GET /api/members/[id]/sms-history` and its
 * service ran for months with **no consumer at all**, and — because nothing ever
 * called it — with a query that selected a column `sms_logs` does not have, so
 * it answered 500 on every request. The endpoint was repaired before this
 * component was written; building the UI first would have rendered a "Delivered"
 * column over a 500.
 *
 * Fetches lazily. Most member drawers are opened to take a payment, not to audit
 * messaging, so the query only runs once someone asks for it.
 */

const TYPE_LABEL: Record<SmsType, string> = {
  reminder_7day: '7-day reminder',
  reminder_3day: '3-day reminder',
  due_today: 'Due today',
  overdue: 'Overdue notice',
  receipt: 'Payment receipt',
  welcome: 'Welcome',
  reactivation: 'Reactivation',
  announcement: 'Announcement',
}

/**
 * Delivery state → badge variant.
 *
 * `pending` is amber rather than green: the vendor has accepted the message but
 * the carrier has not confirmed it, and presenting that as success is what the
 * old code did by collapsing PENDING onto `sent`.
 *
 * `sent` is deliberately neutral, not green. It means "handed to the provider",
 * which is not the same as "arrived", and the front desk should be able to see
 * at a glance which messages are actually confirmed.
 */
const STATUS_VARIANT: Record<
  SmsDeliveryStatus,
  'success' | 'warning' | 'error' | 'neutral'
> = {
  [SmsDeliveryStatus.Delivered]: 'success',
  [SmsDeliveryStatus.Pending]: 'warning',
  [SmsDeliveryStatus.Failed]: 'error',
  [SmsDeliveryStatus.Sent]: 'neutral',
}

const STATUS_LABEL: Record<SmsDeliveryStatus, string> = {
  [SmsDeliveryStatus.Delivered]: 'Delivered',
  [SmsDeliveryStatus.Pending]: 'Pending',
  [SmsDeliveryStatus.Failed]: 'Failed',
  [SmsDeliveryStatus.Sent]: 'Sent',
}

interface HistoryEntry {
  id: string
  smsType: SmsType
  phoneNumber: string
  messageBody: string
  sentAt: string
  deliveryStatus: SmsDeliveryStatus
  textLkMessageId: string | null
}

interface HistoryResponse {
  entries: HistoryEntry[]
  totalCount: number
  page: number
  pageSize: number
  pageCount: number
}

export interface MemberSmsHistoryProps {
  memberId: string
  /**
   * Layout class from the caller — `MemberDetailModal` uses it to order this
   * block on a phone. A wrapper div would do the same job and would also add a
   * stray gap to the detail's spaced column, so the class comes here instead.
   */
  className?: string
}

export function MemberSmsHistory({
  memberId,
  className,
}: MemberSmsHistoryProps) {
  const [expanded, setExpanded] = useState(false)
  const [page, setPage] = useState(1)
  // Per-row message expansion (§27 "Very long SMS / message"): the row shows
  // two clamped lines and a tap reveals the whole body. Local state, because
  // this list is a plain `Table` on the desktop and has no `renderExpanded`.
  const [openRows, setOpenRows] = useState<ReadonlySet<string>>(() => new Set())
  const phone = useViewportTier() === 'phone'
  const toggleRow = (id: string) =>
    setOpenRows((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const { data, isLoading, error } = useQuery<HistoryResponse>({
    queryKey: ['member-sms-history', memberId, page],
    queryFn: async () => {
      const response = await fetch(
        `/api/members/${memberId}/sms-history?page=${page}&pageSize=20`
      )
      if (!response.ok) throw new Error('Failed to load SMS history')
      const result = await response.json()
      return result.data
    },
    enabled: expanded,
  })

  const entries = data?.entries ?? []
  const total = data?.totalCount ?? 0

  return (
    <div
      className={cn(
        'space-y-3 rounded-sm border border-line-1 bg-surface-input p-4',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">SMS History</h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            {expanded && data
              ? `${total} message${total === 1 ? '' : 's'} sent`
              : 'Reminders, receipts and announcements sent to this member'}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? 'Hide' : 'View'} SMS History
        </Button>
      </div>

      {expanded && (
        <div>
          {isLoading ? (
            <div className="space-y-2" aria-label="Loading SMS history">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : error ? (
            // Sanitised: rule 2.8 keeps provider and database detail away from a
            // gym manager. The reason a message failed lives in `error_message`,
            // which /system-health reads and this endpoint never returns.
            <p className="py-4 text-center text-body text-error">
              Could not load SMS history. Please try again.
            </p>
          ) : entries.length === 0 ? (
            <EmptyState
              className="py-8"
              title="No messages yet"
              description="Reminders and receipts sent to this member will appear here."
            />
          ) : (
            <>
              {phone ? (
                /*
                 * §9.4 "SMS history": type, status and sent-at in the row, the
                 * message disclosed on its own line clamped to two and
                 * expanding on tap. MO-17 measured this table at 384 px on
                 * every phone width, inside the member detail Phase 3 made
                 * reachable there — and because the wrapper below is
                 * `overflow-x-auto`, it hid the message column rather than
                 * widening the page.
                 *
                 * The message rides the `actions` slot, the only one below the
                 * meta line (§9.1's anatomy), which is where Phase 7 put the
                 * expanded cohort series for the same reason.
                 */
                <ul role="list">
                  {entries.map((entry) => {
                    const open = openRows.has(entry.id)
                    return (
                      <ListRow
                        key={entry.id}
                        primary={TYPE_LABEL[entry.smsType] ?? entry.smsType}
                        status={
                          <Badge variant={STATUS_VARIANT[entry.deliveryStatus]}>
                            {STATUS_LABEL[entry.deliveryStatus]}
                          </Badge>
                        }
                        value={new Date(entry.sentAt).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        onClick={() => toggleRow(entry.id)}
                        actions={
                          <span
                            className={cn(
                              'text-body-sm text-ink-secondary',
                              !open && 'line-clamp-2'
                            )}
                          >
                            {entry.messageBody}
                          </span>
                        }
                      />
                    )
                  })}
                </ul>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sent at</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="whitespace-nowrap font-mono text-mono-sm text-ink-muted">
                            {new Date(entry.sentAt).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-ink-secondary">
                            {TYPE_LABEL[entry.smsType] ?? entry.smsType}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={STATUS_VARIANT[entry.deliveryStatus]}
                            >
                              {STATUS_LABEL[entry.deliveryStatus]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-ink-secondary">
                            {/* Truncation lives on an inner block, not the cell:
                            `max-width` on a <td> is ignored unless the table is
                            `table-layout: fixed`, so the cell grew instead. */}
                            <div
                              className="max-w-[22rem] truncate"
                              title={entry.messageBody}
                            >
                              {entry.messageBody}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* The hand-rolled Prev/Next pager this replaces was a second
                  implementation of a pattern the design system owns (§2.17),
                  and its 26 px `xs` buttons were the audit's complaint. The
                  primitive's `responsive` form collapses to Prev · "2 of 3" ·
                  Next on a phone and renders the numbered pages unchanged
                  above `tablet`. */}
              {data && (
                <Pagination
                  className="mt-3"
                  page={data.page}
                  pageCount={data.pageCount}
                  onPageChange={setPage}
                  responsive
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
