/**
 * Member Status Configuration - State Machine
 *
 * This file defines valid member statuses and their allowed transitions.
 * CRITICAL: This enforces the business rules for member lifecycle.
 */

/**
 * Days an ACTIVE member may stay unpaid past next_due_date before the daily
 * cron (update-expired-status) flips them to Expired.
 *
 * Billing-critical: the SaaS quota counts ACTIVE members only, so this is the
 * exact moment an unpaid member stops consuming an active-member slot.
 * SQL mirror: none (the cron drives the transition; the DB trigger
 * sync_gym_member_count reacts to the status flip).
 */
export const MEMBER_EXPIRY_GRACE_DAYS = 7;

/**
 * Member status values
 */
export enum MemberStatus {
  /**
   * Member has an active membership with valid payment
   */
  Active = 'active',

  /**
   * Member's membership has expired (payment overdue)
   * Can be reactivated by making payment
   */
  Expired = 'expired',

  /**
   * Member has been suspended for policy violation or voluntary hold
   * Requires admin intervention to reactivate
   */
  Suspended = 'suspended',

  /**
   * Member has permanently cancelled their membership
   * This is a TERMINAL state - no transitions out
   */
  Cancelled = 'cancelled',
}

/**
 * Status transition configuration
 */
export interface StatusTransition {
  /**
   * Source status
   */
  readonly from: MemberStatus;

  /**
   * Target status
   */
  readonly to: MemberStatus;

  /**
   * Whether a reason is required for this transition
   */
  readonly requiresReason?: boolean;

  /**
   * Who can perform this transition
   */
  readonly allowedBy: readonly ('admin' | 'system' | 'user')[];

  /**
   * Description of the transition
   */
  readonly description: string;
}

/**
 * SINGLE SOURCE OF TRUTH for valid status transitions (State Machine)
 *
 * ⚠️ CRITICAL Business Rules:
 * - Active → Expired: Automatic when payment overdue (system)
 * - Active → Suspended: Policy violation or voluntary hold (admin only)
 * - Expired → Active: Payment collected (admin or system)
 * - Expired → Cancelled: 45+ days overdue (admin or system)
 * - Suspended → Active: Member reactivated (admin only)
 * - Suspended → Expired: Time passes while suspended (system)
 * - Suspended → Cancelled: Permanent ban (admin only)
 * - Cancelled → (none): Terminal state, cannot be undone
 *
 * DO NOT allow transitions not listed here!
 */
export const VALID_TRANSITIONS: readonly StatusTransition[] = [
  // Active transitions (2 outgoing)
  {
    from: MemberStatus.Active,
    to: MemberStatus.Expired,
    allowedBy: ['system'],
    description: 'Membership expired due to overdue payment',
  },
  {
    from: MemberStatus.Active,
    to: MemberStatus.Suspended,
    requiresReason: false,
    allowedBy: ['admin'],
    description: 'Membership suspended for policy violation or voluntary hold',
  },

  // Expired transitions (2 outgoing)
  {
    from: MemberStatus.Expired,
    to: MemberStatus.Active,
    allowedBy: ['admin', 'system'],
    description: 'Membership reactivated after payment',
  },
  {
    from: MemberStatus.Expired,
    to: MemberStatus.Cancelled,
    allowedBy: ['admin', 'system'],
    description: 'Membership cancelled after 45+ days overdue',
  },

  // Suspended transitions (3 outgoing)
  {
    from: MemberStatus.Suspended,
    to: MemberStatus.Active,
    allowedBy: ['admin'],
    description: 'Membership reactivated after violation resolved',
  },
  {
    from: MemberStatus.Suspended,
    to: MemberStatus.Expired,
    allowedBy: ['system'],
    description: 'Suspended membership expired',
  },
  {
    from: MemberStatus.Suspended,
    to: MemberStatus.Cancelled,
    requiresReason: true,
    allowedBy: ['admin'],
    description: 'Membership permanently cancelled (ban)',
  },

  // Cancelled is a TERMINAL state - no transitions out
] as const;

