/**
 * Supabase implementation of IGymDirectory.
 *
 * One `.in('id', …)` select of `id, gym_name` per call. The reminders cron
 * passes `createAdminClient()` (it spans every gym); `gym_name` is NOT NULL.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { DatabaseError } from '@/utils/errors'
import type { IGymDirectory } from './IGymDirectory'

const GymNameRows = z.array(z.object({ id: z.string(), gym_name: z.string() }))

export class SupabaseGymDirectory implements IGymDirectory {
  constructor(private readonly supabase: SupabaseClient) {}

  async findNamesByIds(gymIds: string[]): Promise<Map<string, string>> {
    if (gymIds.length === 0) return new Map()

    const { data, error } = await this.supabase
      .from('gyms')
      .select('id, gym_name')
      .in('id', gymIds)

    if (error) {
      throw new DatabaseError(`Failed to load gym names: ${error.message}`)
    }

    return new Map(GymNameRows.parse(data ?? []).map((g) => [g.id, g.gym_name]))
  }
}
