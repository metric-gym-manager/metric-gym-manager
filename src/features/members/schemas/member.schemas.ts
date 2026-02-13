import { z } from 'zod';

// ============================================================
// MEMBER ENUMS
// ============================================================

export const MemberPlanType = z.enum(['monthly', 'daily', 'annual']);
export type MemberPlanType = z.infer<typeof MemberPlanType>;

export const MemberStatus = z.enum(['active', 'expired', 'suspended', 'cancelled']);
export type MemberStatus = z.infer<typeof MemberStatus>;

// ============================================================
// ADD MEMBER SCHEMA
// ============================================================

export const addMemberSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),

  phoneNumber: z
    .string()
    .regex(/^\+94[0-9]{9}$/, 'Phone number must be in +94XXXXXXXXX format'),

  emergencyContactName: z
    .string()
    .min(2, 'Emergency contact name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .optional(),

  emergencyContactPhone: z
    .string()
    .regex(/^\+94[0-9]{9}$/, 'Phone number must be in +94XXXXXXXXX format')
    .optional(),

  planType: MemberPlanType,

  planAmount: z
    .number()
    .positive('Plan amount must be greater than 0')
    .max(1000000, 'Plan amount is too large'),

  discountId: z.string().uuid().nullable().optional(),

  recurringDiscount: z.boolean().optional(),

  membershipStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),

  paymentAmount: z
    .number()
    .positive('Payment amount must be greater than 0')
    .max(1000000, 'Payment amount is too large'),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;

// ============================================================
// UPDATE MEMBER SCHEMA
// ============================================================

export const updateMemberSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .optional(),

  phoneNumber: z
    .string()
    .regex(/^\+94[0-9]{9}$/, 'Phone number must be in +94XXXXXXXXX format')
    .optional(),

  emergencyContactName: z
    .string()
    .min(2, 'Emergency contact name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .nullable()
    .optional(),

  emergencyContactPhone: z
    .string()
    .regex(/^\+94[0-9]{9}$/, 'Phone number must be in +94XXXXXXXXX format')
    .nullable()
    .optional(),

  planType: MemberPlanType.optional(),

  planAmount: z
    .number()
    .positive('Plan amount must be greater than 0')
    .max(1000000, 'Plan amount is too large')
    .optional(),

  discountId: z.string().uuid().nullable().optional(),

  recurringDiscount: z.boolean().optional(),

  status: MemberStatus.optional(),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

// ============================================================
// COLLECT PAYMENT SCHEMA
// ============================================================

export const collectPaymentSchema = z.object({
  memberId: z.string().uuid(),

  planAmount: z
    .number()
    .positive('Plan amount must be greater than 0')
    .max(1000000, 'Plan amount is too large'),

  discountId: z.string().uuid().nullable().optional(),

  paymentAmount: z
    .number()
    .positive('Payment amount must be greater than 0')
    .max(1000000, 'Payment amount is too large'),

  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),

  deductOverduePeriod: z.boolean().optional(),
});

export type CollectPaymentInput = z.infer<typeof collectPaymentSchema>;

// ============================================================
// MEMBER QUERY FILTERS
// ============================================================

export const memberFiltersSchema = z.object({
  search: z.string().optional(),
  status: MemberStatus.optional(),
  planType: MemberPlanType.optional(),
  sortBy: z.enum(['newest', 'oldest', 'upcoming_due', 'recently_expired']).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type MemberFiltersInput = z.infer<typeof memberFiltersSchema>;
