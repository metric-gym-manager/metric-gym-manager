/**
 * Handle PayHere Webhook Use Case (UC-2)
 *
 * Synchronous and idempotent. Executed only AFTER the route has verified
 * md5sig. Implements the normative guard chain from the execution plan:
 *
 *   1. resolve gym   (intent by order_id -> subscription_id -> custom_1)
 *   2. idempotency   (insertIfNew on payhere_payment_id)
 *   3. identity guard (C-21: non-intent mutations require the event's
 *      subscription_id to equal the stored one)
 *   4. cancel reconciliation (RECURRING_STOPPED / item_rec_status = -1)
 *   5. status_code branch
 *
 * Re-ordering any step re-opens a closed hole — see plan §2 Phase UC.
 * Period extension anchors at the charge-processing DB clock via the save
 * RPC (extendPeriod: true) — never at the stale pre-failure boundary (C-23).
 *
* Paid-only tier model: a successful intent charge converts a TRIAL to
 * active (convertTrialToPaid), activates a suspended/canceled account
 * (activate — tier-agnostic), or renews a live one. Checkout notifications
 * are PREAPPROVALS: they carry the reusable `customer_token` (stored as the
 * gym's saved card) that powers all server-initiated charges.
 *
 * Token-billing recovery path (C-32): server-initiated charges (renewals,
 * plan changes) pre-insert a saas_charge_attempts row. When the synchronous
 * Charging API response is lost, the signed notify callback lands here, is
 * resolved via order_id -> charge attempt (same trust model as checkout
 * intents), and finalizes the attempt: renew/reactivate/plan-change on
 * success, past_due on decline. Legacy recurring events (subscription_id
 * identity guard, RECURRING_STOPPED reconciliation) remain supported.
 */

import type {
  IGymSubscriptionRepository,
  ICheckoutIntentRepository,
  ISaasPaymentLogRepository,
  IChargeAttemptRepository,
  CheckoutIntent,
  ChargeAttempt,
} from '@/core/ports/repositories';
import { Subscription } from '@/core/domain/subscription/Subscription';
import { SaasStatus } from '@/core/utils/constants/SubscriptionConfig';

export enum WebhookOutcome {
  Provisioned = 'PROVISIONED',
  Renewed = 'RENEWED',
  Reactivated = 'REACTIVATED',
  MarkedPastDue = 'MARKED_PAST_DUE',
  ReconciledCanceled = 'RECONCILED_CANCELED',
  LoggedPending = 'LOGGED_PENDING',
  AmountMismatch = 'AMOUNT_MISMATCH',
  AlreadyProcessed = 'ALREADY_PROCESSED',
  Unresolved = 'UNRESOLVED',
  StaleEvent = 'STALE_EVENT',
  LoggedOnly = 'LOGGED_ONLY',
}

/** Two-decimal comparison mirroring PayHere's amount formatting. */
const toFixed2 = (n: number): string => n.toFixed(2);

export class HandlePayHereWebhook {
  constructor(
    private readonly subscriptionRepo: IGymSubscriptionRepository,
    private readonly checkoutIntentRepo: ICheckoutIntentRepository,
    private readonly paymentLogRepo: ISaasPaymentLogRepository,
    private readonly chargeAttemptRepo: IChargeAttemptRepository
  ) {}

