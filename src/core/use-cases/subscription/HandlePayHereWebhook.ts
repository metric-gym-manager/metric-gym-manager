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
 */

import type {
  IGymSubscriptionRepository,
  ICheckoutIntentRepository,
  ISaasPaymentLogRepository,
  CheckoutIntent,
} from '@/core/ports/repositories';
import { Subscription } from '@/core/domain/subscription/Subscription';
import { SaasTier, SaasStatus } from '@/core/utils/constants/SubscriptionConfig';

export enum WebhookOutcome {
  Provisioned = 'PROVISIONED',
  Renewed = 'RENEWED',
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
    private readonly paymentLogRepo: ISaasPaymentLogRepository
  ) {}

  async execute(fields: Record<string, string>): Promise<{ outcome: WebhookOutcome }> {
    // md5sig must never persist anywhere (plan C-24: redaction is load-bearing)
    const rawPayload: Record<string, string> = { ...fields, md5sig: '[REDACTED]' };
    const statusCode = Number.parseInt(fields.status_code ?? '', 10);
    const messageType = fields.message_type ?? null;
    const statusMessage = fields.status_message ?? null;

    // ---- 1. Resolve gym --------------------------------------------------
    let intent: CheckoutIntent | null = null;
    let sub: Subscription | null = null;

    if (fields.order_id) {
      intent = await this.checkoutIntentRepo.findPendingByOrderId(fields.order_id);
    }
    if (intent) {
      sub = await this.subscriptionRepo.findByGymId(intent.gymId);
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
      (Boolean(fields.subscription_id) && fields.subscription_id === sub.payhereSubscriptionId);

    // ---- 4. Cancel reconciliation ----------------------------------------
    if (messageType === 'RECURRING_STOPPED' || fields.item_rec_status === '-1') {
      if (
        idMatches &&
        sub.tier === SaasTier.Pro &&
        (sub.status === SaasStatus.Active || sub.status === SaasStatus.PastDue)
      ) {
        await this.subscriptionRepo.save(sub.cancelPro(), { extendPeriod: false });
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

        const next =
          sub.tier === SaasTier.Free ||
          (sub.tier === SaasTier.Pro && sub.status === SaasStatus.Canceled)
            ? sub.activatePro({
                subscriptionId: fields.subscription_id ?? null,
                customerId: fields.customer_token ?? null,
              })
            : sub.renew(); // rare: intent completed while already pro/active|past_due

        await this.subscriptionRepo.save(next, { extendPeriod: true });
        await this.checkoutIntentRepo.markStatus(intent.orderId, 'completed');
        return { outcome: WebhookOutcome.Provisioned };
      }

      // Recurring installment (no intent)
      if (!idMatches) {
        return { outcome: WebhookOutcome.StaleEvent }; // late event for a replaced subscription
      }
      if (
        sub.tier === SaasTier.Pro &&
        (sub.status === SaasStatus.Active || sub.status === SaasStatus.PastDue)
      ) {
        await this.subscriptionRepo.save(sub.renew(), { extendPeriod: true }); // anchor = now() (C-23)
        return { outcome: WebhookOutcome.Renewed };
      }
      return { outcome: WebhookOutcome.StaleEvent }; // canceled: never un-cancel
    }

    if (statusCode === 0) {
      return { outcome: WebhookOutcome.LoggedPending };
    }

    if (statusCode === -1 || statusCode === -2 || statusCode === -3) {
      if (intent) {
        await this.checkoutIntentRepo.markStatus(intent.orderId, 'failed');
        return { outcome: WebhookOutcome.LoggedOnly }; // initial checkout failed; gym stays Free
      }
      if (!idMatches) {
        return { outcome: WebhookOutcome.StaleEvent };
      }
      if (sub.tier === SaasTier.Pro && sub.status === SaasStatus.Active) {
        await this.subscriptionRepo.save(sub.markPastDue(), { extendPeriod: false });
        return { outcome: WebhookOutcome.MarkedPastDue }; // grace starts; dunning cron downgrades later
      }
      return { outcome: WebhookOutcome.LoggedOnly }; // past_due already known / canceled stale
    }

    return { outcome: WebhookOutcome.LoggedOnly };
  }
}
