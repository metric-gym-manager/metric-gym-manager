'use client';

import { Phone, MessageCircle, Mail, X } from 'lucide-react';
import { useEffect } from 'react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const phoneNumber = '+94704379967';
  const whatsappUrl = `https://wa.me/94704379967`;
  const telUrl = `tel:${phoneNumber}`;
  const emailAddress = 'support@metricgymmanager.com';
  const mailtoUrl = `mailto:${emailAddress}`;

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
        style={{
          animation: 'fadeIn 0.2s ease-out',
        }}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          pointerEvents: 'none',
        }}
      >
        <div
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl"
          style={{
            pointerEvents: 'auto',
            animation: 'slideUp 0.3s ease-out',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <X size={20} color="#6e6e73" />
          </button>

          {/* Content */}
          <div style={{ padding: '40px 32px' }}>
            {/* Title */}
            <h2
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: '#1d1d1f',
                marginBottom: '12px',
                letterSpacing: '-0.02em',
              }}
            >
              Get in Touch
            </h2>

            {/* Description */}
            <p
              style={{
                fontSize: '16px',
                color: '#6e6e73',
                marginBottom: '32px',
                lineHeight: 1.5,
              }}
            >
              Choose your preferred way to contact us. We&apos;re here to help!
            </p>

            {/* Buttons */}
            <div className="space-y-3">
              {/* Call Button */}
              <a
                href={telUrl}
                className="flex items-center justify-center gap-3 w-full"
                style={{
                  padding: '16px 24px',
                  background: '#1d1d1f',
                  color: '#ffffff',
                  borderRadius: '980px',
                  fontSize: '16px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Phone size={20} />
                <span>Call {phoneNumber}</span>
              </a>

              {/* WhatsApp Button */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full"
                style={{
                  padding: '16px 24px',
                  background: '#25D366',
                  color: '#ffffff',
                  borderRadius: '980px',
                  fontSize: '16px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(37, 211, 102, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <MessageCircle size={20} />
                <span>WhatsApp</span>
              </a>

              {/* Email Button */}
              <a
                href={mailtoUrl}
                className="flex items-center justify-center gap-3 w-full"
                style={{
                  padding: '16px 24px',
                  background: '#ffffff',
                  color: '#1d1d1f',
                  border: '1px solid rgba(0, 0, 0, 0.15)',
                  borderRadius: '980px',
                  fontSize: '16px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Mail size={20} />
                <span>Email Us</span>
              </a>
            </div>

            {/* Full contact details link */}
            <p
              style={{
                fontSize: '13px',
                color: '#6e6e73',
                marginTop: '24px',
                textAlign: 'center',
              }}
            >
              <a href="/contact" style={{ textDecoration: 'underline', color: '#6e6e73' }}>
                View all contact details
              </a>
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
