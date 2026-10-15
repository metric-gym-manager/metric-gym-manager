import Link from 'next/link'
import type { CSSProperties } from 'react'
import {
  ARTICLE_PATHS,
  CONTACT,
  FEATURE_PATHS,
  FITNESS_EMPIRE,
  FOOTER_GROUPS,
  HEADER_LINKS,
  HUB_PATH,
  LOG_IN_PATH,
  LEGAL_NAME,
  POSTAL_ADDRESS,
  PRICING_PATH,
  PRICING_TIERS,
  SIGN_UP_PATH,
  SITE_NAME,
  TRIAL_DAYS,
  formatLkr,
  prefetchFor,
} from '@/features/marketing'
import { DashboardPreview } from './DashboardPreview'
import { DemoModal } from './DemoModal'

/**
 * The five capability areas, each linking to its own page. This is the
 * homepage's crawlable map of the product: before it existed, the only
 * internal links on the page went to /login and the three legal documents.
 */
const CAPABILITIES = [
  {
    href: FEATURE_PATHS.membership,
    label: 'Membership management',
    text: 'Seven plan types, statuses that update themselves, and QR self-registration from the member’s own phone.',
  },
  {
    href: FEATURE_PATHS.payments,
    label: 'Payment collection',
    text: 'Who is expired, who expires this week, and a desk payment recorded with an SMS receipt.',
  },
  {
    href: FEATURE_PATHS.sms,
    label: 'SMS reminders',
    text: 'Reminders timed to each plan length, with every message tracked to delivered or failed.',
  },
  {
    href: FEATURE_PATHS.revenue,
    label: 'Revenue & analytics',
    text: 'What members owe this month against what you collected, plus renewal, churn and retention.',
  },
  {
    href: FEATURE_PATHS.access,
    label: 'Access control',
    text: 'ZKTeco fingerprint readers that admit members until their paid-through date — even offline.',
  },
] as const

const sans = 'var(--font-geist), system-ui, sans-serif'
const mono = 'var(--font-geist-mono), monospace'

const check: CSSProperties = {
  fontFamily: mono,
  color: '#3fb950',
  flexShrink: 0,
}
const featureRow: CSSProperties = {
  padding: '9px 0',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  fontSize: '13px',
  color: '#8b8b93',
  display: 'flex',
  gap: '8px',
  alignItems: 'flex-start',
}
const featureRowLast: CSSProperties = {
  padding: '9px 0',
  fontSize: '13px',
  color: '#8b8b93',
  display: 'flex',
  gap: '8px',
  alignItems: 'flex-start',
}
const logLine: CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}
const logBox: CSSProperties = {
  background: '#000',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '6px',
  padding: '12px',
  fontFamily: mono,
  fontSize: '11px',
  lineHeight: '19px',
  color: '#8b8b93',
}
const priceTag: CSSProperties = {
  fontFamily: mono,
  fontSize: '32px',
  fontWeight: 600,
  letterSpacing: '-0.02em',
  fontVariantNumeric: 'tabular-nums',
}
const trustLogo: CSSProperties = {
  fontSize: '26px',
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: '#8b8b93',
  opacity: 0.7,
}

