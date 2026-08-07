'use client'

import { Button, Select } from '@/components/ui'
import { ANALYTICS_RANGES } from '@/features/analytics/config/AnalyticsConfig'
import type { AnalyticsRange } from '@/features/analytics/types'

/**
 * Stock-chart style range control: a segmented `1M · 3M · YTD · 1Y · MAX`
 * button group, plus a year picker that appears only for the `1Y` window (so
 * the manager can view this year or any past year). Built from DS primitives —
 * no forked control (§2.17).
 */
export interface RangeSelectorProps {
  range: AnalyticsRange
  year: number
  yearOptions: number[]
  onRangeChange: (range: AnalyticsRange) => void
  onYearChange: (year: number) => void
}

export function RangeSelector({
  range,
  year,
  yearOptions,
  onRangeChange,
  onYearChange,
}: RangeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        role="group"
        aria-label="Time range"
        className="flex items-center gap-0.5 rounded-md border border-line-1 p-0.5"
      >
        {ANALYTICS_RANGES.map((r) => (
          <Button
            key={r}
            size="xs"
            variant={r === range ? 'primary' : 'ghost'}
            aria-pressed={r === range}
            onClick={() => onRangeChange(r)}
          >
            {r}
          </Button>
        ))}
      </div>
      {range === '1Y' && (
        <Select
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
          aria-label="Year"
          className="w-24"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      )}
    </div>
  )
}
