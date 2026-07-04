> ⚠️ **SUPERSEDED (2026-07-04).** This 3-tier (Basic/Pro/Enterprise) plan was never implemented —
> none of its migrations or columns exist. The shipped system is the 2-tier Free/Pro PayHere
> subscription: see `docs/SAAS_SUBSCRIPTION_IMPLEMENTATION.md` and
> `docs/Payhere_subscritption_integration/payhere-subscription-execution-plan.md` (register C-9).
> The `feature_overrides` entitlement idea below remains unimplemented and out of scope.

Tier-Based Subscription System Implementation Plan

 Overview

 Implement 3-tier subscription system (Basic, Pro, Enterprise) with graduated member limits and feature restrictions following Clean Architecture  
 patterns.

 ---
 User Requirements Summary

 Basic Tier Limitations:
 1. 40 members max - block registration when reached
 2. No automated SMS reminders - show "upgrade to enable" in reminders page
 3. No manual SMS receipts - silently skip in CollectPayment use case
 4. Button morphing - at capacity, replace "Add Member" + "Bulk Add" with "Upgrade for More"
 5. Global countdown - show "X member slots remaining" at top of all pages
 6. Header badge - show "Basic" with "Upgrade" link

 Pro Tier (Placeholder):
 - 500 members max
 - All SMS features enabled

 Enterprise Tier (Placeholder):
 - Unlimited members
 - All features enabled

 Pricing Page:
 - New route /pricing with placeholder UI
 - Show 3 tiers with appropriate CTAs

 ---
 Implementation Layers (Bottom-Up)

 LAYER 1: Database Migration

 File: supabase/migrations/20260415000001_add_entitlements_to_gyms.sql

 -- Create enum for base subscription plans
 CREATE TYPE subscription_plan AS ENUM ('basic', 'pro', 'enterprise');

 -- Add base plan column
 ALTER TABLE gyms
 ADD COLUMN subscription_plan subscription_plan NOT NULL DEFAULT 'basic';

 -- ✅ ADD: Feature overrides column (for custom entitlements)
 ALTER TABLE gyms
 ADD COLUMN feature_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

 -- Create index
 CREATE INDEX idx_gyms_subscription_plan ON gyms(subscription_plan);

 -- ✅ ADD: GIN index for feature_overrides JSONB queries
 CREATE INDEX idx_gyms_feature_overrides ON gyms USING GIN (feature_overrides);

 COMMENT ON COLUMN gyms.subscription_plan IS 'Base subscription plan (billing tier)';
 COMMENT ON COLUMN gyms.feature_overrides IS 'Custom feature entitlements that override base plan (e.g., {"automatedRemindersEnabled": true})';

 ---
 LAYER 2: Domain Layer (Entitlement Engine)

 File: src/core/domain/gym/Entitlements.ts (NEW)

 Purpose: Single source of truth for feature entitlements. Implements Base Plan + Overrides = Computed Entitlements pattern.

 Key Exports:

 // 1. Plan type (used ONLY for base templates, never in business logic)
 export type SubscriptionPlan = 'basic' | 'pro' | 'enterprise';

 // 2. Define every feature the app controls
 export interface GymEntitlements {
   maxMembers: number | null;           // null = unlimited
   automatedRemindersEnabled: boolean;
   manualSmsReceiptsEnabled: boolean;
   advancedAnalyticsEnabled: boolean;
   bulkImportEnabled: boolean;
   customBrandingEnabled: boolean;
 }

 // 3. Base plan templates (private - only used internally)
 const BASE_PLAN_ENTITLEMENTS: Record<SubscriptionPlan, GymEntitlements> = {
   basic: {
     maxMembers: 40,
     automatedRemindersEnabled: false,
     manualSmsReceiptsEnabled: false,
     advancedAnalyticsEnabled: false,
     bulkImportEnabled: true,  // Allow bulk import on all tiers
     customBrandingEnabled: false,
   },
   pro: {
     maxMembers: 500,
     automatedRemindersEnabled: true,
     manualSmsReceiptsEnabled: true,
     advancedAnalyticsEnabled: true,
     bulkImportEnabled: true,
     customBrandingEnabled: false,
   },
   enterprise: {
     maxMembers: null,  // Unlimited
     automatedRemindersEnabled: true,
     manualSmsReceiptsEnabled: true,
     advancedAnalyticsEnabled: true,
     bulkImportEnabled: true,
     customBrandingEnabled: true,
   },
 };

 // 4. The Entitlement Engine - merges base plan + custom overrides
 export function calculateEntitlements(
   plan: SubscriptionPlan,
   overrides: Partial<GymEntitlements> = {}
 ): GymEntitlements {
   return {
     ...BASE_PLAN_ENTITLEMENTS[plan],
     ...overrides,  // Overrides trump base plan
   };
 }

 // 5. Helper functions for common checks
 export function canAddMembers(
   entitlements: GymEntitlements,
   currentCount: number,
   countToAdd: number = 1
 ): boolean {
   if (entitlements.maxMembers === null) return true;  // Unlimited
   return currentCount + countToAdd <= entitlements.maxMembers;
 }

 export function getRemainingSlots(
   entitlements: GymEntitlements,
   currentCount: number
 ): number | null {
   if (entitlements.maxMembers === null) return null;  // Unlimited
   return Math.max(0, entitlements.maxMembers - currentCount);
 }

 export function isAtCapacity(
   entitlements: GymEntitlements,
   currentCount: number
 ): boolean {
   if (entitlements.maxMembers === null) return false;  // Never at capacity if unlimited
   return currentCount >= entitlements.maxMembers;
 }

 // 6. Plan metadata (for display purposes only)
 export const PLAN_METADATA: Record<SubscriptionPlan, { label: string; price: string }> = {
   basic: { label: 'Basic', price: 'Free' },
   pro: { label: 'Pro', price: '$49/month' },
   enterprise: { label: 'Enterprise', price: 'Contact Sales' },
 }

 ---
 LAYER 3: Error Handling

 File: src/core/utils/errors/DomainError.ts (ADD)

 export class EntitlementRestrictionError extends DomainError {
   constructor(
     public readonly feature: string,
     message: string,
     public readonly metadata?: Record<string, unknown>
   ) {
     super(message, 'ENTITLEMENT_RESTRICTION', 402);  // 402 Payment Required
     this.name = 'EntitlementRestrictionError';
   }
 }

 Usage Examples:

 // Member capacity limit
 throw new EntitlementRestrictionError(
   'maxMembers',
   `Member capacity limit of ${maxMembers} reached. Upgrade to add more members.`,
   { current: 40, max: 40, plan: 'basic' }
 );

 // Feature not enabled
 throw new EntitlementRestrictionError(
   'automatedRemindersEnabled',
   'Automated SMS reminders are not enabled on your current plan.',
   { plan: 'basic', requiredPlan: 'pro' }
 );

 Export from: src/core/utils/errors/index.ts

 ---
 LAYER 4: Type Updates

 File: src/features/auth/types/index.ts (UPDATE)

 import type { SubscriptionPlan, GymEntitlements } from '@/core/domain/gym/Entitlements';

 export interface GymProfile {
   // ... existing fields
   subscription_plan: SubscriptionPlan;              // ✅ ADD - Base billing plan
   feature_overrides: Partial<GymEntitlements>;      // ✅ ADD - Custom entitlements
 }

 Files to Update SELECT queries:
 - src/lib/middleware/auth.ts - getCurrentGymProfile()
 - src/lib/middleware/api-auth.ts - getApiGymProfile()

 Both need: select('..., subscription_plan, feature_overrides')

 Example:

 // src/lib/middleware/auth.ts
 const { data: gymProfile } = await supabase
   .from('gyms')
   .select('id, name, subscription_plan, feature_overrides, created_at')
   .eq('id', session.user.user_metadata.gym_id)
   .single();

 return {
   ...gymProfile,
   feature_overrides: gymProfile.feature_overrides || {},  // Ensure object, not null
 } as GymProfile;

 ---
 LAYER 5: Repository Layer

 File: src/core/ports/repositories/IMemberRepository.ts (ADD METHOD)

 /**
  * Count total members for a gym (excludes cancelled)
  */
 countMembers(gymId: string): Promise<number>;

 File: src/infrastructure/database/repositories/SupabaseMemberRepository.ts (IMPLEMENT)

 async countMembers(gymId: string): Promise<number> {
   const { count, error } = await this.supabase
     .from('members')
     .select('*', { count: 'exact', head: true })
     .eq('gym_id', gymId)
     .in('status', ['active', 'expired', 'suspended']); // Exclude cancelled

   if (error) throw new DatabaseError(`Failed to count members: ${error.message}`);
   return count ?? 0;
 }

 Why exclude cancelled: Terminal state, don't penalize for historical data.

 ---
 LAYER 6: Use Case Updates

 RegisterMember Use Case

 File: src/core/use-cases/member/RegisterMember.ts (MODIFY)

 Changes:
 1. Add imports:
 import { calculateEntitlements, canAddMembers, type GymEntitlements } from '@/core/domain/gym/Entitlements';
 import { EntitlementRestrictionError } from '@/core/utils/errors';

 2. Update input interface:
 export interface RegisterMemberInput {
   gymId: string;
   gymSubscriptionPlan: SubscriptionPlan;              // ✅ ADD - Base plan
   gymFeatureOverrides: Partial<GymEntitlements>;      // ✅ ADD - Custom overrides
   // ... existing fields
 }

 3. Add validation in execute() method (BEFORE duplicate check):
 // Calculate computed entitlements (base + overrides)
 const entitlements = calculateEntitlements(
   input.gymSubscriptionPlan,
   input.gymFeatureOverrides
 );

 // Check member capacity entitlement
 const currentMemberCount = await this.memberRepo.countMembers(input.gymId);

 if (!canAddMembers(entitlements, currentMemberCount, 1)) {
   throw new EntitlementRestrictionError(
     'maxMembers',
     `Member capacity limit of ${entitlements.maxMembers} reached. Upgrade to add more members.`,
     {
       current: currentMemberCount,
       max: entitlements.maxMembers,
       plan: input.gymSubscriptionPlan,
     }
   );
 }

 CollectPayment Use Case

 File: src/core/use-cases/payment/CollectPayment.ts (MODIFY)

 Changes:
 1. Add imports:
 import { calculateEntitlements, type GymEntitlements, type SubscriptionPlan } from '@/core/domain/gym/Entitlements';

 2. Update input interface:
 export interface CollectPaymentInput {
   // ... existing fields
   gymSubscriptionPlan: SubscriptionPlan;              // ✅ ADD
   gymFeatureOverrides: Partial<GymEntitlements>;      // ✅ ADD
 }

 3. Store entitlements in class:
 export class CollectPayment {
   private gymEntitlements?: GymEntitlements;

   async execute(input: CollectPaymentInput): Promise<CollectPaymentOutput> {
     // Calculate entitlements once at start
     this.gymEntitlements = calculateEntitlements(
       input.gymSubscriptionPlan,
       input.gymFeatureOverrides
     );
     // ... rest
   }
 }

 4. Update sendReceiptSMS() method:
 private async sendReceiptSMS(...): Promise<void> {
   // ✅ Check feature entitlement (not plan name)
   if (!this.gymEntitlements?.manualSmsReceiptsEnabled) {
     console.log('[Entitlements] Manual SMS receipts not enabled - skipping');
     return; // Silent skip
   }
   // ... existing SMS code
 }

 ---
 LAYER 7: API Endpoints

 Gym Entitlements Endpoint (NEW)

 File: src/app/api/gyms/entitlements/route.ts (NEW)

 Purpose: Fast endpoint providing computed entitlements + usage data for frontend

 Response:
 {
   "success": true,
   "data": {
     "plan": "basic",  // For display only (e.g., badge label)
     "features": {
       "maxMembers": 40,
       "automatedRemindersEnabled": false,
       "manualSmsReceiptsEnabled": false,
       "advancedAnalyticsEnabled": false,
       "bulkImportEnabled": true,
       "customBrandingEnabled": false
     },
     "usage": {
       "currentMemberCount": 35,
       "slotsRemaining": 5,
       "isAtCapacity": false
     }
   }
 }

 Implementation:
 import { NextRequest, NextResponse } from 'next/server';
 import { ResponseBuilder, HTTP_STATUS } from '@/core/utils/api/ApiResponse';
 import { calculateEntitlements, getRemainingSlots, isAtCapacity } from '@/core/domain/gym/Entitlements';
 import { getCurrentGymProfile } from '@/lib/middleware/auth';
 import { getContainer } from '@/infrastructure/di';

 export async function GET(_request: NextRequest) {
   const gymProfile = await getCurrentGymProfile();
   const container = await getContainer();
   const memberRepo = container.getMemberRepository();

   // Calculate computed entitlements (base plan + overrides)
   const entitlements = calculateEntitlements(
     gymProfile.subscription_plan,
     gymProfile.feature_overrides
   );

   const currentMemberCount = await memberRepo.countMembers(gymProfile.id);

   const slotsRemaining = getRemainingSlots(entitlements, currentMemberCount);

   return NextResponse.json(
     ResponseBuilder.success({
       plan: gymProfile.subscription_plan,  // Display only
       features: entitlements,               // Feature flags
       usage: {
         currentMemberCount,
         slotsRemaining,
         isAtCapacity: isAtCapacity(entitlements, currentMemberCount),
       },
     }),
     { status: HTTP_STATUS.OK }
   );
 }

 Member Creation Endpoint (UPDATE)

 File: src/app/api/members/route.ts (UPDATE POST)

 Changes:
 1. Pass entitlements to use case:
 const result = await registerMember.execute({
   gymId: gymProfile.id,
   gymSubscriptionPlan: gymProfile.subscription_plan,      // ✅ ADD
   gymFeatureOverrides: gymProfile.feature_overrides,      // ✅ ADD
   // ... rest
 });

 2. Handle entitlement error:
 if (error instanceof EntitlementRestrictionError) {
   return NextResponse.json(
     ResponseBuilder.error(
       error.message,
       'ENTITLEMENT_RESTRICTION',
       { feature: error.feature, ...error.metadata }
     ),
     { status: 402 }  // 402 Payment Required
   );
 }

 Bulk Member Creation (UPDATE)

 File: src/app/api/members/bulk/route.ts (UPDATE POST)

 Changes:
 1. Pre-check entitlement limit BEFORE batch processing:
 const currentCount = await memberRepo.countMembers(gymProfile.id);

 // Calculate entitlements
 const entitlements = calculateEntitlements(
   gymProfile.subscription_plan,
   gymProfile.feature_overrides
 );

 // Check if bulk import would exceed capacity
 if (!canAddMembers(entitlements, currentCount, validated.members.length)) {
   const remaining = getRemainingSlots(entitlements, currentCount) || 0;
   return NextResponse.json(
     ResponseBuilder.error(
       `Cannot add ${validated.members.length} members. Only ${remaining} slots remaining.`,
       'ENTITLEMENT_RESTRICTION',
       {
         feature: 'maxMembers',
         current: currentCount,
         max: entitlements.maxMembers,
         plan: gymProfile.subscription_plan,
       }
     ),
     { status: 402 }  // 402 Payment Required
   );
 }

 2. Pass entitlements to each registration:
 await registerMember.execute({
   gymId: gymProfile.id,
   gymSubscriptionPlan: gymProfile.subscription_plan,      // ✅ ADD
   gymFeatureOverrides: gymProfile.feature_overrides,      // ✅ ADD
   // ... rest
 });

 ---
 LAYER 8: Frontend Hooks

 File: src/features/entitlements/hooks/useEntitlements.ts (NEW)

 Purpose: React Query hook for computed entitlements + usage data

 Key Features:
 - Fetches from /api/gyms/entitlements
 - React Query caching (30s staleTime)
 - Type-safe feature checking
 - Helper methods

 Implementation:
 import { useQuery, type UseQueryResult } from '@tanstack/react-query';
 import type { GymEntitlements } from '@/core/domain/gym/Entitlements';

 interface EntitlementsResponse {
   plan: string;
   features: GymEntitlements;
   usage: {
     currentMemberCount: number;
     slotsRemaining: number | null;
     isAtCapacity: boolean;
   };
 }

 export function useEntitlements(enabled = true) {
   const { data, isLoading, error, refetch } = useQuery<EntitlementsResponse>({
     queryKey: ['gym-entitlements'],
     queryFn: async () => {
       const res = await fetch('/api/gyms/entitlements');
       if (!res.ok) throw new Error('Failed to fetch entitlements');
       const json = await res.json();
       return json.data;
     },
     staleTime: 30000,  // 30s cache
     enabled,
   });

   return {
     isLoading,
     error,
     refetch,

     // Display values
     planName: data?.plan || 'basic',
     usage: data?.usage || {
       currentMemberCount: 0,
       slotsRemaining: null,
       isAtCapacity: false,
     },

     // ✅ CRITICAL: Feature checking function (NEVER check plan name)
     canUseFeature: <K extends keyof GymEntitlements>(featureKey: K): boolean => {
       if (!data?.features) return false;

       const featureValue = data.features[featureKey];

       // For boolean features, return true/false
       if (typeof featureValue === 'boolean') return featureValue;

       // For number features (maxMembers), return true if exists
       return featureValue !== null;
     },

     // Helper: Check if can add members
     canAddMembers: (countToAdd: number = 1): boolean => {
       if (!data?.usage) return false;
       const { currentMemberCount, slotsRemaining, isAtCapacity } = data.usage;

       if (slotsRemaining === null) return true;  // Unlimited
       return !isAtCapacity && slotsRemaining >= countToAdd;
     },
   };
 }

 Exports:
 - useEntitlements() - Primary hook
 - Type: EntitlementsResponse

 ---
 LAYER 9: UI Components

 Member Countdown Component (NEW)

 File: src/features/tier/components/MemberCountdown.tsx (NEW)

 Purpose: Global countdown showing remaining member slots

 Visual States:
 - 0-79%: Gray (neutral)
 - 80-99%: Amber (warning)
 - 100%: Red (error) + "Upgrade for More" link

 Props: None (uses useTier hook internally)

 ---
 Members Page (UPDATE)

 File: src/app/(dashboard)/members/page.tsx (MODIFY)

 Changes:
 1. Import hook and components:
 import { useEntitlements } from '@/features/entitlements/hooks/useEntitlements';
 import { MemberCountdown } from '@/features/entitlements/components/MemberCountdown';

 2. Add countdown to header:
 <div className="flex items-center gap-4">
   <h1 className="text-3xl font-bold">Members</h1>
   <MemberCountdown /> {/* ✅ ADD */}
 </div>

 3. Implement button morphing (using entitlements, NOT plan name):
 const { usage, isLoading } = useEntitlements();

 if (isLoading) return <Skeleton />;

 {usage.isAtCapacity ? (
   // ✅ At Capacity: Single "Upgrade for More" button
   <Link href="/pricing">
     <Button className="bg-amber-500 hover:bg-amber-600 text-white">
       <ArrowUpCircle className="mr-2 h-4 w-4" />
       Upgrade for More Members
     </Button>
   </Link>
 ) : (
   // ✅ Below Capacity: Normal buttons
   <>
     <Button variant="outline" onClick={() => setShowBulkModal(true)}>
       <Upload className="mr-2 h-4 w-4" />
       Bulk Add
     </Button>
     <Button onClick={() => setShowAddModal(true)}>
       <Plus className="mr-2 h-4 w-4" />
       Add Member
     </Button>
   </>
 )}

 ---
 Payment Reminders Page (UPDATE)

 File: src/components/payment-collection/PaymentRemindersTable.tsx (MODIFY)

 Changes:
 1. Import hook:
 import { useEntitlements } from '@/features/entitlements/hooks/useEntitlements';

 2. Check feature entitlement (NOT plan name):
 const { canUseFeature } = useEntitlements();
 const canUseReminders = canUseFeature('automatedRemindersEnabled');

 3. Show upgrade prompt if feature not enabled:
 if (!canUseReminders) {
   return (
     <div className="flex flex-col items-center justify-center py-16">
       <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
       <h3 className="text-xl font-semibold mb-2">
         Automated Reminders Not Enabled
       </h3>
       <p className="text-center text-gray-600 mb-6 max-w-md">
         Automated SMS reminders are included in <strong>Pro</strong> and{' '}
         <strong>Enterprise</strong> plans. Upgrade to automatically notify
         members about upcoming payments.
       </p>
       <Link href="/pricing">
         <Button variant="default" size="lg">
           <ArrowUpCircle className="mr-2 h-5 w-5" />
           View Pricing Plans
         </Button>
       </Link>
     </div>
   );
 }

 // Normal table if feature enabled

 ---
 Pricing Page (NEW)

 File: src/app/(dashboard)/pricing/page.tsx (NEW)

 Purpose: Placeholder pricing page showing 3 tiers

 Features:
 - 3-column responsive grid
 - "Most Popular" badge on Pro
 - "Current Plan" badge on active tier
 - Feature comparison list
 - CTAs: "Current Plan" (disabled), "Upgrade to Pro", "Contact Sales"

 Implementation:
 - Use useTier() to get current tier
 - Map over TIER_CONFIG to render cards
 - Show check/x icons for enabled/disabled features
 - Link Enterprise CTA to mailto:support@...

 ---
 LAYER 10: Layout Updates (Header)

 File: src/components/layout/DashboardHeader.tsx or wherever header lives (UPDATE)

 Changes:
 1. Import components:
 import { useTier } from '@/features/tier/hooks/useTier';
 import { Badge } from '@/components/ui/badge';
 import { MemberCountdown } from '@/features/tier/components/MemberCountdown';

 2. Add tier badge and upgrade link:
 const { tier } = useTier();

 <header className="flex justify-between items-center p-4 border-b">
   <div className="flex items-center gap-4">
     <Badge variant={tier === 'basic' ? 'secondary' : 'default'} className="capitalize">
       {tier}
     </Badge>
     {tier === 'basic' && (
       <Link href="/pricing" className="text-sm text-blue-600 hover:underline font-medium">
         Upgrade
       </Link>
     )}
     <MemberCountdown /> {/* ✅ Global countdown */}
   </div>

   {/* Profile dropdown */}
 </header>

 ---
 PRODUCTION-GRADE REFINEMENTS

 Critical Architectural Gaps & Industry Best Practices

 This section addresses data integrity risks, operational edge cases, and architectural blindspots that must be resolved before deploying to production in a multi-tenant SaaS environment.

 ---
 REFINEMENT 1: Data Integrity & Race Conditions

 Problem: TOCTOU (Time-Of-Check to Time-Of-Use) Vulnerability

 The current plan relies on `SELECT COUNT(*)` on the fly during `RegisterMember` execution. This creates a race condition:

 Scenario:
 - Gym at 39/40 members
 - Two admins simultaneously click "Add Member"
 - Both requests execute `countMembers()` → both see 39
 - Both pass validation
 - Both insert → gym now has 41 members (limit violated)

 Industry Solution: Counter Cache Pattern with Database Triggers

 Instead of counting rows on every registration, maintain a real-time counter directly on the `gyms` table.

 Database Migration (REVISED):

 File: supabase/migrations/20260415000001_add_subscription_tier_to_gyms.sql

 -- Create enum
 CREATE TYPE subscription_tier AS ENUM ('basic', 'pro', 'enterprise');

 -- Add tier column
 ALTER TABLE gyms
 ADD COLUMN subscription_tier subscription_tier NOT NULL DEFAULT 'basic';

 -- ✅ ADD: Counter cache for real-time member count
 ALTER TABLE gyms
 ADD COLUMN current_member_count INTEGER NOT NULL DEFAULT 0;

 -- Create indexes
 CREATE INDEX idx_gyms_subscription_tier ON gyms(subscription_tier);

 -- Add constraint for tier validation
 ALTER TABLE gyms
 ADD CONSTRAINT valid_subscription_tier
 CHECK (subscription_tier IN ('basic', 'pro', 'enterprise'));

 -- ✅ ADD: Initialize counter for existing gyms
 UPDATE gyms
 SET current_member_count = (
   SELECT COUNT(*)
   FROM members
   WHERE members.gym_id = gyms.id
     AND members.status IN ('active', 'expired', 'suspended')
 );

 -- ✅ ADD: Trigger to increment counter on INSERT
 CREATE OR REPLACE FUNCTION increment_member_count()
 RETURNS TRIGGER AS $$
 BEGIN
   -- Only count non-cancelled members
   IF NEW.status IN ('active', 'expired', 'suspended') THEN
     UPDATE gyms
     SET current_member_count = current_member_count + 1
     WHERE id = NEW.gym_id;
   END IF;
   RETURN NEW;
 END;
 $$ LANGUAGE plpgsql;

 CREATE TRIGGER trigger_increment_member_count
 AFTER INSERT ON members
 FOR EACH ROW
 EXECUTE FUNCTION increment_member_count();

 -- ✅ ADD: Trigger to decrement counter on DELETE
 CREATE OR REPLACE FUNCTION decrement_member_count()
 RETURNS TRIGGER AS $$
 BEGIN
   -- Only decrement if deleted member was counted
   IF OLD.status IN ('active', 'expired', 'suspended') THEN
     UPDATE gyms
     SET current_member_count = current_member_count - 1
     WHERE id = OLD.gym_id;
   END IF;
   RETURN OLD;
 END;
 $$ LANGUAGE plpgsql;

 CREATE TRIGGER trigger_decrement_member_count
 AFTER DELETE ON members
 FOR EACH ROW
 EXECUTE FUNCTION decrement_member_count();

 -- ✅ ADD: Trigger to adjust counter on status UPDATE
 CREATE OR REPLACE FUNCTION adjust_member_count_on_status_change()
 RETURNS TRIGGER AS $$
 BEGIN
   -- Handle status transitions
   IF OLD.status IN ('active', 'expired', 'suspended') AND NEW.status = 'cancelled' THEN
     -- Transition TO cancelled → decrement
     UPDATE gyms
     SET current_member_count = current_member_count - 1
     WHERE id = NEW.gym_id;
   ELSIF OLD.status = 'cancelled' AND NEW.status IN ('active', 'expired', 'suspended') THEN
     -- Transition FROM cancelled → increment
     UPDATE gyms
     SET current_member_count = current_member_count + 1
     WHERE id = NEW.gym_id;
   END IF;
   RETURN NEW;
 END;
 $$ LANGUAGE plpgsql;

 CREATE TRIGGER trigger_adjust_member_count
 AFTER UPDATE OF status ON members
 FOR EACH ROW
 WHEN (OLD.status IS DISTINCT FROM NEW.status)
 EXECUTE FUNCTION adjust_member_count_on_status_change();

 -- ✅ ADD: Check constraint for tier limits (defense-in-depth)
 -- NOTE: This is a soft constraint - will allow existing overages but block new violations
 ALTER TABLE gyms
 ADD CONSTRAINT check_member_limit
 CHECK (
   CASE subscription_tier
     WHEN 'basic' THEN current_member_count <= 40
     WHEN 'pro' THEN current_member_count <= 500
     ELSE true  -- Enterprise has no limit
   END
 );

 Benefits:
 1. **Eliminates Race Conditions**: Database-level constraint prevents violations atomically
 2. **Performance**: O(1) lookup instead of O(n) COUNT(*) query
 3. **Defense-in-Depth**: Constraint enforced at database layer, not just application layer
 4. **Audit Trail**: Counter stays in sync automatically via triggers

 Updated Repository Method:

 File: src/infrastructure/database/repositories/SupabaseMemberRepository.ts

 // REMOVE countMembers() method - no longer needed

 Updated Use Case:

 File: src/core/use-cases/member/RegisterMember.ts

 // REMOVE countMembers() call - rely on database constraint instead

 async execute(input: RegisterMemberInput): Promise<Member> {
   // ... existing validation (duplicate check, etc.)

   try {
     // Attempt insert - database will reject if tier limit violated
     const newMember = await this.memberRepo.create({
       // ... member data
     });

     return newMember;
   } catch (error) {
     // ✅ Detect constraint violation from database
     if (error instanceof DatabaseError && error.message.includes('check_member_limit')) {
       // Fetch current count for error message
       const gym = await this.gymRepo.findById(input.gymId);
       const tierConfig = getTierConfig(gym.subscription_tier);

       throw new TierLimitExceededError(
         tierConfig.metadata.label,
         'Member capacity',
         gym.current_member_count,
         tierConfig.limits.maxMembers!
       );
     }
     throw error;
   }
 }

 Updated API Endpoint:

 File: src/app/api/members/count/route.ts

 export async function GET(_request: NextRequest) {
   const gymProfile = await getCurrentGymProfile();

   // ✅ Direct O(1) lookup from gyms table
   const { data: gym, error } = await supabase
     .from('gyms')
     .select('current_member_count, subscription_tier')
     .eq('id', gymProfile.id)
     .single();

   if (error) throw new Error('Failed to fetch gym data');

   const tierConfig = getTierConfig(gym.subscription_tier);

   return NextResponse.json(
     ResponseBuilder.success({
       count: gym.current_member_count,
       tier: gym.subscription_tier,
       maxMembers: tierConfig.limits.maxMembers,
       remaining: getRemainingSlots(gym.subscription_tier, gym.current_member_count),
       atCapacity: isAtCapacity(gym.subscription_tier, gym.current_member_count),
     })
   );
 }

 ---
 REFINEMENT 2: Architectural Blindspots - Tiers vs. Entitlements

 ✅ STATUS: **FULLY IMPLEMENTED** in LAYER 2 (Entitlement Engine)

 Problem: Tight Coupling to Tier Names

 Hardcoding business logic to tier names (`if (tier === 'basic')`) creates inflexibility:

 Scenario:
 - You want to give a specific Basic gym a 14-day trial of automated SMS
 - You want to create a "Basic + SMS" custom plan for a VIP client
 - You need to run A/B tests with different feature combinations

 Tier-based approach requires messy exception logic or database schema changes.

 Industry Solution: Feature Entitlements Separation (Base Plan + Overrides)

 Separate **Plans** (billing) from **Entitlements** (features). Code NEVER checks plan names.

 Design Principle:

 ❌ WRONG: if (gym.tier === 'basic') { /* disable feature */ }
 ✅ CORRECT: if (!gym.entitlements.manualSmsReceiptsEnabled) { /* disable feature */ }

 Implementation (See LAYER 2 for full code):

 1. Database Schema:
 ALTER TABLE gyms
 ADD COLUMN subscription_plan subscription_plan NOT NULL DEFAULT 'basic',
 ADD COLUMN feature_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

 2. Entitlement Engine:
 // src/core/domain/gym/Entitlements.ts
 export function calculateEntitlements(
   plan: SubscriptionPlan,
   overrides: Partial<GymEntitlements> = {}
 ): GymEntitlements {
   return {
     ...BASE_PLAN_ENTITLEMENTS[plan],  // Base template
     ...overrides,                       // Custom overrides trump base
   };
 }

 3. Business Logic:
 // Use cases NEVER check plan name
 const entitlements = calculateEntitlements(gym.subscription_plan, gym.feature_overrides);

 if (!entitlements.manualSmsReceiptsEnabled) {
   return; // Skip feature
 }

 4. Frontend:
 // UI NEVER checks plan name
 const { canUseFeature } = useEntitlements();

 if (!canUseFeature('automatedRemindersEnabled')) {
   return <UpgradePrompt />;
 }

 Benefits:

 1. **Zero-Downtime Customization**: Grant trial features via SQL UPDATE:
    UPDATE gyms SET feature_overrides = '{"automatedRemindersEnabled": true}'
    WHERE id = 'special-customer-id';

 2. **No Code Deploys**: Add custom plans without code changes
 3. **A/B Testing**: Test features on subsets of users easily
 4. **Future-Proof**: Stripe webhooks can update `feature_overrides` seamlessly

 Code Review Checklist:

 - [ ] No `if (plan === 'basic')` anywhere in codebase
 - [ ] All feature checks use `canUseFeature(entitlements, 'featureName')`
 - [ ] All capacity checks use `isAtCapacity(entitlements, count)`
 - [ ] UI components use `useEntitlements()` hook, NEVER check plan name
 - [ ] Only `PLAN_METADATA` and pricing page reference plan names for display

 ---
 REFINEMENT 3: Operational Risk - Grandfathering & Churn

 Problem: Instant Downgrade of Existing Users

 The current migration includes: `DEFAULT 'basic'`

 Impact on Production Deployment:
 - Gym with 150 members → suddenly cannot add anyone (instant breakage)
 - Gym using automated SMS → reminders silently stop (revenue impact)
 - Customer support flooded with "everything broke" tickets
 - High churn risk

 Industry Solution: Grandfather Existing Users

 Database Migration (REVISED):

 File: supabase/migrations/20260415000001_add_subscription_tier_to_gyms.sql (UPDATE)

 -- ✅ REVISED: Grandfather existing gyms to 'pro' tier
 ALTER TABLE gyms
 ADD COLUMN subscription_tier subscription_tier NOT NULL DEFAULT 'basic';

 -- ✅ ADD: Intelligent tier assignment for existing gyms
 UPDATE gyms
 SET subscription_tier = CASE
   -- Gyms with >40 members → Pro (prevent instant breakage)
   WHEN (
     SELECT COUNT(*)
     FROM members
     WHERE members.gym_id = gyms.id
       AND members.status IN ('active', 'expired', 'suspended')
   ) > 40 THEN 'pro'

   -- Gyms that sent SMS in last 30 days → Pro (preserve active features)
   WHEN (
     SELECT COUNT(*)
     FROM sms_logs
     WHERE sms_logs.gym_id = gyms.id
       AND sms_logs.sent_at > NOW() - INTERVAL '30 days'
   ) > 0 THEN 'pro'

   -- All other gyms → Basic (new free tier)
   ELSE 'basic'
 END
 WHERE subscription_tier = 'basic';  -- Only update default values

 Rationale:
 - Existing active users don't experience sudden feature loss
 - Prevents customer churn and support ticket flood
 - Allows gradual migration to paid tiers via upgrade prompts
 - New signups start at 'basic' tier

 Alternative Strategy (Hidden Legacy Tier):

 If you want stricter enforcement, create a hidden `legacy_free` tier:

 CREATE TYPE subscription_tier AS ENUM ('basic', 'pro', 'enterprise', 'legacy_free');

 export const TIER_CONFIG = {
   legacy_free: {
     limits: {
       maxMembers: null,  // Unlimited (grandfathered)
       automatedReminders: true,  // Keep existing features
       manualReceipts: true,
       // ...
     },
     metadata: {
       label: 'Legacy Free',
       price: 'Grandfathered',
       isPublic: false,  // Hide from pricing page
     }
   },
   // ... other tiers
 };

 Then phase out `legacy_free` users over 6-12 months with upgrade incentives.

 ---
 REFINEMENT 4: Bulk Import Transactionality

 Problem: Partial Batch Failures

 Current bulk import flow:
 1. Pre-check capacity: `currentCount + newCount <= maxMembers`
 2. Loop through members, calling `registerMember.execute()` for each
 3. If member 15/20 fails (duplicate phone) → what happens?

 Risk:
 - 14 members inserted, 6 not inserted
 - User's capacity partially consumed (14 slots used)
 - No clear recovery path
 - User confused about which members succeeded

 Industry Solution: Atomic Batch Transactions

 File: src/app/api/members/bulk/route.ts (UPDATE)

 export async function POST(request: NextRequest) {
   const gymProfile = await getCurrentGymProfile();
   const container = await getContainer();
   const supabase = createClient();

   try {
     const body = await request.json();
     const validated = bulkMemberSchema.parse(body);

     // Pre-check tier limit
     const gym = await supabase
       .from('gyms')
       .select('current_member_count, subscription_tier')
       .eq('id', gymProfile.id)
       .single();

     const tierConfig = getTierConfig(gym.data.subscription_tier);

     if (tierConfig.limits.maxMembers !== null) {
       const wouldExceed =
         gym.data.current_member_count + validated.members.length > tierConfig.limits.maxMembers;

       if (wouldExceed) {
         const remaining = Math.max(0, tierConfig.limits.maxMembers - gym.data.current_member_count);
         return NextResponse.json(
           ResponseBuilder.error(
             `Cannot add ${validated.members.length} members. Only ${remaining} slots remaining.`,
             'TIER_LIMIT_EXCEEDED'
           ),
           { status: 402 }
         );
       }
     }

     // ✅ CRITICAL: Wrap in database transaction
     const { data, error } = await supabase.rpc('bulk_register_members', {
       p_gym_id: gymProfile.id,
       p_members: validated.members,
     });

     if (error) {
       // Transaction rolled back - no partial insertions
       return NextResponse.json(
         ResponseBuilder.error(
           `Bulk import failed: ${error.message}`,
           'BULK_IMPORT_FAILED',
           { details: error }
         ),
         { status: 400 }
       );
     }

     return NextResponse.json(
       ResponseBuilder.success({
         inserted: data.length,
         members: data,
       }),
       { status: 201 }
     );
   } catch (error) {
     // ... error handling
   }
 }

 Database Function (Atomic Transaction):

 File: supabase/migrations/20260415000002_add_bulk_register_function.sql

 CREATE OR REPLACE FUNCTION bulk_register_members(
   p_gym_id UUID,
   p_members JSONB
 )
 RETURNS TABLE (
   id UUID,
   name TEXT,
   phone_number TEXT,
   status TEXT
 ) AS $$
 DECLARE
   v_member JSONB;
   v_result RECORD;
 BEGIN
   -- Start implicit transaction (function is atomic by default)

   FOR v_member IN SELECT * FROM jsonb_array_elements(p_members)
   LOOP
     -- Duplicate check
     IF EXISTS (
       SELECT 1 FROM members
       WHERE gym_id = p_gym_id
         AND phone_number = (v_member->>'phoneNumber')
     ) THEN
       RAISE EXCEPTION 'Duplicate phone number: %', (v_member->>'phoneNumber');
     END IF;

     -- Insert member
     INSERT INTO members (gym_id, name, phone_number, status, ...)
     VALUES (
       p_gym_id,
       v_member->>'name',
       v_member->>'phoneNumber',
       'active',
       ...
     )
     RETURNING * INTO v_result;

     RETURN QUERY SELECT v_result.id, v_result.name, v_result.phone_number, v_result.status;
   END LOOP;

   -- If any step fails, entire transaction rolls back automatically
 END;
 $$ LANGUAGE plpgsql;

 Benefits:
 - All-or-nothing semantics: Either all members inserted or none
 - Clean error messages: "Import failed at row 15 (duplicate phone)"
 - No capacity leakage: Counter only increments if entire batch succeeds
 - User can fix issues and retry without partial data corruption

 ---
 REFINEMENT 5: Frontend Cache Stale-Data Issue

 Problem: React Query Cache Not Invalidated

 User flow:
 1. User at 39/40 members adds a member → redirected to members page
 2. `useTier` hook shows "1 slot remaining" (cached for 30s)
 3. User clicks "Add Member" again
 4. Gets unexpected 402 error (tier limit exceeded)
 5. Confused user: "But it said 1 slot remaining!"

 Root Cause: Cache not invalidated on mutation.

 Industry Solution: Optimistic Updates with Cache Invalidation

 File: src/app/(dashboard)/members/page.tsx (UPDATE)

 'use client';

 import { useMutation, useQueryClient } from '@tanstack/react-query';

 export default function MembersPage() {
   const queryClient = useQueryClient();

   const createMemberMutation = useMutation({
     mutationFn: async (memberData) => {
       const res = await fetch('/api/members', {
         method: 'POST',
         body: JSON.stringify(memberData),
       });
       if (!res.ok) throw new Error('Failed to create member');
       return res.json();
     },
     onSuccess: () => {
       // ✅ CRITICAL: Invalidate member count cache immediately
       queryClient.invalidateQueries({ queryKey: ['member-count'] });

       // ✅ Also invalidate members list
       queryClient.invalidateQueries({ queryKey: ['members'] });
     },
     onError: (error) => {
       toast.error(error.message);
     },
   });

   // Same for delete, bulk import, status changes
   const deleteMemberMutation = useMutation({
     mutationFn: async (memberId) => { /* ... */ },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['member-count'] });
       queryClient.invalidateQueries({ queryKey: ['members'] });
     },
   });

   // ...
 }

 Optional: Optimistic Updates

 For instant UI feedback without waiting for server response:

 const createMemberMutation = useMutation({
   mutationFn: async (memberData) => { /* ... */ },
   onMutate: async (newMember) => {
     // Cancel outgoing refetches
     await queryClient.cancelQueries({ queryKey: ['member-count'] });

     // Snapshot previous value
     const previousCount = queryClient.getQueryData(['member-count']);

     // Optimistically update to new value
     queryClient.setQueryData(['member-count'], (old) => ({
       ...old,
       count: old.count + 1,
       remaining: old.remaining - 1,
     }));

     return { previousCount };
   },
   onError: (err, newMember, context) => {
     // Rollback on error
     queryClient.setQueryData(['member-count'], context.previousCount);
   },
   onSettled: () => {
     // Refetch to ensure consistency
     queryClient.invalidateQueries({ queryKey: ['member-count'] });
   },
 });

 ---
 REFINEMENT 6: HTTP Status Code Semantics

 Problem: 403 Forbidden vs. 402 Payment Required

 Current plan uses **403 Forbidden** for tier limits.

 Semantic Issue:
 - 403: User authenticated but lacks **permission** (security/role-based)
 - Tier limits are not permission issues - they are **billing/subscription** issues

 Industry Standard: **402 Payment Required**

 This status code was specifically designed for cases where:
 - User is authenticated
 - Action is blocked due to subscription/payment constraints
 - User can resolve by upgrading plan or paying

 Usage Examples:
 - Stripe API: Returns 402 when payment method fails
 - GitHub API: Returns 402 when API rate limit requires paid plan
 - Twilio API: Returns 402 when account balance insufficient

 Implementation:

 File: src/core/utils/errors/DomainError.ts (UPDATE)

 export class TierLimitExceededError extends DomainError {
   constructor(tier: string, limit: string, current: number, max: number) {
     super(
       `${limit} limit exceeded for ${tier} tier (${current}/${max})`,
       'TIER_LIMIT_EXCEEDED',
       402  // ✅ Changed from 403 to 402
     );
   }
 }

 File: src/app/api/members/route.ts (UPDATE)

 if (error instanceof TierLimitExceededError) {
   return NextResponse.json(
     ResponseBuilder.error(
       error.message,
       'TIER_LIMIT_EXCEEDED',
       { tier: error.tier, current: error.current, max: error.max }
     ),
     { status: 402 }  // ✅ Changed from 403
   );
 }

 Frontend API Interceptor:

 File: src/lib/api/interceptor.ts (NEW)

 // Global error handler for all API calls
 export async function apiCall(url: string, options: RequestInit) {
   const res = await fetch(url, options);

   if (!res.ok) {
     const error = await res.json();

     // ✅ Separate billing walls from permission walls
     if (res.status === 402) {
       // Tier limit - show upgrade prompt
       showUpgradeModal({
         title: 'Upgrade Required',
         message: error.error.message,
         ctaText: 'View Pricing',
         ctaLink: '/pricing',
       });
       throw new TierLimitError(error);
     }

     if (res.status === 403) {
       // Permission denied - show access denied message
       showErrorToast('You do not have permission to perform this action');
       throw new PermissionError(error);
     }

     throw new ApiError(error);
   }

   return res.json();
 }

 Benefits:
 1. **Semantic Clarity**: 402 signals billing issue, not security issue
 2. **Client-Side Routing**: Frontend can handle 402 vs 403 differently
 3. **Industry Standard**: Aligns with Stripe, GitHub, Twilio conventions
 4. **Analytics**: Track billing walls separately from permission walls

 ---
 Summary: Pre-Flight Checklist

 Before executing Phase 1, address these refinements:

  1. **Race Conditions**: Add `current_member_count` column with database triggers
  2. **Feature Coupling**: Ensure all code uses `hasFeature()`, never checks tier strings
  3. **Grandfathering**: Update migration to assign existing users to 'pro' tier
  4. **Bulk Transactions**: Create database function for atomic bulk imports
  5. **Cache Invalidation**: Add `queryClient.invalidateQueries()` to all member mutations
  6. **HTTP Status Codes**: Change 403 to 402 for tier limits throughout codebase

 Priority Levels:

 **CRITICAL (Must Fix Before Production):**
 - Refinement #3: Grandfathering (prevents customer churn)
 - Refinement #5: Cache invalidation (prevents user confusion)

 **HIGH (Fix in Phase 1):**
 - Refinement #1: Race conditions (data integrity)
 - Refinement #4: Bulk transactions (data integrity)

 **MEDIUM (Fix in Phase 1 or 2):**
 - Refinement #6: HTTP status codes (semantic correctness)
 - Refinement #2: Feature entitlements (architectural flexibility)

 ---
 Implementation Sequence

 Phase 1: Foundation

 1. ✅ Run migration 20260415000001_add_subscription_tier_to_gyms.sql (REVISED with counter cache + grandfathering)
 2. ✅ Create TierConfig.ts with enums, interfaces, helpers
 3. ✅ Add TierLimitExceededError to domain errors (with 402 status code)
 4. ✅ Update GymProfile type with subscription_tier
 5. ✅ Update auth middleware to fetch subscription_tier

 Phase 2: Backend

 6. ✅ SKIP countMembers() - using counter cache pattern instead (see Refinement #1)
 7. ✅ Update RegisterMember use case with database constraint error handling
 8. ✅ Update CollectPayment use case with feature check
 9. ✅ Create GET /api/members/count endpoint (using current_member_count column)
 10. ✅ Update POST /api/members with tier error handling (402 status)
 11. ✅ Update POST /api/members/bulk with pre-check and atomic transaction
 12. ✅ Create bulk_register_members() database function (see Refinement #4)

 Phase 3: Frontend

 13. ✅ Create useTier hook (with 30s staleTime)
 14. ✅ Create MemberCountdown component
 15. ✅ Update members page with button morphing + cache invalidation (see Refinement #5)
 16. ✅ Update reminders page with upgrade prompt
 17. ✅ Create pricing page
 18. ✅ Update dashboard header with tier badge
 19. ✅ Add queryClient.invalidateQueries() to all member mutations (CRITICAL - see Refinement #5)

 Phase 4: Testing

 20. ✅ Test member registration at 39/40/41 members (verify database constraint enforcement)
 21. ✅ Test bulk import at capacity (verify atomic transaction rollback)
 22. ✅ Test SMS receipts skipped for Basic tier
 23. ✅ Test UI countdown updates (verify cache invalidation)
 24. ✅ Test button morphing
 25. ✅ Test pricing page navigation
 26. ✅ Test 402 vs 403 error responses in frontend
 27. ✅ Test grandfathered gyms maintain Pro tier after migration

 ---
 Critical Files to Modify/Create

 NEW Files (8)

 1. supabase/migrations/20260415000001_add_subscription_tier_to_gyms.sql
 2. src/core/utils/constants/TierConfig.ts
 3. src/features/tier/hooks/useTier.ts
 4. src/features/tier/components/MemberCountdown.tsx
 5. src/app/api/members/count/route.ts
 6. src/app/(dashboard)/pricing/page.tsx
 7. src/core/utils/errors/DomainError.ts (add TierLimitExceededError class)

 MODIFY Files (8)

 1. src/features/auth/types/index.ts - Add subscription_tier to GymProfile
 2. src/lib/middleware/auth.ts - Update SELECT to include tier
 3. src/lib/middleware/api-auth.ts - Update SELECT to include tier
 4. src/core/ports/repositories/IMemberRepository.ts - Add countMembers method
 5. src/infrastructure/database/repositories/SupabaseMemberRepository.ts - Implement countMembers
 6. src/core/use-cases/member/RegisterMember.ts - Add tier validation
 7. src/core/use-cases/payment/CollectPayment.ts - Add feature check
 8. src/app/api/members/route.ts - Add tier error handling
 9. src/app/api/members/bulk/route.ts - Add pre-check
 10. src/app/(dashboard)/members/page.tsx - Add countdown + button morphing
 11. src/components/payment-collection/PaymentRemindersTable.tsx - Add upgrade prompt
 12. Dashboard header component (location TBD) - Add tier badge

 ---
 Key Design Decisions

 1. Member Count Strategy

 Decision: Create dedicated GET /api/members/count endpoint

 Rationale:
 - Lightweight SELECT COUNT(*) query (not full member fetch)
 - React Query caching (30s staleTime)
 - Reusable by both UI and backend validation
 - Performance: <200ms response time

 2. Cancelled Members

 Decision: Exclude from count (status IN ('active', 'expired', 'suspended'))

 Rationale:
 - Cancelled is terminal state
 - Don't penalize for historical data
 - Only count active resource consumers

 3. Bulk Import Validation

 Decision: Pre-check capacity before processing batch

 Rationale:
 - Prevent partial failures (30/50 succeed, then hit limit)
 - Clear upfront error message
 - Better UX (fail fast)

 4. Manual SMS Receipts (Basic Tier)

 Decision: Silent skip (log but don't error)

 Rationale:
 - Don't block payment collection
 - Log for debugging
 - Payment success is more critical than SMS

 5. Button Morphing

 Decision: Replace both buttons with single "Upgrade for More" at capacity

 Rationale:
 - Clear call-to-action
 - Prevents confusion (why are buttons disabled?)
 - Drives upgrade conversions

 6. Error Handling

 Decision: Use 403 Forbidden for tier limits

 Rationale:
 - Semantically correct (user authenticated but lacks permission)
 - Frontend can check TIER_LIMIT_EXCEEDED error code
 - Show upgrade CTA instead of generic error

 ---
 Edge Cases Handled

 1. Race Conditions

 Scenario: Two requests at 39/40 members arrive simultaneously

 Current: Use case checks count, may allow 41st member

 Future: Add database trigger for defense-in-depth (Phase 2)

 2. Grandfathering

 Scenario: Gym has 50 members when Basic tier (40 limit) introduced

 Solution: Soft enforcement - keep existing, block new registrations
 - isAtCapacity checks count >= maxMembers (allows 40/40, blocks 41st)

 3. Bulk Import at Capacity

 Scenario: Gym at 35/40 tries to import 10 members

 Solution: Reject entire batch with clear error message

 4. Cron Jobs (Future)

 Scenario: Should SendAutomatedReminders check tier?

 Solution: Yes - check hasFeature('automatedReminders') per gym in loop

 ---
 Testing Strategy

 Unit Tests

 - TierConfig.ts helpers (100% coverage)
 - Error class instantiation
 - Helper functions (getRemainingSlots, isAtCapacity, etc.)

 Integration Tests

 - Member registration at 39/40/41 members
 - Bulk import validation
 - SMS receipt skipping (verify console log)
 - API error responses

 E2E Tests (Playwright)

 - Complete user flow: register 40 members → see button morph → click upgrade
 - Reminders page shows upgrade prompt for Basic tier
 - Pricing page navigation and display

 Manual QA

 - Test countdown updates real-time
 - Test tier badge in header
 - Test all 3 pricing tiers display correctly
 - Test mobile responsive layout

 ---
 Success Criteria

 ✅ Functional Requirements
 - Basic tier blocks 41st member (400 Forbidden)
 - Pro tier allows up to 500
 - Enterprise has unlimited
 - Basic tier skips automated/manual SMS (logs confirmation)
 - Member count API responds in <200ms
 - Bulk import validates correctly

 ✅ UX Requirements
 - Clear error messages with current/max counts
 - "Upgrade for More" button visible at capacity
 - Pricing page loads with 3 tiers
 - Tier badge shows in header with upgrade link
 - Member countdown updates every 30s (React Query cache)

 ✅ Technical Requirements
 - All TypeScript compilation passes (no errors)
 - Follows existing Clean Architecture patterns
 - Uses ResponseBuilder for all API responses
 - Dependency injection maintained
 - No breaking changes to existing code

 ---
 Notes

 - Migration sets all existing gyms to 'basic' tier by default
 - Future: Stripe integration for tier upgrades (Phase 2)
 - Future: Database trigger for race condition protection (Phase 2)
 - Future: Usage analytics dashboard (Phase 2)
 - Pricing page is placeholder only (no payment flow)