  async execute(fields: Record<string, string>): Promise<{ outcome: WebhookOutcome }> {
    // md5sig must never persist anywhere (plan C-24: redaction is load-bearing)
    const rawPayload: Record<string, string> = { ...fields, md5sig: '[REDACTED]' };
    const statusCode = Number.parseInt(fields.status_code ?? '', 10);
    const messageType = fields.message_type ?? null;
    const statusMessage = fields.status_message ?? null;

    // ---- 1. Resolve gym --------------------------------------------------
    // order_id -> checkout intent (user checkout) or charge attempt (our
    // server-initiated charge) — both server-created, so both establish
    // identity without a subscription_id (C-21/C-32).
    let intent: CheckoutIntent | null = null;
    let chargeAttempt: ChargeAttempt | null = null;
    let sub: Subscription | null = null;

    if (fields.order_id) {
      intent = await this.checkoutIntentRepo.findPendingByOrderId(fields.order_id);
      if (!intent) {
        chargeAttempt = await this.chargeAttemptRepo.findPendingByOrderId(fields.order_id);
      }
    }
    if (intent) {
      sub = await this.subscriptionRepo.findByGymId(intent.gymId);
    } else if (chargeAttempt) {
      sub = await this.subscriptionRepo.findByGymId(chargeAttempt.gymId);
    } else if (fields.subscription_id) {
      sub = await this.subscriptionRepo.findByPayhereSubscriptionId(fields.subscription_id);
    }
    if (!sub && fields.custom_1) {
      sub = await this.subscriptionRepo.findByGymId(fields.custom_1); // unsigned fallback (C-24)
    }

    const logBase = {
      orderId: fields.order_id ?? null,
      payhereSubscriptionId: fields.subscription_id ?? null,
      statusCode: Number.isNaN(statusCode) ? 0 : statusCode,
      signatureValid: true,
      messageType,
      statusMessage,
      rawPayload,
    };

    if (!sub) {
      if (fields.payment_id) {
        await this.paymentLogRepo.insertIfNew({
          ...logBase,
          gymId: null,
          payherePaymentId: fields.payment_id,
        });
      } else {
        await this.paymentLogRepo.insertInvalid({
          ...logBase,
          gymId: null,
          payherePaymentId: null,
        });
      }
      return { outcome: WebhookOutcome.Unresolved };
    }

    // ---- 2. Idempotency anchor -------------------------------------------
    if (!fields.payment_id) {
      // A signed notification always carries payment_id; without it there is
      // no idempotency anchor, so no state may change.
      await this.paymentLogRepo.insertInvalid({
        ...logBase,
        gymId: sub.gymId,
        payherePaymentId: null,
      });
      return { outcome: WebhookOutcome.LoggedOnly };
    }

    const inserted = await this.paymentLogRepo.insertIfNew({
      ...logBase,
      gymId: sub.gymId,
      payherePaymentId: fields.payment_id,
    });
    if (!inserted) {
      return { outcome: WebhookOutcome.AlreadyProcessed }; // replay -> no state change
    }

    // ---- 3. Identity guard (C-21) ----------------------------------------
    // Non-intent state mutations require the event's subscription_id to match
    // the stored one: after cancel + re-subscribe, late events for the
    // replaced subscription must not touch the new one.
    const idMatches =
      intent !== null ||
      chargeAttempt !== null ||
      (Boolean(fields.subscription_id) && fields.subscription_id === sub.payhereSubscriptionId);

    // ---- 4. Cancel reconciliation ----------------------------------------
    if (messageType === 'RECURRING_STOPPED' || fields.item_rec_status === '-1') {
      if (
        idMatches &&
        (sub.status === SaasStatus.Active || sub.status === SaasStatus.PastDue)
      ) {
        await this.subscriptionRepo.save(sub.cancelPaid(), { extendPeriod: false });
        return { outcome: WebhookOutcome.ReconciledCanceled };
      }
      return { outcome: WebhookOutcome.StaleEvent };
    }

    // ---- 5. status_code branch -------------------------------------------
    if (statusCode === 2) {
      if (intent) {
        const receivedAmount = Number.parseFloat(fields.payhere_amount ?? '');
        if (
          Number.isNaN(receivedAmount) ||
          toFixed2(receivedAmount) !== toFixed2(intent.expectedAmount)
        ) {
          await this.checkoutIntentRepo.markStatus(intent.orderId, 'failed');
          return { outcome: WebhookOutcome.AmountMismatch }; // no provisioning
        }

        // The intent's target tier (priced server-side at checkout) is what
        // gets provisioned. Every tier is paid and checkoutable:
        //   trialing            -> trial converts on the first charge
        //   suspended|canceled  -> (re)activation into the bought tier
        //   active|past_due     -> rare: intent completed while already live
        const gatewayIds = {
          subscriptionId: fields.subscription_id ?? null,
          customerId: fields.customer_token ?? null,
        };
        const next =
          sub.status === SaasStatus.Trialing
            ? sub.convertTrialToPaid(intent.targetTier, gatewayIds)
            : sub.status === SaasStatus.Suspended || sub.status === SaasStatus.Canceled
              ? sub.activate(intent.targetTier, gatewayIds)
              : sub.renew();

        await this.subscriptionRepo.save(next, { extendPeriod: true });
        await this.checkoutIntentRepo.markStatus(intent.orderId, 'completed');
        return { outcome: WebhookOutcome.Provisioned };
      }

      // Late confirmation of a server-initiated token charge whose
      // synchronous response was lost (C-32). The attempt row is the trusted
      // resolver; the amount assertion mirrors the intent path.
      if (chargeAttempt) {
        const receivedAmount = Number.parseFloat(fields.payhere_amount ?? '');
        if (
          Number.isNaN(receivedAmount) ||
          toFixed2(receivedAmount) !== toFixed2(chargeAttempt.expectedAmount)
        ) {
          await this.chargeAttemptRepo.markStatus(fields.order_id!, 'failed', fields.payment_id);
          return { outcome: WebhookOutcome.AmountMismatch }; // no provisioning
        }

        const next = this.applyChargeAttempt(sub, chargeAttempt);
        if (!next) {
          // The money moved but the local state can no longer accept it
          // (e.g. voluntarily canceled between charge and confirmation).
          // Never un-cancel; the attempt is closed as succeeded (payment
          // happened) and the log row is the admin trail.
          await this.chargeAttemptRepo.markStatus(
            fields.order_id!,
            'succeeded',
            fields.payment_id
          );
          return { outcome: WebhookOutcome.StaleEvent };
        }

        await this.subscriptionRepo.save(next, { extendPeriod: true });
        await this.chargeAttemptRepo.markStatus(fields.order_id!, 'succeeded', fields.payment_id);
        return {
          outcome:
            chargeAttempt.kind === 'plan_change'
              ? WebhookOutcome.Provisioned
              : sub.status === SaasStatus.Suspended
                ? WebhookOutcome.Reactivated
                : WebhookOutcome.Renewed,
        };
      }

      // Recurring installment (no intent) — legacy PayHere-driven subscriptions
      if (!idMatches) {
        return { outcome: WebhookOutcome.StaleEvent }; // late event for a replaced subscription
      }
      if (sub.status === SaasStatus.Active || sub.status === SaasStatus.PastDue) {
        await this.subscriptionRepo.save(sub.renew(), { extendPeriod: true }); // anchor = now() (C-23)
        return { outcome: WebhookOutcome.Renewed };
      }
      if (sub.status === SaasStatus.Suspended) {
        // Late successful gateway retry on the retained subscription id:
        // payment received -> the suspension lifts (tier preserved).
        await this.subscriptionRepo.save(sub.reactivate(), { extendPeriod: true });
        return { outcome: WebhookOutcome.Reactivated };
      }
      return { outcome: WebhookOutcome.StaleEvent }; // canceled: never un-cancel
    }

    if (statusCode === 0) {
      return { outcome: WebhookOutcome.LoggedPending };
    }

    if (statusCode === -1 || statusCode === -2 || statusCode === -3) {
      if (intent) {
        await this.checkoutIntentRepo.markStatus(intent.orderId, 'failed');
        return { outcome: WebhookOutcome.LoggedOnly }; // initial checkout failed; status unchanged
      }
      if (chargeAttempt) {
        // Late decline of a server-initiated charge: close the attempt; a
        // failed RENEWAL starts grace (the charge cron's next pass schedules
        // the retry). Plan-change declines leave the current plan untouched.
        await this.chargeAttemptRepo.markStatus(fields.order_id!, 'failed', fields.payment_id);
        if (chargeAttempt.kind === 'renewal' && sub.status === SaasStatus.Active) {
          await this.subscriptionRepo.save(sub.markPastDue(), { extendPeriod: false });
          return { outcome: WebhookOutcome.MarkedPastDue };
        }
        return { outcome: WebhookOutcome.LoggedOnly };
      }
      if (!idMatches) {
        return { outcome: WebhookOutcome.StaleEvent };
      }
      if (sub.status === SaasStatus.Active) {
        await this.subscriptionRepo.save(sub.markPastDue(), { extendPeriod: false });
        return { outcome: WebhookOutcome.MarkedPastDue }; // grace starts; dunning cron suspends later
      }
      return { outcome: WebhookOutcome.LoggedOnly }; // past_due already known / canceled stale
    }

    return { outcome: WebhookOutcome.LoggedOnly };
  }

