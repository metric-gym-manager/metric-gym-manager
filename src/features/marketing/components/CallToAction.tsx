import Link from 'next/link'
import { Button } from '@/components/ui'
import { DemoModal } from '@/components/landing/DemoModal'
import { CONTACT_PATH } from '../config/pages'
import { SIGN_UP_PATH } from '../config/navigation'
import { TRIAL_DAYS } from '../config/pricing'

/**
 * Closing call to action. Three honest next steps: start the self-serve
 * trial, ask for a walkthrough (the same lead form as the homepage), or talk
 * to a person.
 */
export function CallToAction({
  title = 'Run the gym. Let Metric keep the records.',
  text = `Start with a ${TRIAL_DAYS}-day free trial — no payment details needed — or ask for a walkthrough and we will show you Metric with your own plans and prices.`,
}: {
  title?: string
  text?: string
}) {
  return (
    <section className="border-b border-line-subtle">
      <div className="mx-auto flex max-w-marketing flex-col items-start gap-6 px-6 py-20 phone:px-4 phone:py-14">
        <h2 className="max-w-2xl text-pretty text-display text-ink">{title}</h2>
        <p className="max-w-2xl text-pretty text-body-lg text-ink-secondary">
          {text}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="primary" size="lg">
            <Link href={SIGN_UP_PATH} prefetch={false}>
              Start free trial
            </Link>
          </Button>
          <DemoModal />
          <Link
            href={CONTACT_PATH}
            className="text-sm text-ink-secondary underline-offset-4 transition-colors duration-normal hover:text-ink hover:underline"
          >
            Contact sales and support
          </Link>
        </div>
      </div>
    </section>
  )
}
