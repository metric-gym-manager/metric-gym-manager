'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

export function GetStartedSection() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });

  const benefits = [
    'No credit card required',
    'Setup in under 5 minutes',
    '30-day money-back guarantee',
    'Free onboarding support',
  ];

  return (
    <section
      ref={ref}
      className={`py-16 md:py-24 bg-gradient-to-br from-brand-accent to-indigo-600 ${
        isVisible ? 'animate-fade-in-up' : 'opacity-0'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="text-center">
          {/* Heading */}
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-12">
            Ready to Transform Your Gym?
          </h2>

          {/* Benefits */}
          <div className="flex flex-wrap justify-center gap-6 mb-16">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-2 text-white">
                <CheckCircle className="h-5 w-5 text-white" />
                <span className="text-base md:text-lg">{benefit}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/register">
              <Button
                size="lg"
                className="bg-white text-brand-accent hover:bg-gray-100 px-8 py-6 text-lg font-semibold shadow-xl"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#contact">
              <Button
                size="lg"
                variant="outline"
                className="bg-white/10 text-white border-white hover:bg-white/20 px-8 py-6 text-lg font-semibold"
              >
                Schedule a Demo
              </Button>
            </Link>
          </div>

          {/* Trust badges */}
          <div className="mt-12 pt-8 border-t border-white/20">
            <p className="text-white/75 text-sm mb-4">Trusted by gyms across Sri Lanka</p>
            <div className="flex flex-wrap justify-center items-center gap-8 text-white/60">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">25+</div>
                <div className="text-sm">Happy Gyms</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">2.2K+</div>
                <div className="text-sm">Active Members</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">99.99%</div>
                <div className="text-sm">Uptime</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
