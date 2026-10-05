'use client'

import { useState } from 'react'
// Deep import: the @/features/leads barrel is server-tainted (it reaches
// nodemailer), so a client component must not import it.
import { LeadInterest } from '@/features/leads/config/LeadConfig'
import { trackEvent } from '@/lib/analytics/gtag'

const css = `
.l-modal-btn:hover{background:#fff!important}
.l-dropdown-item:hover{background:rgba(255,255,255,0.06)!important}
.l-modal-close:hover{color:#ededf0!important}
@media (max-width:480px){
  .l-demo-modal-card{padding:28px 20px!important;margin:16px!important}
}
`

const PLAN_OPTIONS = ['Lite', 'Pro', 'Enterprise'] as const
type PlanOption = (typeof PLAN_OPTIONS)[number]

/** The dropdown's tier names (TIER_DISPLAY_NAME) to the LeadInterest values. */
const PLAN_TO_INTEREST: Record<PlanOption, LeadInterest> = {
  Lite: LeadInterest.Lite,
  Pro: LeadInterest.Pro,
  Enterprise: LeadInterest.Enterprise,
}

const inputStyle: React.CSSProperties = {
  height: '40px',
  padding: '0 12px',
  borderRadius: '6px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
  color: '#ededf0',
  fontSize: '14px',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color .2s',
}
const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 500,
  color: '#8b8b93',
  letterSpacing: '0.02em',
}
const focusOn = (e: React.FocusEvent<HTMLInputElement>) =>
  (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')
const focusOff = (e: React.FocusEvent<HTMLInputElement>) =>
  (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')

/**
 * Landing-page "Request a demo" modal. Captures a marketing lead and persists
 * it via the public POST /api/public/leads endpoint (leads feature). Replaces
 * the previous mailto: dead-end. The hidden `website` input is a honeypot —
 * real users never see it; a bot that fills it is rejected server-side.
 */
export function DemoModal() {
  const [showModal, setShowModal] = useState(false)
  const [planDropdownOpen, setPlanDropdownOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>(
    'idle'
  )
  const [error, setError] = useState<string | null>(null)

  const openModal = () => {
    setShowModal(true)
    setPlanDropdownOpen(false)
    setSelectedPlan('')
    setName('')
    setEmail('')
    setPhone('')
    setWebsite('')
    setStatus('idle')
    setError(null)
  }

  const closeModal = () => {
    setShowModal(false)
    setPlanDropdownOpen(false)
  }

  const handleSubmit = async () => {
    setError(null)
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError('Please fill in your name, email and phone.')
      return
    }
    setStatus('submitting')
    try {
      const interest = selectedPlan
        ? PLAN_TO_INTEREST[selectedPlan as PlanOption]
        : LeadInterest.Demo
      const response = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, interest, website }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        setError(
          result?.error?.message || 'Something went wrong. Please try again.'
        )
        setStatus('idle')
        return
      }
      setStatus('success')
      // GA4 recommended event: ties an organic landing page to a lead. No
      // personal data — only which plan, if any, the visitor asked about.
      trackEvent('generate_lead', { form: 'demo_request', interest })
    } catch {
      setError('Network error. Please try again.')
      setStatus('idle')
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <button
        onClick={openModal}
        className="l-modal-btn"
        style={{
          whiteSpace: 'nowrap',
          display: 'inline-flex',
          alignItems: 'center',
          height: '36px',
          padding: '0 16px',
          borderRadius: '5px',
          fontSize: '13px',
          fontWeight: 500,
          border: '1px solid rgba(255,255,255,0.15)',
          background: '#ededf0',
          color: '#000',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background .2s',
        }}
      >
        Request a demo
      </button>

      {showModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="l-demo-modal-card"
            style={{
              background: '#111113',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '460px',
              padding: '40px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              position: 'relative',
            }}
          >
            <button
              onClick={closeModal}
              className="l-modal-close"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: '#5c5c64',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px',
                lineHeight: 1,
                transition: 'color .2s',
              }}
            >
              ✕
            </button>

            {status === 'success' ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: '22px',
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    color: '#ededf0',
                  }}
                >
                  Thanks — we&apos;ll be in touch.
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    color: '#8b8b93',
                    lineHeight: '20px',
                  }}
                >
                  We&apos;ll reach out to{' '}
                  <span style={{ color: '#ededf0' }}>{email}</span> within one
                  business day to schedule your walkthrough.
                </p>
                <button
                  onClick={closeModal}
                  className="l-modal-btn"
                  style={{
                    marginTop: '8px',
                    height: '40px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#ededf0',
                    color: '#000',
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    transition: 'background .2s',
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '22px',
                      fontWeight: 600,
                      letterSpacing: '-0.02em',
                      color: '#ededf0',
                    }}
                  >
                    Request a demo
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#5c5c64' }}>
                    Fill in your details and we&apos;ll reach out to schedule a
                    walkthrough.
                  </p>
                </div>

                {error && (
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#f85149',
                      background: 'rgba(248,81,73,0.1)',
                      border: '1px solid rgba(248,81,73,0.25)',
                      borderRadius: '6px',
                      padding: '10px 12px',
                    }}
                  >
                    {error}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <label style={labelStyle} htmlFor="demo-name">
                      Contact person name
                    </label>
                    <input
                      id="demo-name"
                      autoComplete="name"
                      type="text"
                      placeholder="John Perera"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={inputStyle}
                      onFocus={focusOn}
                      onBlur={focusOff}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <label style={labelStyle} htmlFor="demo-email">
                      Email
                    </label>
                    <input
                      id="demo-email"
                      autoComplete="email"
                      type="email"
                      placeholder="you@yourgym.lk"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={inputStyle}
                      onFocus={focusOn}
                      onBlur={focusOff}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <label style={labelStyle} htmlFor="demo-phone">
                      Phone number
                    </label>
                    <input
                      id="demo-phone"
                      autoComplete="tel"
                      type="tel"
                      placeholder="+94 77 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      style={inputStyle}
                      onFocus={focusOn}
                      onBlur={focusOff}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      position: 'relative',
                    }}
                  >
                    {/* A span, not a label: the control below is a div, so
                        there is nothing for a label to name. It is wired with
                        aria-labelledby instead, and given the button
                        semantics and keyboard access its appearance already
                        implies. */}
                    <span style={labelStyle} id="demo-plan-label">
                      Interested in
                    </span>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-labelledby="demo-plan-label"
                      aria-haspopup="listbox"
                      aria-expanded={planDropdownOpen}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setPlanDropdownOpen((o) => !o)
                        }
                      }}
                      onClick={() => setPlanDropdownOpen((o) => !o)}
                      style={{
                        height: '40px',
                        padding: '0 12px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.04)',
                        color: selectedPlan ? '#ededf0' : '#5c5c64',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        userSelect: 'none',
                        transition: 'border-color .2s',
                      }}
                    >
                      <span>{selectedPlan || 'Select a plan'}</span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="#8b8b93"
                        style={{ flexShrink: 0 }}
                      >
                        <path d="M4.5 6l3.5 4 3.5-4z" />
                      </svg>
                    </div>

                    {planDropdownOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          left: 0,
                          right: 0,
                          zIndex: 10,
                          background: '#1a1a1e',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          padding: '4px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1px',
                          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                        }}
                      >
                        {PLAN_OPTIONS.map((plan) => (
                          <div
                            key={plan}
                            className="l-dropdown-item"
                            onClick={() => {
                              setSelectedPlan(plan)
                              setPlanDropdownOpen(false)
                            }}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '5px',
                              fontSize: '14px',
                              color: '#ededf0',
                              cursor: 'pointer',
                              transition: 'background .15s',
                            }}
                          >
                            {plan}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Honeypot — visually hidden, must stay empty */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  style={{
                    position: 'absolute',
                    left: '-9999px',
                    width: 1,
                    height: 1,
                    opacity: 0,
                  }}
                />

                <button
                  onClick={handleSubmit}
                  disabled={status === 'submitting'}
                  className="l-modal-btn"
                  style={{
                    height: '40px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#ededf0',
                    color: '#000',
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
                    opacity: status === 'submitting' ? 0.7 : 1,
                    transition: 'background .2s',
                  }}
                >
                  {status === 'submitting' ? 'Submitting…' : 'Submit request'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
