import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Gym Management SaaS
        </h1>
        <p className="text-xl text-gray-700 mb-8">
          Multi-tenant platform for gym and fitness center management
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold"
          >
            Staff Login
          </Link>
          <Link
            href="/register"
            className="px-6 py-3 bg-white text-primary-600 border-2 border-primary-600 rounded-lg hover:bg-primary-50 transition-colors font-semibold"
          >
            Register Gym
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="font-semibold text-lg mb-2">Member Management</h3>
            <p className="text-gray-600 text-sm">
              Track member profiles, emergency contacts, and medical waivers
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="font-semibold text-lg mb-2">Membership Plans</h3>
            <p className="text-gray-600 text-sm">
              Create flexible pricing plans with automatic billing
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-md">
            <h3 className="font-semibold text-lg mb-2">Payment Processing</h3>
            <p className="text-gray-600 text-sm">
              Secure payment handling with automatic member activation
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
