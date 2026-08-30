import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'

/**
 * Shared dark-theme layout for the legal documents (Privacy, Terms, Refund).
 *
 * Renders the sticky nav, a sticky sidebar with a document switcher plus an
 * "On this page" table of contents, and a document column of numbered
 * sections. Fonts (`--font-geist`, `--font-geist-mono`) come from the root
 * layout. No client JS: document switching is route-based and in-page
 * navigation uses anchor links, so this stays a Server Component.
 */

const mono = 'var(--font-geist-mono), monospace'

export type LegalDoc = 'privacy' | 'terms' | 'refund'

export interface LegalSection {
  /** Anchor id, e.g. "p1" */
  id: string
  title: string
  body: ReactNode
}

interface LegalLayoutProps {
  activeDoc: LegalDoc
  title: string
  /** Human-readable revision date, e.g. "July 2026". */
  lastUpdated: string
  sections: LegalSection[]
  /** Rendered under the document, styled as a mono footnote. */
  footnote?: ReactNode
}

const DOCS: { doc: LegalDoc; label: string; href: string }[] = [
  { doc: 'privacy', label: 'Privacy Policy', href: '/privacy' },
  { doc: 'terms', label: 'Terms of Service', href: '/terms' },
  { doc: 'refund', label: 'Refund Policy', href: '/refund-policy' },
]

const css = `
.legal-root{background:#0a0a0b;color:#ededf0;font-family:var(--font-geist),system-ui,sans-serif;-webkit-font-smoothing:antialiased;font-size:14px;line-height:22px;min-height:100vh}
.legal-root *{box-sizing:border-box}
.legal-root a{color:#8a88ff;text-decoration:none;transition:color .2s,background .2s}
.legal-root a:hover{color:#a5a3ff}
.legal-sec{scroll-margin-top:96px}
.legal-doc-link:hover{background:var(--ds-surface-input)!important}
.legal-toc-link:hover{color:#ededf0!important}
.legal-nav-back:hover{color:#ededf0!important}
.legal-login:hover{background:#ffffff!important;color:#0a0a0b!important}
@media (max-width:860px){
  .legal-grid{grid-template-columns:1fr!important;gap:32px!important}
  .legal-sidebar{position:static!important;top:auto!important}
}
`

const sectionHeading: CSSProperties = {
  margin: '0 0 8px',
  fontSize: '16px',
  fontWeight: 600,
  letterSpacing: '-0.01em',
}
const sectionNum: CSSProperties = {
  fontFamily: mono,
  color: 'var(--ds-text-muted)',
  marginRight: '10px',
}

