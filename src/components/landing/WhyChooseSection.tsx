'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import Link from 'next/link';

export function WhyChooseSection() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });

  const reasons = [
    "Automate payment reminders and reduce late payments by 80%",
    "Set up in under 5 minutes - no technical knowledge required",
    "Get paid faster with automated SMS and WhatsApp reminders",
    "24/7 support in English, Sinhala, and Tamil",
  ];

  return (
    <section
      ref={ref}
      className={`py-16 md:py-24 bg-white ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
          {/* Left: Checklist */}
          <div className="lg:col-span-3">
            <h2 className="text-3xl md:text-4xl font-bold text-brand-charcoal mb-4">
              Why Choose Metric Gym Manager?
            </h2>

            <ul className="space-y-4">
              {reasons.map((reason, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-brand-accent flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span className="text-gray-700 text-base leading-relaxed">
                    {reason}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: Pricing teaser */}
          <div className="lg:col-span-2">
            <Card className="bg-gradient-to-br from-brand-accent to-indigo-600 text-white border-none shadow-2xl">
              <CardContent className="pt-8 pb-8 text-center space-y-6">
                <div className="inline-block px-4 py-1 bg-white/20 rounded-full text-sm font-semibold">
                  Pricing
                </div>

                <div>
                  <div className="text-5xl font-bold mb-2">6,500</div>
                  <div className="text-white/90">LKR per month</div>
                </div>

                <p className="text-white/90 text-sm">
                  No hidden fees, no surprises. Cancel anytime.
                </p>

                <Link href="#pricing">
                  <Button
                    size="lg"
                    className="w-full bg-white text-brand-accent hover:bg-gray-100"
                  >
                    See All Plans
                  </Button>
                </Link>

                <p className="text-xs text-white/75">
                  30-day money-back guarantee
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
