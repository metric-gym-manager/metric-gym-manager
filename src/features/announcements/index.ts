/**
 * Announcements Feature - Public API
 *
 * Gym-wide SMS broadcasts with per-recipient send/failure tracking.
 * External code should import from this file; reach into internal
 * subfolders only from within this feature.
 */

// ============================================================
// COMPONENTS
// ============================================================

export { default as AnnouncementProgress } from './components/AnnouncementProgress';

// ============================================================
// SERVICES
// ============================================================

export {
  getAnnouncements,
  createAndSendAnnouncement,
  retryFailedAnnouncements,
  clearSessionFailures,
  getAnnouncementProgress,
  verifyAnnouncementOwnership,
  type AnnouncementProgressData,
} from './services/announcement.service';

// ============================================================
// SCHEMAS
// ============================================================

export {
  createAnnouncementSchema,
  type CreateAnnouncementInput,
} from './schemas/announcement.schemas';

// ============================================================
// TYPES
// ============================================================

export type { Announcement } from './types';
