# Multi-Gym Account Support - Complete Implementation Blueprint

## Document Purpose

This document provides a complete, step-by-step implementation guide for adding multi-gym account support to the Gym Management SaaS platform. This feature allows users to create and manage multiple gym locations (branches) under a single login with Gmail-style quick switching.

**Status**: Design Complete - Ready for Future Implementation
**Created**: 2026-02-20
**Estimated Effort**: 6 weeks (1 developer)

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Architecture Analysis](#architecture-analysis)
3. [Database Schema Changes](#database-schema-changes)
4. [Application Layer Changes](#application-layer-changes)
5. [UI Components](#ui-components)
6. [API Route Refactoring](#api-route-refactoring)
7. [Advanced Features](#advanced-features)
8. [Testing Strategy](#testing-strategy)
9. [Deployment & Rollout](#deployment--rollout)
10. [Code Examples](#code-examples)
11. [Migration Scripts](#migration-scripts)
12. [Troubleshooting Guide](#troubleshooting-guide)

---

## Feature Overview

### Business Requirements

Users with multiple gym locations (e.g., downtown branch, suburban branch) need to:

- Create additional gym accounts while logged in
- Switch between gyms quickly without re-authentication (Gmail-style UX)
- Share settings (plans, discounts, installments) across gyms with per-gym customization
- View aggregated analytics across all owned gyms
- Maintain separate member subscriptions per gym
- Support future per-gym platform billing

### User Stories

1. **As a gym owner**, I want to create a second gym account from my dashboard so I can manage multiple locations under one login
2. **As a gym owner**, I want to quickly switch between my gyms so I can manage them without logging out
3. **As a gym owner**, I want to create shared membership plans that all my gyms use, with the ability to customize pricing per location
4. **As a gym owner**, I want to see total members and revenue across all my locations in one dashboard
5. **As a new user**, I want to register a second gym without creating a new account if I already have one

### Key Constraints

- Each gym maintains separate member databases (data isolation)
- Each gym will have separate billing/subscriptions (future feature)
- Shared settings are optional - gyms can use shared or create their own
- Must maintain backward compatibility with existing single-gym users
- RLS policies must enforce strict data isolation

---

## Architecture Analysis

### Current State Assessment

#### What Already Works (Strengths ✅)

1. **Database Schema**:
   - `gyms` table has NO unique constraint on `user_id` column
   - Already supports multiple gyms per user at database level
   - All foreign keys correctly use `gym_id` for data partitioning

2. **RLS Policies**:
   - All policies are gym-scoped via `gym_id` relationships
   - Properly enforce data isolation between gyms
   - Will work with multi-gym without changes

3. **Service Layer**:
   - All service functions already accept `gym_id` as explicit parameter
   - No assumptions about single gym in business logic

#### What Needs Fixing (Limitations ❌)

1. **Auth Middleware**:
   - `getCurrentGymProfile()` uses `.single()` - assumes one gym per user
   - Will throw error if user has multiple gyms

2. **Session Management**:
   - `SessionData` type only supports single `gymProfile`
   - Login response only returns one gym

3. **UI Layer**:
   - No gym switcher component
   - No way to select which gym is active
   - No visual indication of current gym

4. **API Routes**:
   - All routes call `getCurrentGymProfile()` without gym selection
   - No `gymId` parameter handling
   - No ownership verification pattern

5. **Type Definitions**:
   - `GymProfile` missing `organization_id` and `is_primary_gym` fields
   - No types for shared settings

### Architectural Approach

```
┌─────────────────────────────────────────────────────────────┐
│                        User Session                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  Gym A   │  │  Gym B   │  │  Gym C   │                  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                  │
│       └──────────────┴──────────────┘                        │
│              Same organization_id                            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Active Gym Context (React)                      │
│  • Stores activeGymId in localStorage                        │
│  • Provides switchGym() function                             │
│  • Invalidates queries on switch                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Routes Pattern                         │
│  1. Extract gymId from query param                           │
│  2. Verify ownership via requireGymAccess(gymId)             │
│  3. Use gymId for all DB queries                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              RLS Policies (Unchanged)                        │
│  • Enforce gym_id filtering on all queries                   │
│  • Prevent cross-gym data access                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema Changes

### Overview of Changes

- **New Tables**: 3 (gym_memberships, shared_plan_templates, gym_plan_overrides)
- **Modified Tables**: 1 (gyms - add 2 columns)
- **New Indexes**: 4
- **Updated RLS Policies**: 2
- **Backward Compatible**: Yes (nullable columns, backfill script)

### Migration 1: Add Organization Tracking to Gyms

**File**: `supabase/migrations/20260221000001_add_organization_to_gyms.sql`

```sql
-- Add organization tracking columns to gyms table
ALTER TABLE gyms
  ADD COLUMN organization_id UUID,
  ADD COLUMN is_primary_gym BOOLEAN DEFAULT FALSE;

-- Backfill existing gyms: each existing gym becomes its own organization
UPDATE gyms
SET organization_id = id,
    is_primary_gym = TRUE
WHERE organization_id IS NULL;

-- Now make organization_id required
ALTER TABLE gyms
  ALTER COLUMN organization_id SET NOT NULL;

-- Add index for performance
CREATE INDEX idx_gyms_organization ON gyms(organization_id);
CREATE INDEX idx_gyms_user_org ON gyms(user_id, organization_id);

-- Add comment
COMMENT ON COLUMN gyms.organization_id IS 'Links gyms that belong to the same organization/owner for shared settings';
COMMENT ON COLUMN gyms.is_primary_gym IS 'Marks the first gym created in an organization. Primary gym can create shared templates.';
```

**Rationale**:

- Each existing gym becomes its own organization (backward compatible)
- When user creates second gym, it joins the organization_id of their first gym
- is_primary_gym determines which gym can create shared templates

### Migration 2: Create Gym Memberships Junction Table

**File**: `supabase/migrations/20260221000002_create_gym_memberships.sql`

```sql
-- Junction table to track which gyms belong to which organization
CREATE TABLE IF NOT EXISTS gym_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The organization/group that owns multiple gyms
  organization_id UUID NOT NULL,

  -- Individual gym belonging to this organization
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,

  -- Metadata
  is_primary BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT unique_org_gym UNIQUE (organization_id, gym_id)
);

-- Indexes
CREATE INDEX idx_gym_memberships_org ON gym_memberships(organization_id);
CREATE INDEX idx_gym_memberships_gym ON gym_memberships(gym_id);

-- RLS Policies
ALTER TABLE gym_memberships ENABLE ROW LEVEL SECURITY;

-- Users can view memberships for their gyms
CREATE POLICY "Users can view their gym memberships"
  ON gym_memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = gym_memberships.gym_id
      AND gyms.user_id = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE gym_memberships IS 'Junction table linking gyms to their parent organization for multi-gym support';
```

**Note**: This table is optional for Phase 1. It provides explicit organization tracking but can be derived from `gyms.organization_id`.

### Migration 3: Create Shared Settings Tables

**File**: `supabase/migrations/20260221000003_create_shared_settings.sql`

```sql
-- Shared plan templates across organization
CREATE TABLE IF NOT EXISTS shared_plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,

  plan_type member_plan_type NOT NULL,
  template_name TEXT NOT NULL,
  default_amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT unique_org_plan_template UNIQUE (organization_id, template_name)
);

-- Shared discount templates
CREATE TABLE IF NOT EXISTS shared_discount_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,

  discount_name TEXT NOT NULL,
  discount_percentage INTEGER NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT unique_org_discount UNIQUE (organization_id, discount_name)
);

-- Per-gym customization of shared templates
CREATE TABLE IF NOT EXISTS gym_plan_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  shared_template_id UUID REFERENCES shared_plan_templates(id) ON DELETE CASCADE,

  custom_amount DECIMAL(10, 2), -- Override default_amount if set
  is_active BOOLEAN, -- Override active status if set

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT unique_gym_template UNIQUE (gym_id, shared_template_id)
);

-- Indexes
CREATE INDEX idx_shared_plans_org ON shared_plan_templates(organization_id);
CREATE INDEX idx_shared_discounts_org ON shared_discount_templates(organization_id);
CREATE INDEX idx_gym_overrides_gym ON gym_plan_overrides(gym_id);
CREATE INDEX idx_gym_overrides_template ON gym_plan_overrides(shared_template_id);

-- RLS Policies
ALTER TABLE shared_plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_discount_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_plan_overrides ENABLE ROW LEVEL SECURITY;

-- Users can view shared templates for their organization
CREATE POLICY "Users can view their org's shared plan templates"
  ON shared_plan_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.organization_id = shared_plan_templates.organization_id
      AND gyms.user_id = auth.uid()
    )
  );

-- Only primary gym can create/update/delete shared templates
CREATE POLICY "Primary gym can manage shared plan templates"
  ON shared_plan_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.organization_id = shared_plan_templates.organization_id
      AND gyms.user_id = auth.uid()
      AND gyms.is_primary_gym = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.organization_id = shared_plan_templates.organization_id
      AND gyms.user_id = auth.uid()
      AND gyms.is_primary_gym = TRUE
    )
  );

-- Similar policies for shared_discount_templates
CREATE POLICY "Users can view their org's shared discount templates"
  ON shared_discount_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.organization_id = shared_discount_templates.organization_id
      AND gyms.user_id = auth.uid()
    )
  );

CREATE POLICY "Primary gym can manage shared discount templates"
  ON shared_discount_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.organization_id = shared_discount_templates.organization_id
      AND gyms.user_id = auth.uid()
      AND gyms.is_primary_gym = TRUE
    )
  );

