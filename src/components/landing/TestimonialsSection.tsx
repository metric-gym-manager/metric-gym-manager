'use client';

import { TestimonialCard } from './TestimonialCard';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

const testimonials = [
  {
    quote: "Metric Gym Manager transformed how we run our fitness center. Payment tracking is now effortless!",
    name: "Sarah Johnson",
    role: "Owner",
    gymName: "PowerFit Gym",
    rating: 5,
  },
  {
    quote: "The automated SMS reminders have dramatically reduced missed payments. Our revenue is up 30%!",
    name: "Michael Chen",
    role: "Manager",
    gymName: "Iron Temple",
    rating: 5,
  },
  {
    quote: "Simple, intuitive, and powerful. Exactly what we needed to streamline our operations.",
    name: "Emma Rodriguez",
    role: "Owner",
    gymName: "FitZone Studio",
    rating: 5,
  },
  {
    quote: "Customer support is outstanding and the platform is rock solid. Highly recommended!",
    name: "David Park",
    role: "Co-Founder",
    gymName: "Elite Athletics",
    rating: 5,
  },
  {
    quote: "Switching to Metric was the best decision for our gym. Member management has never been easier.",
    name: "Lisa Thompson",
    role: "Owner",
    gymName: "Muscle Factory",
    rating: 5,
  },
];

export function TestimonialsSection() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section
      ref={ref}
      className={`py-16 md:py-24 bg-brand-gray ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Section heading */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-brand-charcoal mb-4">
            What Our Clients Say
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Hear from gym owners who&apos;ve transformed their business with Metric Gym Manager
          </p>
        </div>

        {/* Scrolling testimonials */}
        <div className="relative overflow-hidden">
          {/* Gradient overlays */}
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-brand-gray to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-brand-gray to-transparent z-10" />

          {/* Scrolling container */}
          <div className="flex gap-6 animate-scroll-left">
            {/* First set */}
            {testimonials.map((testimonial, index) => (
              <TestimonialCard key={`testimonial-1-${index}`} {...testimonial} />
            ))}
            {/* Second set (duplicate for seamless loop) */}
            {testimonials.map((testimonial, index) => (
              <TestimonialCard key={`testimonial-2-${index}`} {...testimonial} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
