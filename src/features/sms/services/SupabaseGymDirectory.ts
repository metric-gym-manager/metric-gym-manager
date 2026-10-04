/**
 * Supabase implementation of IGymDirectory.
 *
 * Selects `id, gym_name` with `.in('id', …)`, in batches of
 * {@link GYM_NAME_BATCH_SIZE}: the ids travel in the URL of a GET, so one
 * request naming every gym grows with the customer count until the gateway
 * refuses it — and a failed read stops the whole reminder run. The reminders
 * cron passes `createAdminClient()` (it spans every gym); `gym_name` is
 * NOT NULL.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { DatabaseError } from '@/utils/errors'
import type { IGymDirectory } from './IGymDirectory'

const GymNameRows = z.array(z.object({ id: z.string(), gym_name: z.string() }))

/** Gym ids per request: about 4 KB of URL (36-character UUIDs plus encoded commas). */
export const GYM_NAME_BATCH_SIZE = 100

export class SupabaseGymDirectory implements IGymDirectory {
  constructor(private readonly supabase: SupabaseClient) {}

  async findNamesByIds(gymIds: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>()

    for (let i = 0; i < gymIds.length; i += GYM_NAME_BATCH_SIZE) {
      const batch = gymIds.slice(i, i + GYM_NAME_BATCH_SIZE)
      const { data, error } = await this.supabase
        .from('gyms')
        .select('id, gym_name')
        .in('id', batch)

      if (error) {
        throw new DatabaseError(`Failed to load gym names: ${error.message}`)
      }
      for (const g of GymNameRows.parse(data ?? [])) names.set(g.id, g.gym_name)
    }

    return names
  }
}