const css = `
@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.landing-root{background:#000;color:#ededf0;font-family:${sans};-webkit-font-smoothing:antialiased;font-size:14px;line-height:1.6}
html:has(.landing-root){scroll-behavior:smooth}
.landing-root *{box-sizing:border-box}
.landing-root a{color:#8b8b93;text-decoration:none;transition:color .2s}
.landing-root a:hover{color:#ededf0}
.landing-root img{max-width:100%;display:block}
.l-btn-solid:hover{background:#fff!important}
.l-btn-ghost:hover{border-color:rgba(255,255,255,0.3)!important}
.l-trust:hover{opacity:1!important}
@media (max-width:1024px){
  #capabilities-grid{grid-template-columns:repeat(2,1fr)!important}
  #footer-grid{grid-template-columns:repeat(3,1fr)!important}
}
@media (max-width:768px){
  #nav-links a.txt{display:none!important}
  #nav-links{gap:10px!important}
  #hero-section .hero-inner{padding:64px 20px 0!important}
  #hero-h1{font-size:clamp(32px,9vw,48px)!important}
  #hero-subtitle{font-size:16px!important;line-height:24px!important}
  #platform-section{padding:64px 16px!important;gap:40px!important}
  #platform-grid{grid-template-columns:1fr!important;gap:0!important}
  #platform-grid > div{padding:28px 0!important;border-bottom:1px solid rgba(255,255,255,0.07)!important;min-width:0!important}
  #platform-grid > div:last-child{border-bottom:none!important}
  #platform-grid .feature-header{flex-direction:column!important;align-items:flex-start!important;gap:8px!important}
  #platform-grid .feature-badge{margin-top:0!important}
  #platform-grid h3{font-size:20px!important}
  #platform-grid .feature-desc{font-size:14px!important;line-height:22px!important}
  #platform-grid .code-block{font-size:10px!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;margin-top:16px!important}
  #capabilities-section{padding:64px 20px!important;gap:32px!important}
  #capabilities-grid{grid-template-columns:1fr!important}
  #pricing-section{padding:64px 20px!important}
  #pricing-grid{grid-template-columns:1fr!important}
  #trust-section .trust-inner{padding:40px 20px!important}
  #trust-logos{overflow:hidden!important;flex-wrap:nowrap!important;gap:0!important;mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)!important;-webkit-mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)!important}
  #trust-logos .marquee-track{display:flex!important;gap:48px!important;animation:marquee 20s linear infinite!important;flex-shrink:0!important;padding-right:48px!important}
  #trust-logos span{font-size:18px!important;white-space:nowrap!important}
  #quote-section .quote-inner{padding:56px 20px!important;text-align:left!important}
  #quote-text{font-size:clamp(18px,5vw,24px)!important;margin-left:0!important;margin-right:0!important}
  #quote-attribution{text-align:left!important}
  #cta{min-height:70vh!important}
  #cta .cta-inner{padding:64px 20px!important}
  #cta-heading{font-size:clamp(28px,8vw,48px)!important}
  #footer-inner{padding:56px 20px 32px!important;gap:40px!important}
  #footer-grid{grid-template-columns:1fr 1fr!important}
  #footer-watermark{font-size:clamp(56px,18vw,120px)!important}
}
@media (max-width:480px){
  #footer-grid{grid-template-columns:1fr!important}
  #trust-logos span{font-size:16px!important}
}
`

