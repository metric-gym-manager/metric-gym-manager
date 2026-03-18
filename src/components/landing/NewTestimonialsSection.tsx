'use client';

import { useEffect, useRef } from 'react';

const testimonials = [
  {
    quote:
      'The automated SMS reminders have dramatically reduced missed payments. Our revenue is up 30%!',
    author: 'Michael Chen',
    role: 'Manager at Iron Temple',
  },
  {
    quote:
      'Simple, intuitive, and powerful. Exactly what we needed to streamline our operations.',
    author: 'Emma Rodriguez',
    role: 'Owner at FitZone Studio',
  },
  {
    quote:
      'Customer support is outstanding and the platform is rock solid. Highly recommended!',
    author: 'David Park',
    role: 'Co-Founder at Elite Athletics',
  },
  {
    quote:
      'Switching to Metric was the best decision for our gym. Member management has never been easier.',
    author: 'Lisa Thompson',
    role: 'Owner at Muscle Factory',
  },
];

export function NewTestimonialsSection() {
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
      id="reviews"
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
          TESTIMONIALS
        </div>

        {/* Section Headline */}
        <h2
          className="text-center mb-16"
          style={{
            fontSize: 'clamp(36px, 5vw, 56px)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            color: '#1d1d1f',
            marginBottom: '64px',
          }}
        >
          Loved by gym owners
          <br />
          across Sri Lanka.
        </h2>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="glass-card scroll-reveal p-8"
              style={{
                animationDelay: `${index * 0.1}s`,
              }}
            >
              {/* Quote */}
              <p
                className="mb-6"
                style={{
                  fontSize: '17px',
                  color: 'rgba(29, 29, 31, 0.8)',
                  fontStyle: 'italic',
                  lineHeight: 1.6,
                }}
              >
                &ldquo;{testimonial.quote}&rdquo;
              </p>

              {/* Author */}
              <div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1d1d1f',
                    marginBottom: '2px',
                  }}
                >
                  {testimonial.author}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: '#6e6e73',
                  }}
                >
                  {testimonial.role}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
