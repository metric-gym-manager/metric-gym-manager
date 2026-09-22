'use client'

import * as React from 'react'
import {
  Area,
  AreaChart as RAreaChart,
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart as RLineChart,
  Pie,
  PieChart as RPieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart as RScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Skeleton } from './Skeleton'
import { EmptyState } from './EmptyState'

/**
 * Chart primitives — tokenized recharts wrappers (spec §15 Data Visualization).
 * Every chart shares one palette, mono-numeric tooltip, subtle grid, muted axes,
 * and consistent empty/loading states. Colors are CSS variables so charts are
 * theme-aware without a theme prop. Business charts compose these; they never
 * restyle recharts directly.
 *
 * Palette rule (spec §15): max 3 colors per chart; accent highlights the current
 * series; status colors for status-driven data.
 */

/** Theme-aware series palette (CSS vars). Accent first, then status/neutral. */
export const CHART_SERIES = [
  'var(--ds-accent)',
  'var(--ds-success-text)',
  'var(--ds-warning-text)',
  'var(--ds-error-text)',
  'var(--ds-text-muted)',
] as const

const AXIS_COLOR = 'var(--ds-text-muted)'
const GRID_COLOR = 'var(--ds-border-subtle)'
const DEFAULT_BAR = 'var(--ds-border-3)'
const ACCENT = 'var(--ds-accent)'

const axisTick = {
  fontSize: 10,
  fill: AXIS_COLOR,
  fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
} as const

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false)
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [])
  return reduced
}

export interface ChartSeries {
  key: string
  label?: string
  color?: string
}

interface BaseChartProps {
  height?: number
  loading?: boolean
  empty?: React.ReactNode
  /** Accessible summary of the chart. */
  label: string
  className?: string
}

/** Shared frame: handles sizing, aria, loading skeleton, and empty state. */
function ChartFrame({
  height = 180,
  loading,
  isEmpty,
  empty,
  label,
  className,
  children,
}: BaseChartProps & { isEmpty: boolean; children: React.ReactElement }) {
  if (loading) {
    return (
      <Skeleton
        className={cn('w-full', className)}
        style={{ height }}
        aria-label={`${label} loading`}
      />
    )
  }
  if (isEmpty) {
    return (
      <div
        className={cn('flex w-full items-center justify-center', className)}
        style={{ height }}
      >
        {empty ?? <EmptyState title="No data" />}
      </div>
    )
  }
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('w-full', className)}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

/** Themed tooltip — surface card, hairline, mono numerics. */
function DSTooltip({
  valueFormatter,
}: {
  valueFormatter?: (value: number | string) => string
}) {
  return (
    <Tooltip
      cursor={{ fill: 'var(--ds-surface-hover)' }}
      contentStyle={{
        background: 'var(--ds-surface-card)',
        border: '1px solid var(--ds-border-2)',
        borderRadius: 6,
        boxShadow: 'var(--ds-shadow-overlay)',
        fontSize: 12,
      }}
      labelStyle={{ color: 'var(--ds-text-muted)', fontSize: 11 }}
      itemStyle={{
        color: 'var(--ds-text-primary)',
        fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
      }}
      formatter={
        valueFormatter
          ? (value) => valueFormatter(value as number | string)
          : undefined
      }
    />
  )
}

const dsLegend = (
  <Legend
    wrapperStyle={{
      fontSize: 11,
      fontFamily: 'var(--font-geist), system-ui, sans-serif',
      color: 'var(--ds-text-muted)',
    }}
  />
)

/**
 * `1400000 → 1.4M`, `35000 → 35k` — the compact Y-axis tick (mobile rebuild
 * plan §5.9).
 *
 * The axis is 40 px wide with an −8 px left margin, so ~32 px is available for
 * the label. At the 10 px mono tick size that holds five characters: LKR
 * figures of six or seven digits are cut to `0000` / `5000`, which reads as a
 * number and is not one. Shortening the label fixes that in the space there
 * is, where widening the axis would take 16 px of plot area from a 390 px
 * screen and still not hold `1000000`.
 *
 * At most one decimal, and never a trailing `.0`.
 */
