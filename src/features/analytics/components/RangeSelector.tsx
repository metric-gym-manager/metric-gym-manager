'use client'

import { Button, Select } from '@/components/ui'
import { cn } from '@/lib/utils'
import { ANALYTICS_RANGES } from '@/features/analytics/config/AnalyticsConfig'
import type { AnalyticsRange } from '@/features/analytics/types'

/**
 * Stock-chart style range control: a segmented `1M · 3M · YTD · 1Y · MAX`
 * button group, plus a year picker that appears only for the `1Y` window (so
 * the manager can view this year or any past year). Built from DS primitives —
 * no forked control (§2.17).
 *
 * The selected segment is `surface-selected`, not `variant="primary"`. Primary
 * is the near-white solid this app gives its one call to action per screen;
 * used here it made `YTD` the brightest element on the page, above the KPI
 * values — a hierarchy inversion (§5.19 "not every action is prominent",
 * §5.11 "strong contrast only for levels 1–2"; a range filter is level 3).
 * `surface-selected` is the same fill the sidebar and table rows use, so this
 * reads in the app's existing selection language rather than adding a third.
 * The hover override keeps the fill stable — `ghost`'s own hover is dimmer
 * than the selected fill and would invert the state on pointer-over.
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
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Time range"
        className="flex flex-wrap items-center gap-0.5 rounded-sm border border-line-1 p-0.5"
      >
        {ANALYTICS_RANGES.map((r) => (
          <Button
            key={r}
            size="xs"
            variant="ghost"
            aria-pressed={r === range}
            className={cn(
              r === range &&
                'bg-surface-selected text-ink hover:bg-surface-selected'
            )}
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
