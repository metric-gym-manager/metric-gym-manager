/**
 * Gym directory port — gym names for automated texts.
 *
 * Every automated SMS names the gym (SEO-053), because the sender ID is one
 * platform-wide value. Request-driven use cases receive the name from their
 * route, which already holds the gym profile; the reminders cron spans every
 * gym, so it reads the names it needs once per run through this port.
 */
export interface IGymDirectory {
  /**
   * Gym names by id, in a single read.
   *
   * @param gymIds - Distinct gym ids
   * @returns `gyms.gym_name` keyed by id; an id with no row is absent
   * @throws DatabaseError when the read fails
   */
  findNamesByIds(gymIds: string[]): Promise<Map<string, string>>
}
