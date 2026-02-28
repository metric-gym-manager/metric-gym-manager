'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function HeroSection() {

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&q=85"
          alt="Modern gym interior"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-20">
        {/* Top bar: Logo and CTAs */}
        <div className="flex flex-col items-center mb-12 md:mb-16 gap-6 md:flex-row md:justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="Metric Gym Manager Logo"
              width={24}
              height={24}
              className="w-6 h-6"
            />
            <h1 className="text-xl md:text-2xl font-bold text-white">Metric Gym Manager</h1>
          </div>

          {/* CTAs - Desktop only */}
          <div className="hidden md:flex gap-4">
            <Link href="/register">
              <Button size="lg" className="bg-brand-accent hover:bg-brand-accent/90 text-white px-8">
                Get Started Free
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="bg-white/10 text-white border-white hover:bg-white/20 px-8">
                Log In
              </Button>
            </Link>
          </div>
        </div>

        {/* Main headline */}
        <div className="max-w-4xl mx-auto text-center mb-10 md:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 md:mb-6 leading-tight">
            Turn Your Gym Smarter
          </h2>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-200 leading-relaxed max-w-2xl mx-auto mb-8 md:mb-0">
            All-in-one management platform for modern fitness centers. Automate operations, boost revenue, and delight your members.
          </p>
        </div>

        {/* CTA Buttons - Mobile prominent, Desktop secondary */}
        <div className="flex flex-col gap-4 justify-center mb-12 md:mb-20 max-w-md mx-auto md:max-w-none md:flex-row">
          {/* Mobile: Primary CTAs */}
          <Link href="/register" className="md:hidden w-full">
            <Button size="lg" className="w-full bg-brand-accent hover:bg-brand-accent/90 text-white py-6 text-lg font-semibold">
              Get Started Free
            </Button>
          </Link>
          <Link href="/login" className="md:hidden w-full">
            <Button size="lg" variant="outline" className="w-full bg-white/10 text-white border-white hover:bg-white/20 py-6 text-lg font-semibold">
              Log In
            </Button>
          </Link>

          {/* Desktop: Secondary CTAs */}
          <Link href="#contact" className="hidden md:block">
            <Button size="lg" variant="outline" className="bg-white/10 text-white border-white hover:bg-white/20 px-8">
              Schedule a Demo
            </Button>
          </Link>
          <Link href="#pricing" className="hidden md:block">
            <Button size="lg" variant="outline" className="bg-white/10 text-white border-white hover:bg-white/20 px-8">
              View Pricing
            </Button>
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 md:gap-8 max-w-4xl mx-auto">
          {/* Gyms */}
          <div className="text-center">
            <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-brand-accent mb-1 md:mb-2">
              25+
            </div>
            <div className="text-gray-300 text-xs sm:text-sm md:text-base font-medium">
              Gyms Connected
            </div>
          </div>

          {/* Members */}
          <div className="text-center">
            <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-brand-accent mb-1 md:mb-2">
              2.2K+
            </div>
            <div className="text-gray-300 text-xs sm:text-sm md:text-base font-medium">
              Active Members
            </div>
          </div>

          {/* Uptime */}
          <div className="text-center">
            <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-brand-accent mb-1 md:mb-2">
              99.99%
            </div>
            <div className="text-gray-300 text-xs sm:text-sm md:text-base font-medium">
              Uptime
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
