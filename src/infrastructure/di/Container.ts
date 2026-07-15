/**
 * Dependency Injection Container
 *
 * Central place for wiring up dependencies and creating instances.
 *
 * This container follows the Dependency Injection pattern to:
 * 1. Create infrastructure implementations (repositories, services)
 * 2. Wire up use cases with their dependencies
 * 3. Provide a single source of truth for dependency management
 *
 * Benefits:
 * - Easy to swap implementations (e.g., MockSMSProvider in development)
 * - Testable (can inject mocks)
 * - Clear dependency graph
 */

import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// Repositories
import { SupabaseMemberRepository } from '@/infrastructure/database/repositories/SupabaseMemberRepository';
import { SupabasePaymentRepository } from '@/infrastructure/database/repositories/SupabasePaymentRepository';
import { SupabaseSMSRepository } from '@/infrastructure/database/repositories/SupabaseSMSRepository';
import { SupabaseGymSubscriptionRepository } from '@/infrastructure/database/repositories/SupabaseGymSubscriptionRepository';
import { SupabaseCheckoutIntentRepository } from '@/infrastructure/database/repositories/SupabaseCheckoutIntentRepository';
import { SupabaseSaasPaymentLogRepository } from '@/infrastructure/database/repositories/SupabaseSaasPaymentLogRepository';
import { SupabaseChargeAttemptRepository } from '@/infrastructure/database/repositories/SupabaseChargeAttemptRepository';

// Payment gateways
import { PayHereGateway } from '@/infrastructure/payments/PayHereGateway';
import { PayHereSubscriptionGateway } from '@/infrastructure/payments/PayHereSubscriptionGateway';
import { getPayhereConfig } from '@/lib/payhere/config';
import { SaasTier } from '@/core/utils/constants/SubscriptionConfig';

// Services
import { TextLkSMSProvider } from '@/infrastructure/sms/providers/TextLkSMSProvider';
import { MockSMSProvider } from '@/infrastructure/sms/providers/MockSMSProvider';
import { R2StorageProvider } from '@/infrastructure/storage/R2StorageProvider';
import { MockStorageProvider } from '@/infrastructure/storage/MockStorageProvider';

// Use Cases
import { RegisterMember } from '@/core/use-cases/member/RegisterMember';
import { VerifyMember } from '@/core/use-cases/member/VerifyMember';
import { CollectPayment } from '@/core/use-cases/payment/CollectPayment';
import { IssueDayPass } from '@/core/use-cases/payment/IssueDayPass';
import { SendAutomatedReminders } from '@/core/use-cases/reminder/SendAutomatedReminders';
import { UpdateExpiredStatus } from '@/core/use-cases/member/UpdateExpiredStatus';
import { CancelOverdueMembers } from '@/core/use-cases/member/CancelOverdueMembers';
import { ExpireSuspendedMembers } from '@/core/use-cases/member/ExpireSuspendedMembers';
import { SuspendMember } from '@/core/use-cases/member/SuspendMember';
import { ReactivateMember } from '@/core/use-cases/member/ReactivateMember';
import { CancelMember } from '@/core/use-cases/member/CancelMember';
import { GenerateCheckoutUrl } from '@/core/use-cases/subscription/GenerateCheckoutUrl';
import { HandlePayHereWebhook } from '@/core/use-cases/subscription/HandlePayHereWebhook';
import { ProcessDunning } from '@/core/use-cases/subscription/ProcessDunning';
import { ProcessTrialExpiry } from '@/core/use-cases/subscription/ProcessTrialExpiry';
import { CancelSubscription } from '@/core/use-cases/subscription/CancelSubscription';
import { ChangePlan } from '@/core/use-cases/subscription/ChangePlan';
import { ChargeDueRenewals } from '@/core/use-cases/subscription/ChargeDueRenewals';

// Interfaces
import type { IMemberRepository } from '@/core/ports/repositories/IMemberRepository';
import type { IPaymentRepository } from '@/core/ports/repositories/IPaymentRepository';
import type { ISMSRepository } from '@/core/ports/repositories/ISMSRepository';
import type { IGymSubscriptionRepository } from '@/core/ports/repositories/IGymSubscriptionRepository';
import type { ICheckoutIntentRepository } from '@/core/ports/repositories/ICheckoutIntentRepository';
import type { ISaasPaymentLogRepository } from '@/core/ports/repositories/ISaasPaymentLogRepository';
import type { IChargeAttemptRepository } from '@/core/ports/repositories/IChargeAttemptRepository';
import type { ISMSProvider } from '@/core/ports/services/ISMSProvider';
import type { IPaymentGateway, ISubscriptionGateway } from '@/core/ports/services';
import type { IStorageProvider } from '@/core/ports/services/IStorageProvider';

