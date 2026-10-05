/**
 * @jest-environment node
 */
import fs from 'node:fs'
import path from 'node:path'
import { LeadInterest, LEAD_INTEREST_LABELS } from '../config/LeadConfig'

/**
 * Lead interests speak the product's tier names. Until 2026-10-05 a visitor
 * who picked Lite or Pro was stored as `starter` / `growth` and labelled
 * "Starter plan" / "Growth plan", the names retired in July.
 *
 * The database holds the same list in the `leads_interest_check` constraint,
 * and TS/Postgres enum lists in this repo have drifted apart before and broken
 * inserts. The newest migration that defines the constraint must list exactly
 * the enum's values.
 */
const MIGRATIONS = path.join(process.cwd(), 'supabase', 'migrations')

function constraintValuesInNewestMigration(): string[] {
  const defining = fs
    .readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => fs.readFileSync(path.join(MIGRATIONS, f), 'utf8'))
    .filter((sql) => /interest\s+IN\s*\(/i.test(sql))
  const newest = defining[defining.length - 1]
  const lists = [...newest.matchAll(/interest\s+IN\s*\(([^)]*)\)/gi)]
  const last = lists[lists.length - 1][1]
  return [...last.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()
}

describe('LeadInterest', () => {
  it('names the tiers Lite and Pro', () => {
    expect(Object.values(LeadInterest).sort()).toEqual(
      ['demo', 'enterprise', 'lite', 'pro', 'sales'].sort()
    )
    expect(LEAD_INTEREST_LABELS[LeadInterest.Lite]).toBe('Lite plan')
    expect(LEAD_INTEREST_LABELS[LeadInterest.Pro]).toBe('Pro plan')
  })

  it('matches the database constraint in the newest migration', () => {
    expect(constraintValuesInNewestMigration()).toEqual(
      [...Object.values(LeadInterest)].sort()
    )
  })
})