  /**
   * Map a confirmed successful token charge onto the state machine.
   * Returns null when the current state must not accept it (money moved but
   * e.g. the gym canceled in the interim — never un-cancel).
   */
  private applyChargeAttempt(sub: Subscription, attempt: ChargeAttempt): Subscription | null {
    const keepIds = { subscriptionId: null, customerId: null };

    if (attempt.kind === 'plan_change') {
      switch (sub.status) {
        case SaasStatus.Trialing:
          return sub.convertTrialToPaid(attempt.targetTier, keepIds);
        case SaasStatus.Active:
          // Sync path lost AND the tier flip never applied; same-tier means
          // it somehow already applied -> treat as a paid month (renew).
          return sub.tier === attempt.targetTier
            ? sub.renew()
            : sub.switchPlan(attempt.targetTier);
        case SaasStatus.Suspended:
        case SaasStatus.Canceled:
          return sub.activate(attempt.targetTier, keepIds);
        default:
          return null;
      }
    }

    // renewal
    switch (sub.status) {
      case SaasStatus.Active:
      case SaasStatus.PastDue:
        return sub.renew();
      case SaasStatus.Suspended:
        // Charge initiated before dunning suspended mid-window; payment
        // received -> the suspension lifts (tier preserved).
        return sub.reactivate();
      default:
        return null;
    }
  }
}
