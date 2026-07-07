/**
 * Subscription Domain Entity — SaaS Free/Pro billing state of a gym (tenant).
 *
 * Immutable, in the style of Member.ts: private constructor, static create,
 * guarded transition methods throwing InvalidStatusTransitionError, and a
 * NON-TRANSITION renew() per architecture rule §2.5.1 (recurring renewal is a
 * property update / recovery, not a self-transition).
 *
 * State model — five legal (tier, status) pairs:
 *   free/active, free/canceled, pro/active, pro/past_due, pro/canceled
 *
 * Period arithmetic note: activateGrowth()/renew() carry INTENT only. The actual
 * current_period_end is computed by the save_gym_subscription RPC on the
 * DATABASE clock (migration 20260704000003) — the in-memory value is
 * stale-until-saved and the repository rebuilds the entity from the RPC
 * result. Never do JS date math for the period (plan C-18/C-23).
 */

import {
  SaasTier,
  SaasStatus,
  GRACE_PERIOD_DAYS,
  STARTER_TIER_MEMBER_LIMIT,
} from '@/core/utils/constants/SubscriptionConfig';
import { InvalidStatusTransitionError } from '@/core/utils/errors';

export interface SubscriptionProps {
  gymId: string;
  tier: SaasTier;
  status: SaasStatus;
  memberCount: number;
  currentPeriodEnd: Date | null;
  payhereCustomerId: string | null;
  payhereSubscriptionId: string | null;
}

export class Subscription {
  private constructor(private readonly props: SubscriptionProps) {}

  static create(props: SubscriptionProps): Subscription {
    return new Subscription({ ...props });
  }

  get gymId(): string {
    return this.props.gymId;
  }

  get tier(): SaasTier {
    return this.props.tier;
  }

  get status(): SaasStatus {
    return this.props.status;
  }

  get memberCount(): number {
    return this.props.memberCount;
  }

  get currentPeriodEnd(): Date | null {
    return this.props.currentPeriodEnd;
  }

  get payhereCustomerId(): string | null {
    return this.props.payhereCustomerId;
  }

  get payhereSubscriptionId(): string | null {
    return this.props.payhereSubscriptionId;
  }

  /**
   * Defensive copy of the props (dates cloned).
   */
  toProps(): SubscriptionProps {
    return {
      ...this.props,
      currentPeriodEnd: this.props.currentPeriodEnd
        ? new Date(this.props.currentPeriodEnd)
        : null,
    };
  }

  private stateKey(): string {
    return `${this.props.tier}:${this.props.status}`;
  }

  /**
   * free/active, free/canceled, pro/canceled → pro/active.
   *
   * Initial activation, re-subscription after downgrade, or re-subscription
   * after a voluntary cancel (a NEW PayHere subscription id replaces the old).
   * Rejects pro/active and pro/past_due: already subscribed — past_due
   * recovery arrives via renew() on the existing subscription, never a
   * second checkout.
   */
  activateGrowth(input: {
    subscriptionId: string | null;
    customerId: string | null;
  }): Subscription {
    const allowed =
      this.props.tier === SaasTier.Starter ||
      (this.props.tier === SaasTier.Growth && this.props.status === SaasStatus.Canceled);

    if (!allowed) {
      throw new InvalidStatusTransitionError(this.stateKey(), 'pro:active');
    }

    return new Subscription({
      ...this.props,
      tier: SaasTier.Growth,
      status: SaasStatus.Active,
      payhereSubscriptionId: input.subscriptionId ?? this.props.payhereSubscriptionId,
      payhereCustomerId: input.customerId ?? this.props.payhereCustomerId,
    });
  }