-- Users can manage their own gym's overrides
CREATE POLICY "Users can view their gym's plan overrides"
  ON gym_plan_overrides FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = gym_plan_overrides.gym_id
      AND gyms.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their gym's plan overrides"
  ON gym_plan_overrides FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = gym_plan_overrides.gym_id
      AND gyms.user_id = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE shared_plan_templates IS 'Plan templates shared across all gyms in an organization';
COMMENT ON TABLE shared_discount_templates IS 'Discount templates shared across all gyms in an organization';
COMMENT ON TABLE gym_plan_overrides IS 'Per-gym customizations of shared plan templates';
```

### Migration 4: Update RLS Policies for Multi-Gym

**File**: `supabase/migrations/20260221000004_update_rls_for_multigym.sql`

```sql
-- Update gym policies to support multi-gym queries

-- Drop old policies that assume single gym
DROP POLICY IF EXISTS "Gym owners can view own gym" ON gyms;
DROP POLICY IF EXISTS "Gym owners can update own gym" ON gyms;

-- New policies: Users can view/update ALL their gyms
CREATE POLICY "Users can view their gyms"
  ON gyms FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their gyms"
  ON gyms FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can create new gyms (INSERT policy)
CREATE POLICY "Users can create gyms"
  ON gyms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Note: Members, payments, and other tables don't need changes
-- They already use gym_id foreign key and RLS policies check via EXISTS
```

### Database Schema Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         auth.users                           │
│  - id (UUID)                                                 │
│  - email                                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ 1:N (one user, many gyms)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                          gyms                                │
│  - id (UUID)                                                 │
│  - user_id (FK → auth.users) [NOT UNIQUE]                   │
│  - username                                                  │
│  - gym_name                                                  │
│  - organization_id (UUID) [NEW]                              │
│  - is_primary_gym (BOOLEAN) [NEW]                            │
└────┬────────────────────────────────────────────────────────┘
     │
     │ 1:N (one gym, many members)
     ▼
┌─────────────────────────────────────────────────────────────┐
│                        members                               │
│  - id (UUID)                                                 │
│  - gym_id (FK → gyms)                                        │
│  - name                                                      │
│  - status                                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              shared_plan_templates [NEW]                     │
│  - id (UUID)                                                 │
│  - organization_id (UUID)                                    │
│  - template_name                                             │
│  - default_amount                                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ 1:N (one template, many overrides)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│             gym_plan_overrides [NEW]                         │
│  - id (UUID)                                                 │
│  - gym_id (FK → gyms)                                        │
│  - shared_template_id (FK → shared_plan_templates)           │
│  - custom_amount (overrides default_amount)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Application Layer Changes

### 1. Type Definitions Update

**File**: `src/features/auth/types/index.ts`

```typescript
// BEFORE (Current)
export interface SessionData {
  user: AuthUser
  gymProfile: GymProfile // Single gym only
}

export interface GymProfile {
  id: string
  user_id: string
  username: string
  email: string
  email_verified: boolean
  phone_number: string | null
  gym_name: string
  gym_address: string | null
  gym_website: string | null
  created_at: string
  updated_at: string
}

// AFTER (Multi-Gym)
export interface SessionData {
  user: AuthUser
  gymProfiles: GymProfile[] // Array of all user's gyms
  activeGymId?: string // Currently selected gym (optional)
}

export interface GymProfile {
  id: string
  user_id: string
  username: string
  email: string
  email_verified: boolean
  phone_number: string | null
  gym_name: string
  gym_address: string | null
  gym_website: string | null
  organization_id: string // NEW - links gyms in same org
  is_primary_gym: boolean // NEW - first gym created
  created_at: string
  updated_at: string
}

