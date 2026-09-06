import { LoadingLayout } from '@/components/common/composites'

/**
 * Route-level loading state for every (dashboard) segment.
 *
 * Previously a hand-written table skeleton in `bg-gray-200` on `bg-white` — raw
 * palette values that would not have followed the dark theme, and a shape that
 * matched no actual page: it showed a six-column table while loading the
 * dashboard, revenue, analytics and all of settings.
 *
 * Now a page header plus a neutral content band, drawn from the design system's
 * own skeletons. A per-route `loading.tsx` shaped to that route's real layout
 * would be better still, and is the natural refinement once the screens settle.
 */
export default function DashboardLoading() {
  return (
    <div className="flex max-w-app flex-col gap-4">
      <div className="flex items-center justify-between gap-4 pb-1">
        <div className="h-5 w-40 animate-pulse rounded-xs bg-surface-active" />
        <div className="h-3 w-28 animate-pulse rounded-xs bg-surface-active" />
      </div>
      <LoadingLayout variant="list" rows={8} label="Loading page" />
    </div>
  )
}
