/**
 * Metric Design System — chart primitives (Layer 2), on their own barrel.
 *
 *   `import { LineChart, Sparkline, CHART_SERIES } from '@/components/ui/charts'`
 *
 * Charts are the one primitive family NOT re-exported from `@/components/ui`.
 * `Charts.tsx` imports recharts at module scope, and a bundler keeps every
 * module a barrel re-exports — so while the main barrel carried Charts, every
 * page that imported any primitive shipped recharts. The root layout imports
 * `Toaster`, so that was every page: a 638 KB chunk on the homepage, /login and
 * each marketing page, none of which draws a chart (SEO-055).
 *
 * This is still "always a barrel, never a deep path" (DESIGN_SYSTEM.md §3):
 * import charts from here, never from `primitives/Charts`.
 */
export * from '../primitives/Charts'