// NEW: Shared settings types
export interface SharedPlanTemplate {
  id: string
  organization_id: string
  plan_type: 'monthly' | 'daily' | 'annual' | 'custom'
  template_name: string
  default_amount: number
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface GymPlanOverride {
  id: string
  gym_id: string
  shared_template_id: string
  custom_amount?: number
  is_active?: boolean
  created_at: string
  updated_at: string
}

export interface EffectivePlan {
  id: string
  plan_type: string
  name: string
  amount: number
  is_active: boolean
  source: 'shared' | 'override' | 'gym-specific'
  shared_template_id?: string // Present if source is 'shared' or 'override'
}
```

### 2. Auth Middleware Refactoring

**File**: `src/lib/middleware/auth.ts`

````typescript
import { createClient } from '@/lib/supabase/server'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { GymProfile } from '@/features/auth/types'
import { redirect } from 'next/navigation'

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<SupabaseUser> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return user
}

/**
 * @deprecated Use getUserGyms() and specify gymId explicitly.
 * This function will be removed in v2.0.
 *
 * For backward compatibility, returns the primary gym or first gym.
 */
export async function getCurrentGymProfile(): Promise<GymProfile> {
  console.warn('getCurrentGymProfile is deprecated. Use getUserGyms() instead.')

  const user = await requireAuth()
  const supabase = await createClient()

  const { data: gymProfile, error } = await supabase
    .from('gyms')
    .select('*')
    .eq('user_id', user.id)
    .order('is_primary_gym', { ascending: false })
    .limit(1)
    .single()

  if (error || !gymProfile) {
    throw new Error('Gym profile not found')
  }

  return gymProfile
}

/**
 * Get all gyms for the current authenticated user.
 * Returns gyms ordered by primary first.
 *
 * @returns Array of gym profiles
 * @throws Error if user not authenticated or has no gyms
 */
export async function getUserGyms(): Promise<GymProfile[]> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: gyms, error } = await supabase
    .from('gyms')
    .select('*')
    .eq('user_id', user.id)
    .order('is_primary_gym', { ascending: false }) // Primary gym first

  if (error) {
    throw new Error('Failed to fetch gyms')
  }

  if (!gyms || gyms.length === 0) {
    throw new Error('No gym profiles found')
  }

  return gyms
}

/**
 * Get a specific gym by ID and verify the current user owns it.
 *
 * @param gymId - UUID of the gym to fetch
 * @returns Gym profile if found and user has access
 * @throws Error if gym not found or user doesn't own it
 */
export async function getGymById(gymId: string): Promise<GymProfile> {
  const user = await requireAuth()
  const supabase = await createClient()

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(gymId)) {
    throw new Error('Invalid gym ID format')
  }

  const { data: gym, error } = await supabase
    .from('gyms')
    .select('*')
    .eq('id', gymId)
    .eq('user_id', user.id) // Verify ownership
    .single()

  if (error || !gym) {
    throw new Error('Gym not found or access denied')
  }

  return gym
}

/**
 * Verify that the current user has access to the specified gym.
 * Use this in API routes before performing gym-specific operations.
 *
 * @param gymId - UUID of the gym to verify access to
 * @returns Gym profile if access is granted
 * @throws Error if access denied
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const gymId = request.nextUrl.searchParams.get('gymId');
 *   await requireGymAccess(gymId);
 *   // ... proceed with gym-specific logic
 * }
 * ```
 */
export async function requireGymAccess(gymId: string): Promise<GymProfile> {
  return getGymById(gymId)
}

/**
 * Get all gyms in the same organization as the specified gym.
 * Useful for aggregated analytics and shared settings.
 *
 * @param gymId - UUID of any gym in the organization
 * @returns Array of all gyms in the organization
 */
export async function getOrganizationGyms(
  gymId: string
): Promise<GymProfile[]> {
  const gym = await getGymById(gymId) // Verifies ownership
  const supabase = await createClient()

  const { data: orgGyms, error } = await supabase
    .from('gyms')
    .select('*')
    .eq('organization_id', gym.organization_id)
    .order('is_primary_gym', { ascending: false })

  if (error) {
    throw new Error('Failed to fetch organization gyms')
  }

  return orgGyms || []
}
````

### 3. Auth Service Updates

**File**: `src/features/auth/services/auth.service.ts`

Update the `getCurrentSession()` function:

```typescript
/**
 * Get current session with all user's gyms
 */
export async function getCurrentSession(): Promise<SessionData | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return null
    }

    // CHANGED: Fetch ALL gyms for this user instead of single
    const { data: gymProfiles, error } = await supabase
      .from('gyms')
      .select('*')
      .eq('user_id', user.id)
      .order('is_primary_gym', { ascending: false }) // Primary first

    if (error || !gymProfiles || gymProfiles.length === 0) {
      return null
    }

    return {
      user: user as AuthUser,
      gymProfiles: gymProfiles as GymProfile[],
    }
  } catch (error) {
    console.error('Get session error:', error)
    return null
  }
}
```

Update the `loginWithPassword()` function:

```typescript
/**
 * Login with password - returns all user's gyms
 */
export async function loginWithPassword(
  input: LoginInput
): Promise<AuthResponse<LoginResponse>> {
  try {
    const supabase = await createClient()

    // ... existing auth logic ...

    // CHANGED: Fetch all gyms
    const { data: gymProfiles, error: gymError } = await supabase
      .from('gyms')
      .select('*')
      .eq('user_id', authData.user.id)
      .order('is_primary_gym', { ascending: false })

    if (gymError || !gymProfiles || gymProfiles.length === 0) {
      return {
        success: false,
        error: 'Failed to load gym profile',
      }
    }

    const primaryGym = gymProfiles[0] // First gym (primary or oldest)

    return {
      success: true,
      data: {
        user: authData.user as AuthUser,
        gymProfiles: gymProfiles as GymProfile[], // NEW
        primaryGym: primaryGym, // For backward compatibility
        requiresEmailVerification: !primaryGym.email_verified,
      },
    }
  } catch (error) {
    // ... error handling ...
  }
}
```

---

## UI Components

### 1. Active Gym Context Provider

**File**: `src/contexts/active-gym.context.tsx` (NEW)

```typescript
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { GymProfile } from '@/features/auth/types';

interface ActiveGymContextValue {
  activeGymId: string | null;
  activeGym: GymProfile | null;
  allGyms: GymProfile[];
  switchGym: (gymId: string) => void;
  isLoading: boolean;
  error: Error | null;
}

const ActiveGymContext = createContext<ActiveGymContextValue | null>(null);

/**
 * Hook to access active gym context
 * @throws Error if used outside ActiveGymProvider
 */
export function useActiveGym() {
  const context = useContext(ActiveGymContext);
  if (!context) {
    throw new Error('useActiveGym must be used within ActiveGymProvider');
  }
  return context;
}

const ACTIVE_GYM_STORAGE_KEY = 'active_gym_id';

interface ActiveGymProviderProps {
  children: ReactNode;
}

/**
 * Provider for managing active gym selection across the application.
 *
 * Features:
 * - Fetches all gyms for current user
 * - Persists active gym selection in localStorage
 * - Auto-selects primary gym on first load
 * - Invalidates all gym-scoped queries when gym switches
 *
 * Usage:
 * Wrap your dashboard layout with this provider:
 * <ActiveGymProvider>
 *   <YourDashboard />
 * </ActiveGymProvider>
 */
export function ActiveGymProvider({ children }: ActiveGymProviderProps) {
  const queryClient = useQueryClient();

  // Fetch all gyms for current user
  const { data: allGyms = [], isLoading, error } = useQuery<GymProfile[]>({
    queryKey: ['user-gyms'],
    queryFn: async () => {
      const res = await fetch('/api/gyms/list');
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch gyms');
      }
      const result = await res.json();
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
  });

  // Initialize active gym from localStorage or first gym
  const [activeGymId, setActiveGymId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;

    // Try to get from localStorage
    const stored = localStorage.getItem(ACTIVE_GYM_STORAGE_KEY);
    return stored;
  });

  // Auto-select first gym if none selected and gyms loaded
  useEffect(() => {
    if (!activeGymId && allGyms.length > 0) {
      // Check if stored gym exists in allGyms
      const storedId = localStorage.getItem(ACTIVE_GYM_STORAGE_KEY);
      const storedGymExists = allGyms.some(g => g.id === storedId);

      if (storedGymExists && storedId) {
        setActiveGymId(storedId);
      } else {
        // Default to primary gym or first gym
        const defaultGym = allGyms.find(g => g.is_primary_gym) || allGyms[0];
        setActiveGymId(defaultGym.id);
        localStorage.setItem(ACTIVE_GYM_STORAGE_KEY, defaultGym.id);
      }
    }
  }, [activeGymId, allGyms]);

  const activeGym = allGyms.find(g => g.id === activeGymId) || null;

  /**
   * Switch to a different gym
   * @param gymId - UUID of the gym to switch to
   */
  const switchGym = (gymId: string) => {
    // Verify gym exists
    const gym = allGyms.find(g => g.id === gymId);
    if (!gym) {
      console.error(`Gym ${gymId} not found in user's gyms`);
      return;
    }

    setActiveGymId(gymId);
    localStorage.setItem(ACTIVE_GYM_STORAGE_KEY, gymId);

    // Invalidate all gym-scoped queries to refetch for new gym
    queryClient.invalidateQueries({ queryKey: ['members'] });
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['revenue'] });
    queryClient.invalidateQueries({ queryKey: ['settings'] });
    queryClient.invalidateQueries({ queryKey: ['plan-types'] });
    queryClient.invalidateQueries({ queryKey: ['discounts'] });

    console.log(`Switched to gym: ${gym.gym_name}`);
  };

  return (
    <ActiveGymContext.Provider
      value={{
        activeGymId,
        activeGym,
        allGyms,
        switchGym,
        isLoading,
        error: error as Error | null,
      }}
    >
      {children}
    </ActiveGymContext.Provider>
  );
}
```

### 2. Gym Switcher Component

**File**: `src/components/layout/GymSwitcher.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useActiveGym } from '@/contexts/active-gym.context';
import { useRouter } from 'next/navigation';