/**
 * Dependency Injection Container
 *
 * @example
 * // In an API route
 * const container = await getContainer();
 * const registerMember = await container.getRegisterMemberUseCase();
 * const result = await registerMember.execute({ ... });
 *
 * @example
 * // In a cron job
 * const container = await getContainer();
 * const sendReminders = await container.getSendAutomatedRemindersUseCase();
 * const summary = await sendReminders.execute();
 */
export class Container {
  private supabase: SupabaseClient;

  // Singleton instances (lazy-initialized)
  private memberRepo?: IMemberRepository;
  private paymentRepo?: IPaymentRepository;
  private smsRepo?: ISMSRepository;
  private smsProvider?: ISMSProvider;
  private gymSubscriptionRepo?: IGymSubscriptionRepository;
  private checkoutIntentRepo?: ICheckoutIntentRepository;
  private saasPaymentLogRepo?: ISaasPaymentLogRepository;
  private chargeAttemptRepo?: IChargeAttemptRepository;
  private paymentGateway?: IPaymentGateway;
  private subscriptionGateway?: ISubscriptionGateway;
  private storageProvider?: IStorageProvider;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // ============================================================
  // REPOSITORIES
  // ============================================================

  /**
   * Get Member Repository
   */
  getMemberRepository(): IMemberRepository {
    if (!this.memberRepo) {
      this.memberRepo = new SupabaseMemberRepository(this.supabase);
    }
    return this.memberRepo;
  }

  /**
   * Get Payment Repository
   */
  getPaymentRepository(): IPaymentRepository {
    if (!this.paymentRepo) {
      this.paymentRepo = new SupabasePaymentRepository(this.supabase);
    }
    return this.paymentRepo;
  }

  /**
   * Get SMS Repository
   */
  getSMSRepository(): ISMSRepository {
    if (!this.smsRepo) {
      this.smsRepo = new SupabaseSMSRepository(this.supabase);
    }
    return this.smsRepo;
  }

  /**
   * Get Gym Subscription Repository (SaaS billing state on the gyms row)
   */
  getGymSubscriptionRepository(): IGymSubscriptionRepository {
    if (!this.gymSubscriptionRepo) {
      this.gymSubscriptionRepo = new SupabaseGymSubscriptionRepository(this.supabase);
    }
    return this.gymSubscriptionRepo;
  }

  /**
   * Get Checkout Intent Repository (PayHere order_id -> gym attribution)
   */
  getCheckoutIntentRepository(): ICheckoutIntentRepository {
    if (!this.checkoutIntentRepo) {
      this.checkoutIntentRepo = new SupabaseCheckoutIntentRepository(this.supabase);
    }
    return this.checkoutIntentRepo;
  }

  /**
   * Get SaaS Payment Log Repository (webhook audit + billing history)
   */
  getSaasPaymentLogRepository(): ISaasPaymentLogRepository {
    if (!this.saasPaymentLogRepo) {
      this.saasPaymentLogRepo = new SupabaseSaasPaymentLogRepository(this.supabase);
    }
    return this.saasPaymentLogRepo;
  }

  /**
   * Get Charge Attempt Repository (server-initiated token-charge ledger)
   */
  getChargeAttemptRepository(): IChargeAttemptRepository {
    if (!this.chargeAttemptRepo) {
      this.chargeAttemptRepo = new SupabaseChargeAttemptRepository(this.supabase);
    }
    return this.chargeAttemptRepo;
  }

  /** Per-tier monthly prices from config — the single injection point (amount authority). */
  private getTierPricesLkr(): Record<SaasTier, number> {
    const payhere = getPayhereConfig();
    return {
      [SaasTier.Lite]: payhere.litePriceLkr,
      [SaasTier.Pro]: payhere.proPriceLkr,
      [SaasTier.Enterprise]: payhere.enterprisePriceLkr,
    };
  }

  // ============================================================
  // SERVICES
  // ============================================================

