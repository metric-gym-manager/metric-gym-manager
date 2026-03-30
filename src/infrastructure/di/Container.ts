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

// Services
import { TextLkSMSProvider } from '@/infrastructure/sms/providers/TextLkSMSProvider';
import { MockSMSProvider } from '@/infrastructure/sms/providers/MockSMSProvider';

// Use Cases
import { RegisterMember } from '@/core/use-cases/member/RegisterMember';
import { CollectPayment } from '@/core/use-cases/payment/CollectPayment';
import { SendAutomatedReminders } from '@/core/use-cases/reminder/SendAutomatedReminders';
import { UpdateExpiredStatus } from '@/core/use-cases/member/UpdateExpiredStatus';
import { CancelOverdueMembers } from '@/core/use-cases/member/CancelOverdueMembers';
import { ExpireSuspendedMembers } from '@/core/use-cases/member/ExpireSuspendedMembers';
import { SuspendMember } from '@/core/use-cases/member/SuspendMember';
import { ReactivateMember } from '@/core/use-cases/member/ReactivateMember';
import { CancelMember } from '@/core/use-cases/member/CancelMember';

// Interfaces
import type { IMemberRepository } from '@/core/ports/repositories/IMemberRepository';
import type { IPaymentRepository } from '@/core/ports/repositories/IPaymentRepository';
import type { ISMSRepository } from '@/core/ports/repositories/ISMSRepository';
import type { ISMSProvider } from '@/core/ports/services/ISMSProvider';

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

  // ============================================================
  // SERVICES
  // ============================================================

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
      this.getSMSProvider()
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
