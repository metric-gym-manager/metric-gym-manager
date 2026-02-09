import { z } from 'zod'

export const AddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
})

export const CreateMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  phone: z.string().optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  address: AddressSchema.optional(),
  photoUrl: z.string().url().optional(),
  notes: z.string().optional(),
})

export const UpdateMemberSchema = CreateMemberSchema.partial()

export const EmergencyContactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  relationship: z.string().min(2, 'Relationship is required'),
  phone: z.string().min(10, 'Valid phone number required'),
  email: z.string().email().optional(),
  isPrimary: z.boolean().optional(),
})

export const MedicalWaiverSchema = z.object({
  conditions: z.string().optional(),
  medications: z.string().optional(),
  allergies: z.string().optional(),
  signatureData: z.string().min(1, 'Signature is required'),
})

export const MemberStatusSchema = z.enum(['active', 'pending', 'frozen', 'expired', 'cancelled'])

export const UpdateMemberStatusSchema = z.object({
  status: MemberStatusSchema,
})

export type CreateMemberInput = z.infer<typeof CreateMemberSchema>
export type UpdateMemberInput = z.infer<typeof UpdateMemberSchema>
export type EmergencyContactInput = z.infer<typeof EmergencyContactSchema>
export type MedicalWaiverInput = z.infer<typeof MedicalWaiverSchema>
export type MemberStatus = z.infer<typeof MemberStatusSchema>
export type UpdateMemberStatusInput = z.infer<typeof UpdateMemberStatusSchema>
