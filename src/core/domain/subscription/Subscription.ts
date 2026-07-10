/**
 * Subscription Domain Entity — SaaS Lite/Pro/Enterprise billing state
 * of a gym (tenant). Every tier is paid.
 *
 * Immutable, in the style of Member.ts: private constructor, static create,
 * guarded transition methods throwing InvalidStatusTransitionError, and a
 * NON-TRANSITION renew() per architecture rule §2.5.1 (recurring renewal is a
 * property update / recovery, not a self-transition).
 *
 * State model — legal (tier, status) pairs:
 * {lite, pro, enterprise} × {trialing, active, past_due, suspended, canceled}.
 * Member caps come from the PlanRestrictions capability matrix (lite 100,
 * pro ∞, enterprise ∞).
 *
 * There is NO free tier and NO downgrade landing tier: dunning and trial
 * expiry SUSPEND (status change, tier preserved) via suspend().
 *
 * Complimentary (lifetime) subscriptions: a tier with NO gateway
 * subscription and NO period end while ACTIVE (manually provisioned, never
 * billed). Dunning can never touch them — both its WHERE clauses require a
 * period end.
 *
 * Period arithmetic note: activate()/renew() carry INTENT only. The actual
 * current_period_end is computed by the save_gym_subscription RPC on the
 * DATABASE clock — the in-memory value is stale-until-saved and the
 * repository rebuilds the entity from the RPC result. Never do JS date math
 * for the period (plan C-18/C-23).
 */

import {
  SaasTier,
  SaasStatus,
  GRACE_PERIOD_DAYS,
} from '@/core/utils/constants/SubscriptionConfig';
import { getPlanCapabilities } from '@/core/domain/subscription/PlanRestrictions';
import { InvalidStatusTransitionError } from '@/core/utils/errors';

export interface SubscriptionProps {
  gymId: string;
  tier: SaasTier;
  status: SaasStatus;
  memberCount: number;
  currentPeriodEnd: Date | null;
  /** Trial clock (set at signup by the DB default); meaningful while trialing. */
  trialEndsAt: Date | null;
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

