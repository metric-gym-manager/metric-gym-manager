/**
 * Read rows by id in batches — the one batching implementation behind the
 * reminders cron's directories.
 *
 * `.in('id', …)` travels in the URL of a GET, so one request naming every id
 * grows with the customer count until the gateway refuses it, and a failed
 * read stops the whole reminder run.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { z } from 'zod'
import { DatabaseError } from '@/utils/errors'

/** Ids per request: about 4 KB of URL (36-character UUIDs plus encoded commas). */
export const ID_BATCH_SIZE = 100

/**
 * Select `columns` from `table` for every id, `ID_BATCH_SIZE` ids per request.
 *
 * @param supabase - The client to read with
 * @param table - Table name
 * @param columns - Select list; must include `id`
 * @param ids - Distinct ids (no request is made for none)
 * @param rowSchema - Zod schema every returned row must satisfy
 * @param what - Noun for the error message, e.g. "gym names"
 * @returns Every row found, across all batches
 * @throws DatabaseError when any batch fails
 */
export async function selectByIds<Row>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  ids: string[],
  rowSchema: z.ZodType<Row>,
  what: string
): Promise<Row[]> {
  const rows: Row[] = []

  for (let i = 0; i < ids.length; i += ID_BATCH_SIZE) {
    const batch = ids.slice(i, i + ID_BATCH_SIZE)
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .in('id', batch)

    if (error) {
      throw new DatabaseError(`Failed to load ${what}: ${error.message}`)
    }
    for (const row of (data ?? []) as unknown[]) rows.push(rowSchema.parse(row))
  }

  return rows
}
