import Link from 'next/link'
import type { CSSProperties } from 'react'
import { DemoModal } from './DemoModal'

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
const statCard: CSSProperties = {
  background: '#0c0c0d',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '6px',
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
}
const statLabel: CSSProperties = {
  fontSize: '10px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#5c5c64',
  fontWeight: 500,
}
const sidebarItem: CSSProperties = {
  height: '26px',
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  borderRadius: '4px',
  fontSize: '12px',
  color: '#8b8b93',
}
const sidebarHeading: CSSProperties = {
  fontSize: '10px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#5c5c64',
  fontWeight: 500,
  padding: '10px 8px 4px',
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
@media (max-width:768px){
  #nav-links a.txt{display:none!important}
  #nav-links{gap:10px!important}
  #hero-section .hero-inner{padding:64px 20px 0!important}
  #hero-h1{font-size:clamp(32px,9vw,48px)!important}
  #hero-subtitle{font-size:16px!important;line-height:24px!important}
  #preview-body{flex-direction:column!important;height:auto!important}
  #preview-sidebar{width:100%!important;border-right:none!important;border-bottom:1px solid rgba(255,255,255,0.07)!important;flex-direction:row!important;overflow-x:auto!important;gap:4px!important;padding:8px!important}
  #preview-brand,#preview-primary-label{display:none!important}
  #preview-stats{grid-template-columns:repeat(2,1fr)!important}
  #platform-section{padding:64px 16px!important;gap:40px!important}
  #platform-grid{grid-template-columns:1fr!important;gap:0!important}
  #platform-grid > div{padding:28px 0!important;border-bottom:1px solid rgba(255,255,255,0.07)!important}
  #platform-grid > div:last-child{border-bottom:none!important}
  #platform-grid .feature-header{flex-direction:column!important;align-items:flex-start!important;gap:8px!important}
  #platform-grid .feature-badge{margin-top:0!important}
  #platform-grid h3{font-size:20px!important}
  #platform-grid .feature-desc{font-size:14px!important;line-height:22px!important}
  #platform-grid .code-block{font-size:10px!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;margin-top:16px!important}
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
  .payment-row span:nth-child(2){display:none!important}
}
@media (max-width:480px){
  #preview-stats{grid-template-columns:1fr!important}
  #footer-grid{grid-template-columns:1fr!important}
  #nav-login{display:none!important}
  #trust-logos span{font-size:16px!important}
}
`

export function LandingPage() {
  return (
    <div className="landing-root">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* NAV */}
      <nav
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
              alt="Metric"
              style={{ width: '22px', height: '22px' }}
            />
            Metric
          </div>
          <div
            id="nav-links"
            style={{ display: 'flex', alignItems: 'center', gap: '24px' }}
          >
            <a
              className="txt"
              href="#platform"
              style={{ fontSize: '13px', whiteSpace: 'nowrap' }}
            >
              Platform
            </a>
            <a
              className="txt"
              href="#pricing"
              style={{ fontSize: '13px', whiteSpace: 'nowrap' }}
            >
              Pricing
            </a>
            <a
              className="txt"
              href="#platform"
              style={{ fontSize: '13px', whiteSpace: 'nowrap' }}
            >
              Resources
            </a>
            <Link
              id="nav-login"
              className="l-btn-ghost"
              href="/login"
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
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                width: 'fit-content',
                fontFamily: mono,
                fontSize: '11px',
                letterSpacing: '0.06em',
                color: '#5c5c64',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#fff',
                  flexShrink: 0,
                }}
              />
              RUNNING NATIONWIDE · ENGINEERED FOR PRECISION
            </div>
            <h1
              id="hero-h1"
              style={{
                margin: 0,
                fontSize: 'clamp(48px,7.5vw,92px)',
                fontWeight: 600,
                letterSpacing: '-0.04em',
                lineHeight: 0.98,
                textWrap: 'pretty',
              }}
            >
              The operating system for serious gyms.
            </h1>
            <p
              id="hero-subtitle"
              style={{
                margin: 0,
                fontSize: '19px',
                lineHeight: '28px',
                color: '#8b8b93',
                maxWidth: '540px',
                textWrap: 'pretty',
              }}
            >
              Member records, automated fee collection, SMS infrastructure,
              revenue tracking, and biometric access control.
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
              <a
                className="l-btn-ghost"
                href="#platform"
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
                See the platform
              </a>
            </div>
          </div>

          {/* Dashboard preview */}
          <div
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              overflow: 'hidden',
              background: '#000',
            }}
          >
            <div
              style={{
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '0 14px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <div style={{ display: 'flex', gap: '6px' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.12)',
                  }}
                />
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.12)',
                  }}
                />
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.12)',
                  }}
                />
              </div>
              <div
                style={{
                  flex: 1,
                  maxWidth: '360px',
                  margin: '0 auto',
                  height: '22px',
                  background: '#000',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: mono,
                  fontSize: '11px',
                  color: '#5c5c64',
                }}
              >
                metricgymOS.com/dashboard
              </div>
              <div style={{ width: '46px' }} />
            </div>
            <div
              id="preview-body"
              style={{ display: 'flex', height: '500px', overflow: 'hidden' }}
            >
              <div
                id="preview-sidebar"
                style={{
                  width: '180px',
                  borderRight: '1px solid rgba(255,255,255,0.07)',
                  padding: '12px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  background: '#000',
                  flexShrink: 0,
                }}
              >
                <div
                  id="preview-brand"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '0 8px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <img
                    src="/logo.svg"
                    alt=""
                    style={{ width: '16px', height: '16px' }}
                  />
                  Prime Fitness
                </div>
                <div id="preview-primary-label" style={sidebarHeading}>
                  Primary
                </div>
                <div
                  style={{
                    height: '26px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    background: 'rgba(255,255,255,0.07)',
                    fontWeight: 500,
                    color: '#ededf0',
                  }}
                >
                  Dashboard
                </div>
                <div style={sidebarItem}>Members</div>
                <div style={sidebarItem}>Revenue</div>
                <div style={sidebarItem}>Fee Collection</div>
                <div style={sidebarHeading}>Operations</div>
                <div style={sidebarItem}>Announcements</div>
                <div style={sidebarItem}>Billing Setup</div>
              </div>
              <div
                style={{
                  flex: 1,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  minWidth: 0,
                  background: '#000',
                }}
              >
                <div
                  id="preview-stats"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4,1fr)',
                    gap: '10px',
                  }}
                >
                  <div style={statCard}>
                    <span style={statLabel}>Expired</span>
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: '18px',
                        fontWeight: 600,
                        color: '#f85149',
                      }}
                    >
                      14
                    </span>
                  </div>
                  <div style={statCard}>
                    <span style={statLabel}>Revenue · Jul</span>
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: '18px',
                        fontWeight: 600,
                      }}
                    >
                      486,500
                    </span>
                  </div>
                  <div style={statCard}>
                    <span style={statLabel}>Forecast · Jul</span>
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: '18px',
                        fontWeight: 600,
                        color: '#8b8b93',
                      }}
                    >
                      73,500
                    </span>
                  </div>
                  <div style={statCard}>
                    <span style={statLabel}>Active</span>
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: '18px',
                        fontWeight: 600,
                        color: '#3fb950',
                      }}
                    >
                      312
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    background: '#0c0c0d',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      padding: '8px 12px',
                      borderBottom: '1px solid rgba(255,255,255,0.07)',
                      fontSize: '10px',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: '#5c5c64',
                      fontWeight: 500,
                    }}
                  >
                    Recent payments
                  </div>
                  {[
                    {
                      name: 'Nuwan Perera',
                      date: '2026-07-14',
                      amount: '3,500',
                    },
                    {
                      name: 'Ishara Gunasekara',
                      date: '2026-07-13',
                      amount: '3,500',
                    },
                    {
                      name: 'Anushka Weerasinghe',
                      date: '2026-07-12',
                      amount: '15,500',
                    },
                    {
                      name: 'Malith Rathnayake',
                      date: '2026-07-10',
                      amount: '36,000',
                    },
                  ].map((row, i, arr) => (
                    <div
                      key={row.name}
                      className="payment-row"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '7px 12px',
                        borderBottom:
                          i < arr.length - 1
                            ? '1px solid rgba(255,255,255,0.05)'
                            : undefined,
                        fontSize: '12px',
                      }}
                    >
                      <span>{row.name}</span>
                      <span style={{ color: '#8b8b93' }}>{row.date}</span>
                      <span style={{ fontFamily: mono }}>{row.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
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
            &quot;We cut our admin time by 80% in the first month. The automated
            reminders alone paid for the subscription.&quot;
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
              Zulfi Ahamath
            </strong>{' '}
            — Owner, Fitness Empire, Wattala
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
                    −95% LATE PAYMENTS
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
                  Branded SMS reminders fire automatically before every renewal.
                  Escalation ladders for overdue accounts.
                </p>
              </div>
              <div className="code-block" style={logBox}>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>07-15 09:00:01</span>{' '}
                  <span style={{ color: '#3fb950' }}>SENT</span> sms → 077 481
                  2290 · renewal T−3
                </div>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>07-15 09:00:01</span>{' '}
                  <span style={{ color: '#3fb950' }}>SENT</span> whatsapp → 071
                  220 8845 · renewal T−3
                </div>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>07-15 09:00:02</span>{' '}
                  <span style={{ color: '#3fb950' }}>DLVR</span> sms ← 077 481
                  2290 · 1.2s
                </div>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>07-15 09:00:04</span>{' '}
                  <span style={{ color: '#8b8b93' }}>RETRY</span> sms → 076 903
                  1177 · carrier timeout
                </div>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>07-15 09:00:06</span>{' '}
                  <span style={{ color: '#3fb950' }}>DLVR</span> sms ← 076 903
                  1177 · attempt 2
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
                    HIKVISION · ZKTECO
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
                  Seamless integration with access control hardware. RFID,
                  facial recognition and fingerprint entry wired to membership
                  status. Lapsed account, closed gate.
                </p>
              </div>
              <div className="code-block" style={logBox}>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>18:02:11</span>{' '}
                  <span style={{ color: '#3fb950' }}>GRANT</span> face · M-0087
                  Jayawardena · gate A
                </div>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>18:04:56</span>{' '}
                  <span style={{ color: '#3fb950' }}>GRANT</span> rfid · M-0163
                  Herath · gate A
                </div>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>18:07:33</span>{' '}
                  <span style={{ color: '#f85149' }}>DENY </span> rfid · M-0102
                  Silva · membership lapsed
                </div>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>18:07:41</span>{' '}
                  <span style={{ color: '#3fb950' }}>GRANT</span> finger ·
                  M-0126 Bandara · gate B
                </div>
                <div style={logLine}>
                  <span style={{ color: '#5c5c64' }}>18:09:20</span>{' '}
                  <span style={{ color: '#3fb950' }}>GRANT</span> face · M-0170
                  Rathnayake · gate A
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY METRIC */}
      <section
        id="why"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      />

      {/* ENTERPRISE */}
      <section
        id="enterprise"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      />

      {/* SECURITY */}
      <section
        id="security"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: '#000',
        }}
      />

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
              30-day free trial on every tier.
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
            {/* Starter */}
            <div
              style={{
                background: '#0c0c0d',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '6px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                position: 'relative',
              }}
            >
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
              >
                <span style={{ fontSize: '14px', fontWeight: 600 }}>
                  Starter
                </span>
                <span style={{ fontSize: '12px', color: '#8b8b93' }}>
                  Everything you need to run your gym
                </span>
              </div>
              <div
                style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}
              >
                <span style={priceTag}>2,990</span>
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
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div style={featureRow}>
                  <span style={check}>✓</span>Up to 100 active members
                </div>
                <div style={featureRow}>
                  <span style={check}>✓</span>Member registration &amp;
                  directory
                </div>
                <div style={featureRow}>
                  <span style={check}>✓</span>Payment tracking &amp; receipts
                </div>
                <div style={featureRow}>
                  <span style={check}>✓</span>Today&apos;s revenue, live
                </div>
                <div style={featureRow}>
                  <span style={check}>✓</span>Automated SMS reminders
                </div>
                <div style={featureRow}>
                  <span style={check}>✓</span>Bulk SMS announcements
                </div>
                <div style={featureRowLast}>
                  <span style={check}>✓</span>QR code check-in
                </div>
              </div>
            </div>

            {/* Growth */}
            <div
              style={{
                background: '#0c0c0d',
                border: '1px solid rgba(255,255,255,0.24)',
                borderRadius: '6px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                position: 'relative',
              }}
            >
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
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
              >
                <span style={{ fontSize: '14px', fontWeight: 600 }}>
                  Growth
                </span>
                <span style={{ fontSize: '12px', color: '#8b8b93' }}>
                  For growing gyms with larger member bases
                </span>
              </div>
              <div
                style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}
              >
                <span style={priceTag}>4,990</span>
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
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div style={featureRow}>
                  <span style={check}>✓</span>Everything in Starter
                </div>
                <div style={featureRowLast}>
                  <span style={check}>✓</span>Unlimited active members
                </div>
              </div>
            </div>

            {/* Enterprise */}
            <div
              style={{
                background: '#0c0c0d',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '6px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                position: 'relative',
              }}
            >
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
              >
                <span style={{ fontSize: '14px', fontWeight: 600 }}>
                  Enterprise
                </span>
                <span style={{ fontSize: '12px', color: '#8b8b93' }}>
                  Full automation with access control hardware
                </span>
              </div>
              <div
                style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}
              >
                <span style={priceTag}>6,990</span>
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
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div style={featureRow}>
                  <span style={check}>✓</span>Everything in Growth
                </div>
                <div style={featureRow}>
                  <span style={check}>✓</span>Access control hardware
                  integration
                </div>
                <div style={featureRow}>
                  <span style={check}>✓</span>Automated gatekeeping &amp;
                  attendance
                </div>
                <div style={featureRowLast}>
                  <span style={check}>✓</span>Priority support
                </div>
              </div>
              <div
                style={{ fontFamily: mono, fontSize: '11px', color: '#5c5c64' }}
              >
                INSTALLATION &amp; HARDWARE FEES APPLIED
              </div>
            </div>
          </div>
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
              gridTemplateColumns: '1.7fr 1fr 1fr 1fr',
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
                  alt="Metric"
                  style={{ width: '22px', height: '22px' }}
                />
                Metric Gym OS
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  color: '#8b8b93',
                  lineHeight: '21px',
                }}
              >
                Colombo, Sri Lanka
                <br />
                6.9271° N, 79.8612° E
              </p>
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
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
                Product
              </span>
              <a href="#platform" style={{ fontSize: '13px' }}>
                Platform
              </a>
              <a href="#pricing" style={{ fontSize: '13px' }}>
                Pricing
              </a>
              <Link href="/login" style={{ fontSize: '13px' }}>
                Log in
              </Link>
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
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
                Company
              </span>
              <a href="mailto:founder@metric.lk" style={{ fontSize: '13px' }}>
                About
              </a>
              <a href="mailto:founder@metric.lk" style={{ fontSize: '13px' }}>
                Contact
              </a>
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
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
                Legal
              </span>
              <Link href="/privacy" style={{ fontSize: '13px' }}>
                Privacy policy
              </Link>
              <Link href="/terms" style={{ fontSize: '13px' }}>
                Terms of service
              </Link>
              <Link href="/refund-policy" style={{ fontSize: '13px' }}>
                Refund &amp; cancellation policy
              </Link>
            </div>
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
              © 2026 CAPITALIST ONE (PVT) LTD
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