export function compactAxisTick(value: number | string): string {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return String(value)

  const abs = Math.abs(n)
  const unit =
    abs >= 1e9
      ? ([1e9, 'B'] as const)
      : abs >= 1e6
        ? ([1e6, 'M'] as const)
        : abs >= 1e3
          ? ([1e3, 'k'] as const)
          : null
  if (!unit) return String(n)

  const scaled = n / unit[0]
  // One decimal only where it carries information: 1.4M, but 12M not 12.0M.
  const text =
    Math.abs(scaled) < 10 && !Number.isInteger(scaled)
      ? scaled.toFixed(1)
      : String(Math.round(scaled))
  return `${text}${unit[1]}`
}

// ── Line ─────────────────────────────────────────────────────────────────────
export interface CartesianChartProps<T> extends BaseChartProps {
  data: T[]
  xKey: string
  series: ChartSeries[]
  showGrid?: boolean
  showLegend?: boolean
  valueFormatter?: (value: number | string) => string
  /**
   * Format the Y-axis tick labels. Wins over `compactAxis`.
   *
   * Separate from `valueFormatter`, which formats the *tooltip*: the tooltip
   * has room for `LKR 1,400,000` and the axis does not, and conflating them is
   * why the axis carried the full figure in the first place.
   */
  yTickFormatter?: (value: number | string) => string
  /**
   * Shorten Y-axis ticks to `35k` / `1.4M` ({@link compactAxisTick}).
   *
   * Opt-in and inert when unset, so no existing chart changes. Screens pass it
   * under the phone tier (§5.9).
   */
  compactAxis?: boolean
}

/**
 * The tick formatter a cartesian chart should use, or `undefined` for none.
 *
 * Exported because it is the whole of the decision — an explicit formatter
 * wins, `compactAxis` is the shorthand, and neither set means the axis is
 * untouched — and recharts renders no axis in jsdom, so this is the only
 * place the rule can be tested rather than described.
 */
export function resolveYTickFormatter(
  yTickFormatter?: (value: number | string) => string,
  compactAxis?: boolean
): ((value: number | string) => string) | undefined {
  return yTickFormatter ?? (compactAxis ? compactAxisTick : undefined)
}

export function LineChart<T>({
  data,
  xKey,
  series,
  showGrid = true,
  showLegend,
  valueFormatter,
  yTickFormatter,
  compactAxis,
  ...frame
}: CartesianChartProps<T>) {
  const reduced = usePrefersReducedMotion()
  return (
    <ChartFrame {...frame} isEmpty={!data || data.length === 0}>
      <RLineChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: -8 }}
      >
        {showGrid && <CartesianGrid stroke={GRID_COLOR} vertical={false} />}
        <XAxis
          dataKey={xKey}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={resolveYTickFormatter(yTickFormatter, compactAxis)}
        />
        <DSTooltip valueFormatter={valueFormatter} />
        {showLegend && dsLegend}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label ?? s.key}
            stroke={s.color ?? CHART_SERIES[i % CHART_SERIES.length]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={!reduced}
          />
        ))}
      </RLineChart>
    </ChartFrame>
  )
}

// ── Bar ──────────────────────────────────────────────────────────────────────
export function BarChart<T>({
  data,
  xKey,
  series,
  showGrid = true,
  showLegend,
  valueFormatter,
  yTickFormatter,
  compactAxis,
  ...frame
}: CartesianChartProps<T>) {
  const reduced = usePrefersReducedMotion()
  return (
    <ChartFrame {...frame} isEmpty={!data || data.length === 0}>
      <RBarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        {showGrid && <CartesianGrid stroke={GRID_COLOR} vertical={false} />}
        <XAxis
          dataKey={xKey}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={resolveYTickFormatter(yTickFormatter, compactAxis)}
        />
        <DSTooltip valueFormatter={valueFormatter} />
        {showLegend && dsLegend}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label ?? s.key}
            fill={
              s.color ??
              (series.length === 1
                ? DEFAULT_BAR
                : CHART_SERIES[i % CHART_SERIES.length])
            }
            radius={[2, 2, 0, 0]}
            isAnimationActive={!reduced}
          />
        ))}
      </RBarChart>
    </ChartFrame>
  )
}

