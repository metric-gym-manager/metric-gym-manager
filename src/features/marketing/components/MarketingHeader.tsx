import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui'
import { HEADER_LINKS, LOG_IN_PATH, SIGN_UP_PATH } from '../config/navigation'

/**
 * Sticky header for the public pages. Real links only — the homepage's old
 * hash anchors (#platform, #pricing) were the reason crawlers could reach
 * nothing but /login and the legal documents from it.
 *
 * On a phone the text links fold away (the footer carries every link) and
 * the two actions stay.
 */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-sticky border-b border-line-subtle bg-surface-base">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:rounded-sm focus:bg-surface-card focus:px-3 focus:py-2 focus:text-sm focus:text-ink"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-marketing items-center justify-between gap-4 px-6 phone:px-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-geist text-base font-semibold text-ink"
        >
          <Image src="/logo.svg" alt="" width={22} height={22} />
          Metric
        </Link>
        <nav aria-label="Main" className="flex items-center gap-6 phone:gap-2">
          {HEADER_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap font-geist text-sm text-ink-secondary transition-colors duration-normal hover:text-ink phone:hidden"
            >
              {l.label}
            </Link>
          ))}
          <Button asChild variant="secondary" size="md">
            <Link href={LOG_IN_PATH}>Log in</Link>
          </Button>
          <Button asChild variant="primary" size="md">
            <Link href={SIGN_UP_PATH}>Start free trial</Link>
          </Button>
        </nav>
      </div>
    </header>
  )
}
