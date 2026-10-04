/**
 * Gyms that must never be texted — the operator's `SMS_DISABLED_GYM_IDS` list.
 *
 * The E2E test gyms live in the production database with seeded members whose
 * numbers are valid-format Sri Lankan mobiles. The reminders cron treated them
 * as customers and sent 310 real texts before they were suspended on
 * 2026-10-04. They run again with texts disabled through this list.
 *
 * Enforced at `sendSmsViaTextLk`, the one function every real text passes
 * through, and skipped up front by the reminders cron. It is an environment
 * variable on purpose: set by whoever deploys, never by a gym owner, so it adds
 * no column and no RLS surface.
 *
 * Format: gym ids separated by commas or whitespace, e.g.
 * `SMS_DISABLED_GYM_IDS=e0d0a7f9-…,3133db6c-…`.
 */

type Env = Record<string, string | undefined>

/**
 * The gym ids texts are disabled for.
 *
 * @param env - Environment to read (defaults to `process.env`)
 * @returns Lower-cased ids; empty when the variable is unset or blank
 */
export function smsDisabledGymIds(env: Env = process.env): Set<string> {
  return new Set(
    (env.SMS_DISABLED_GYM_IDS ?? '')
      .split(/[\s,]+/)
      .map((id) => id.trim().toLowerCase())
      .filter(Boolean)
  )
}

/**
 * Whether texts are disabled for a gym.
 *
 * @param gymId - The gym the text is for
 * @param env - Environment to read (defaults to `process.env`)
 * @returns True when the gym is on `SMS_DISABLED_GYM_IDS`
 */
export function isSmsDisabledForGym(
  gymId: string,
  env: Env = process.env
): boolean {
  return smsDisabledGymIds(env).has(gymId.toLowerCase())
}
