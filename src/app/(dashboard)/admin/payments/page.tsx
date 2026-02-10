'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'

export default function PaymentsPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    memberId: '',
    membershipId: '',
    amount: '',
    forceOutcome: '' as '' | 'success' | 'failure',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/payments/mock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId: formData.memberId,
          membershipId: formData.membershipId,
          amount: parseFloat(formData.amount),
          forceOutcome: formData.forceOutcome || undefined,
        }),
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        // Clear form on success
        setFormData({
          memberId: '',
          membershipId: '',
          amount: '',
          forceOutcome: '',
        })
      }
    } catch (error) {
      setResult({
        success: false,
        error: 'Failed to process payment',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Payment Processing</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Mock Payment Simulator</CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              ⚠️ Development only - simulates payment processing
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Member ID"
                value={formData.memberId}
                onChange={(e) => setFormData({ ...formData, memberId: e.target.value })}
                placeholder="UUID of member"
                required
              />

              <Input
                label="Membership ID"
                value={formData.membershipId}
                onChange={(e) => setFormData({ ...formData, membershipId: e.target.value })}
                placeholder="UUID of membership assignment"
                required
              />

              <Input
                label="Amount ($)"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="99.99"
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Force Outcome (Optional)
                </label>
                <select
                  value={formData.forceOutcome}
                  onChange={(e) =>
                    setFormData({ ...formData, forceOutcome: e.target.value as any })
                  }
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Random (80% success)</option>
                  <option value="success">Force Success</option>
                  <option value="failure">Force Failure</option>
                </select>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Processing...' : 'Process Mock Payment'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Result</CardTitle>
          </CardHeader>
          <CardContent>
            {!result && (
              <div className="text-center py-8 text-gray-500">
                Submit a payment to see the result
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-lg ${
                    result.success
                      ? result.data?.status === 'succeeded'
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Status:</span>
                    {result.data?.status ? (
                      <Badge
                        variant={result.data.status === 'succeeded' ? 'success' : 'danger'}
                      >
                        {result.data.status}
                      </Badge>
                    ) : (
                      <Badge variant="danger">Error</Badge>
                    )}
                  </div>

                  {result.message && (
                    <p className="text-sm text-gray-700 mb-2">{result.message}</p>
                  )}

                  {result.data && (
                    <div className="text-sm space-y-1 mt-4">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Payment ID:</span>
                        <span className="font-mono text-xs">{result.data.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Amount:</span>
                        <span className="font-medium">${result.data.amount}</span>
                      </div>
                      {result.data.mockProcessorId && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Transaction ID:</span>
                          <span className="font-mono text-xs">{result.data.mockProcessorId}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {result.error && (
                    <p className="text-sm text-red-700 mt-2">{result.error}</p>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">What happens on success?</h4>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>Payment record updated to "succeeded"</li>
                    <li>Member status automatically set to "active"</li>
                    <li>Membership status set to "active"</li>
                    <li>Database trigger handles all updates</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>How to Test</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>Create a member in the Members page</li>
            <li>Create a membership plan in the Plans page</li>
            <li>
              Assign the plan to the member using:
              <code className="block mt-1 p-2 bg-gray-100 rounded text-xs">
                POST /api/memberships/assignments
              </code>
            </li>
            <li>Copy the member ID and membership assignment ID</li>
            <li>Use this form to process a mock payment</li>
            <li>Check the Members page to see the member status change to "active"</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
