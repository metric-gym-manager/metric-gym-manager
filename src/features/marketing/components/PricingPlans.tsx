import Link from 'next/link'
import { Button, Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import { CONTACT_PATH } from '../config/pages'
import { SIGN_UP_PATH } from '../config/navigation'
import { PRICING_TIERS, TRIAL_DAYS, formatLkr } from '../config/pricing'
import { CheckList } from './CheckList'

/**
 * The three published plans, rendered from config/pricing.ts — the same list
 * the homepage and the SoftwareApplication offers read.
 */
export function PricingPlans({
  headingLevel = 'h3',
}: {
  headingLevel?: 'h2' | 'h3'
}) {
  const Heading = headingLevel
  return (
    <ul className="grid grid-cols-1 items-stretch gap-3 laptop:grid-cols-3">
      {PRICING_TIERS.map((t) => (
        <li key={t.tier} className="flex">
          <Card
            className={cn(
              'relative flex w-full flex-col gap-5 rounded-lg bg-surface-panel p-6',
              t.highlighted && 'border-line-3'
            )}
          >
            <div className="flex flex-col gap-1">
              <Heading className="text-h2 text-ink">{t.name}</Heading>
              <p className="text-sm text-ink-secondary">{t.summary}</p>
            </div>
            <p className="flex items-baseline gap-2">
              <span className="font-mono text-readout tabular-nums text-ink">
                LKR {formatLkr(t.monthlyPriceLkr)}
              </span>
              <span className="font-mono text-mono-sm uppercase text-ink-muted">
                per month
              </span>
            </p>
            <p className="text-sm text-ink-muted">{t.audience}</p>
            <div className="flex-1 border-t border-line-subtle pt-1">
              <CheckList items={t.inclusions} />
            </div>
            {t.note && <p className="text-sm text-ink-muted">{t.note}</p>}
            {t.selfServeTrial ? (
              <Button
                asChild
                variant={t.highlighted ? 'primary' : 'secondary'}
                size="lg"
              >
                <Link href={SIGN_UP_PATH} prefetch={false}>
                  Start {TRIAL_DAYS}-day free trial
                </Link>
              </Button>
            ) : (
              <Button asChild variant="secondary" size="lg">
                <Link href={CONTACT_PATH}>Talk to us about {t.name}</Link>
              </Button>
            )}
          </Card>
        </li>
      ))}
    </ul>
  )
}
