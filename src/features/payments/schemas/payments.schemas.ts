import { z } from 'zod'

export const CreatePaymentSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
  membershipId: z.string().uuid('Invalid membership ID').optional(),
  paymentMethodId: z.string().uuid('Invalid payment method ID').optional(),
  amount: z.number().positive('Amount must be greater than 0'),
  type: z.enum(['membership', 'setup_fee', 'class_pack', 'drop_in', 'other']),
  description: z.string().optional(),
})

export const ProcessMockPaymentSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
  membershipId: z.string().uuid('Invalid membership ID'),
  amount: z.number().positive('Amount must be greater than 0'),
  paymentMethodId: z.string().optional(),
  forceOutcome: z.enum(['success', 'failure']).optional(),
})

export const RetryPaymentSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID'),
})

export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>
export type ProcessMockPaymentInput = z.infer<typeof ProcessMockPaymentSchema>
export type RetryPaymentInput = z.infer<typeof RetryPaymentSchema>
