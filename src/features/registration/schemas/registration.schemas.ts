import { z } from 'zod';
import { normalizePhoneNumber, isValidSriLankanPhone } from '@/lib/utils/phone';
import { MEMBER_PHOTO_CONTENT_TYPES } from '@/lib/utils/member-photo';

// ============================================================
// PUBLIC QR SELF-REGISTRATION SCHEMA
// ============================================================

/**
 * Body of POST /api/public/registrations.
 *
 * Note what is deliberately absent: any amount field. The charge is always
 * derived server-side from the gym's plan_types row — the client only picks
 * which plan. planType is validated against the gym's active plans in the
 * route (the gym is resolved from the token, never from client input).
 */
export const publicRegistrationSchema = z.object({
  token: z
    .string()
    .regex(/^[a-f0-9]{32,64}$/i, 'Invalid registration link'),

  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),

  phoneNumber: z
    .string()
    .min(1, 'Phone number is required')
    .refine(
      (val) => isValidSriLankanPhone(val),
      'Invalid Sri Lankan phone number. Use format: 0771234567'
    )
    .transform((val) => `+${normalizePhoneNumber(val)}`),

  planType: z.string().min(1, 'Please select a plan'),

  /**
   * Content type of the selfie the client will upload after registration.
   * When present, the response includes a presigned PUT URL for
   * profiles/{memberId}.webp (or .jpg for iOS Safari).
   */
  photoContentType: z
    .enum(Object.keys(MEMBER_PHOTO_CONTENT_TYPES) as [string, ...string[]])
    .optional(),

  /**
   * Honeypot field: rendered invisibly in the form; humans leave it empty,
   * naive bots fill it. Submissions with a value are rejected.
   */
  website: z.string().max(0, 'Invalid submission').optional(),
});

export type PublicRegistrationInput = z.infer<typeof publicRegistrationSchema>;
