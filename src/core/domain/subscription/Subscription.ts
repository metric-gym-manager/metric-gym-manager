/**
 * Subscription Domain Entity — SaaS Starter/Growth/Enterprise billing state
 * of a gym (tenant).
 *
 * Immutable, in the style of Member.ts: private constructor, static create,
 * guarded transition methods throwing InvalidStatusTransitionError, and a
 * NON-TRANSITION renew() per architecture rule §2.5.1 (recurring renewal is a
 * property update / recovery, not a self-transition).
 *
 * State model — legal (tier, status) pairs: starter/{active,canceled} and
 * {growth,enterprise}/{active,past_due,canceled}. Member caps come from the
 * PlanRestrictions capability matrix (starter 40, growth 190, enterprise ∞).
 *
 * Complimentary (lifetime) subscriptions: a paid tier with NO gateway
 * subscription and NO period end (manually provisioned, never billed).
 * Dunning can never touch them — both its WHERE clauses require a period end.
 *
 * Period arithmetic note: activatePaid()/renew() carry INTENT only. The actual
 * current_period_end is computed by the save_gym_subscription RPC on the
 * DATABASE clock — the in-memory value is stale-until-saved and the
 * repository rebuilds the entity from the RPC result. Never do JS date math
 * for the period (plan C-18/C-23).
 */

import {
  SaasTier,
  SaasStatus,
  GRACE_PERIOD_DAYS,
  isPaidTier,
  type PaidTier,
} from '@/core/utils/constants/SubscriptionConfig';
import { getPlanCapabilities } from '@/core/domain/subscription/PlanRestrictions';
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
   * starter/* or {paid}/canceled → {targetTier}/active.
   *
   * Initial activation, re-subscription after downgrade, re-subscription
   * after a voluntary cancel, or a plan change AFTER cancel (a NEW PayHere
   * subscription id replaces the old). Rejects any paid tier active/past_due:
   * already subscribed — past_due recovery arrives via renew() on the
   * existing subscription, and a plan change requires cancelling the current
   * gateway subscription first (PayHere has no in-place plan swap).
   */
  activatePaid(
    targetTier: PaidTier,
    input: {
      subscriptionId: string | null;
      customerId: string | null;
    }
  ): Subscription {
    if (!isPaidTier(targetTier)) {
      // JS callers can bypass the type; the state machine must not.
      throw new InvalidStatusTransitionError(this.stateKey(), `${targetTier}:active`);
    }
    const allowed =
      this.props.tier === SaasTier.Starter ||
      (isPaidTier(this.props.tier) && this.props.status === SaasStatus.Canceled);

    if (!allowed) {
      throw new InvalidStatusTransitionError(this.stateKey(), `${targetTier}:active`);
    }

    return new Subscription({
      ...this.props,
      tier: targetTier,
      status: SaasStatus.Active,
      payhereSubscriptionId: input.subscriptionId ?? this.props.payhereSubscriptionId,
      payhereCustomerId: input.customerId ?? this.props.payhereCustomerId,
    });
  }

  /**
   * NON-TRANSITION (§2.5.1): successful recurring charge on an existing paid
   * subscription. Recovers past_due → active. Requires status active or
   * past_due — a stale installment event must never un-cancel a voluntarily
   * canceled subscription (plan C-21: the webhook treats that as STALE_EVENT).
   *
   * The period extension itself happens in save_gym_subscription
   * (extendPeriod: true), anchored at the charge-processing DB time.
   */
  renew(): Subscription {
    const allowed =
      isPaidTier(this.props.tier) &&
      (this.props.status === SaasStatus.Active || this.props.status === SaasStatus.PastDue);

    if (!allowed) {
      throw new InvalidStatusTransitionError(this.stateKey(), `${this.props.tier}:active`);
    }

    return new Subscription({ ...this.props, status: SaasStatus.Active });
  }

  /**
   * {paid}/active → {paid}/past_due. Recurring charge failed; grace begins.
   * Only the dunning cron performs the hard downgrade later.
   */
  markPastDue(): Subscription {
    if (!isPaidTier(this.props.tier) || this.props.status !== SaasStatus.Active) {
      throw new InvalidStatusTransitionError(this.stateKey(), `${this.props.tier}:past_due`);
    }
    return new Subscription({ ...this.props, status: SaasStatus.PastDue });
  }

  /**
   * {paid}/active | {paid}/past_due → {paid}/canceled. Voluntary cancel
   * confirmed at the gateway; retains tier and currentPeriodEnd (paid-through).
   */
  cancelPaid(): Subscription {
    const allowed =
      isPaidTier(this.props.tier) &&
      (this.props.status === SaasStatus.Active || this.props.status === SaasStatus.PastDue);

    if (!allowed) {
      throw new InvalidStatusTransitionError(this.stateKey(), `${this.props.tier}:canceled`);
    }

    return new Subscription({ ...this.props, status: SaasStatus.Canceled });
  }

  /**
   * {paid}/past_due (grace expired) | {paid}/canceled (period ended) →
   * starter/canceled. Dunning-cron transition; clears the gateway
   * subscription id. Members are NEVER touched by this transition.
   */
  downgradeToStarter(): Subscription {
    const allowed =
      isPaidTier(this.props.tier) &&
      (this.props.status === SaasStatus.PastDue || this.props.status === SaasStatus.Canceled);

    if (!allowed) {
      throw new InvalidStatusTransitionError(this.stateKey(), 'starter:canceled');
    }

    return new Subscription({
      ...this.props,
      tier: SaasTier.Starter,
      status: SaasStatus.Canceled,
      payhereSubscriptionId: null,
    });
  }

  /**
   * Complimentary (lifetime) subscription: a paid tier that was provisioned
   * manually — permanently active, no gateway subscription, no period end.
   * Never billed, never dunned; subscription self-management is disabled in
   * the UI and the checkout/cancel APIs reject it. The status=active
   * requirement keeps the derivation off canceled billed rows (which retain
   * their period end in every real path anyway).
   */
  isComplimentary(): boolean {
    return (
      isPaidTier(this.props.tier) &&
      this.props.status === SaasStatus.Active &&
      this.props.payhereSubscriptionId === null &&
      this.props.currentPeriodEnd === null
    );
  }

  /**
   * Quota allowance — MUST mirror the SQL matrix in register_member_guarded;
   * integration tests keep the two in lock-step. The cap for every tier comes
   * from the PlanRestrictions capability matrix (null = unlimited); paid
   * tiers additionally require the subscription to be live (active, in-grace
   * past_due, or paid-through canceled). Complimentary subscriptions have no
   * period end but are always status=active, so they pass unconditionally.
   */
  canAddMember(now: Date): boolean {
    const cap = getPlanCapabilities(this.props.tier).maxMembers;
    const withinCap = cap === null || this.props.memberCount < cap;

    if (!isPaidTier(this.props.tier)) {
      return withinCap;
    }
    if (this.props.status === SaasStatus.Active) {
      return withinCap;
    }
    if (this.props.status === SaasStatus.PastDue) {
      const graceEnd = this.graceEndsAt();
      return graceEnd !== null && now.getTime() <= graceEnd.getTime() && withinCap;
    }
    // {paid}/canceled: paid-through until period end, NO grace
    return (
      this.props.currentPeriodEnd !== null &&
      now.getTime() <= this.props.currentPeriodEnd.getTime() &&
      withinCap
    );
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
