/**
 * @jest-environment node
 */

/**
 * The product's dates in time zones other than the one running the tests.
 *
 * A `YYYY-MM-DD` value (a due date, a start date) is a calendar day, not an
 * instant. `new Date('2026-10-26')` is UTC midnight, and printing that in the
 * browser's zone showed 25 Oct to anyone west of UTC: a due date a day early.
 * This machine and CI both sit at or east of UTC, so an in-process test never
 * sees the defect.
 *
 * A zone cannot be switched inside Jest: `process.env` there is a per-test
 * copy, so assigning `TZ` never reaches Node. Each zone therefore runs the
 * real `date.ts` in a child process started with that `TZ`.
 */

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { formatDateTime } from '../date'

const ROOT = path.resolve(__dirname, '../../../..')
const TSX = path.join(ROOT, 'node_modules/tsx/dist/cli.mjs')
const DATE_MODULE = path.join(ROOT, 'src/utils/date/date.ts')

/** Run each call in a fresh Node whose time zone is `tz`; return the outputs. */
function formatIn(
  tz: string,
  calls: Array<['formatDate' | 'formatDateTime', string]>
): string[] {
  const script = `
    import * as d from ${JSON.stringify(DATE_MODULE)};
    const calls = ${JSON.stringify(calls)};
    console.log(JSON.stringify(calls.map(([fn, arg]) => d[fn](arg))));
  `
  const out = execFileSync(process.execPath, [TSX, '-e', script], {
    env: { ...process.env, TZ: tz },
    encoding: 'utf8',
  })
  return JSON.parse(out.trim().split('\n').pop() as string)
}

describe('formatDate — a calendar day is the same day in every time zone', () => {
  it('prints a YYYY-MM-DD date as that day west of UTC', () => {
    expect(
      formatIn('America/New_York', [
        ['formatDate', '2026-10-26'],
        ['formatDate', '2026-01-01'],
      ])
    ).toEqual(['26 Oct 2026', '01 Jan 2026'])
  })

  it('prints a YYYY-MM-DD date as that day east of UTC', () => {
    expect(formatIn('Asia/Colombo', [['formatDate', '2026-10-26']])).toEqual([
      '26 Oct 2026',
    ])
  })

  it('still prints a timestamp as the local day', () => {
    // 20:00 UTC on the 25th is 01:30 on the 26th in Colombo; 02:00 UTC on the
    // 26th is still the 25th in New York.
    expect(
      formatIn('Asia/Colombo', [['formatDate', '2026-10-25T20:00:00Z']])
    ).toEqual(['26 Oct 2026'])
    expect(
      formatIn('America/New_York', [['formatDate', '2026-10-26T02:00:00Z']])
    ).toEqual(['25 Oct 2026'])
  })
})

describe('formatDateTime — the product date and a 24-hour local time', () => {
  it('prints Sri Lankan time for a Sri Lankan browser', () => {
    expect(
      formatIn('Asia/Colombo', [
        ['formatDateTime', '2026-10-05T03:30:00Z'],
        ['formatDateTime', '2026-10-05T12:45:00Z'],
      ])
    ).toEqual(['05 Oct 2026, 09:00', '05 Oct 2026, 18:15'])
  })
})

describe('formatDateTime — a value that is not a date', () => {
  it('says Unknown', () => {
    expect(formatDateTime('not-a-date')).toBe('Unknown')
  })
})
