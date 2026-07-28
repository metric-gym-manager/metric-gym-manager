'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Input,
  Select,
  Modal,
  Badge,
} from '@/components/ui'
import type {
  MemberWithDiscount,
  OverdueMember,
} from '@/features/members/types'
import type { PlanType } from '@/features/settings/types'
import { X, Filter } from 'lucide-react'
import { formatDate } from '@/utils/date/date'
import { getPlanBadgeColor } from '@/utils/badge-colors'
import UrgencyBadge from '@/components/common/UrgencyBadge'
import { PaymentDetailsModal } from './PaymentDetailsModal'
import MemberAvatar from './MemberAvatar'
import { formatMemberNumber } from '@/features/members/utils/formatMemberNumber'

/** True when the member is an unverified QR self-registration (NEW badge) */
const isNewMember = (member: MemberWithDiscount) =>
  member.registration_source === 'qr' && !member.verified_at

interface MembersListResponse {
  members: MemberWithDiscount[]
  overdueMembers?: OverdueMember[]
  totalCount: number
  page: number
  totalPages: number
}

interface SearchSuggestion {
  id: string
  member_number: number
  name: string
  phone_number: string
  photo_path: string | null
  photo_updated_at: string | null
}

interface MembersTableProps {
  onMemberClick: (member: MemberWithDiscount) => void
}

