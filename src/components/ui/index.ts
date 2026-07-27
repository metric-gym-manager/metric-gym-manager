/**
 * Metric Design System — canonical primitive library (Layer 2).
 *
 * Import primitives from this barrel:
 *   `import { Button, Input, Badge, Modal, tokens } from '@/components/ui'`
 *
 * The legacy shadcn components still live at `@/components/ui/<name>` (e.g.
 * `@/components/ui/button`) so existing screens keep working, but they are
 * DEPRECATED — new code must consume these token-driven primitives instead
 * (spec §1 "one implementation per pattern"; ARCHITECTURE feature-first: shared
 * UI lives in `components/`). Screens migrate off the legacy files over time.
 */

// Layer 1 — design tokens (JS mirror of the CSS variables)
export * from './tokens'

// Layer 2 — primitives
export * from './primitives/Spinner'
export * from './primitives/Button'
export * from './primitives/Label'
export * from './primitives/FormField'
export * from './primitives/Input'
export * from './primitives/Textarea'
export * from './primitives/Select'
export * from './primitives/Checkbox'
export * from './primitives/Radio'
export * from './primitives/Switch'
export * from './primitives/Badge'
export * from './primitives/Avatar'
export * from './primitives/Card'
export * from './primitives/Divider'
export * from './primitives/Skeleton'
export * from './primitives/Tooltip'
export * from './primitives/Table'
export * from './primitives/EmptyState'
export * from './primitives/Alert'
export * from './primitives/Toast'

// Overlays
export * from './primitives/Modal'
export * from './primitives/Drawer'

// ── Phase 2 ──────────────────────────────────────────────────────────────────
// Navigation
export * from './primitives/Tabs'
export * from './primitives/Accordion'
export * from './primitives/Breadcrumb'
export * from './primitives/Pagination'

// Menus & overlays
export * from './primitives/Popover'
export * from './primitives/DropdownMenu'
export * from './primitives/Progress'
export * from './primitives/CommandPalette'

// Data
export * from './primitives/DataTable'
export * from './primitives/useVirtualRows'
export * from './primitives/Charts'