  get trialEndsAt(): Date | null {
    return this.props.trialEndsAt;
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
      trialEndsAt: this.props.trialEndsAt ? new Date(this.props.trialEndsAt) : null,
    };
  }

  private stateKey(): string {
    return `${this.props.tier}:${this.props.status}`;
  }

  /**
   * suspended | canceled → trialing. Platform-granted (re-)trial: restarts
   * the onboarding window with a fresh trial clock. New-gym signups get
   * trialing via the DB defaults (lite/trialing + trial_ends_at default) and
   * never pass through here.
   */
  startTrial(trialEndsAt: Date): Subscription {
    const allowed =
      this.props.status === SaasStatus.Suspended || this.props.status === SaasStatus.Canceled;
    if (!allowed) {
      throw new InvalidStatusTransitionError(this.stateKey(), `${this.props.tier}:trialing`);
    }
    return new Subscription({
      ...this.props,
      status: SaasStatus.Trialing,
      trialEndsAt: new Date(trialEndsAt),
    });
  }

  /**
   * trialing | suspended | {tier}/canceled → {targetTier}/active.
   *
   * Tier-agnostic activation (every tier is paid and checkoutable): trial
   * conversion, reactivation of a suspended account via a new checkout,
   * re-subscription after a voluntary cancel, or a plan change AFTER cancel
   * (a NEW PayHere subscription id replaces the old). Rejects active and
   * past_due: already subscribed — past_due recovery arrives via renew() on
   * the existing subscription, and a plan change requires cancelling the
   * current gateway subscription first (PayHere has no in-place plan swap).
   */
  activate(
    targetTier: SaasTier,
    input: {
      subscriptionId: string | null;
      customerId: string | null;
    }
  ): Subscription {
    const allowed =
      this.props.status === SaasStatus.Trialing ||
      this.props.status === SaasStatus.Suspended ||
      this.props.status === SaasStatus.Canceled;

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
   * trialing → {targetTier}/active. First successful checkout charge during
   * the trial window converts the trial. Guarded alias of activate() that
   * additionally asserts the trialing state.
   */
  convertTrialToPaid(
    targetTier: SaasTier,
    input: {
      subscriptionId: string | null;
      customerId: string | null;
    }
  ): Subscription {
    if (this.props.status !== SaasStatus.Trialing) {
      throw new InvalidStatusTransitionError(this.stateKey(), `${targetTier}:active`);
    }
    return this.activate(targetTier, input);
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
      this.props.status === SaasStatus.Active || this.props.status === SaasStatus.PastDue;

    if (!allowed) {
      throw new InvalidStatusTransitionError(this.stateKey(), `${this.props.tier}:active`);
    }

    return new Subscription({ ...this.props, status: SaasStatus.Active });
  }

  /**
   * active → past_due. Recurring charge failed; grace begins.
   * Only the dunning cron performs the suspension later.
   */
  markPastDue(): Subscription {
    if (this.props.status !== SaasStatus.Active) {
      throw new InvalidStatusTransitionError(this.stateKey(), `${this.props.tier}:past_due`);
    }
    return new Subscription({ ...this.props, status: SaasStatus.PastDue });
  }

  /**
   * active | past_due → canceled. Voluntary cancel confirmed at the gateway;
   * retains tier and currentPeriodEnd (paid-through). At period end the
   * dunning cron suspends.
   */
  cancelPaid(): Subscription {
    const allowed =
      this.props.status === SaasStatus.Active || this.props.status === SaasStatus.PastDue;

    if (!allowed) {
      throw new InvalidStatusTransitionError(this.stateKey(), `${this.props.tier}:canceled`);
    }

    return new Subscription({ ...this.props, status: SaasStatus.Canceled });
  }

  /**
   * past_due (grace expired) | canceled (period ended) | trialing (trial
   * expired) → suspended. Cron-only transition (dunning / trial expiry);
   * the TIER IS PRESERVED — there is no free landing tier. The gateway
   * subscription id is RETAINED so a late successful PayHere retry can
   * still reactivate (identity guard C-21 matches it); a new checkout
   * replaces it on activate(). Members are NEVER touched by this transition.
   */
  suspend(): Subscription {
    const allowed =
      this.props.status === SaasStatus.PastDue ||
      this.props.status === SaasStatus.Canceled ||
      this.props.status === SaasStatus.Trialing;

    if (!allowed) {
      throw new InvalidStatusTransitionError(this.stateKey(), `${this.props.tier}:suspended`);
    }

    return new Subscription({ ...this.props, status: SaasStatus.Suspended });
  }

  /**
   * suspended → active (tier preserved). Payment received for a suspended
   * account: a late successful charge on the retained gateway subscription
   * (webhook renew path cannot apply — renew() rejects suspended) or a
   * platform recovery op. New checkouts go through activate() instead.
   */
  reactivate(): Subscription {
    if (this.props.status !== SaasStatus.Suspended) {
      throw new InvalidStatusTransitionError(this.stateKey(), `${this.props.tier}:active`);
    }
    return new Subscription({ ...this.props, status: SaasStatus.Active });
  }

  /**
   * Complimentary (lifetime) subscription: a tier that was provisioned
   * manually — permanently active, no gateway subscription, no period end.
   * Never billed, never dunned; subscription self-management is disabled in
   * the UI and the checkout/cancel APIs reject it. The status=active
   * requirement keeps the derivation off trialing rows (which also have no
   * gateway sub/period end) and off canceled billed rows.
   */
  isComplimentary(): boolean {
    return (
      this.props.status === SaasStatus.Active &&
      this.props.payhereSubscriptionId === null &&
      this.props.currentPeriodEnd === null
    );
  }

  /**
   * Access-control hardware support (Enterprise only) — the sole remaining
   * per-tier feature gate, from the PlanRestrictions capability matrix.
   */
  hasAccessControlHardware(): boolean {
    return getPlanCapabilities(this.props.tier).accessControlHardware;
  }

  /**
   * Quota allowance — MUST mirror the SQL matrix in
   * assert_gym_can_add_active_member; integration tests keep the two in
   * lock-step. The cap for every tier comes from the PlanRestrictions
   * capability matrix (null = unlimited).
   *
   *   trialing  → within cap (full features during the trial window)
   *   active    → within cap
   *   past_due  → within cap while the grace window covers `now`
   *   canceled  → within cap while paid-through (until period end, NO
   *               grace — the customer keeps what they paid for; dunning
   *               suspends at period end)
   *   suspended → never (account is gated pending payment)
   *
   * Complimentary subscriptions are always status=active → within cap
   * (unlimited on their tier).
   */
  canAddMember(now: Date): boolean {
    const cap = getPlanCapabilities(this.props.tier).maxMembers;
    const withinCap = cap === null || this.props.memberCount < cap;

    switch (this.props.status) {
      case SaasStatus.Trialing:
      case SaasStatus.Active:
        return withinCap;
      case SaasStatus.PastDue: {
        const graceEnd = this.graceEndsAt();
        return graceEnd !== null && now.getTime() <= graceEnd.getTime() && withinCap;
      }
      case SaasStatus.Canceled:
        return (
          this.props.currentPeriodEnd !== null &&
          now.getTime() <= this.props.currentPeriodEnd.getTime() &&
          withinCap
        );
      case SaasStatus.Suspended:
        return false;
    }
  }

  /**
   * True when past_due and the grace window has elapsed (dunning will suspend).
   */
  isGraceExpired(now: Date): boolean {
    if (this.props.status !== SaasStatus.PastDue) {
      return false;
    }
    const graceEnd = this.graceEndsAt();
    return graceEnd !== null && now.getTime() > graceEnd.getTime();
  }

  /**
   * True when trialing and the trial clock has elapsed (trial-expiry cron
   * will suspend).
   */
  isTrialExpired(now: Date): boolean {
    return (
      this.props.status === SaasStatus.Trialing &&
      this.props.trialEndsAt !== null &&
      now.getTime() > this.props.trialEndsAt.getTime()
    );
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
