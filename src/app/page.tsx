import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 px-4 py-16">
        <div className="max-w-4xl w-full text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900">
              Gym Management
              <span className="block text-blue-600">Made Simple</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto">
              Streamline your gym operations with automated member management,
              payment tracking, and SMS reminders
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto px-8">
                Get Started Free
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto px-8">
                Login
              </Button>
            </Link>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-blue-600">📊</div>
                  <h3 className="font-semibold text-lg">Member Management</h3>
                  <p className="text-sm text-gray-600">
                    Track members, plans, and payment history in one place
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-blue-600">💰</div>
                  <h3 className="font-semibold text-lg">Revenue Analytics</h3>
                  <p className="text-sm text-gray-600">
                    Monitor collected vs projected revenue with detailed charts
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-blue-600">📱</div>
                  <h3 className="font-semibold text-lg">Automated SMS</h3>
                  <p className="text-sm text-gray-600">
                    Never miss a payment with automatic SMS reminders
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-400">
            © 2025 Gym Management SaaS. Built for Sri Lankan gyms.
          </p>
        </div>
      </footer>
    </main>
  );
}
