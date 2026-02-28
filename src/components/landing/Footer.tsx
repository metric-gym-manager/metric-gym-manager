import Link from 'next/link';
import { Facebook } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-brand-navy text-white">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-16">
        {/* Main footer content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Column 1: Brand */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold">Metric Gym Manager</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Modern gym management software built by gym owners, for gym owners.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-xs">
              <span>🇱🇰</span>
              <span>Proudly Built in Sri Lanka</span>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Quick Links</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/" className="text-gray-300 hover:text-white transition-colors text-sm">
                  Home
                </Link>
              </li>
              <li>
                <Link href="#features" className="text-gray-300 hover:text-white transition-colors text-sm">
                  Features
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="text-gray-300 hover:text-white transition-colors text-sm">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="#contact" className="text-gray-300 hover:text-white transition-colors text-sm">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-gray-300 hover:text-white transition-colors text-sm">
                  Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Services */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Services</h4>
            <ul className="space-y-3">
              <li className="text-gray-300 text-sm">Member Management</li>
              <li className="text-gray-300 text-sm">Payment Processing</li>
              <li className="text-gray-300 text-sm">Analytics & Reports</li>
              <li className="text-gray-300 text-sm">SMS Reminders</li>
              <li className="text-gray-300 text-sm">Multi-Branch Support</li>
              <li className="text-gray-300 text-sm">Access Control (Coming Soon)</li>
            </ul>
          </div>

          {/* Column 4: Contact & Social */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Connect</h4>
            <div className="space-y-3 mb-6">
              <div className="text-sm">
                <a href="tel:0704379967" className="text-gray-300 hover:text-white transition-colors">
                  0704379967
                </a>
              </div>
              <div className="text-sm">
                <a
                  href="mailto:info@holtzmanlabs.com"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  info@holtzmanlabs.com
                </a>
              </div>
            </div>

            {/* Social icons */}
            <div className="flex gap-3">
              <a
                href="https://www.facebook.com/people/Metric-Gym-Manager/61587965730194/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-400">
            <div>
              © {currentYear} Metric Gym Manager. All rights reserved.
            </div>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
