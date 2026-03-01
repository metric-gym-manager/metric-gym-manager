import { z } from 'zod';

// Word limit for announcements (160 characters - standard SMS length)
const MAX_MESSAGE_LENGTH = 160;

export const createAnnouncementSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(MAX_MESSAGE_LENGTH, `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
