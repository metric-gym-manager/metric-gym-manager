import { z } from 'zod'

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Not a real date')

/**
 * Shape and display limits of a public-page registry entry.
 *
 * The length bounds are where search results truncate in practice (roughly
 * 600 px of title and 160 characters of description); they keep a page's own
 * words visible instead of an ellipsis or a rewrite.
 */
export const marketingPageSchema = z
  .object({
    path: z
      .string()
      .regex(
        /^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/,
        'Lower-case, hyphenated, no trailing slash'
      ),
    kind: z.enum([
      'home',
      'hub',
      'feature',
      'pricing',
      'company',
      'contact',
      'resources',
      'article',
      'legal',
    ]),
    title: z.string().min(20).max(62),
    description: z.string().min(70).max(160),
    label: z.string().min(2).max(40),
    parent: z.string().optional(),
    lastModified: isoDate,
    published: isoDate.optional(),
  })
  .refine((p) => p.kind !== 'article' || p.published !== undefined, {
    message: 'Articles need a publication date',
  })
  .refine((p) => p.kind === 'home' || p.parent !== undefined, {
    message: 'Every page except the homepage needs a parent for its breadcrumb',
  })

export type MarketingPageInput = z.infer<typeof marketingPageSchema>
