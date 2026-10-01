import Link from 'next/link'
import Image from 'next/image'
import { FOOTER_GROUPS } from '../config/navigation'
import { CONTACT, LEGAL_NAME, POSTAL_ADDRESS, SITE_NAME } from '../config/site'

/**
 * Site footer: every public page, the company, and the same contact details
 * /contact prints (both read config/site.ts, so they cannot drift apart again).
 */
export function MarketingFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-line-subtle bg-surface-base">
      <div className="mx-auto flex max-w-marketing flex-col gap-12 px-6 py-16 phone:px-4 phone:py-12">
        <div className="grid grid-cols-1 gap-10 tablet:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="flex max-w-xs flex-col gap-4">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-geist text-lg font-semibold text-ink"
            >
              <Image src="/logo.svg" alt="" width={22} height={22} />
              {SITE_NAME}
            </Link>
            <p className="font-geist text-sm text-ink-secondary">
              Gym management software built and supported in Sri Lanka.
            </p>
            <address className="font-geist text-sm not-italic text-ink-muted">
              {LEGAL_NAME}
              <br />
              {POSTAL_ADDRESS.lines.join(' ')}
              <br />
              <a
                href={`tel:${CONTACT.phoneE164}`}
                className="inline-block leading-6 transition-colors duration-normal hover:text-ink"
              >
                {CONTACT.phoneDisplay}
              </a>
              <br />
              <a
                href={`mailto:${CONTACT.supportEmail}`}
                className="inline-block leading-6 transition-colors duration-normal hover:text-ink"
              >
                {CONTACT.supportEmail}
              </a>
            </address>
          </div>
          {FOOTER_GROUPS.map((group) => (
            <nav
              key={group.heading}
              aria-label={group.heading}
              className="flex flex-col gap-3"
            >
              {/* Not a heading: footer labels would otherwise join every
                  page's H2 outline. The nav's aria-label names the group. */}
              <p className="font-mono text-metadata uppercase text-ink-muted">
                {group.heading}
              </p>
              <ul className="flex flex-col gap-2.5">
                {group.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="font-geist text-sm text-ink-secondary transition-colors duration-normal hover:text-ink"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="border-t border-line-subtle pt-8 font-mono text-mono-sm uppercase text-ink-muted">
          © {year} {LEGAL_NAME}
        </p>
      </div>
    </footer>
  )
}
