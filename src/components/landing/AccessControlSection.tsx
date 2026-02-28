'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Fingerprint, Scan, CreditCard, QrCode, Lock, Clock } from 'lucide-react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

export function AccessControlSection() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });

  const features = [
    { icon: <Fingerprint className="h-8 w-8" />, label: "Fingerprint" },
    { icon: <Scan className="h-8 w-8" />, label: "Face Recognition" },
    { icon: <CreditCard className="h-8 w-8" />, label: "RFID Card" },
    { icon: <QrCode className="h-8 w-8" />, label: "QR Code" },
    { icon: <Lock className="h-8 w-8" />, label: "Door Lock" },
    { icon: <Clock className="h-8 w-8" />, label: "Attendance" },
  ];

  return (
    <section
      ref={ref}
      className={`py-16 md:py-24 bg-brand-gray ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Prominent "Coming Soon" badge at top */}
        <div className="flex justify-center mb-8">
          <Badge className="bg-brand-accent text-white px-6 py-2 text-lg font-semibold shadow-lg">
            Coming Soon
          </Badge>
        </div>

        {/* Section heading */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-brand-charcoal mb-4">
            Access Control Integration
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Seamlessly integrate with industry-leading access control systems for enhanced security
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Product image */}
          <div className="relative h-80 lg:h-96 bg-gray-200 rounded-lg overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&q=80"
              alt="Biometric access control devices"
              fill
              className="object-cover"
            />
          </div>

          {/* Right: Content */}
          <div className="space-y-6">
            {/* Partner logos */}
            <div className="flex flex-wrap items-center gap-6 mb-6">
              <div className="px-6 py-3 bg-white rounded-lg shadow-sm border border-gray-200">
                <span className="text-lg font-bold text-gray-700">HIKVISION</span>
              </div>
              <div className="px-6 py-3 bg-white rounded-lg shadow-sm border border-gray-200">
                <span className="text-lg font-bold text-gray-700">ZKTeco</span>
              </div>
            </div>

            {/* Special offer card */}
            <Card className="bg-gradient-to-br from-brand-accent/10 to-indigo-50 border-brand-accent/30">
              <CardContent className="pt-6">
                <div className="text-sm font-semibold text-brand-accent mb-2">
                  SPECIAL LAUNCH OFFER
                </div>
                <div className="text-2xl font-bold text-brand-charcoal mb-2">
                  10% OFF + Minimum 1 Year Warranty*
                </div>
                <p className="text-sm text-gray-600">
                  Available when this feature launches
                </p>
              </CardContent>
            </Card>

            {/* Supported features grid */}
            <div>
              <h3 className="font-semibold text-lg text-brand-charcoal mb-4">
                Supported Features
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="flex flex-col items-center text-center p-4 bg-white rounded-lg border border-gray-200 hover:border-brand-accent/50 hover:shadow-md transition-all"
                  >
                    <div className="text-brand-accent mb-2">{feature.icon}</div>
                    <span className="text-sm font-medium text-gray-700">{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Full integration note */}
            <p className="text-sm text-gray-600 leading-relaxed">
              Full integration service including hardware installation, software setup, and training
              will be provided. Stay tuned for launch updates!
            </p>

            {/* Disclaimer */}
            <p className="text-xs text-gray-500 italic">
              *Warranty period depends on device type and manufacturer specifications
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
