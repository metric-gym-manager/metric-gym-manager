import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A titled band of page content. One <h2> per section, so every page has a
 * clean, skimmable outline: H1 (hero) → H2 (sections) → H3 (items).
 *
 * `prose` constrains the text column to a readable measure; `wide` lets grids
 * and tables use the full marketing width.
 */
export function MarketingSection({
  id,
  eyebrow,
  title,
  intro,
  width = 'prose',
  children,
  className,
}: {
  id?: string
  eyebrow?: string
  title: ReactNode
  intro?: ReactNode
  width?: 'prose' | 'wide'
  children?: ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      className={cn('scroll-mt-20 border-b border-line-subtle', className)}
    >
      <div className="mx-auto flex max-w-marketing flex-col gap-8 px-6 py-20 phone:px-4 phone:py-14">
        <div className="flex max-w-3xl flex-col gap-3">
          {eyebrow && (
            <p className="font-mono text-metadata uppercase text-ink-muted">
              {eyebrow}
            </p>
          )}
          <h2 className="text-pretty text-display-sm font-semibold text-ink">
            {title}
          </h2>
          {intro && (
            <div className="text-pretty text-body-lg text-ink-secondary">
              {intro}
            </div>
          )}
        </div>
        {children && (
          <div className={cn(width === 'prose' && 'max-w-3xl')}>{children}</div>
        )}
      </div>
    </section>
  )
}

/**
 * Body copy for marketing prose: paragraphs, lists and inline links styled
 * once, so page files hold words rather than class names.
 */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 text-body-lg text-ink-secondary [&_a]:text-brand-link [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-brand-link-hover [&_h3]:pt-2 [&_h3]:text-h2 [&_h3]:text-ink [&_li]:pl-1 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-2 [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5">
      {children}
    </div>
  )
}
