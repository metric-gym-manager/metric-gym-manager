/**
 * Supabase implementation of IGymDirectory.
 *
 * Selects `id, gym_name` in batches through `selectByIds` (one request per
 * {@link GYM_NAME_BATCH_SIZE} ids). The reminders cron passes
 * `createAdminClient()` (it spans every gym); `gym_name` is NOT NULL.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { IGymDirectory } from './IGymDirectory'
import { ID_BATCH_SIZE, selectByIds } from './selectByIds'

const GymNameRow = z.object({ id: z.string(), gym_name: z.string() })

/** Gym ids per request (see `selectByIds`). */
export const GYM_NAME_BATCH_SIZE = ID_BATCH_SIZE

export class SupabaseGymDirectory implements IGymDirectory {
  constructor(private readonly supabase: SupabaseClient) {}

  async findNamesByIds(gymIds: string[]): Promise<Map<string, string>> {
    const rows = await selectByIds(
      this.supabase,
      'gyms',
      'id, gym_name',
      gymIds,
      GymNameRow,
      'gym names'
    )
    return new Map(rows.map((g) => [g.id, g.gym_name]))
  }
}
