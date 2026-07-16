/**
 * Charge Due Renewals Use Case (UC-7) — THE billing engine of the token
 * model. Daily cron: this application (not PayHere) decides when and how
 * much to charge, via the Charging API against stored card tokens.
 *
 * Per due gym (active|past_due, token stored, next_charge_at <= now):
 *   1. insert a pending renewal charge attempt (one-pending-per-gym gate:
 *      a gym with an unresolved/ambiguous attempt is SKIPPED — never risk a
 *      double charge, C-32)
 *   2. charge the current tier's flat price
 *   3. verified success  → renew() + credit-preserving period extension
 *      (save_gym_subscription also schedules the next charge at the new
 *      period boundary)
 *   4. definite decline  → mark attempt failed; active → past_due (grace
 *      starts); schedule the next automatic retry
 *      (RENEWAL_RETRY_INTERVAL_DAYS, never beyond grace — C-26 keeps total
 *      attempts inside card-network retry budgets)
 *   5. transport fault / gateway-pending / unverifiable → attempt stays
 *      PENDING; the notify webhook finalizes it, or attempt expiry
 *      (CHARGE_ATTEMPT_TTL_HOURS) abandons it and unblocks the schedule
 *
 * Members are NEVER touched. Legacy recurring gyms never appear here
 * (their next_charge_at is NULL — PayHere still drives them).
 */

import type {
  IGymSubscriptionRepository,
  IChargeAttemptRepository,
  ISaasPaymentLogRepository,
} from '@/core/ports/repositories';
import type { ISubscriptionGateway, TokenChargeResult } from '@/core/ports/services';
import { Subscription } from '@/core/domain/subscription/Subscription';
import {
  SaasTier,
  SaasStatus,
  TIER_DISPLAY_NAME,
  CHARGE_ATTEMPT_TTL_HOURS,
} from '@/core/utils/constants/SubscriptionConfig';
import { ConflictError } from '@/utils/errors';

export interface ChargeRenewalsSummary {
  due: number;
  charged: number;
  markedPastDue: number;
  retriesScheduled: number;
  /** Gyms skipped because an unresolved charge attempt is still pending. */
  skippedPendingAttempt: number;
  /** Outcomes left pending for webhook confirmation (transport/pending/unverifiable). */
  awaitingConfirmation: number;
  attemptsExpired: number;
  errors: string[];
}

/** Bound one cron pass; anything beyond rolls into the next daily run. */
const CHARGE_BATCH_LIMIT = 200;

const toStringRecord = (raw: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v == null ? '' : String(v)]));

export class ChargeDueRenewals {
  constructor(
    private readonly subscriptionRepo: IGymSubscriptionRepository,
    private readonly chargeAttemptRepo: IChargeAttemptRepository,
    private readonly subscriptionGateway: ISubscriptionGateway,
    private readonly paymentLogRepo: ISaasPaymentLogRepository,
    /** Per-tier monthly prices, injected from config by the DI container — the core never reads env */
    private readonly pricesLkr: Record<SaasTier, number>
  ) {}

  async execute(now: Date = new Date()): Promise<ChargeRenewalsSummary> {
    const summary: ChargeRenewalsSummary = {
      due: 0,
      charged: 0,
      markedPastDue: 0,
      retriesScheduled: 0,
      skippedPendingAttempt: 0,
      awaitingConfirmation: 0,
      attemptsExpired: 0,
      errors: [],
    };

    // Abandon ambiguous attempts past the TTL so the schedule can move again.
    summary.attemptsExpired = await this.chargeAttemptRepo.expireStale(
      new Date(now.getTime() - CHARGE_ATTEMPT_TTL_HOURS * 60 * 60 * 1000)
    );

    const due = await this.subscriptionRepo.findDueForCharge(now, CHARGE_BATCH_LIMIT);
    summary.due = due.length;

    for (const sub of due) {
      try {
        await this.chargeOne(sub, now, summary);
      } catch (error) {
        summary.errors.push(
          `gym ${sub.gymId}: ${error instanceof Error ? error.message : 'unknown error'}`
        );
      }
    }

    return summary;
  }

  private async chargeOne(
    sub: Subscription,
    now: Date,
    summary: ChargeRenewalsSummary
  ): Promise<void> {
    const customerToken = sub.payhereCustomerId;
    if (!customerToken) return; // defensive: the query already filters

    const amount = this.pricesLkr[sub.tier];
    const orderId = `REN-${sub.gymId}-${now.getTime()}`;

    try {
      await this.chargeAttemptRepo.createPending({
        orderId,
        gymId: sub.gymId,
        kind: 'renewal',
        targetTier: sub.tier,
        expectedAmount: amount,
        currency: 'LKR',
      });
    } catch (error) {
      if (error instanceof ConflictError) {
        // An earlier attempt is unresolved (lost response awaiting webhook /
        // TTL). Charging again could double-bill — skip this gym.
        summary.skippedPendingAttempt++;
        return;
      }
      throw error;
    }

    let charge: TokenChargeResult;
    try {
      charge = await this.subscriptionGateway.chargeCustomerToken({
        orderId,
        amount,
        currency: 'LKR',
        customerToken,
        items: `${TIER_DISPLAY_NAME[sub.tier]} Plan — Monthly`,
        gymId: sub.gymId,
      });
    } catch (error) {
      // Transport fault: outcome UNKNOWN. Attempt stays pending (blocks the
      // schedule); the webhook or TTL expiry resolves it.
      summary.awaitingConfirmation++;
      summary.errors.push(
        `gym ${sub.gymId}: charge transport fault (attempt ${orderId} left pending): ${
          error instanceof Error ? error.message : 'unknown'
        }`
      );
      return;
    }

    if (charge.paymentId) {
      await this.paymentLogRepo.insertIfNew({
        gymId: sub.gymId,
        orderId,
        payherePaymentId: charge.paymentId,
        payhereSubscriptionId: null,
        statusCode: charge.statusCode,
        signatureValid: charge.signatureValid,
        messageType: 'TOKEN_CHARGE',
        statusMessage: charge.statusMessage,
        rawPayload: toStringRecord(charge.rawPayload),
      });
    }

    if (charge.statusCode === 2 && charge.signatureValid) {
      // renew() recovers past_due → active too; the save RPC banks unused
      // days (GREATEST rule) and schedules the next charge at the boundary.
      await this.subscriptionRepo.save(sub.renew(), { extendPeriod: true });
      await this.chargeAttemptRepo.markStatus(orderId, 'succeeded', charge.paymentId);
      summary.charged++;
      return;
    }

    if (charge.statusCode === 0 || (charge.statusCode === 2 && !charge.signatureValid)) {
      // Gateway-pending or unverifiable success: leave the attempt pending
      // for the signed notify callback.
      summary.awaitingConfirmation++;
      return;
    }

    // Definite decline (-1/-2)
    await this.chargeAttemptRepo.markStatus(orderId, 'failed', charge.paymentId);
    if (sub.status === SaasStatus.Active) {
      await this.subscriptionRepo.save(sub.markPastDue(), { extendPeriod: false });
      summary.markedPastDue++;
    }
    const nextRetry = await this.subscriptionRepo.scheduleChargeRetry(sub.gymId);
    if (nextRetry) {
      summary.retriesScheduled++;
    }
  }
}
