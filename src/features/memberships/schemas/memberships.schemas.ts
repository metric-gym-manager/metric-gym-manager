import { z } from 'zod'

export const CreatePlanSchema = z.object({
  name: z.string().min(2, 'Plan name must be at least 2 characters'),
  description: z.string().optional(),
  planType: z.enum(['drop_in', 'class_pack', 'monthly', 'annual', 'custom']),
  priceAmount: z.number().positive('Price must be greater than 0'),
  billingFrequency: z.enum(['one_time', 'monthly', 'annual']),
  trialDays: z.number().int().min(0).optional(),
  accessLevel: z.string().optional(),
  classCredits: z.number().int().positive().optional(),
  contractLengthMonths: z.number().int().positive().optional(),
  setupFee: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const UpdatePlanSchema = CreatePlanSchema.partial()

export const AssignPlanSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
  planId: z.string().uuid('Invalid plan ID'),
  startDate: z.string().datetime(),
  autoRenew: z.boolean().optional(),
})

export const CancelMembershipSchema = z.object({
  reason: z.string().optional(),
})

export type CreatePlanInput = z.infer<typeof CreatePlanSchema>
export type UpdatePlanInput = z.infer<typeof UpdatePlanSchema>
export type AssignPlanInput = z.infer<typeof AssignPlanSchema>
export type CancelMembershipInput = z.infer<typeof CancelMembershipSchema>
