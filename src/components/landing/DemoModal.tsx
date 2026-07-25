'use client'

import { useState } from 'react'

const css = `
.l-modal-btn:hover{background:#fff!important}
.l-dropdown-item:hover{background:rgba(255,255,255,0.06)!important}
.l-modal-close:hover{color:#ededf0!important}
@media (max-width:480px){
  .l-demo-modal-card{padding:28px 20px!important;margin:16px!important}
}
`

export function DemoModal() {
  const [showModal, setShowModal] = useState(false)
  const [planDropdownOpen, setPlanDropdownOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('')

  const openModal = () => {
    setShowModal(true)
    setPlanDropdownOpen(false)
    setSelectedPlan('')
  }

  const closeModal = () => {
    setShowModal(false)
    setPlanDropdownOpen(false)
  }

  const handleSubmit = () => {
    const plan = selectedPlan || 'Not selected'
    window.location.href = `mailto:founder@metric.lk?subject=Demo Request - ${plan} Plan`
    closeModal()
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

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
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

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
              >
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#8b8b93',
                    letterSpacing: '0.02em',
                  }}
                >
                  Contact person name
                </label>
                <input
                  type="text"
                  placeholder="John Perera"
                  style={{
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
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor =
                      'rgba(255,255,255,0.3)')
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor =
                      'rgba(255,255,255,0.1)')
                  }
                />
              </div>

              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
              >
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#8b8b93',
                    letterSpacing: '0.02em',
                  }}
                >
                  Phone number
                </label>
                <input
                  type="tel"
                  placeholder="+94 77 123 4567"
                  style={{
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
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor =
                      'rgba(255,255,255,0.3)')
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor =
                      'rgba(255,255,255,0.1)')
                  }
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
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#8b8b93',
                    letterSpacing: '0.02em',
                  }}
                >
                  Interested in
                </label>
                <div
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
                    {(['Starter', 'Growth', 'Enterprise'] as const).map(
                      (plan) => (
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
                      )
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleSubmit}
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
                cursor: 'pointer',
                transition: 'background .2s',
              }}
            >
              Submit request
            </button>
          </div>
        </div>
      )}
    </>
  )
}
