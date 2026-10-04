/**
 * Supabase implementation of IDiscountDirectory.
 *
 * Selects `id, discount_percentage` from `discounts` in batches through
 * `selectByIds`. The reminders cron passes `createAdminClient()` (it spans
 * every gym). Inactive discounts are read like active ones: the desk's
 * renewals list charges a recurring discount for as long as a member is linked
 * to it, and a reminder must quote the same amount.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { IDiscountDirectory } from './IDiscountDirectory'
import { selectByIds } from './selectByIds'

// `discounts.discount_percentage` is an integer column, so it arrives as a number.
const DiscountRow = z.object({
  id: z.string(),
  discount_percentage: z.number(),
})

export class SupabaseDiscountDirectory implements IDiscountDirectory {
  constructor(private readonly supabase: SupabaseClient) {}

  async findPercentagesByIds(
    discountIds: string[]
  ): Promise<Map<string, number>> {
    const rows = await selectByIds(
      this.supabase,
      'discounts',
      'id, discount_percentage',
      discountIds,
      DiscountRow,
      'discount percentages'
    )
    return new Map(rows.map((d) => [d.id, d.discount_percentage]))
  }
}