// ── Area ─────────────────────────────────────────────────────────────────────
export function AreaChart<T>({
  data,
  xKey,
  series,
  showGrid = true,
  showLegend,
  valueFormatter,
  yTickFormatter,
  compactAxis,
  ...frame
}: CartesianChartProps<T>) {
  const reduced = usePrefersReducedMotion()
  return (
    <ChartFrame {...frame} isEmpty={!data || data.length === 0}>
      <RAreaChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: -8 }}
      >
        <defs>
          {series.map((s, i) => {
            const color = s.color ?? CHART_SERIES[i % CHART_SERIES.length]
            return (
              <linearGradient
                key={s.key}
                id={`ds-area-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            )
          })}
        </defs>
        {showGrid && <CartesianGrid stroke={GRID_COLOR} vertical={false} />}
        <XAxis
          dataKey={xKey}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={resolveYTickFormatter(yTickFormatter, compactAxis)}
        />
        <DSTooltip valueFormatter={valueFormatter} />
        {showLegend && dsLegend}
        {series.map((s, i) => {
          const color = s.color ?? CHART_SERIES[i % CHART_SERIES.length]
          return (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label ?? s.key}
              stroke={color}
              strokeWidth={2}
              fill={`url(#ds-area-${s.key})`}
              isAnimationActive={!reduced}
            />
          )
        })}
      </RAreaChart>
    </ChartFrame>
  )
}

// ── Pie / Donut ──────────────────────────────────────────────────────────────
export interface PieDatum {
  name: string
  value: number
  color?: string
}

export interface PieChartProps extends BaseChartProps {
  data: PieDatum[]
  showLegend?: boolean
  valueFormatter?: (value: number | string) => string
  /** Inner radius ratio 0–1; >0 renders a donut. */
  innerRadiusRatio?: number
}

export function PieChart({
  data,
  showLegend = true,
  valueFormatter,
  innerRadiusRatio = 0,
  ...frame
}: PieChartProps) {
  const reduced = usePrefersReducedMotion()
  const height = frame.height ?? 180
  const outer = Math.max(40, height / 2 - 24)
  return (
    <ChartFrame {...frame} isEmpty={!data || data.length === 0}>
      <RPieChart>
        <DSTooltip valueFormatter={valueFormatter} />
        {showLegend && dsLegend}
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={outer * innerRadiusRatio}
          outerRadius={outer}
          paddingAngle={1}
          stroke="var(--ds-surface-card)"
          strokeWidth={2}
          isAnimationActive={!reduced}
        >
          {data.map((d, i) => (
            <Cell
              key={d.name}
              fill={d.color ?? CHART_SERIES[i % CHART_SERIES.length]}
            />
          ))}
        </Pie>
      </RPieChart>
    </ChartFrame>
  )
}

export function DonutChart(props: PieChartProps) {
  return (
    <PieChart innerRadiusRatio={props.innerRadiusRatio ?? 0.6} {...props} />
  )
}

// ── Scatter ──────────────────────────────────────────────────────────────────
export interface ScatterChartProps<T> extends BaseChartProps {
  data: T[]
  xKey: string
  yKey: string
  name?: string
  color?: string
  showGrid?: boolean
  valueFormatter?: (value: number | string) => string
}

export function ScatterChart<T>({
  data,
  xKey,
  yKey,
  name,
  color,
  showGrid = true,
  valueFormatter,
  ...frame
}: ScatterChartProps<T>) {
  const reduced = usePrefersReducedMotion()
  return (
    <ChartFrame {...frame} isEmpty={!data || data.length === 0}>
      <RScatterChart margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        {showGrid && <CartesianGrid stroke={GRID_COLOR} />}
        <XAxis
          dataKey={xKey}
          type="number"
          tick={axisTick}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          dataKey={yKey}
          type="number"
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <DSTooltip valueFormatter={valueFormatter} />
        <Scatter
          data={data}
          name={name}
          fill={color ?? ACCENT}
          isAnimationActive={!reduced}
        />
      </RScatterChart>
    </ChartFrame>
  )
}

// ── Sparkline ────────────────────────────────────────────────────────────────
export interface SparklineProps {
  data: Array<{ value: number }> | number[]
  color?: string
  height?: number
  className?: string
  label?: string
}

export function Sparkline({
  data,
  color = ACCENT,
  height = 32,
  className,
  label = 'Trend',
}: SparklineProps) {
  const reduced = usePrefersReducedMotion()
  const normalized = React.useMemo(
    () =>
      Array.isArray(data) && typeof data[0] === 'number'
        ? (data as number[]).map((value) => ({ value }))
        : (data as Array<{ value: number }>),
    [data]
  )
  if (!normalized || normalized.length === 0) return null
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('w-full', className)}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RLineChart
          data={normalized}
          margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
        >
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={!reduced}
          />
        </RLineChart>
      </ResponsiveContainer>
    </div>
  )
}