export default function MembersTable({ onMemberClick }: MembersTableProps) {
  const [inputValue, setInputValue] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [planType, setPlanType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('newest')
  const [page, setPage] = useState(1)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [selectedPaymentMember, setSelectedPaymentMember] =
    useState<OverdueMember | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Debounce the search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(inputValue)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [inputValue])

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch search suggestions
  const { data: suggestions } = useQuery<SearchSuggestion[]>({
    queryKey: ['member-suggestions', inputValue],
    queryFn: async () => {
      if (!inputValue || inputValue.trim().length < 1) return []
      const response = await fetch(
        `/api/members/suggestions?q=${encodeURIComponent(inputValue)}`
      )
      if (!response.ok) return []
      const result = await response.json()
      return result.data ?? []
    },
    enabled: inputValue.trim().length >= 1,
    staleTime: 30000,
  })

  // Fetch active plan types
  const { data: planTypes } = useQuery<PlanType[]>({
    queryKey: ['billing-setup-plan-types'],
    queryFn: async () => {
      const response = await fetch('/api/billing-setup/plans')
      if (!response.ok) return []
      const result = await response.json()
      return result.data ?? []
    },
    staleTime: 300000, // Cache for 5 minutes
  })

  // Filter only active plan types and map to labels
  const activePlanTypes = planTypes?.filter((pt) => pt.is_active) ?? []
  const getPlanLabel = (planType: string) => {
    const labels: Record<string, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      '3-months': '3 Months',
      '6-months': '6 Months',
      annual: 'Annual',
    }
    return labels[planType] || planType
  }

  // Fetch members data
  const { data, isLoading, error } = useQuery<MembersListResponse>({
    queryKey: ['members', debouncedSearch, status, planType, sortBy, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })

      if (debouncedSearch) params.append('search', debouncedSearch)
      if (status !== 'all') params.append('status', status)
      if (planType !== 'all') params.append('planType', planType)
      if (sortBy) params.append('sortBy', sortBy)

      const response = await fetch(`/api/members?${params}`)
      if (!response.ok) throw new Error('Failed to fetch members')
      const result = await response.json()
      return result.data
    },
  })

  const handleSuggestionClick = useCallback((suggestion: SearchSuggestion) => {
    setInputValue(suggestion.name)
    setDebouncedSearch(suggestion.name)
    setShowSuggestions(false)
    setPage(1)
  }, [])

  const handleClearSearch = () => {
    setInputValue('')
    setDebouncedSearch('')
    setShowSuggestions(false)
    setPage(1)
  }

  // Format phone number
  const formatPhone = (phone: string) => {
    return phone
  }

  // Get status dot color class
  const getStatusDotClass = (status: string): string => {
    switch (status) {
      case 'active':
        return 'bg-success'
      case 'expired':
        return 'bg-error'
      case 'suspended':
        return 'bg-warning'
      case 'cancelled':
        return 'bg-ink-muted'
      default:
        return 'bg-success'
    }
  }

  if (error) {
    return (
      <div className="rounded-md bg-error-bg p-4">
        <p className="text-sm text-error">
          Failed to load members. Please try again.
        </p>
      </div>
    )
  }

  const hasSuggestions =
    showSuggestions &&
    suggestions &&
    suggestions.length > 0 &&
    inputValue.trim().length >= 1

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          {/* Search with type-ahead dropdown */}
          <div className="relative flex-1" ref={searchContainerRef}>
            <Input
              placeholder="Search by name, phone, or member ID..."
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                setShowSuggestions(true)
              }}
              onFocus={() => {
                if (inputValue.trim().length >= 1) setShowSuggestions(true)
              }}
              autoComplete="off"
              className={inputValue ? 'pr-8' : ''}
            />
            {inputValue && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {hasSuggestions && (
              <div className="absolute z-palette mt-1 w-full rounded-md border border-line-2 bg-surface-card shadow-overlay">
                <ul className="max-h-60 overflow-auto py-1">
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="w-full px-4 py-2 text-left text-sm hover:bg-surface-hover flex items-center gap-2"
                        onMouseDown={(e) => {
                          e.preventDefault() // prevent blur before click
                          handleSuggestionClick(s)
                        }}
                      >
                        <MemberAvatar
                          name={s.name}
                          photoPath={s.photo_path}
                          photoUpdatedAt={s.photo_updated_at}
                          className="h-7 w-7 text-[10px]"
                        />
                        <span className="shrink-0 font-mono text-xs text-ink-muted">
                          {formatMemberNumber(s.member_number)}
                        </span>
                        <span className="font-medium text-ink truncate">
                          {s.name}
                        </span>
                        <span className="ml-auto shrink-0 text-ink-muted text-xs">
                          {s.phone_number}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Filter button for mobile */}
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setFilterModalOpen(true)}
            className="lg:hidden shrink-0"
            aria-label="Open filters"
          >
            <Filter className="h-4 w-4" />
          </Button>

          {/* Desktop filters - hidden on mobile */}
          <div className="hidden lg:flex gap-4">
            <div className="w-[150px]">
              <Select
                id="members-table-status-filter-desktop-select"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value)
                  setPage(1)
                }}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </div>
            <div className="w-[150px]">
              <Select
                id="members-table-plan-filter-desktop-select"
                value={planType}
                onChange={(e) => {
                  setPlanType(e.target.value)
                  setPage(1)
                }}
              >
                <option value="all">All Plans</option>
                {activePlanTypes.map((pt) => (
                  <option key={pt.plan_type} value={pt.plan_type}>
                    {getPlanLabel(pt.plan_type)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* Sort dropdown - hidden on mobile, shown in filter modal instead */}
        <div className="hidden lg:block">
          <div className="w-[200px]">
            <Select
              id="members-table-sort-desktop-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="upcoming_due">Upcoming Payments</option>
              <option value="recently_expired">Recently Expired</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Filter Modal for Mobile */}
      <Modal
        open={filterModalOpen}
        onOpenChange={setFilterModalOpen}
        title="Filters & Sorting"
        footer={
          <>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setStatus('all')
                setPlanType('all')
                setSortBy('newest')
                setPage(1)
              }}
            >
              Reset
            </Button>
            <Button
              variant="accent"
              className="flex-1"
              onClick={() => setFilterModalOpen(false)}
            >
              Apply
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Status Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select
              id="members-table-status-filter-mobile-select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>

          {/* Plan Type Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Plan Type</label>
            <Select
              id="members-table-plan-filter-mobile-select"
              value={planType}
              onChange={(e) => {
                setPlanType(e.target.value)
                setPage(1)
              }}
            >
              <option value="all">All Plans</option>
              {activePlanTypes.map((pt) => (
                <option key={pt.plan_type} value={pt.plan_type}>
                  {getPlanLabel(pt.plan_type)}
                </option>
              ))}
            </Select>
          </div>

          {/* Sort By */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Sort By</label>
            <Select
              id="members-table-sort-mobile-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="upcoming_due">Upcoming Payments</option>
              <option value="recently_expired">Recently Expired</option>
            </Select>
          </div>
        </div>
      </Modal>

      {/* Active search status bar */}
      {debouncedSearch && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted">Searching for:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accentui-border bg-accentui-bg px-3 py-0.5 text-xs font-medium text-brand-link">
            {debouncedSearch}
            <button
              type="button"
              onClick={handleClearSearch}
              className="ml-0.5 rounded-full hover:text-brand-link-hover transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
          {data && (
            <span className="text-xs text-ink-muted">
              — {data.totalCount} result{data.totalCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Total Count */}
      {data && !debouncedSearch && (
        <div className="text-sm text-ink-secondary">
          Total Members:{' '}
          <span className="font-semibold text-ink">{data.totalCount}</span>
        </div>
      )}

      {/* Overdue Members Section */}
      {data && data.overdueMembers && data.overdueMembers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-error">Overdue Members</h3>
          <div className="rounded-lg border border-line-1 bg-error-bg overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-error-bg">
                <TableRow>
                  <TableHead>Member ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Plan Type</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.overdueMembers.map((member) => (
                  <TableRow
                    key={member.id}
                    clickable
                    onClick={() => onMemberClick(member)}
                    className="hover:bg-error-bg"
                  >
                    <TableCell className="font-mono text-xs text-ink-muted whitespace-nowrap">
                      {formatMemberNumber(member.member_number)}
                    </TableCell>
                    <TableCell>
                      <span
                        className="flex items-center gap-2 font-medium"
                        title={member.status}
                      >
                        <MemberAvatar
                          name={member.name}
                          photoPath={member.photo_path}
                          photoUpdatedAt={member.photo_updated_at}
                        />
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${getStatusDotClass(member.status)}`}
                        />
                        {member.name}
                        {isNewMember(member) && (
                          <Badge variant="accent">NEW</Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{formatPhone(member.phone_number)}</TableCell>
                    <TableCell>{formatDate(member.registered_date)}</TableCell>
                    <TableCell>
                      <Badge className={getPlanBadgeColor(member.plan_type)}>
                        {member.plan_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(member.next_due_date)}</TableCell>
                    <TableCell>
                      <UrgencyBadge daysOverdue={member.days_overdue} />
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedPaymentMember(member)
                        }}
                        className="text-sm font-medium text-brand-link hover:text-brand-link-hover transition-colors"
                      >
                        View Payment Details
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* All Members Section */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">All Members</h3>
        <div className="rounded-lg border border-line-1 bg-surface-card overflow-auto max-h-[600px]">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-sm text-ink-muted">Loading members...</div>
            </div>
          ) : data && data.members.length > 0 ? (
            <Table>
              <TableHeader className="sticky top-0 bg-surface-card z-sticky">
                <TableRow>
                  <TableHead>Member ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Plan Type</TableHead>
                  <TableHead>Next Due Date</TableHead>
                  <TableHead>Discount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.members.map((member) => (
                  <TableRow
                    key={member.id}
                    clickable
                    onClick={() => onMemberClick(member)}
                  >
                    <TableCell className="font-mono text-xs text-ink-muted whitespace-nowrap">
                      {formatMemberNumber(member.member_number)}
                    </TableCell>
                    <TableCell>
                      <span
                        className="flex items-center gap-2 font-medium"
                        title={member.status}
                      >
                        <MemberAvatar
                          name={member.name}
                          photoPath={member.photo_path}
                          photoUpdatedAt={member.photo_updated_at}
                        />
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${getStatusDotClass(member.status)}`}
                        />
                        {member.name}
                        {isNewMember(member) && (
                          <Badge variant="accent">NEW</Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{formatPhone(member.phone_number)}</TableCell>
                    <TableCell>{formatDate(member.registered_date)}</TableCell>
                    <TableCell>
                      <Badge className={getPlanBadgeColor(member.plan_type)}>
                        {member.plan_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(member.next_due_date)}</TableCell>
                    <TableCell>
                      {member.discount ? (
                        <span className="text-sm text-ink-secondary">
                          {member.discount.discount_name} (
                          {member.discount.discount_percentage}%)
                        </span>
                      ) : (
                        <span className="text-sm text-ink-muted">None</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center space-y-2 max-w-md mx-auto px-4">
                <p className="text-sm text-ink-muted">No members found</p>
                {status !== 'all' || planType !== 'all' || debouncedSearch ? (
                  <p className="text-xs text-ink-muted">
                    Try adjusting your filters or search term
                  </p>
                ) : (
                  <p className="text-xs text-ink-muted">
                    Get started by adding your first member using the &quot;+
                    Add Member&quot; button above, or register multiple members
                    at once with &quot;Bulk Register&quot;.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-ink-secondary">
            Page {data.page} of {data.totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      <PaymentDetailsModal
        member={selectedPaymentMember}
        open={!!selectedPaymentMember}
        onClose={() => setSelectedPaymentMember(null)}
      />
    </div>
  )
}
