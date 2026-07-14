-- Add member photo support (Cloudflare R2 object storage)
--
-- Members can now have a face photo stored in Cloudflare R2. The database
-- stores only the object key (e.g. 'profiles/{member_id}.webp'); the full
-- public URL is composed at render time from NEXT_PUBLIC_R2_PUBLIC_URL.
-- photo_updated_at is used as a CDN cache-busting version parameter since
-- photo replacements overwrite the same object key.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS photo_path TEXT,
  ADD COLUMN IF NOT EXISTS photo_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN members.photo_path IS 'R2 object key for the member face photo (e.g. profiles/{id}.webp). NULL when no photo.';
COMMENT ON COLUMN members.photo_updated_at IS 'Timestamp of last photo upload/replacement; appended as ?v= for CDN cache busting.';

-- Backfill for schema drift: gyms.profile_image_url is referenced by the
-- application (gym profile queries) but was added directly in the hosted
-- database without a committed migration. Recorded here so fresh
-- environments match production.
ALTER TABLE gyms
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

COMMENT ON COLUMN gyms.profile_image_url IS 'Optional gym profile image URL.';
