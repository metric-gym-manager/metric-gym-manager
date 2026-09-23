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
      {/*
       * On a phone the five segments become a snap-scrolling row instead of a
       * wrapping one (§13, §25.4): a range control that wraps to a second line
       * pushes the KPI band down the screen, and the whole point of a stock
       * -chart range strip is that it stays put.
       *
       * Everything the phone tier adds is `phone:`-scoped, including the
       * scroller. F30: `overflow-x-auto` is never "inert on a desktop that
       * does not overflow" — it still makes the box a scroll container, and a
       * scroll container clips whatever sits outside its padding box. This
       * group has a border and a selected fill rather than an overhanging
       * underline, so there is nothing obvious to clip; scoping is still
       * cheaper than proving that.
       *
       * `data-scroll="x"` marks it as the probe's sanctioned horizontal
       * scroller. §13 and §25.4 both ask for this row explicitly, so it is a
       * scroller the plan sanctions rather than one invented to silence a
       * rule (contrast Phase 3, which refused the marker for SMS history).
       */}
      <div
        role="group"
        aria-label="Time range"
        data-scroll="x"
        className="flex flex-wrap items-center gap-0.5 rounded-sm border border-line-1 p-0.5 phone:flex-nowrap phone:snap-x phone:snap-mandatory phone:overflow-x-auto"
      >
        {ANALYTICS_RANGES.map((r) => (
          <Button
            key={r}
            size="xs"
            variant="ghost"
            aria-pressed={r === range}
            className={cn(
              // `shrink-0` so a segment keeps its width inside the phone's
              // scroller instead of being squeezed; `snap-start` so a swipe
              // lands on a segment rather than between two.
              'phone:shrink-0 phone:snap-start',
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