export function LandingPage() {
  return (
    <div className="landing-root">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* NAV */}
      <nav
        aria-label="Main"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          height: '56px',
          background: 'rgba(10,10,11,0.85)',
          backdropFilter: 'saturate(180%) blur(16px)',
          WebkitBackdropFilter: 'saturate(180%) blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: '#ededf0',
            }}
          >
            <img
              src="/logo.svg"
              alt=""
              width={22}
              height={22}
              style={{ width: '22px', height: '22px' }}
            />
            Metric
          </div>
          <div
            id="nav-links"
            style={{ display: 'flex', alignItems: 'center', gap: '24px' }}
          >
            {HEADER_LINKS.map((l) => (
              <Link
                key={l.href}
                className="txt"
                href={l.href}
                style={{ fontSize: '13px', whiteSpace: 'nowrap' }}
              >
                {l.label}
              </Link>
            ))}
            <Link
              id="nav-login"
              className="l-btn-ghost"
              href={LOG_IN_PATH}
              prefetch={false}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: '32px',
                padding: '0 12px',
                borderRadius: '5px',
                background: 'transparent',
                color: '#ededf0',
                fontSize: '13px',
                fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.12)',
                whiteSpace: 'nowrap',
              }}
            >
              Log in
            </Link>
            <a
              className="l-btn-solid"
              href="#cta"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: '32px',
                padding: '0 12px',
                borderRadius: '5px',
                background: '#ededf0',
                color: '#000',
                fontSize: '13px',
                fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.12)',
                whiteSpace: 'nowrap',
              }}
            >
              Request a demo
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section
        id="hero-section"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div
          className="hero-inner"
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
            padding: '96px 24px 0',
          }}
        >
          <div
            style={{
              maxWidth: '720px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              paddingBottom: '64px',
            }}
          >
            {/* One <h1>, two visible lines: the descriptive line says what
                the product is and where (the page's search intent), the
                display line keeps the brand voice. Both are real, visible
                text — the eyebrow was a separate div before, which left the
                heading saying nothing about gym software or Sri Lanka. */}
            <h1
              style={{
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: 'fit-content',
                  fontFamily: mono,
                  fontSize: '11px',
                  fontWeight: 400,
                  letterSpacing: '0.06em',
                  lineHeight: 1.6,
                  textTransform: 'uppercase',
                  color: '#8b8b93',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: '#fff',
                    flexShrink: 0,
                  }}
                />
                Gym management software · Sri Lanka
              </span>{' '}
              <span
                id="hero-h1"
                style={{
                  fontSize: 'clamp(48px,7.5vw,92px)',
                  fontWeight: 600,
                  letterSpacing: '-0.04em',
                  lineHeight: 0.98,
                  textWrap: 'pretty',
                }}
              >
                The operating system for serious gyms.
              </span>
            </h1>
            <p
              id="hero-subtitle"
              style={{
                margin: 0,
                fontSize: '19px',
                lineHeight: '28px',
                color: '#8b8b93',
                maxWidth: '560px',
                textWrap: 'pretty',
              }}
            >
              Member records, renewals, automated SMS reminders, revenue
              reporting and fingerprint door access — in one system built for
              gyms in Sri Lanka.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <a
                className="l-btn-solid"
                href="#cta"
                style={{
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '5px',
                  background: '#ededf0',
                  color: '#000',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                Request a demo
              </a>
              <Link
                className="l-btn-ghost"
                href={HUB_PATH}
                style={{
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '5px',
                  background: 'transparent',
                  color: '#ededf0',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                See how it works
              </Link>
            </div>
          </div>

          {/* Dashboard preview — the real /dashboard, drawn with its own parts */}
          <DashboardPreview />
        </div>
      </section>

      {/* TRUST */}
      <section
        id="trust-section"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: '#000',
        }}
      >
        <div
          className="trust-inner"
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
            padding: '56px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '36px',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              fontFamily: mono,
              fontSize: '11px',
              letterSpacing: '0.08em',
              color: '#5c5c64',
            }}
          >
            TRUSTED BY LEADING GYMS ACROSS SRI LANKA
          </div>
          <div
            id="trust-logos"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '18px 48px',
            }}
          >
            <div className="marquee-track" style={{ display: 'contents' }}>
              <span className="l-trust" style={trustLogo}>
                Yomak Health Hub
              </span>
              <span className="l-trust" style={trustLogo}>
                FITNESS EMPIRE
              </span>
              <span className="l-trust" style={trustLogo}>
                Colombo Strength Co.
              </span>
              <span className="l-trust" style={trustLogo}>
                ROYAL FITNESS WORLD
              </span>
              <span className="l-trust" style={trustLogo}>
                Lifeline Fitness Center
              </span>
              <span className="l-trust" style={trustLogo}>
                FORGE 24/7
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* QUOTE */}
      <section
        id="quote-section"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: '#000',
        }}
      >
        <div
          className="quote-inner"
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
            padding: '80px 24px',
            textAlign: 'center',
          }}
        >
          <p
            id="quote-text"
            style={{
              fontSize: 'clamp(22px,3vw,32px)',
              fontWeight: 500,
              letterSpacing: '-0.02em',
              lineHeight: 1.3,
              maxWidth: '720px',
              margin: '0 auto 24px',
              textWrap: 'pretty',
              color: '#ededf0',
            }}
          >
            &quot;{FITNESS_EMPIRE.quote}&quot;
          </p>
          <p
            id="quote-attribution"
            style={{
              fontFamily: mono,
              fontSize: '13px',
              color: '#5c5c64',
              margin: 0,
            }}
          >
            <strong style={{ color: '#ededf0', fontWeight: 500 }}>
              {FITNESS_EMPIRE.owner}
            </strong>{' '}
            — Owner, {FITNESS_EMPIRE.name}, {FITNESS_EMPIRE.locality}
          </p>
          <p style={{ margin: '20px 0 0', fontSize: '15px' }}>
            <Link
              href={ARTICLE_PATHS.fitnessEmpire}
              style={{
                color: '#9694f5',
                textDecoration: 'underline',
                textUnderlineOffset: '4px',
              }}
            >
              Read the {FITNESS_EMPIRE.name} story
            </Link>
          </p>
        </div>
      </section>

      {/* PLATFORM */}
      <section
        id="platform"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div
          id="platform-section"
          className="platform-inner"
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
            padding: '96px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '64px',
          }}
        >
          <div
            style={{
              maxWidth: '560px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <span
              style={{
                fontFamily: mono,
                fontSize: '11px',
                letterSpacing: '0.08em',
                color: '#8b8b93',
              }}
            >
              PLATFORM
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: 'clamp(34px,4.4vw,52px)',
                fontWeight: 600,
                letterSpacing: '-0.028em',
                lineHeight: 1.04,
              }}
            >
              Two systems. Zero manual work.
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: '15px',
                color: '#8b8b93',
                textWrap: 'pretty',
              }}
            >
              Built on a single member ledger — one record, one source of truth,
              from sign-up to gate entry.
            </p>
          </div>
          <div
            id="platform-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '48px 40px',
            }}
          >
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
              >
                <div
                  className="feature-header"
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: 600,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Never miss a renewal.
                  </h3>
                  <span
                    className="feature-badge"
                    style={{
                      whiteSpace: 'nowrap',
                      fontFamily: mono,
                      fontSize: '11px',
                      color: '#3fb950',
                      background: 'rgba(63,185,80,0.1)',
                      border: '1px solid rgba(63,185,80,0.25)',
                      borderRadius: '4px',
                      padding: '1px 6px',
                    }}
                  >
                    T−7 · T−3 · DUE DATE
                  </span>
                </div>
                <p
                  className="feature-desc"
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    color: '#8b8b93',
                    textWrap: 'pretty',
                  }}
                >
                  SMS reminders go out automatically before every renewal and on
                  the due date, timed to each plan’s length — and every message
                  is tracked to delivered or failed.
                </p>
                <Link
                  href={FEATURE_PATHS.sms}
                  style={{
                    fontSize: '13px',
                    color: '#9694f5',
                    width: 'fit-content',
                  }}
                >
                  How the reminder schedule works →
                </Link>
              </div>
              <div className="code-block" style={logBox}>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>07-15 09:00:01</span>{' '}
                  <span style={{ color: '#3fb950' }}>SENT</span> sms → 077 481
                  2290 · renewal T−3
                </div>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>07-15 09:00:01</span>{' '}
                  <span style={{ color: '#3fb950' }}>SENT</span> sms → 071 220
                  8845 · renewal T−7
                </div>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>07-15 09:00:02</span>{' '}
                  <span style={{ color: '#3fb950' }}>DLVR</span> sms ← 077 481
                  2290 · 1.2s
                </div>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>07-15 09:00:04</span>{' '}
                  <span style={{ color: '#3fb950' }}>SENT</span> sms → 076 903
                  1177 · due today
                </div>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>07-15 09:00:06</span>{' '}
                  <span style={{ color: '#3fb950' }}>DLVR</span> sms ← 076 903
                  1177 · 2.1s
                </div>
              </div>
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
              >
                <div
                  className="feature-header"
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: 600,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Only paid members get in.
                  </h3>
                  <span
                    className="feature-badge"
                    style={{
                      whiteSpace: 'nowrap',
                      fontFamily: mono,
                      fontSize: '11px',
                      color: '#8b8b93',
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '4px',
                      padding: '1px 6px',
                    }}
                  >
                    ZKTECO · FINGERPRINT
                  </span>
                </div>
                <p
                  className="feature-desc"
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    color: '#8b8b93',
                    textWrap: 'pretty',
                  }}
                >
                  ZKTeco fingerprint readers, wired to each member’s
                  paid-through date and enforced by the reader’s own clock —
                  even when the internet is down. Lapsed account, closed gate.
                </p>
                <Link
                  href={FEATURE_PATHS.access}
                  style={{
                    fontSize: '13px',
                    color: '#9694f5',
                    width: 'fit-content',
                  }}
                >
                  How fingerprint access control works →
                </Link>
              </div>
              <div className="code-block" style={logBox}>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>18:02:11</span>{' '}
                  <span style={{ color: '#3fb950' }}>GRANT</span> finger ·
                  M-0087 Jayawardena · gate A
                </div>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>18:04:56</span>{' '}
                  <span style={{ color: '#3fb950' }}>GRANT</span> finger ·
                  M-0163 Herath · gate A
                </div>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>18:07:33</span>{' '}
                  <span style={{ color: '#f85149' }}>DENY </span> finger ·
                  M-0102 Silva · membership expired
                </div>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>18:07:41</span>{' '}
                  <span style={{ color: '#3fb950' }}>GRANT</span> finger ·
                  M-0126 Bandara · gate B
                </div>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>18:09:20</span>{' '}
                  <span style={{ color: '#3fb950' }}>GRANT</span> finger ·
                  M-0170 Rathnayake · gate A
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CAPABILITIES — replaces three empty placeholder sections that
          rendered as stacked hairlines. Every capability links to its page. */}
      <section
        id="capabilities"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div
          id="capabilities-section"
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
            padding: '96px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '48px',
          }}
        >
          <div
            style={{
              maxWidth: '640px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <span
              style={{
                fontFamily: mono,
                fontSize: '11px',
                letterSpacing: '0.08em',
                color: '#8b8b93',
              }}
            >
              CAPABILITIES
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: 'clamp(34px,4.4vw,52px)',
                fontWeight: 600,
                letterSpacing: '-0.028em',
                lineHeight: 1.04,
              }}
            >
              Everything a gym runs on.
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: '15px',
                color: '#8b8b93',
                textWrap: 'pretty',
              }}
            >
              One member record drives all five. Read how{' '}
              <Link
                href={HUB_PATH}
                style={{
                  color: '#9694f5',
                  textDecoration: 'underline',
                  textUnderlineOffset: '4px',
                }}
              >
                gym management software works for Sri Lankan gyms
              </Link>
              , or go straight to the part you need.
            </p>
          </div>
          <ul
            id="capabilities-grid"
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(3,1fr)',
              gap: '12px',
            }}
          >
            {CAPABILITIES.map((c) => (
              <li
                key={c.href}
                style={{
                  background: '#0c0c0d',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '6px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
                  <Link href={c.href} style={{ color: '#ededf0' }}>
                    {c.label}
                  </Link>
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    color: '#8b8b93',
                    textWrap: 'pretty',
                  }}
                >
                  {c.text}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* PRICING */}
      <section
        id="pricing"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div
          id="pricing-section"
          className="pricing-inner"
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
            padding: '96px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '48px',
          }}
        >
          <div
            style={{
              maxWidth: '560px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <span
              style={{
                fontFamily: mono,
                fontSize: '11px',
                letterSpacing: '0.08em',
                color: '#8b8b93',
              }}
            >
              PRICING
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: 'clamp(34px,4.4vw,52px)',
                fontWeight: 600,
                letterSpacing: '-0.028em',
                lineHeight: 1.04,
              }}
            >
              Three tiers. No surprises.
            </h2>
            <p style={{ margin: 0, fontSize: '15px', color: '#8b8b93' }}>
              Every new account starts with a {TRIAL_DAYS}-day free trial — no
              payment details needed. Enterprise is set up with our team.
            </p>
          </div>
          <div
            id="pricing-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3,1fr)',
              gap: '12px',
              alignItems: 'stretch',
            }}
          >
            {/* Rendered from features/marketing/config/pricing.ts — the same
                list as /pricing and the SoftwareApplication offers. */}
            {PRICING_TIERS.map((t) => (
              <div
                key={t.tier}
                style={{
                  background: '#0c0c0d',
                  border: t.highlighted
                    ? '1px solid rgba(255,255,255,0.24)'
                    : '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '6px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  position: 'relative',
                }}
              >
                {t.highlighted && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-9px',
                      left: '24px',
                      background: '#ededf0',
                      color: '#000',
                      fontFamily: mono,
                      fontSize: '10px',
                      letterSpacing: '0.08em',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontWeight: 500,
                    }}
                  >
                    MOST POPULAR
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                    {t.name}
                  </h3>
                  <span style={{ fontSize: '12px', color: '#8b8b93' }}>
                    {t.summary}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '6px',
                  }}
                >
                  <span style={priceTag}>{formatLkr(t.monthlyPriceLkr)}</span>
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: '12px',
                      color: '#5c5c64',
                    }}
                  >
                    LKR/MO
                  </span>
                </div>
                <ul
                  style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    borderTop: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  {t.inclusions.map((item, i) => (
                    <li
                      key={item}
                      style={
                        i === t.inclusions.length - 1
                          ? featureRowLast
                          : featureRow
                      }
                    >
                      <span aria-hidden="true" style={check}>
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                {t.note && (
                  <div
                    style={{
                      fontFamily: mono,
                      fontSize: '11px',
                      color: '#5c5c64',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t.note}
                  </div>
                )}
              </div>
            ))}
          </div>
          <Link
            href={PRICING_PATH}
            style={{ fontSize: '13px', color: '#9694f5', width: 'fit-content' }}
          >
            Compare plans, billing and the free trial →
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section
        id="cta"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          className="cta-inner"
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
            padding: '96px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            textAlign: 'center',
          }}
        >
          <h2
            id="cta-heading"
            style={{
              margin: 0,
              fontSize: 'clamp(36px,5vw,64px)',
              fontWeight: 600,
              letterSpacing: '-0.035em',
              lineHeight: 1.02,
              maxWidth: '640px',
              textWrap: 'pretty',
            }}
          >
            Run the gym. The platform runs itself.
          </h2>
          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <DemoModal />
            <Link
              className="l-btn-ghost"
              href={SIGN_UP_PATH}
              prefetch={false}
              style={{
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                height: '36px',
                padding: '0 16px',
                borderRadius: '5px',
                background: 'transparent',
                color: '#ededf0',
                fontSize: '13px',
                fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              Start {TRIAL_DAYS}-day free trial
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          overflow: 'hidden',
        }}
      >
        <div
          id="footer-inner"
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
            padding: '80px 24px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: '64px',
          }}
        >
          <div
            id="footer-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '1.7fr 1fr 1fr 1fr 1fr',
              gap: '40px',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                maxWidth: '280px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '16px',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: '#ededf0',
                }}
              >
                <img
                  src="/logo.svg"
                  alt=""
                  width={22}
                  height={22}
                  style={{ width: '22px', height: '22px' }}
                />
                {SITE_NAME}
              </div>
              {/* Same address, phone and email as /contact and the
                  Organization structured data (features/marketing/config/site.ts). */}
              <address
                style={{
                  margin: 0,
                  fontStyle: 'normal',
                  fontSize: '13px',
                  color: '#8b8b93',
                  lineHeight: '21px',
                }}
              >
                {LEGAL_NAME}
                <br />
                {POSTAL_ADDRESS.lines.join(' ')}
                <br />
                <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a>
                <br />
                <a href={`mailto:${CONTACT.supportEmail}`}>
                  {CONTACT.supportEmail}
                </a>
              </address>
            </div>
            {FOOTER_GROUPS.map((group) => (
              <nav
                key={group.heading}
                aria-label={group.heading}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#5c5c64',
                    fontWeight: 500,
                  }}
                >
                  {group.heading}
                </span>
                {group.links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    prefetch={prefetchFor(l.href)}
                    style={{ fontSize: '13px' }}
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '24px',
              flexWrap: 'wrap',
              paddingTop: '32px',
              borderTop: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <span
              style={{ fontFamily: mono, fontSize: '11px', color: '#5c5c64' }}
            >
              © {new Date().getFullYear()} {LEGAL_NAME.toUpperCase()}
            </span>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '20px' }}
            />
          </div>
          <div
            id="footer-watermark"
            style={{
              fontSize: 'clamp(72px,15vw,200px)',
              fontWeight: 600,
              letterSpacing: '-0.05em',
              lineHeight: 0.8,
              color: '#141416',
              userSelect: 'none',
              marginBottom: '-0.12em',
            }}
          >
            Metric
          </div>
        </div>
      </footer>
    </div>
  )
}
