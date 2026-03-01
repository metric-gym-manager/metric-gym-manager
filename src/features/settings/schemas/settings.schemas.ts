import { z } from 'zod';

// ============================================================
// GYM INFORMATION SCHEMA
// ============================================================

export const updateGymInfoSchema = z.object({
  gym_name: z
    .string()
    .min(2, 'Gym name must be at least 2 characters')
    .max(100, 'Gym name must not exceed 100 characters'),

  gym_address: z
    .union([
      z.string().min(5, 'Address must be at least 5 characters').max(200, 'Address must not exceed 200 characters'),
      z.literal(''),
    ])
    .optional()
    .nullable(),

  gym_website: z
    .union([
      z.string().url('Invalid website URL'),
      z.literal(''),
    ])
    .optional()
    .nullable(),
});

export type UpdateGymInfoInput = z.infer<typeof updateGymInfoSchema>;

// ============================================================
// PLAN TYPE SCHEMA
// ============================================================

export const PlanTypeEnum = z.enum(['daily', 'weekly', 'monthly', '3-months', '6-months', 'annual']);
export type PlanTypeEnum = z.infer<typeof PlanTypeEnum>;

export const createPlanTypeSchema = z.object({
  plan_type: PlanTypeEnum,
  default_amount: z
    .number()
    .positive('Amount must be greater than 0')
    .max(1000000, 'Amount is too large'),
  is_active: z.boolean().optional().default(true),
});

export type CreatePlanTypeInput = z.infer<typeof createPlanTypeSchema>;

export const updatePlanTypeSchema = z.object({
  plan_type: PlanTypeEnum,
  default_amount: z
    .number()
    .positive('Amount must be greater than 0')
    .max(1000000, 'Amount is too large'),
  is_active: z.boolean(),
});

export type UpdatePlanTypeInput = z.infer<typeof updatePlanTypeSchema>;

export const deletePlanTypeSchema = z.object({
  plan_type: PlanTypeEnum,
});

export type DeletePlanTypeInput = z.infer<typeof deletePlanTypeSchema>;

// ============================================================
// DISCOUNT SCHEMA
// ============================================================

export const createDiscountSchema = z.object({
  discount_name: z
    .string()
    .min(2, 'Discount name must be at least 2 characters')
    .max(50, 'Discount name must not exceed 50 characters'),

  discount_percentage: z
    .number()
    .int('Percentage must be a whole number')
    .min(1, 'Percentage must be at least 1')
    .max(100, 'Percentage cannot exceed 100'),

  is_active: z.boolean().optional(),
});

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>;

export const updateDiscountSchema = z.object({
  discount_name: z
    .string()
    .min(2, 'Discount name must be at least 2 characters')
    .max(50, 'Discount name must not exceed 50 characters')
    .optional(),

  discount_percentage: z
    .number()
    .int('Percentage must be a whole number')
    .min(1, 'Percentage must be at least 1')
    .max(100, 'Percentage cannot exceed 100')
    .optional(),

  is_active: z.boolean().optional(),
});

export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>;

// ============================================================
// SECURITY SCHEMA
// ============================================================

export const updatePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirm_password: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
});

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;

export const updateEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export type UpdateEmailInput = z.infer<typeof updateEmailSchema>;