  /**
   * Get PayHere redirect/form payment gateway
   */
  getPaymentGateway(): IPaymentGateway {
    if (!this.paymentGateway) {
      this.paymentGateway = new PayHereGateway();
    }
    return this.paymentGateway;
  }

  /**
   * Get PayHere OAuth REST subscription gateway (cancel / list payments)
   */
  getSubscriptionGateway(): ISubscriptionGateway {
    if (!this.subscriptionGateway) {
      this.subscriptionGateway = new PayHereSubscriptionGateway();
    }
    return this.subscriptionGateway;
  }

  /**
   * Get SMS Provider
   *
   * Returns real provider (Text.lk) if ENABLE_REAL_SMS=true,
   * otherwise returns mock provider for development.
   */
  getSMSProvider(): ISMSProvider {
    if (!this.smsProvider) {
      const useRealSms = process.env.ENABLE_REAL_SMS === 'true';

      if (useRealSms) {
        this.smsProvider = new TextLkSMSProvider();
        console.log('📱 Using Text.lk SMS Provider (ENABLE_REAL_SMS=true)');
      } else {
        this.smsProvider = new MockSMSProvider();
        console.log('📱 Using Mock SMS Provider (ENABLE_REAL_SMS=false or not set)');
      }
    }
    return this.smsProvider;
  }

  /**
   * Get Storage Provider
   *
   * Returns the Cloudflare R2 provider when R2 credentials are configured,
   * otherwise falls back to the in-memory mock (development/tests).
   */
  getStorageProvider(): IStorageProvider {
    if (!this.storageProvider) {
      const r2Configured =
        !!process.env.R2_ACCOUNT_ID &&
        !!process.env.R2_ACCESS_KEY_ID &&
        !!process.env.R2_SECRET_ACCESS_KEY &&
        !!process.env.R2_BUCKET_NAME;

      if (r2Configured) {
        this.storageProvider = new R2StorageProvider();
      } else {
        this.storageProvider = new MockStorageProvider();
        console.log('🗄️ Using Mock Storage Provider (R2 env vars not set)');
      }
    }
    return this.storageProvider;
  }

  // ============================================================
  // USE CASES - MEMBER
  // ============================================================

  /**
   * Get RegisterMember use case
   */
  getRegisterMemberUseCase(): RegisterMember {
    return new RegisterMember(
      this.getMemberRepository(),
      this.getPaymentRepository(),
      this.getSMSProvider(),
      this.getSMSRepository()
    );
  }

  /**
   * Get VerifyMember use case
   */
  getVerifyMemberUseCase(): VerifyMember {
    return new VerifyMember(this.getMemberRepository());
  }

  /**
   * Get UpdateExpiredStatus use case
   */
  getUpdateExpiredStatusUseCase(): UpdateExpiredStatus {
    return new UpdateExpiredStatus(this.getMemberRepository());
  }

  /**
   * Get CancelOverdueMembers use case
   */
  getCancelOverdueMembersUseCase(): CancelOverdueMembers {
    return new CancelOverdueMembers(this.getMemberRepository());
  }

  /**
   * Get SuspendMember use case
   */
  getSuspendMemberUseCase(): SuspendMember {
    return new SuspendMember(this.getMemberRepository());
  }

  /**
   * Get ReactivateMember use case
   */
  getReactivateMemberUseCase(): ReactivateMember {
    return new ReactivateMember(this.getMemberRepository());
  }

  /**
   * Get CancelMember use case
   */
  getCancelMemberUseCase(): CancelMember {
    return new CancelMember(this.getMemberRepository());
  }

  /**
   * Get ExpireSuspendedMembers use case
   */
  getExpireSuspendedMembersUseCase(): ExpireSuspendedMembers {
    return new ExpireSuspendedMembers(this.getMemberRepository());
  }

  // ============================================================
  // USE CASES - PAYMENT
  // ============================================================

  /**
   * Get CollectPayment use case
   */
  getCollectPaymentUseCase(): CollectPayment {
    return new CollectPayment(
      this.getMemberRepository(),
      this.getPaymentRepository(),
      this.getSMSProvider(),
      this.getSMSRepository()
    );
  }

  /**
   * Get IssueDayPass use case
   */
  getIssueDayPassUseCase(): IssueDayPass {
    return new IssueDayPass(
      this.getMemberRepository(),
      this.getPaymentRepository(),
      this.getSMSProvider(),
      this.getSMSRepository()
    );
  }