/**
 * Check if a status transition is valid
 *
 * @param from - Current status
 * @param to - Desired status
 * @returns True if transition is allowed
 *
 * @example
 * canTransition(MemberStatus.Active, MemberStatus.Expired) // true
 * canTransition(MemberStatus.Active, MemberStatus.Cancelled) // false (must go through expired)
 * canTransition(MemberStatus.Cancelled, MemberStatus.Active) // false (terminal state)
 */
export function canTransition(
  from: MemberStatus | string,
  to: MemberStatus | string
): boolean {
  return VALID_TRANSITIONS.some((t) => t.from === from && t.to === to);
}

/**
 * Get valid transitions from a status
 *
 * @param from - Current status
 * @returns Array of transition configurations
 *
 * @example
 * getValidTransitionsFrom(MemberStatus.Active) // [{ from: Active, to: Expired, ... }, ...]
 * getValidTransitionsFrom(MemberStatus.Cancelled) // [] (terminal state)
 */
export function getValidTransitionsFrom(from: MemberStatus | string): StatusTransition[] {
  return VALID_TRANSITIONS.filter((t) => t.from === from);
}

/**
 * Get valid transitions to a status
 *
 * @param to - Target status
 * @returns Array of transition configurations
 *
 * @example
 * getValidTransitionsTo(MemberStatus.Active) // [{ from: Expired, to: Active, ... }, ...]
 */
export function getValidTransitionsTo(to: MemberStatus | string): StatusTransition[] {
  return VALID_TRANSITIONS.filter((t) => t.to === to);
}

/**
 * Get valid target statuses from a status (legacy helper)
 *
 * @param from - Current status
 * @returns Array of valid target statuses
 *
 * @example
 * getValidTransitions(MemberStatus.Active) // [MemberStatus.Expired, MemberStatus.Suspended]
 * getValidTransitions(MemberStatus.Cancelled) // [] (terminal state)
 */
export function getValidTransitions(from: MemberStatus | string): MemberStatus[] {
  return getValidTransitionsFrom(from).map((t) => t.to);
}

/**
 * Get transition configuration
 *
 * @param from - Current status
 * @param to - Desired status
 * @returns Transition configuration, or null if invalid
 */
export function getTransitionConfig(
  from: MemberStatus | string,
  to: MemberStatus | string
): StatusTransition | null {
  return VALID_TRANSITIONS.find((t) => t.from === from && t.to === to) || null;
}

/**
 * Check if a transition requires a reason
 *
 * @param from - Current status
 * @param to - Desired status
 * @returns True if reason is required
 */
export function requiresReason(
  from: MemberStatus | string,
  to: MemberStatus | string
): boolean {
  const config = getTransitionConfig(from, to);
  return config?.requiresReason ?? false;
}

/**
 * Check if a status is terminal (no transitions out)
 *
 * @param status - Status to check
 * @returns True if terminal
 */
export function isTerminalStatus(status: MemberStatus | string): boolean {
  return getValidTransitions(status).length === 0;
}

/**
 * Get status display label
 *
 * @param status - Member status
 * @returns Display label
 */
export function getStatusLabel(status: MemberStatus | string): string {
  switch (status) {
    case MemberStatus.Active:
      return 'Active';
    case MemberStatus.Expired:
      return 'Expired';
    case MemberStatus.Suspended:
      return 'Suspended';
    case MemberStatus.Cancelled:
      return 'Cancelled';
    default:
      return status as string;
  }
}

/**
 * Get status color for UI display
 *
 * @param status - Member status
 * @returns Color code
 */
export function getStatusColor(
  status: MemberStatus | string
): 'green' | 'red' | 'yellow' | 'gray' {
  switch (status) {
    case MemberStatus.Active:
      return 'green';
    case MemberStatus.Expired:
      return 'red';
    case MemberStatus.Suspended:
      return 'yellow';
    case MemberStatus.Cancelled:
      return 'gray';
    default:
      return 'gray';
  }
}

/**
 * Check if a member status is valid
 *
 * @param status - Status to validate
 * @returns True if valid
 */
export function isValidMemberStatus(status: string): status is MemberStatus {
  return Object.values(MemberStatus).includes(status as MemberStatus);
}
