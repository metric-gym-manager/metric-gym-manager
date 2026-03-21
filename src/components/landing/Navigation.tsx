'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ContactModal } from './ContactModal';

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'border-b' : ''
      }`}
      style={{
        height: '64px',
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: isScrolled ? '1px solid rgba(0, 0, 0, 0.08)' : 'none',
      }}
    >
      <div className="max-w-[1400px] mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="transition-transform duration-200 group-hover:scale-105">
            <img
              src="/logo.svg"
              alt="Metric Logo"
              width="32"
              height="32"
              style={{
                display: 'block',
              }}
            />
          </div>
          <span
            className="font-bold transition-colors duration-200"
            style={{
              fontSize: '18px',
              letterSpacing: '-0.5px',
              color: '#1d1d1f',
            }}
          >
            Metric
          </span>
        </Link>

        {/* Center Navigation Links */}
        <div className="hidden md:flex items-center gap-8">
          <button
            onClick={() => scrollToSection('features')}
            className="nav-link"
            style={{
              fontSize: '13px',
              color: '#6e6e73',
              fontWeight: 400,
              transition: 'color 0.2s ease',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              padding: '4px 0',
            }}
          >
            Features
            <span className="nav-link-underline" />
          </button>
          <button
            onClick={() => scrollToSection('lanka')}
            className="nav-link"
            style={{
              fontSize: '13px',
              color: '#6e6e73',
              fontWeight: 400,
              transition: 'color 0.2s ease',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              padding: '4px 0',
            }}
          >
            For Sri Lanka
            <span className="nav-link-underline" />
          </button>
          <button
            onClick={() => scrollToSection('pricing')}
            className="nav-link"
            style={{
              fontSize: '13px',
              color: '#6e6e73',
              fontWeight: 400,
              transition: 'color 0.2s ease',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              padding: '4px 0',
            }}
          >
            Pricing
            <span className="nav-link-underline" />
          </button>
          <button
            onClick={() => scrollToSection('reviews')}
            className="nav-link"
            style={{
              fontSize: '13px',
              color: '#6e6e73',
              fontWeight: 400,
              transition: 'color 0.2s ease',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              padding: '4px 0',
            }}
          >
            Reviews
            <span className="nav-link-underline" />
          </button>
          <button
            onClick={() => setIsContactModalOpen(true)}
            className="nav-link"
            style={{
              fontSize: '13px',
              color: '#6e6e73',
              fontWeight: 400,
              transition: 'color 0.2s ease',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              padding: '4px 0',
            }}
          >
            Contact
            <span className="nav-link-underline" />
          </button>
        </div>

        {/* Right CTAs */}
        <div className="flex items-center gap-4">
          {/* Desktop: Show Log In text link and Get Started Free button */}
          <Link
            href="/login"
            className="hidden md:block"
            style={{
              fontSize: '13px',
              color: '#6e6e73',
              fontWeight: 400,
              transition: 'color 0.2s ease',
            }}
          >
            Log In
          </Link>
          <Link
            href="/register"
            className="hidden md:inline-block btn-primary"
            style={{
              padding: '10px 20px',
              fontSize: '13px',
            }}
          >
            Get Started Free
          </Link>

          {/* Mobile: Show only Log In button */}
          <Link
            href="/login"
            className="block md:hidden btn-primary"
            style={{
              padding: '10px 20px',
              fontSize: '13px',
            }}
          >
            Log In
          </Link>
        </div>
      </div>

      <style jsx>{`
        .nav-link:hover {
          color: #1d1d1f !important;
        }

        .nav-link-underline {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0;
          height: 1px;
          background: #1d1d1f;
          transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .nav-link:hover .nav-link-underline {
          width: 100%;
        }
      `}</style>

      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />
    </nav>
  );
}