  /**
   * NON-TRANSITION (§2.5.1): successful recurring charge on an already-Pro
   * subscription. Recovers past_due → active. Requires status active or
   * past_due — a stale installment event must never un-cancel a voluntarily
   * canceled subscription (plan C-21: the webhook treats that as STALE_EVENT).
   *
   * The period extension itself happens in save_gym_subscription
   * (extendPeriod: true), anchored at the charge-processing DB time.
   */
  renew(): Subscription {
    const allowed =
      this.props.tier === SaasTier.Growth &&
      (this.props.status === SaasStatus.Active || this.props.status === SaasStatus.PastDue);

    if (!allowed) {
      throw new InvalidStatusTransitionError(this.stateKey(), 'pro:active');
    }

    return new Subscription({ ...this.props, status: SaasStatus.Active });
  }

  /**
   * pro/active → pro/past_due. Recurring charge failed; grace begins.
   * Only the dunning cron performs the hard downgrade later.
   */
  markPastDue(): Subscription {
    if (this.props.tier !== SaasTier.Growth || this.props.status !== SaasStatus.Active) {
      throw new InvalidStatusTransitionError(this.stateKey(), 'pro:past_due');
    }
    return new Subscription({ ...this.props, status: SaasStatus.PastDue });
  }

  /**
   * pro/active | pro/past_due → pro/canceled. Voluntary cancel confirmed at
   * the gateway; retains tier and currentPeriodEnd (paid-through).
   */
  cancelGrowth(): Subscription {
    const allowed =
      this.props.tier === SaasTier.Growth &&
      (this.props.status === SaasStatus.Active || this.props.status === SaasStatus.PastDue);

    if (!allowed) {
      throw new InvalidStatusTransitionError(this.stateKey(), 'pro:canceled');
    }

    return new Subscription({ ...this.props, status: SaasStatus.Canceled });
  }

  /**
   * pro/past_due (grace expired) | pro/canceled (period ended) → free/canceled.
   * Dunning-cron transition; clears the gateway subscription id.
   * Members are NEVER touched by this transition.
   */
  downgradeToStarter(): Subscription {
    const allowed =
      this.props.tier === SaasTier.Growth &&
      (this.props.status === SaasStatus.PastDue || this.props.status === SaasStatus.Canceled);

    if (!allowed) {
      throw new InvalidStatusTransitionError(this.stateKey(), 'free:canceled');
    }

    return new Subscription({
      ...this.props,
      tier: SaasTier.Starter,
      status: SaasStatus.Canceled,
      payhereSubscriptionId: null,
    });
  }

  /**
   * Quota allowance — MUST mirror the SQL matrix in register_member_guarded
   * (migration 20260704000003); integration tests keep the two in lock-step.
   */
  canAddMember(now: Date): boolean {
    if (this.props.tier === SaasTier.Growth) {
      if (this.props.status === SaasStatus.Active) {
        return true;
      }
      if (this.props.status === SaasStatus.PastDue) {
        const graceEnd = this.graceEndsAt();
        return graceEnd !== null && now.getTime() <= graceEnd.getTime();
      }
      // pro/canceled: paid-through until period end, NO grace
      return (
        this.props.currentPeriodEnd !== null &&
        now.getTime() <= this.props.currentPeriodEnd.getTime()
      );
    }
    return this.props.memberCount < STARTER_TIER_MEMBER_LIMIT;
  }

  /**
   * True when past_due and the grace window has elapsed (dunning will downgrade).
   */
  isGraceExpired(now: Date): boolean {
    if (this.props.status !== SaasStatus.PastDue) {
      return false;
    }
    const graceEnd = this.graceEndsAt();
    return graceEnd !== null && now.getTime() > graceEnd.getTime();
  }

  /**
   * True while the paid period covers `now`.
   */
  isPaidThrough(now: Date): boolean {
    return (
      this.props.currentPeriodEnd !== null &&
      now.getTime() <= this.props.currentPeriodEnd.getTime()
    );
  }

  /**
   * currentPeriodEnd + GRACE_PERIOD_DAYS when past_due, else null.
   */
  graceEndsAt(): Date | null {
    if (this.props.status !== SaasStatus.PastDue || this.props.currentPeriodEnd === null) {
      return null;
    }
    const graceEnd = new Date(this.props.currentPeriodEnd);
    graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);
    return graceEnd;
  }
}
