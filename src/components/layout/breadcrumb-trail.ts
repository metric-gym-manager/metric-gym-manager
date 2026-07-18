import { primaryNavigation, settingsNavigation } from './navigation'

/**
 * href → human label. Settings sub-pages are registered first so the top-level
 * `/settings` label from `primaryNavigation` wins (it would otherwise be
 * overwritten by "Settings · General" → "General").
 */
const LABELS = new Map<string, string>()
for (const item of settingsNavigation) {
  // "Settings · Billing" → "Billing" (the parent "Settings" crumb is separate).
  LABELS.set(item.href, item.name.split('·').pop()!.trim())
}
for (const item of primaryNavigation) LABELS.set(item.href, item.name)

function titleCase(segment: string): string {
  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export interface Crumb {
  href: string
  label: string
  isLast: boolean
}

/**
 * Build the breadcrumb trail for a pathname. Labels resolve through the shared
 * navigation registry so they stay in sync with the sidebar and palette;
 * unknown segments fall back to a title-cased version. Returns `[]` for `/`.
 */
export function buildBreadcrumbTrail(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean)
  return segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/')
    return {
      href,
      label: LABELS.get(href) ?? titleCase(segment),
      isLast: index === segments.length - 1,
    }
  })
}
