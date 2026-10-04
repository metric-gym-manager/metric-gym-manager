/**
 * Discount directory port — discount percentages for automated reminders.
 *
 * A reminder quotes what the desk will charge, which is the plan amount less a
 * recurring discount (`effectivePlanAmount`). A member row carries only its
 * `discount_id`, so the reminders cron reads the percentages it needs once per
 * run through this port.
 */
export interface IDiscountDirectory {
  /**
   * Discount percentages by id, in as few reads as the ids allow.
   *
   * @param discountIds - Distinct discount ids
   * @returns `discounts.discount_percentage` keyed by id; an id with no row is absent
   * @throws DatabaseError when a read fails
   */
  findPercentagesByIds(discountIds: string[]): Promise<Map<string, number>>
}
