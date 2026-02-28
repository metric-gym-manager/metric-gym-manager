'use client';

import { PricingCard } from './PricingCard';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

const pricingPlans = [
  {
    name: "Basic",
    price: "3,990 LKR",
    period: "/month",
    description: "Perfect for small gyms",
    features: [
      "Up to 100 active members",
      "Member management dashboard",
      "Payment tracking",
      "SMS reminders (100/month)",
      "Revenue analytics",
      "Email support",
    ],
    ctaText: "Get Started",
    ctaLink: "/register",
  },
  {
    name: "Pro",
    price: "5,990 LKR",
    period: "/month",
    description: "Most popular choice",
    features: [
      "Up to 500 active members",
      "Everything in Basic",
      "Unlimited SMS reminders",
      "Advanced revenue analytics",
      "Multi-location support",
      "Priority support",
      "Access control integration (Coming Soon)",
    ],
    featured: true,
    ctaText: "Start Free Trial",
    ctaLink: "/register",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For multi-location gyms",
    features: [
      "Unlimited members",
      "Everything in Pro",
      "Custom integrations",
      "Dedicated account manager",
      "24/7 phone support",
      "Custom mobile app branding",
      "Advanced API access",
    ],
    ctaText: "Contact Sales",
    ctaLink: "#contact",
  },
];

export function PricingSection() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section
      id="pricing"
      ref={ref}
      className={`py-16 md:py-24 bg-brand-gray ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Section heading */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-brand-charcoal mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Choose the plan that fits your gym. All plans include core features with no hidden fees.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingPlans.map((plan, index) => (
            <PricingCard key={index} {...plan} />
          ))}
        </div>

        {/* Additional info */}
        <div className="text-center mt-12 text-sm text-gray-600">
          <p>All plans include 30-day money-back guarantee • No credit card required for trial</p>
        </div>
      </div>
    </section>
  );
}