/**
 * Gmail-style gym switcher component.
 *
 * Features:
 * - Displays current gym with avatar
 * - Lists all user's gyms in dropdown
 * - Highlights active gym
 * - Search/filter for users with many gyms
 * - "Create New Gym" action at bottom
 */
export function GymSwitcher() {
  const router = useRouter();
  const { activeGym, allGyms, switchGym } = useActiveGym();
  const [open, setOpen] = useState(false);

  const handleCreateGym = () => {
    setOpen(false);
    router.push('/create-gym');
  };

  const handleSelectGym = (gymId: string) => {
    switchGym(gymId);
    setOpen(false);
  };

  if (!activeGym) {
    return (
      <div className="w-full p-2 text-center text-sm text-gray-500">
        Loading gyms...
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select a gym"
          className="w-full justify-between"
        >
          <div className="flex items-center gap-2 truncate">
            {/* Gym Avatar */}
            <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
              {activeGym.gym_name.charAt(0).toUpperCase()}
            </div>

            {/* Gym Name */}
            <div className="flex flex-col items-start">
              <span className="truncate font-medium text-sm">
                {activeGym.gym_name}
              </span>
              {activeGym.is_primary_gym && (
                <span className="text-xs text-gray-500">Primary</span>
              )}
            </div>
          </div>

          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search gyms..." />
          <CommandList>
            <CommandEmpty>No gym found.</CommandEmpty>

            <CommandGroup heading="Your Gyms">
              {allGyms.map((gym) => (
                <CommandItem
                  key={gym.id}
                  onSelect={() => handleSelectGym(gym.id)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      activeGym?.id === gym.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />

                  <Building2 className="mr-2 h-4 w-4 text-gray-400" />

                  <div className="flex flex-col flex-1">
                    <span className="font-medium">{gym.gym_name}</span>
                    {gym.is_primary_gym && (
                      <span className="text-xs text-gray-500">Primary</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup>
              <CommandItem
                onSelect={handleCreateGym}
                className="cursor-pointer text-blue-600"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New Gym
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

### 3. Sidebar Integration

**File**: `src/components/layout/Sidebar.tsx` (MODIFY)

```typescript
// Add import
import { GymSwitcher } from './GymSwitcher';

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-r border-gray-200 px-6 pb-4">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center">
            <h1 className="text-xl font-bold text-gray-900">
              Metric Gym OS
            </h1>
          </div>

          {/* NEW: Gym Switcher - Add this section */}
          <div className="space-y-2">
            <GymSwitcher />
          </div>

          {/* Existing Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              {/* ... existing nav items ... */}
            </ul>
          </nav>
        </div>
      </div>

      {/* Mobile sidebar - also add GymSwitcher here */}
      {/* ... */}
    </>
  );
}
```

### 4. Dashboard Layout Update

**File**: `src/app/(dashboard)/layout.tsx` (MODIFY)

```typescript
import { requireAuth } from '@/lib/middleware/auth'; // Changed from getCurrentGymProfile
import { redirect } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { MemberModalProvider } from '@/features/members/contexts/member-modal.context';
import { ActiveGymProvider } from '@/contexts/active-gym.context'; // NEW

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verify authentication (don't call getCurrentGymProfile anymore)
  try {
    await requireAuth(); // Just verify they're logged in
  } catch (error) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64">
        {/* NEW: Wrap content with ActiveGymProvider */}
        <ActiveGymProvider>
          <Header />
          <main className="px-4 py-6 lg:px-8">
            <MemberModalProvider>
              {children}
            </MemberModalProvider>
          </main>
        </ActiveGymProvider>
      </div>
    </div>
  );
}
```

### 5. Create Gym Page

**File**: `src/app/(dashboard)/create-gym/page.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useActiveGym } from '@/contexts/active-gym.context';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const createGymSchema = z.object({
  gymName: z.string().min(2, 'Gym name must be at least 2 characters').max(100),
  gymAddress: z.string().min(5, 'Address must be at least 5 characters').max(200).optional().or(z.literal('')),
  gymWebsite: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

type CreateGymInput = z.infer<typeof createGymSchema>;

export default function CreateGymPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { switchGym } = useActiveGym();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<CreateGymInput>({
    gymName: '',
    gymAddress: '',
    gymWebsite: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    try {
      // Validate form data
      const validatedData = createGymSchema.parse(formData);
      setIsLoading(true);

      // Call API to create gym
      const response = await fetch('/api/gyms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validatedData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error || 'Failed to create gym account');
        return;
      }

      // Invalidate gyms list to refetch
      await queryClient.invalidateQueries({ queryKey: ['user-gyms'] });

      // Switch to newly created gym
      switchGym(result.data.id);

      // Redirect to members page
      router.push('/members');
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) {
            errors[error.path[0] as string] = error.message;
          }
        });
        setFieldErrors(errors);
        setError('Please fix the errors below');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create New Gym Account</CardTitle>
          <CardDescription>
            Add another gym location to your account. You'll be able to switch between your gyms anytime.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="gymName">
                Gym Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="gymName"
                value={formData.gymName}
                onChange={(e) =>
                  setFormData({ ...formData, gymName: e.target.value })
                }
                placeholder="e.g., Downtown Branch, Suburban Location"
                disabled={isLoading}
                className={fieldErrors.gymName ? 'border-red-500' : ''}
              />
              {fieldErrors.gymName && (
                <p className="text-sm text-red-500">{fieldErrors.gymName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gymAddress">Gym Address</Label>
              <Input
                id="gymAddress"
                value={formData.gymAddress}
                onChange={(e) =>
                  setFormData({ ...formData, gymAddress: e.target.value })
                }
                placeholder="123 Main St, City, State ZIP"
                disabled={isLoading}
                className={fieldErrors.gymAddress ? 'border-red-500' : ''}
              />
              {fieldErrors.gymAddress && (
                <p className="text-sm text-red-500">{fieldErrors.gymAddress}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gymWebsite">Gym Website</Label>
              <Input
                id="gymWebsite"
                type="url"
                value={formData.gymWebsite}
                onChange={(e) =>
                  setFormData({ ...formData, gymWebsite: e.target.value })
                }
                placeholder="https://example.com"
                disabled={isLoading}
                className={fieldErrors.gymWebsite ? 'border-red-500' : ''}
              />
              {fieldErrors.gymWebsite && (
                <p className="text-sm text-red-500">{fieldErrors.gymWebsite}</p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? 'Creating...' : 'Create Gym Account'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## API Route Refactoring

### Standard Pattern for All Routes

**Before (Single Gym)**:

```typescript
// src/app/api/members/route.ts
export async function GET(request: NextRequest) {
  const gymProfile = await getCurrentGymProfile()

  const filters = {
    status: searchParams.get('status'),
    search: searchParams.get('search'),
  }

  const result = await getMembersList(gymProfile.id, filters)
  return NextResponse.json({ success: true, data: result })
}
```

**After (Multi-Gym)**:

```typescript
// src/app/api/members/route.ts
export async function GET(request: NextRequest) {
  try {
    // 1. Extract gymId from query parameter
    const searchParams = request.nextUrl.searchParams
    const gymId = searchParams.get('gymId')

    if (!gymId) {
      return NextResponse.json(
        { success: false, error: 'Please select a gym account to continue.' },
        { status: 400 }
      )
    }

    // 2. Verify ownership and get gym profile
    const gymProfile = await requireGymAccess(gymId)

    // 3. Build filters
    const filters = {
      status: searchParams.get('status'),
      search: searchParams.get('search'),
    }

    // 4. Use gymId for all operations
    const result = await getMembersList(gymId, filters)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Get members error:', error)

    if (error.message === 'Gym not found or access denied') {
      return NextResponse.json(
        { success: false, error: 'Gym not found or access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch members' },
      { status: 500 }
    )
  }
}
```

### New API Routes

#### 1. List User's Gyms

**File**: `src/app/api/gyms/list/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server'
import { getUserGyms } from '@/lib/middleware/auth'

/**
 * GET /api/gyms/list
 * Returns all gyms for the authenticated user.
 */
export async function GET() {
  try {
    const gyms = await getUserGyms()

    return NextResponse.json({
      success: true,
      data: gyms,
    })
  } catch (error) {
    console.error('List gyms error:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to fetch gyms' },
      { status: 500 }
    )
  }
}
```

#### 2. Create New Gym

**File**: `src/app/api/gyms/create/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/auth'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createGymSchema = z.object({
  gymName: z.string().min(2).max(100),
  gymAddress: z.string().min(5).max(200).optional().or(z.literal('')),
  gymWebsite: z.string().url().optional().or(z.literal('')),
})

/**
 * POST /api/gyms/create
 * Creates a new gym account for the authenticated user.
 *
 * Body:
 * {
 *   "gymName": string (required),
 *   "gymAddress": string (optional),
 *   "gymWebsite": string (optional, must be valid URL)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()

    // Validate input
    const validatedData = createGymSchema.parse(body)

    const supabase = await createClient()

    // Get user's existing gyms to determine organization_id
    const { data: existingGyms, error: existingError } = await supabase
      .from('gyms')
      .select('organization_id, id')
      .eq('user_id', user.id)
      .limit(1)

    if (existingError) {
      throw new Error('Failed to check existing gyms')
    }

    // If user has gyms, join their organization. Otherwise create new org.
    const organizationId =
      existingGyms && existingGyms.length > 0
        ? existingGyms[0].organization_id
        : crypto.randomUUID()

    // Generate unique username for new gym
    // Pattern: gymname_timestamp
    const baseUsername = validatedData.gymName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .substring(0, 30)

    const timestamp = Date.now().toString(36)
    const uniqueUsername = `${baseUsername}_${timestamp}`

    // Create new gym
    const { data: newGym, error: createError } = await supabase
      .from('gyms')
      .insert({
        user_id: user.id,
        username: uniqueUsername,
        email: user.email, // Reuse user's email
        email_verified: true, // User is already verified
        gym_name: validatedData.gymName,
        gym_address: validatedData.gymAddress || null,
        gym_website: validatedData.gymWebsite || null,
        organization_id: organizationId,
        is_primary_gym: existingGyms.length === 0, // First gym is primary
      })
      .select()
      .single()

    if (createError || !newGym) {
      console.error('Create gym error:', createError)
      return NextResponse.json(
        { success: false, error: 'Failed to create gym account' },
        { status: 500 }
      )
    }

    // Initialize default plan types for new gym
    const defaultPlans = [
      {
        gym_id: newGym.id,
        plan_type: 'monthly',
        default_amount: 5000.0,
        is_active: true,
      },
      {
        gym_id: newGym.id,
        plan_type: 'daily',
        default_amount: 300.0,
        is_active: true,
      },
      {
        gym_id: newGym.id,
        plan_type: 'annual',
        default_amount: 50000.0,
        is_active: true,
      },
    ]

    const { error: planError } = await supabase
      .from('plan_types')
      .insert(defaultPlans)

    if (planError) {
      console.warn('Failed to create default plan types:', planError)
      // Don't fail the request - plan types can be created manually
    }

    return NextResponse.json(
      {
        success: true,
        data: newGym,
        message: 'Gym account created successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create gym error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input data',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create gym account' },
      { status: 500 }
    )
  }
}
```

### Client-Side Fetch Wrapper

**File**: `src/lib/api/gym-client.ts` (NEW)

````typescript
import { useActiveGym } from '@/contexts/active-gym.context'

/**
 * Custom hook that provides a fetch wrapper which automatically
 * includes the active gymId in all requests.
 *
 * Usage:
 * ```typescript
 * const gymFetch = useGymFetch();
 * const response = await gymFetch('/api/members');
 * // Automatically adds ?gymId=active-gym-id to URL
 * ```
 */
export function useGymFetch() {
  const { activeGymId } = useActiveGym()

  return async (url: string, options?: RequestInit) => {
    if (!activeGymId) {
      throw new Error('No active gym selected')
    }

    // Add gymId to URL
    const urlWithGym = new URL(url, window.location.origin)
    urlWithGym.searchParams.set('gymId', activeGymId)

    return fetch(urlWithGym.toString(), options)
  }
}

/**
 * Alternative: Standalone function that doesn't require React context
 * Use this in non-component code (e.g., utility functions)
 */
export async function gymFetch(
  gymId: string,
  url: string,
  options?: RequestInit
) {
  const urlWithGym = new URL(url, window.location.origin)
  urlWithGym.searchParams.set('gymId', gymId)

  return fetch(urlWithGym.toString(), options)
}
````

### Example Refactored API Routes

#### Members Route

**File**: `src/app/api/members/route.ts` (MODIFY)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireGymAccess } from '@/lib/middleware/auth'
import {
  getMembersList,
  createMember,
} from '@/features/members/services/member.service'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const gymId = searchParams.get('gymId')

    if (!gymId) {
      return NextResponse.json(
        { success: false, error: 'gymId is required' },
        { status: 400 }
      )
    }

    await requireGymAccess(gymId)

    const filters = {
      status: searchParams.get('status'),
      search: searchParams.get('search'),
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    }

    const result = await getMembersList(gymId, filters)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Get members error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch members' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const gymId = searchParams.get('gymId')

    if (!gymId) {
      return NextResponse.json(
        { success: false, error: 'gymId is required' },
        { status: 400 }
      )
    }

    await requireGymAccess(gymId)

    const body = await request.json()
    const member = await createMember(gymId, body)

    return NextResponse.json({ success: true, data: member }, { status: 201 })
  } catch (error) {
    console.error('Create member error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create member' },
      { status: 500 }
    )
  }
}
```

---

## Advanced Features

### 1. Shared Plan Templates Service

**File**: `src/features/settings/services/plan-templates.service.ts` (NEW)

```typescript
import { createClient } from '@/lib/supabase/server'
import type {
  EffectivePlan,
  SharedPlanTemplate,
  GymPlanOverride,
} from '@/features/auth/types'

/**
 * Get effective plan types for a gym.
 * Merges shared templates, gym overrides, and gym-specific plans.
 *
 * Logic:
 * 1. Fetch shared templates from organization
 * 2. Fetch gym-specific overrides
 * 3. Merge: overrides take precedence over shared templates
 * 4. Add gym-specific plans
 *
 * @param gymId - UUID of the gym
 * @returns Array of effective plans with source indication
 */
export async function getEffectivePlanTypes(
  gymId: string
): Promise<EffectivePlan[]> {
  const supabase = await createClient()

  // Get gym's organization
  const { data: gym, error: gymError } = await supabase
    .from('gyms')
    .select('organization_id')
    .eq('id', gymId)
    .single()

  if (gymError || !gym) {
    throw new Error('Gym not found')
  }

  // Get shared templates from organization
  const { data: sharedTemplates } = await supabase
    .from('shared_plan_templates')
    .select('*')
    .eq('organization_id', gym.organization_id)
    .eq('is_active', true)

  // Get gym overrides
  const { data: overrides } = await supabase
    .from('gym_plan_overrides')
    .select('*, shared_template:shared_plan_templates(*)')
    .eq('gym_id', gymId)

  // Get gym-specific plans
  const { data: gymPlans } = await supabase
    .from('plan_types')
    .select('*')
    .eq('gym_id', gymId)
    .eq('is_active', true)

  // Merge: overrides take precedence over shared templates
  const effectivePlans: EffectivePlan[] = []

  sharedTemplates?.forEach((template) => {
    const override = overrides?.find(
      (o) => o.shared_template_id === template.id
    )

    effectivePlans.push({
      id: override?.id || template.id,
      plan_type: template.plan_type,
      name: template.template_name,
      amount: override?.custom_amount ?? template.default_amount,
      is_active: override?.is_active ?? template.is_active,
      source: override ? 'override' : 'shared',
      shared_template_id: template.id,
    })
  })

  // Add gym-specific plans
  gymPlans?.forEach((plan) => {
    effectivePlans.push({
      id: plan.id,
      plan_type: plan.plan_type,
      name: `${plan.plan_type} (custom)`,
      amount: plan.default_amount,
      is_active: plan.is_active,
      source: 'gym-specific',
    })
  })

  return effectivePlans
}

/**
 * Create a shared plan template (only primary gym can do this).
 *
 * @param gymId - UUID of the primary gym
 * @param templateData - Plan template data
 * @returns Created template
 * @throws Error if gym is not primary
 */
export async function createSharedPlanTemplate(
  gymId: string,
  templateData: {
    planType: string
    templateName: string
    defaultAmount: number
    description?: string
  }
): Promise<SharedPlanTemplate> {
  const supabase = await createClient()

  // Verify gym is primary
  const { data: gym } = await supabase
    .from('gyms')
    .select('organization_id, is_primary_gym')
    .eq('id', gymId)
    .single()

  if (!gym?.is_primary_gym) {
    throw new Error('Only primary gym can create shared templates')
  }

  const { data, error } = await supabase
    .from('shared_plan_templates')
    .insert({
      organization_id: gym.organization_id,
      plan_type: templateData.planType,
      template_name: templateData.templateName,
      default_amount: templateData.defaultAmount,
      description: templateData.description,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Create or update a gym override for a shared template.
 *
 * @param gymId - UUID of the gym
 * @param sharedTemplateId - UUID of the shared template
 * @param override - Override data
 * @returns Created/updated override
 */
export async function createPlanOverride(
  gymId: string,
  sharedTemplateId: string,
  override: {
    customAmount?: number
    isActive?: boolean
  }
): Promise<GymPlanOverride> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('gym_plan_overrides')
    .upsert(
      {
        gym_id: gymId,
        shared_template_id: sharedTemplateId,
        custom_amount: override.customAmount,
        is_active: override.isActive,
      },
      {
        onConflict: 'gym_id,shared_template_id',
      }
    )
    .select()
    .single()

  if (error) throw error
  return data
}
```

### 2. Aggregated Analytics

**File**: `src/app/(dashboard)/analytics/page.tsx` (NEW)

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useActiveGym } from '@/contexts/active-gym.context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, DollarSign, TrendingUp } from 'lucide-react';

interface OrgAnalytics {
  totalMembers: number;
  totalRevenue: number;
  activeMembers: number;
  gymBreakdown: Array<{
    gymId: string;
    gymName: string;
    memberCount: number;
    revenue: number;
    activeMembers: number;
  }>;
}

export default function AnalyticsPage() {
  const { activeGym } = useActiveGym();

  const { data: analytics, isLoading } = useQuery<OrgAnalytics>({
    queryKey: ['org-analytics', activeGym?.organization_id],
    queryFn: async () => {
      const res = await fetch(
        `/api/analytics/organization?orgId=${activeGym?.organization_id}`
      );
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const result = await res.json();
      return result.data;
    },
    enabled: !!activeGym?.organization_id,
  });

  if (isLoading) {
    return <div>Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Organization Analytics</h1>
        <p className="text-gray-500">
          Aggregated metrics across all your gym locations
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalMembers || 0}</div>
            <p className="text-xs text-gray-500">
              {analytics?.activeMembers || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rs. {analytics?.totalRevenue.toLocaleString() || 0}
            </div>
            <p className="text-xs text-gray-500">All locations combined</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locations</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.gymBreakdown.length || 0}
            </div>
            <p className="text-xs text-gray-500">Active gym locations</p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown by Gym */}
      <Card>
        <CardHeader>
          <CardTitle>Breakdown by Location</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics?.gymBreakdown.map((gym) => (
              <div
                key={gym.gymId}
                className="flex items-center justify-between border-b pb-4 last:border-0"
              >
                <div className="space-y-1">
                  <p className="font-medium">{gym.gymName}</p>
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span>{gym.memberCount} members</span>
                    <span>({gym.activeMembers} active)</span>
                  </div>
                </div>
                <p className="text-lg font-semibold">
                  Rs. {gym.revenue.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**File**: `src/app/api/analytics/organization/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const orgId = request.nextUrl.searchParams.get('orgId')

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'orgId is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify user owns gyms in this organization
    const { data: userGyms } = await supabase
      .from('gyms')
      .select('id, gym_name')
      .eq('user_id', user.id)
      .eq('organization_id', orgId)

    if (!userGyms || userGyms.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    const gymIds = userGyms.map((g) => g.id)

    // Aggregate members across all gyms
    const { count: totalMembers } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .in('gym_id', gymIds)
      .neq('status', 'archived')

    const { count: activeMembers } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .in('gym_id', gymIds)
      .eq('status', 'active')

    // Aggregate revenue
    const { data: payments } = await supabase
      .from('payments')
      .select('amount, member:members!inner(gym_id)')
      .in('member.gym_id', gymIds)

    const totalRevenue =
      payments?.reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0

    // Breakdown by gym
    const gymBreakdown = await Promise.all(
      userGyms.map(async (gym) => {
        const { count: memberCount } = await supabase
          .from('members')
          .select('*', { count: 'exact', head: true })
          .eq('gym_id', gym.id)
          .neq('status', 'archived')

        const { count: activeMemberCount } = await supabase
          .from('members')
          .select('*', { count: 'exact', head: true })
          .eq('gym_id', gym.id)
          .eq('status', 'active')

        const { data: gymPayments } = await supabase
          .from('payments')
          .select('amount, member:members!inner(gym_id)')
          .eq('member.gym_id', gym.id)

        const revenue =
          gymPayments?.reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0

        return {
          gymId: gym.id,
          gymName: gym.gym_name,
          memberCount: memberCount || 0,
          activeMembers: activeMemberCount || 0,
          revenue,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        totalMembers: totalMembers || 0,
        activeMembers: activeMembers || 0,
        totalRevenue,
        gymBreakdown,
      },
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
```

---

## Testing Strategy

### Unit Tests

**File**: `tests/lib/middleware/auth.test.ts` (NEW)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getUserGyms,
  requireGymAccess,
  getOrganizationGyms,
} from '@/lib/middleware/auth'

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: 'user-123', email: 'test@gym.com' } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [
              {
                id: 'gym-1',
                user_id: 'user-123',
                gym_name: 'Main Gym',
                organization_id: 'org-1',
                is_primary_gym: true,
              },
              {
                id: 'gym-2',
                user_id: 'user-123',
                gym_name: 'Branch 2',
                organization_id: 'org-1',
                is_primary_gym: false,
              },
            ],
          })),
        })),
      })),
    })),
  })),
}))

describe('Multi-Gym Auth Helpers', () => {
  describe('getUserGyms', () => {
    it('should fetch all gyms for authenticated user', async () => {
      const gyms = await getUserGyms()

      expect(gyms).toHaveLength(2)
      expect(gyms[0].is_primary_gym).toBe(true)
      expect(gyms[1].is_primary_gym).toBe(false)
    })

    it('should order gyms with primary first', async () => {
      const gyms = await getUserGyms()

      expect(gyms[0].gym_name).toBe('Main Gym')
    })
  })

  describe('requireGymAccess', () => {
    it('should throw error for invalid UUID format', async () => {
      await expect(requireGymAccess('not-a-uuid')).rejects.toThrow(
        'Invalid gym ID format'
      )
    })

    it('should allow access to owned gym', async () => {
      const gym = await requireGymAccess('gym-1')
      expect(gym.id).toBe('gym-1')
    })
  })

  describe('getOrganizationGyms', () => {
    it('should fetch all gyms in same organization', async () => {
      const orgGyms = await getOrganizationGyms('gym-1')

      expect(orgGyms).toHaveLength(2)
      expect(orgGyms[0].organization_id).toBe(orgGyms[1].organization_id)
    })
  })
})
```

### Integration Tests

**File**: `tests/features/gyms/multi-gym.test.ts` (NEW)

```typescript
import { describe, it, expect } from 'vitest'

describe('Multi-Gym Integration Tests', () => {
  it('should create new gym and join existing organization', async () => {
    // Test creating second gym
    const response = await fetch('/api/gyms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gymName: 'Downtown Branch',
        gymAddress: '456 Oak St',
      }),
    })

    const result = await response.json()

    expect(response.status).toBe(201)
    expect(result.success).toBe(true)
    expect(result.data.gym_name).toBe('Downtown Branch')
    expect(result.data.is_primary_gym).toBe(false)
  })

  it('should enforce data isolation between gyms', async () => {
    // Create member in gym-1
    const member = await createMember('gym-1', { name: 'John Doe' })

    // Try to fetch members from gym-2
    const members = await getMembersList('gym-2', {})

    // Should not include member from gym-1
    expect(members).not.toContainEqual(member)
  })
})
```

### E2E Tests (Playwright)

**File**: `tests/e2e/multi-gym.spec.ts` (NEW)

```typescript
import { test, expect } from '@playwright/test'

test.describe('Multi-Gym Functionality', () => {
  test('user can create and switch between gyms', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('input[name="email"]', 'test@gym.com')
    await page.fill('input[name="password"]', 'Test123!')
    await page.click('button[type="submit"]')

    // Should land on members page
    await expect(page).toHaveURL('/members')

    // Open gym switcher
    await page.click('[role="combobox"]')

    // Click "Create New Gym"
    await page.click('text=Create New Gym')

    // Fill form
    await page.fill('input#gymName', 'Downtown Branch')
    await page.fill('input#gymAddress', '456 Oak St')
    await page.click('button[type="submit"]')

    // Should switch to new gym
    await expect(page.locator('[role="combobox"]')).toContainText(
      'Downtown Branch'
    )

    // Members list should be empty for new gym
    await expect(page.locator('text=No members found')).toBeVisible()

    // Switch back to first gym
    await page.click('[role="combobox"]')
    await page.click('text=Main Gym')

    // Should have different members
    await expect(page.locator('[role="combobox"]')).toContainText('Main Gym')
  })

  test('shared settings are visible across gyms', async ({ page }) => {
    // Navigate to settings as primary gym
    await page.goto('/settings')

    // Create shared plan template
    await page.click('text=Create Shared Template')
    await page.fill('input[name="templateName"]', 'Premium Monthly')
    await page.fill('input[name="defaultAmount"]', '10000')
    await page.click('button:has-text("Create")')

    // Switch to second gym
    await page.click('[role="combobox"]')
    await page.click('text=Branch 2')

    // Navigate to settings
    await page.goto('/settings')

    // Shared template should be visible
    await expect(page.locator('text=Premium Monthly')).toBeVisible()
    await expect(page.locator('text=Shared from Main Gym')).toBeVisible()
  })
})
```

---

## Deployment & Rollout

### Phase 1: Database Migration (Week 1)

```bash
# Run migrations
supabase migration up 20260221000001_add_organization_to_gyms.sql
supabase migration up 20260221000002_create_gym_memberships.sql
supabase migration up 20260221000003_create_shared_settings.sql
supabase migration up 20260221000004_update_rls_for_multigym.sql

# Verify migrations
supabase db reset --local  # Test locally first
```

### Phase 2: Feature Flag Deployment (Week 2)

Add to `.env`:

```bash
NEXT_PUBLIC_ENABLE_MULTI_GYM=false
```

Deploy code with feature flag off. Database schema is ready but features are dormant.

### Phase 3: Internal Testing (Week 3)

Enable for specific test accounts:

```typescript
// In active-gym.context.tsx
const isMultiGymEnabled =
  process.env.NEXT_PUBLIC_ENABLE_MULTI_GYM === 'true' ||
  testAccountEmails.includes(user.email)
```

### Phase 4: Beta Rollout (Week 4)

Enable for 10-20% of users via gradual rollout:

```typescript
// Enable for users whose ID hash matches
const enabledPercentage = 20
const userIdHash = hashCode(user.id) % 100
const isMultiGymEnabled = userIdHash < enabledPercentage
```

### Phase 5: Full Rollout (Week 5)

Set `NEXT_PUBLIC_ENABLE_MULTI_GYM=true` for all users.

### Phase 6: Cleanup (Week 6)

Remove deprecated code:

- Remove `getCurrentGymProfile()`
- Remove feature flag checks
- Update documentation

---

## Troubleshooting Guide

### Issue: "gymId is required" error

**Cause**: API route called without gymId parameter
**Solution**: Ensure `useGymFetch()` hook is used in component

### Issue: User can't see any gyms after login

**Cause**: Active Gym Context not fetching gyms
**Check**:

1. Verify API route `/api/gyms/list` is working
2. Check browser console for errors
3. Verify user has at least one gym in database

### Issue: Data from wrong gym appearing

**Cause**: API route not using correct gymId
**Solution**: Verify all API routes call `requireGymAccess(gymId)`

### Issue: RLS policy blocking queries

**Cause**: RLS policies may need updating
**Solution**: Test queries with `SET request.jwt.claims` in SQL

---

## Summary

This implementation blueprint provides everything needed to add multi-gym support to the Gym Management SaaS platform. The feature maintains backward compatibility, follows security best practices, and provides a Gmail-style user experience for managing multiple gym locations.

**Total Estimated Effort**: 6 weeks (1 developer)
**Risk Level**: Medium (API refactoring is tedious but straightforward)
**Business Impact**: High (enables enterprise customers with multiple locations)

For questions or clarifications, refer to the original plan document at:
`C:\Users\playe\.claude\plans\tranquil-foraging-sedgewick.md`
