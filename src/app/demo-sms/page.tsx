'use client'

import { useState } from 'react'

export default function DemoSmsPage() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '+94',
    gymName: '',
    fee: '5000',
    type: 'welcome' as 'welcome' | 'due' | 'receipt',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    messageId?: string
    balance?: number
    mock?: boolean
  } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/demo/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        message: 'Failed to send SMS. Please check console for errors.',
      })
      console.error('SMS send error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <div className="min-h-screen  from-surface-panel to-surface-card py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-display-sm text-ink mb-2">SMS Demo</h1>
          <p className="text-sm text-ink-secondary">
            Test SMS functionality (Localhost only)
          </p>
          <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-success-bg text-success">
            Real SMS Mode: Active
          </div>
        </div>

        <div className="bg-surface-card  rounded-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Field */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-ink-secondary mb-2"
              >
                Member Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-line-2 rounded-sm focus:ring-2 focus:ring-focusring focus:border-transparent outline-none transition"
                placeholder="John Doe"
              />
            </div>

            {/* Phone Field */}
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-ink-secondary mb-2"
              >
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                required
                pattern="^\+94\d{9}$"
                className="w-full px-4 py-2 border border-line-2 rounded-sm focus:ring-2 focus:ring-focusring focus:border-transparent outline-none transition"
                placeholder="+94771234567"
              />
              <p className="mt-1 text-xs text-ink-muted">
                Format: +94XXXXXXXXX (9 digits after +94)
              </p>
            </div>

            {/* Gym Name Field */}
            <div>
              <label
                htmlFor="gymName"
                className="block text-sm font-medium text-ink-secondary mb-2"
              >
                Gym Name
              </label>
              <input
                type="text"
                id="gymName"
                name="gymName"
                value={formData.gymName}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-line-2 rounded-sm focus:ring-2 focus:ring-focusring focus:border-transparent outline-none transition"
                placeholder="Metric Gym"
              />
            </div>

            {/* Membership Fee Field */}
            <div>
              <label
                htmlFor="fee"
                className="block text-sm font-medium text-ink-secondary mb-2"
              >
                Membership Fee (Rs.)
              </label>
              <input
                type="number"
                id="fee"
                name="fee"
                value={formData.fee}
                onChange={handleInputChange}
                required
                min="0"
                step="0.01"
                className="w-full px-4 py-2 border border-line-2 rounded-sm focus:ring-2 focus:ring-focusring focus:border-transparent outline-none transition"
                placeholder="5000.00"
              />
              <p className="mt-1 text-xs text-ink-muted">
                Amount will be formatted as Rs.X,XXX.XX in SMS
              </p>
            </div>

            {/* Message Type Field */}
            <div>
              <label
                htmlFor="type"
                className="block text-sm font-medium text-ink-secondary mb-2"
              >
                Message Type
              </label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-line-2 rounded-sm focus:ring-2 focus:ring-focusring focus:border-transparent outline-none transition bg-surface-card"
              >
                <option value="welcome">Welcome Message</option>
                <option value="due">Payment Due Reminder</option>
                <option value="receipt">Payment Receipt</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accentui text-accentui-text py-3 px-4 rounded-sm font-medium hover:bg-accentui-hover focus:outline-none focus:ring-2 focus:ring-focusring focus:ring-offset-2 disabled:bg-ink-muted disabled:cursor-not-allowed transition"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-accentui-text"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Sending...
                </span>
              ) : (
                'Send SMS'
              )}
            </button>
          </form>

          {/* Result Display */}
          {result && (
            <div
              className={`mt-6 p-4 rounded-sm ${
                result.success
                  ? 'bg-success-bg border border-success-border'
                  : 'bg-error-bg border border-error-border'
              }`}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {result.success ? (
                    <svg
                      className="h-5 w-5 text-success"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5 text-error"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <h3
                    className={`text-sm font-medium ${
                      result.success ? 'text-success' : 'text-error'
                    }`}
                  >
                    {result.success ? 'Success' : 'Error'}
                  </h3>
                  <div
                    className={`mt-2 text-sm ${
                      result.success ? 'text-success' : 'text-error'
                    }`}
                  >
                    <p>{result.message}</p>
                    {result.mock && (
                      <p className="mt-1 text-xs italic">
                        (Mock mode - check console)
                      </p>
                    )}
                    {result.messageId && (
                      <p className="mt-1 text-xs">
                        Message ID: {result.messageId}
                      </p>
                    )}
                    {result.balance !== undefined && (
                      <p className="mt-1 text-xs">
                        Remaining Balance: {result.balance} credits
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-accentui-bg border border-accentui-border rounded-sm p-4">
          <h3 className="text-sm font-medium text-ink mb-2">How it works</h3>
          <ul className="text-xs text-brand-link space-y-1">
            <li>• This demo sends real SMS via text.lk</li>
            <li>• Only accessible on localhost for security</li>
            <li>• Check your phone for the message</li>
            <li>• SMS balance is displayed after sending</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
