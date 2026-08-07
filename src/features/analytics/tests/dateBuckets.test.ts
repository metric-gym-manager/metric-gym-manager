import {
  addDays,
  addMonths,
  bucketKey,
  bucketLabel,
  bucketPeriod,
  endOfMonth,
  enumerateBuckets,
  maxDate,
  minDate,
  monthsBetween,
  resolveAnalyticsWindow,
  startOfMonth,
  toDateKey,
} from '../utils/dateBuckets'

describe('date arithmetic', () => {
  it('normalizes timestamps to date keys', () => {
    expect(toDateKey('2026-08-06T10:30:00.000Z')).toBe('2026-08-06')
    expect(toDateKey('2026-08-06')).toBe('2026-08-06')
  })

  it('adds and subtracts days across month boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-08-06', -29)).toBe('2026-07-08')
  })

  it('adds months clamping to the last valid day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29') // leap year
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
  })

  it('computes month boundaries', () => {
    expect(startOfMonth('2026-02-15')).toBe('2026-02-01')
    expect(endOfMonth('2026-02-15')).toBe('2026-02-28')
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29')
  })

  it('picks min/max and counts months between', () => {
    expect(minDate('2026-01-01', '2026-02-01')).toBe('2026-01-01')
    expect(maxDate('2026-01-01', '2026-02-01')).toBe('2026-02-01')
    expect(monthsBetween('2026-01-15', '2026-03-20')).toBe(2)
    expect(monthsBetween('2026-05-01', '2026-05-28')).toBe(0)
  })
})

describe('bucket keys and labels', () => {
  it('derives keys per granularity', () => {
    expect(bucketKey('2026-03-05', 'day')).toBe('2026-03-05')
    expect(bucketKey('2026-03-05', 'month')).toBe('2026-03')
    expect(bucketKey('2026-03-05', 'year')).toBe('2026')
  })

  it('renders human labels', () => {
    expect(bucketLabel('2026-03-05', 'day')).toBe('05 Mar')
    expect(bucketLabel('2026-03', 'month')).toBe('Mar 26')
    expect(bucketLabel('2026', 'year')).toBe('2026')
  })

  it('derives bucket period bounds', () => {
    expect(bucketPeriod('2026-02', 'month')).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    })
    expect(bucketPeriod('2026', 'year')).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    })
    expect(bucketPeriod('2026-02-10', 'day')).toEqual({
      start: '2026-02-10',
      end: '2026-02-10',
    })
  })

  it('enumerates buckets inclusively', () => {
    expect(enumerateBuckets('2026-01-01', '2026-01-03', 'day')).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ])
    expect(enumerateBuckets('2026-06-15', '2026-08-02', 'month')).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
    ])
    // A fully-future window (start after end) yields no buckets.
    expect(enumerateBuckets('2027-01-01', '2026-12-31', 'month')).toEqual([])
  })
})

describe('resolveAnalyticsWindow', () => {
  const today = '2026-08-06'

  it('1M/3M use trailing days clamped to gym creation', () => {
    expect(resolveAnalyticsWindow('1M', 2026, today, '2020-01-01')).toEqual({
      startIso: '2026-07-08',
      endIso: today,
      granularity: 'day',
    })
    // Young gym clamps the start forward.
    expect(resolveAnalyticsWindow('1M', 2026, today, '2026-08-01')).toEqual({
      startIso: '2026-08-01',
      endIso: today,
      granularity: 'day',
    })
    expect(resolveAnalyticsWindow('3M', 2026, today, '2020-01-01')).toEqual({
      startIso: '2026-05-09',
      endIso: today,
      granularity: 'day',
    })
  })

  it('YTD runs Jan 1 → today with monthly buckets', () => {
    expect(resolveAnalyticsWindow('YTD', 2026, today, '2020-01-01')).toEqual({
      startIso: '2026-01-01',
      endIso: today,
      granularity: 'month',
    })
  })

  it('1Y honors a selected calendar year, clamping the end to today', () => {
    expect(resolveAnalyticsWindow('1Y', 2024, today, '2020-01-01')).toEqual({
      startIso: '2024-01-01',
      endIso: '2024-12-31',
      granularity: 'month',
    })
    expect(resolveAnalyticsWindow('1Y', 2026, today, '2020-01-01')).toEqual({
      startIso: '2026-01-01',
      endIso: today,
      granularity: 'month',
    })
  })

  it('MAX spans gym creation → today, switching to yearly for long spans', () => {
    expect(resolveAnalyticsWindow('MAX', 2026, today, '2026-01-01')).toEqual({
      startIso: '2026-01-01',
      endIso: today,
      granularity: 'month',
    })
    expect(resolveAnalyticsWindow('MAX', 2026, today, '2020-01-01')).toEqual({
      startIso: '2020-01-01',
      endIso: today,
      granularity: 'year',
    })
  })
})
