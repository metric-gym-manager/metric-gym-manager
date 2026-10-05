import { z } from 'zod'
import { LeadInterest } from '../config/LeadConfig'

/**
 * Public lead-capture input (anonymous — from the marketing landing page).
 *
 * The `website` field is a HONEYPOT: it is rendered hidden and must stay
 * empty; a non-empty value means a bot filled it, so `.parse()` rejects the
 * submission before it ever reaches the service (keeps the route thin — R6,
 * mirrors `publicRegistrationSchema`). Domain enum validated with
 * `z.nativeEnum` (R13).
 */
export const createLeadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Please enter your name')
    .max(100, 'Name is too long'),
  email: z.string().trim().email('Enter a valid email address').max(254),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,20}$/, 'Enter a valid phone number'),
  gymName: z
    .string()
    .trim()
    .max(100, 'Gym name is too long')
    .optional()
    .or(z.literal('')),
  message: z
    .string()
    .trim()
    .max(1000, 'Message is too long')
    .optional()
    .or(z.literal('')),
  interest: z.nativeEnum(LeadInterest),
  /** The marketing consent checkbox. Unticked (or absent) is no consent. */
  marketingConsent: z.boolean().optional().default(false),
  /** Honeypot — must be empty. Hidden from real users. */
  website: z.string().max(0, 'Invalid submission').optional(),
})

export type CreateLeadInput = z.infer<typeof createLeadSchema>