export function LegalLayout({
  activeDoc,
  title,
  lastUpdated,
  sections,
  footnote,
}: LegalLayoutProps) {
  return (
    <div
      className="legal-root"
      style={{ fontSize: '14px', lineHeight: '22px' }}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* NAV */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          height: '56px',
          background: 'var(--ds-surface-overlay)',
          backdropFilter: 'saturate(180%) blur(16px)',
          WebkitBackdropFilter: 'saturate(180%) blur(16px)',
          borderBottom: '1px solid var(--ds-border-1)',
        }}
      >
        <div
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
            padding: '0 24px',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'var(--ds-text-primary)',
            }}
          >
            <img
              src="/logo.svg"
              alt="Metric"
              style={{ width: '22px', height: '22px' }}
            />
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '-0.01em',
              }}
            >
              Metric
            </span>
            <span
              style={{
                whiteSpace: 'nowrap',
                fontFamily: mono,
                fontSize: '11px',
                color: 'var(--ds-text-muted)',
                border: '1px solid var(--ds-border-1)',
                borderRadius: '4px',
                padding: '1px 6px',
                marginLeft: '4px',
              }}
            >
              LEGAL
            </span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <Link
              href="/"
              className="legal-nav-back"
              style={{ fontSize: '13px', color: 'var(--ds-text-secondary)' }}
            >
              ← Back to site
            </Link>
            <Link
              href="/login"
              className="legal-login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: '32px',
                padding: '0 12px',
                borderRadius: '5px',
                background: 'var(--ds-text-primary)',
                color: 'var(--ds-surface-base)',
                fontSize: '13px',
                fontWeight: 500,
                border: '1px solid var(--ds-border-2)',
                whiteSpace: 'nowrap',
              }}
            >
              Log in
            </Link>
          </div>
        </div>
      </nav>

      <div
        className="legal-grid"
        style={{
          maxWidth: '1120px',
          margin: '0 auto',
          padding: '48px 24px',
          display: 'grid',
          gridTemplateColumns: '220px 1fr',
          gap: '64px',
          alignItems: 'start',
        }}
      >
        {/* STICKY SIDEBAR */}
        <div
          className="legal-sidebar"
          style={{
            position: 'sticky',
            top: '104px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span
              style={{
                fontSize: '11px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--ds-text-muted)',
                fontWeight: 500,
                padding: '0 10px 6px',
              }}
            >
              Documents
            </span>
            {DOCS.map(({ doc, label, href }) => {
              const active = doc === activeDoc
              return (
                <Link
                  key={doc}
                  href={href}
                  className="legal-doc-link"
                  style={{
                    height: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 10px',
                    borderRadius: '5px',
                    fontSize: '13px',
                    background: active ? 'var(--ds-border-1)' : 'transparent',
                    color: active
                      ? 'var(--ds-text-primary)'
                      : 'var(--ds-text-secondary)',
                  }}
                >
                  {label}
                </Link>
              )
            })}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              borderTop: '1px solid var(--ds-border-1)',
              paddingTop: '16px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--ds-text-muted)',
                fontWeight: 500,
                padding: '0 10px 4px',
              }}
            >
              On this page
            </span>
            {sections.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="legal-toc-link"
                style={{
                  fontSize: '12px',
                  lineHeight: '18px',
                  color: 'var(--ds-text-secondary)',
                  padding: '0 10px',
                  display: 'flex',
                  gap: '8px',
                }}
              >
                <span style={{ fontFamily: mono, color: 'var(--ds-border-3)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {s.title}
              </a>
            ))}
          </div>
          <div
            style={{
              borderTop: '1px solid var(--ds-border-1)',
              padding: '16px 10px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <span
              style={{
                whiteSpace: 'nowrap',
                fontFamily: mono,
                fontSize: '11px',
                color: 'var(--ds-text-muted)',
                border: '1px solid var(--ds-border-1)',
                borderRadius: '4px',
                padding: '2px 8px',
                width: 'fit-content',
              }}
            >
              LAST UPDATED
            </span>
            <span
              style={{
                fontFamily: mono,
                fontSize: '11px',
                color: 'var(--ds-text-muted)',
              }}
            >
              {lastUpdated.toUpperCase()}
            </span>
          </div>
        </div>

        {/* DOCUMENT COLUMN */}
        <div
          style={{
            maxWidth: '68ch',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <h1
            style={{
              margin: '0 0 4px',
              fontSize: '28px',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}
          >
            {title}
          </h1>
          <p
            style={{
              margin: '0 0 24px',
              fontSize: '13px',
              color: 'var(--ds-text-muted)',
              fontFamily: mono,
            }}
          >
            CAPITALIST ONE (PVT) LTD · METRIC GYM OS · LAST UPDATED{' '}
            {lastUpdated.toUpperCase()}
          </p>

          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}
          >
            {sections.map((s, i) => (
              <div key={s.id} id={s.id} className="legal-sec">
                <h2 style={sectionHeading}>
                  <span style={sectionNum}>{i + 1}.</span>
                  {s.title}
                </h2>
                {s.body}
              </div>
            ))}
          </div>

          {footnote && (
            <div
              style={{
                marginTop: '24px',
                borderTop: '1px solid var(--ds-border-1)',
                paddingTop: '16px',
                fontFamily: mono,
                fontSize: '11px',
                lineHeight: '18px',
                color: 'var(--ds-text-muted)',
              }}
            >
              {footnote}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---- Content building blocks (design-styled) ---------------------------- */

/** A body paragraph. */
export function LegalP({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: '0 0 12px',
        fontSize: '14px',
        lineHeight: '24px',
        color: 'var(--ds-text-secondary)',
        textWrap: 'pretty',
      }}
    >
      {children}
    </p>
  )
}

/** A disc list. */
export function LegalList({ children }: { children: ReactNode }) {
  return (
    <ul
      style={{
        margin: '0 0 12px',
        paddingLeft: '20px',
        fontSize: '14px',
        lineHeight: '24px',
        color: 'var(--ds-text-secondary)',
        listStyle: 'disc',
      }}
    >
      {children}
    </ul>
  )
}

export function LegalLI({ children }: { children: ReactNode }) {
  return <li style={{ marginBottom: '6px' }}>{children}</li>
}

/** A bold sub-heading inside a section (e.g. "Identity Data:"). */
export function LegalSubHead({ children }: { children: ReactNode }) {
  return (
    <h3
      style={{
        margin: '0 0 6px',
        fontSize: '14px',
        fontWeight: 600,
        color: 'var(--ds-text-primary)',
        letterSpacing: '-0.01em',
      }}
    >
      {children}
    </h3>
  )
}

/** Monospaced callout box for emphasised operational notes. */
export function LegalCallout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        margin: '0 0 12px',
        background: 'var(--ds-surface-card)',
        border: '1px solid var(--ds-border-1)',
        borderRadius: '6px',
        padding: '12px 16px',
        fontFamily: mono,
        fontSize: '12px',
        lineHeight: '20px',
        color: 'var(--ds-text-secondary)',
      }}
    >
      {children}
    </div>
  )
}

/** Definition-style contact list without bullets. */
export function LegalContactList({ children }: { children: ReactNode }) {
  return (
    <ul
      style={{
        margin: 0,
        padding: 0,
        listStyle: 'none',
        fontSize: '14px',
        lineHeight: '26px',
        color: 'var(--ds-text-secondary)',
      }}
    >
      {children}
    </ul>
  )
}

export function LegalContactItem({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <li>
      <strong style={{ color: 'var(--ds-text-primary)', fontWeight: 600 }}>
        {label}
      </strong>{' '}
      {children}
    </li>
  )
}
