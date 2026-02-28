'use client';

import { FeatureCard } from './FeatureCard';
import { LogoTicker } from './LogoTicker';
import { Brain, Fingerprint, Bell, Users } from 'lucide-react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

export function FeaturesSection() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });

  const features = [
    {
      icon: <Brain className="h-12 w-12" strokeWidth={1.5} />,
      title: "AI-Powered Analytics",
      description: "Get predictive insights on member retention, revenue forecasting, and automated marketing recommendations.",
    },
    {
      icon: <Fingerprint className="h-12 w-12" strokeWidth={1.5} />,
      title: "Biometric Access Control",
      description: "Seamless integration with HIKVISION/ZKTeco systems for RFID, facial recognition, and fingerprint access.",
      badge: "Coming Soon",
    },
    {
      icon: <Bell className="h-12 w-12" strokeWidth={1.5} />,
      title: "Automated Payment Reminders",
      description: "Send branded SMS, email, and WhatsApp reminders automatically before membership renewals.",
    },
    {
      icon: <Users className="h-12 w-12" strokeWidth={1.5} />,
      title: "Unlimited Member Management",
      description: "Comprehensive member profiles with multi-location support, staff roles, and branded mobile app.",
    },
  ];

  return (
    <section
      ref={ref}
      className={`py-16 md:py-24 bg-white ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Section heading */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-brand-charcoal mb-4">
            Everything You Need to Run Your Gym Smarter
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Powerful features designed to streamline operations, boost revenue,
            and deliver exceptional member experiences
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
          ))}
        </div>

        {/* Partner logos ticker */}
        <LogoTicker />
      </div>
    </section>
  );
}
