'use client';

import { PricingCard } from './PricingCard';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

const pricingPlans = [
  {
    name: "Starter",
    price: "6,500 LKR",
    period: "/month",
    description: "Perfect for small gyms",
    features: [
      "Unlimited Members",
      "Member Registration & Directory",
      "Payment Tracking",
      "Revenue Tracking",
      "Automated Payment Reminders",
      "Automated Recipt and Welcome Email",
      "Mobile app included",
      "Email Support",
    ],
    ctaText: "Get Started",
    ctaLink: "/register",
  },
  {
    name: "Growth",
    price: "9,500 LKR",
    period: "/month",
    description: "Most popular choice",
    features: [
      "Everything in Starter plan",
      "Member-Facing Mobile App",
      "Member Progress Tracking",
      "Workout and Meal Plan Management",
      "1-to-1 Workout Tailoring",
      "AI Fitness Coach Integration",
      "Admin + 1 Role-Based User Account",
      "Email + Chat Support"
    ],
    featured: true,
    ctaText: "Start Free Trial",
    ctaLink: "/register",
  },
  {
    name: "Ultimate",
    price: "17,500 LKR",
    period: "/month",
    description: "For unparalleled operational efficiency and member satisfaction",
    features: [
      "Everything in Growth plan",
      "Access Control Hardware Integration",
      "Automated Gatekeeping (Entry Control)",
      "Automated Attendance Tracking",
      "Staff Attendance Tracking",
      "Trainer Profiles",
      "Admin + 3 Role-Based User Accounts",
      "Priority 24/7 + On-Site Support",
      "Installation and Hardware Fees Apply",
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