  // ============================================================
  // USE CASES - SAAS SUBSCRIPTION (billing routes use getAdminContainer())
  // ============================================================

  /**
   * Get GenerateCheckoutUrl use case (UC-1)
   * All tiers paid; no free/skip path — the price map covers every SaasTier.
   */
  getGenerateCheckoutUrlUseCase(): GenerateCheckoutUrl {
    return new GenerateCheckoutUrl(
      this.getGymSubscriptionRepository(),
      this.getCheckoutIntentRepository(),
      this.getPaymentGateway(),
      this.getTierPricesLkr()
    );
  }

  /**
   * Get HandlePayHereWebhook use case (UC-2)
   */
  getHandlePayHereWebhookUseCase(): HandlePayHereWebhook {
    return new HandlePayHereWebhook(
      this.getGymSubscriptionRepository(),
      this.getCheckoutIntentRepository(),
      this.getSaasPaymentLogRepository(),
      this.getChargeAttemptRepository()
    );
  }

  /**
   * Get ProcessDunning use case (UC-3)
   */
  getProcessDunningUseCase(): ProcessDunning {
    return new ProcessDunning(
      this.getGymSubscriptionRepository(),
      this.getCheckoutIntentRepository()
    );
  }

  /**
   * Get CancelSubscription use case (UC-4)
   */
  getCancelSubscriptionUseCase(): CancelSubscription {
    return new CancelSubscription(
      this.getGymSubscriptionRepository(),
      this.getSubscriptionGateway()
    );
  }

  /**
   * Get ProcessTrialExpiry use case (UC-5)
   */
  getProcessTrialExpiryUseCase(): ProcessTrialExpiry {
    return new ProcessTrialExpiry(this.getGymSubscriptionRepository());
  }

  /**
   * Get ChangePlan use case (UC-6) — one-click tier change / reactivation
   * against the stored card token.
   */
  getChangePlanUseCase(): ChangePlan {
    return new ChangePlan(
      this.getGymSubscriptionRepository(),
      this.getChargeAttemptRepository(),
      this.getSubscriptionGateway(),
      this.getSaasPaymentLogRepository(),
      this.getTierPricesLkr()
    );
  }

  /**
   * Get ChargeDueRenewals use case (UC-7) — the token-billing engine
   * (daily charge-renewals cron).
   */
  getChargeDueRenewalsUseCase(): ChargeDueRenewals {
    return new ChargeDueRenewals(
      this.getGymSubscriptionRepository(),
      this.getChargeAttemptRepository(),
      this.getSubscriptionGateway(),
      this.getSaasPaymentLogRepository(),
      this.getTierPricesLkr()
    );
  }

  // ============================================================
  // USE CASES - REMINDERS
  // ============================================================

  /**
   * Get SendAutomatedReminders use case
   */
  getSendAutomatedRemindersUseCase(): SendAutomatedReminders {
    return new SendAutomatedReminders(
      this.getMemberRepository(),
      this.getSMSRepository(),
      this.getSMSProvider(),
      // Billing-status source: suspended/canceled gyms are skipped
      this.getGymSubscriptionRepository()
    );
  }
}

/**
 * Create and return a configured Container instance
 *
 * This is the main entry point for dependency injection.
 * Call this in your API routes and cron jobs.
 *
 * @example
 * // In an API route
 * export async function POST(request: NextRequest) {
 *   const container = await getContainer();
 *   const registerMember = container.getRegisterMemberUseCase();
 *   // ... use the use case
 * }
 *
 * @returns Configured Container instance
 */
export async function getContainer(): Promise<Container> {
  const supabase = await createClient();
  return new Container(supabase);
}

/**
 * Create Container with admin client (for cron jobs)
 *
 * Use this for cron jobs that need to bypass RLS.
 *
 * @example
 * // In a cron job route
 * export async function GET() {
 *   const container = await getAdminContainer();
 *   const sendReminders = container.getSendAutomatedRemindersUseCase();
 *   const summary = await sendReminders.execute();
 *   return NextResponse.json(summary);
 * }
 *
 * @returns Container with admin Supabase client
 */
export async function getAdminContainer(): Promise<Container> {
  // Import admin client dynamically to avoid issues
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  return new Container(supabase);
}
