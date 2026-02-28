'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Phone, MessageCircle } from 'lucide-react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { toast } from 'sonner';

export function ContactSection() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });
  const [formData, setFormData] = useState({
    name: '',
    contactNumber: '',
    interestedIn: 'demo',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Integrate with backend API
    console.log('Form submitted:', formData);
    toast.success("Thank you! We'll be in touch soon.");
    setFormData({ name: '', contactNumber: '', interestedIn: 'demo', message: '' });
  };

  return (
    <section
      id="contact"
      ref={ref}
      className={`hidden md:block py-16 md:py-24 bg-white ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Section heading */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-brand-charcoal mb-4">
            Let's Grow Your Gym Together
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Ready to transform your gym operations? Get in touch with our team.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Left: Contact form */}
          <div className="lg:col-span-3">
            <Card className="border-gray-200">
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Name */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full"
                    />
                  </div>

                  {/* Contact Number */}
                  <div>
                    <label htmlFor="contact" className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Number
                    </label>
                    <Input
                      id="contact"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={formData.contactNumber}
                      onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                      required
                      className="w-full"
                    />
                  </div>

                  {/* Interested In */}
                  <div>
                    <label htmlFor="interested" className="block text-sm font-medium text-gray-700 mb-2">
                      I'm Interested In
                    </label>
                    <select
                      id="interested"
                      value={formData.interestedIn}
                      onChange={(e) => setFormData({ ...formData, interestedIn: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                    >
                      <option value="demo">Demo Request</option>
                      <option value="trial">Free Trial</option>
                      <option value="access-control">Access Control Integration</option>
                      <option value="partnership">Partnership Inquiry</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                      Message
                    </label>
                    <Textarea
                      id="message"
                      rows={5}
                      placeholder="Tell us about your gym and how we can help you..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      required
                      className="w-full"
                    />
                  </div>

                  {/* Submit button */}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-brand-accent hover:bg-brand-accent/90 text-white"
                  >
                    Send Message
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right: Contact info */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h3 className="text-2xl font-bold text-brand-charcoal mb-6">
                Get in Touch
              </h3>

              <div className="space-y-6">
                {/* Email */}
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-brand-accent/10 rounded-full text-brand-accent">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">Email</div>
                    <a
                      href="mailto:info@holtzmanlabs.com"
                      className="text-gray-600 hover:text-brand-accent transition-colors"
                    >
                      info@holtzmanlabs.com
                    </a>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-brand-accent/10 rounded-full text-brand-accent">
                    <Phone className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">Phone</div>
                    <a
                      href="tel:0704379967"
                      className="text-gray-600 hover:text-brand-accent transition-colors"
                    >
                      0704379967
                    </a>
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-brand-accent/10 rounded-full text-brand-accent">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">WhatsApp</div>
                    <a
                      href="https://wa.me/94704379967"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-brand-accent transition-colors"
                    >
                      0704379967
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Proudly Built badge */}
            <Card className="bg-gradient-to-br from-brand-accent/10 to-indigo-50 border-brand-accent/20">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl mb-2">🇱🇰</div>
                <div className="font-semibold text-brand-charcoal mb-1">
                  Proudly Built in Sri Lanka
                </div>
                <div className="text-sm text-gray-600">
                  Trusted by gyms worldwide
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
