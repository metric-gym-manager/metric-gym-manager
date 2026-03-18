import { z } from 'zod';

/** Validates the PushSubscription JSON from the browser */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

/** For the send-push API endpoint */
export const sendPushSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(300),
  url: z.string().optional(),
  type: z
    .enum(['announcement', 'reminder', 'system'])
    .optional()
    .default('system'),
});

export type SendPushInput = z.infer<typeof sendPushSchema>;
