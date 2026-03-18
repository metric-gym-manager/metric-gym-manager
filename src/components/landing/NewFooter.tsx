'use client';

export function NewFooter() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer
      style={{
        padding: '64px 24px 32px',
        borderTop: '1px solid rgba(0, 0, 0, 0.08)',
        background: '#f5f5f7',
      }}
    >
      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left Side */}
        <div className="text-center md:text-left">
          <div
            className="mb-2"
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#1d1d1f',
            }}
          >
            Metric Gym Manager
          </div>
          <div
            style={{
              fontSize: '13px',
              color: '#6e6e73',
            }}
          >
            © 2026 Metric Gym Manager · Proudly built in Sri Lanka
          </div>
        </div>

        {/* Right Side Links */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => scrollToSection('features')}
            className="footer-link"
            style={{
              fontSize: '13px',
              color: '#6e6e73',
              transition: 'color 0.2s ease',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Features
          </button>
          <button
            onClick={() => scrollToSection('pricing')}
            className="footer-link"
            style={{
              fontSize: '13px',
              color: '#6e6e73',
              transition: 'color 0.2s ease',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Pricing
          </button>
          <a
            href="/privacy"
            className="footer-link"
            style={{
              fontSize: '13px',
              color: '#6e6e73',
              transition: 'color 0.2s ease',
            }}
          >
            Privacy
          </a>
          <a
            href="/terms"
            className="footer-link"
            style={{
              fontSize: '13px',
              color: '#6e6e73',
              transition: 'color 0.2s ease',
            }}
          >
            Terms
          </a>
          <a
            href="/support"
            className="footer-link"
            style={{
              fontSize: '13px',
              color: '#6e6e73',
              transition: 'color 0.2s ease',
            }}
          >
            Contact
          </a>
        </div>
      </div>

      <style jsx>{`
        .footer-link:hover {
          color: #1d1d1f !important;
        }
      `}</style>
    </footer>
  );
}
