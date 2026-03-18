'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

const pricingTiers = [
  {
    name: 'Starter',
    price: '6,500',
    description: 'Perfect for starting out',
    features: [
      'Unlimited Members',
      'Member Registration & Directory',
      'Payment Tracking',
      'Revenue Tracking',
      'Automated Payment Reminders',
      'Automated Receipt and Welcome Email',
      'Mobile app included',
      'Email Support',
    ],
    cta: 'Get Started',
    ctaStyle: 'primary',
    featured: false,
  },
  {
    name: 'Ultimate',
    price: '17,500',
    description: 'For unparalleled operational efficiency and member satisfaction',
    features: [
      'Everything in Starter plan',
      'Access Control Hardware Integration',
      'Automated Gatekeeping (Entry Control)',
      'Automated Attendance Tracking',
      'Staff Attendance Tracking',
      'Trainer Profiles',
      'Admin + 3 Role-Based User Accounts',
      'Priority 24/7 + On-Site Support',
      'Installation and Hardware Fees Apply',
    ],
    cta: 'Contact Sales',
    ctaStyle: 'secondary',
    featured: false,
  },
];

export function NewPricingSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      { threshold: 0.1 }
    );

    const cards = sectionRef.current?.querySelectorAll('.scroll-reveal');
    cards?.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="pricing"
      ref={sectionRef}
      style={{
        padding: '140px 24px',
        background: '#ffffff',
      }}
    >
      <div className="max-w-[1120px] mx-auto">
        {/* Section Label */}
        <div
          className="text-center mb-4"
          style={{
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#6e6e73',
          }}
        >
          PRICING
        </div>

        {/* Section Headline */}
        <h2
          className="text-center mb-4"
          style={{
            fontSize: 'clamp(36px, 5vw, 56px)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            color: '#1d1d1f',
          }}
        >
          Simple, transparent
          <br />
          pricing.
        </h2>

        {/* Section Description */}
        <p
          className="text-center mx-auto mb-16"
          style={{
            fontSize: '19px',
            color: '#6e6e73',
            maxWidth: '640px',
            lineHeight: 1.5,
            marginBottom: '64px',
          }}
        >
          No hidden fees. No surprises. Cancel anytime. 30-day money-back guarantee.
        </p>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[900px] mx-auto">
          {pricingTiers.map((tier, index) => (
            <div
              key={index}
              className={`scroll-reveal p-8 relative ${
                tier.featured ? 'featured-card' : 'glass-card'
              }`}
              style={{
                animationDelay: `${index * 0.1}s`,
                background: tier.featured
                  ? 'rgba(0, 0, 0, 0.04)'
                  : 'var(--glass-bg)',
                borderColor: tier.featured
                  ? 'rgba(0, 0, 0, 0.12)'
                  : 'var(--glass-border)',
              }}
            >
              {/* Most Popular Badge */}
              {tier.featured && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2"
                  style={{
                    background: '#1d1d1f',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '4px 16px',
                    borderRadius: '980px',
                  }}
                >
                  Most Popular
                </div>
              )}

              {/* Plan Name */}
              <div
                className="mb-2"
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#1d1d1f',
                }}
              >
                {tier.name}
              </div>

              {/* Description */}
              <div
                className="mb-6"
                style={{
                  fontSize: '14px',
                  color: '#6e6e73',
                }}
              >
                {tier.description}
              </div>

              {/* Price */}
              <div className="mb-8">
                <span
                  style={{
                    fontSize: '48px',
                    fontWeight: 700,
                    letterSpacing: '-0.04em',
                    color: '#1d1d1f',
                  }}
                >
                  {tier.price}
                </span>
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 400,
                    color: '#6e6e73',
                    marginLeft: '4px',
                  }}
                >
                  LKR/mo
                </span>
              </div>

              {/* Features */}
              <ul className="mb-8 space-y-3">
                {tier.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <span
                      style={{
                        color: '#34d399',
                        fontWeight: 700,
                        fontSize: '16px',
                      }}
                    >
                      ✓
                    </span>
                    <span
                      style={{
                        fontSize: '14px',
                        color: 'rgba(29, 29, 31, 0.7)',
                        lineHeight: 1.5,
                      }}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <Link
                href={tier.cta === 'Contact Sales' ? '/support' : '/register'}
                className={
                  tier.ctaStyle === 'primary' ? 'btn-primary' : 'btn-secondary'
                }
                style={{
                  width: '100%',
                  textAlign: 'center',
                  display: 'block',
                }}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
