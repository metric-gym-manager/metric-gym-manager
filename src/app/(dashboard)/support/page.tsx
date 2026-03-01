import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, MessageCircle, Headset } from 'lucide-react';

export default function SupportPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-blue-100 p-4">
              <Headset className="h-12 w-12 text-blue-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Support</h1>
          <p className="text-gray-500 mt-2">
            We're here to help with any technical difficulties, failures, or suggestions
          </p>
        </div>

        {/* Contact Card */}
        <Card className="p-8">
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="space-y-4">
              {/* Phone Contact */}
              <div className="flex items-center gap-4 p-4 rounded-lg bg-blue-50 border border-blue-100">
                <div className="shrink-0">
                  <div className="rounded-full bg-blue-600 p-3">
                    <Phone className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Call or WhatsApp</p>
                  <a
                    href="tel:0704379967"
                    className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    070 437 9967
                  </a>
                </div>
              </div>

              {/* WhatsApp Button */}
              <div className="flex gap-3">
                <Button
                  asChild
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  <a
                    href="https://wa.me/94704379967"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="h-5 w-5" />
                    WhatsApp
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  <a href="tel:0704379967" className="flex items-center justify-center gap-2">
                    <Phone className="h-5 w-5" />
                    Call Now
                  </a>
                </Button>
              </div>
            </div>

            {/* Support Hours */}
            <div className="border-t border-gray-200 pt-6">
              <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Support Hours</h3>
                <p className="text-sm text-gray-600">
                  Monday - Sunday: 8:00 AM - 10:00 PM
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  We typically respond within a few hours during business hours
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Additional Info */}
        <div className="text-center text-sm text-gray-500">
          <p>Thank you for using Metric Gym Manager!</p>
          <p className="mt-1">We appreciate your feedback and are here to help.</p>
        </div>
      </div>
    </div>
  );
}
