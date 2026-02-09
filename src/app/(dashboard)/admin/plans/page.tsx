'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function PlansPage() {
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    planType: 'monthly' as const,
    priceAmount: '',
    billingFrequency: 'monthly' as const,
    trialDays: '0',
  })

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    const token = localStorage.getItem('accessToken')
    try {
      const response = await fetch('/api/memberships/plans', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (data.success) {
        setPlans(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = localStorage.getItem('accessToken')

    try {
      const response = await fetch('/api/memberships/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          priceAmount: parseFloat(formData.priceAmount),
          trialDays: parseInt(formData.trialDays),
        }),
      })

      if (response.ok) {
        await fetchPlans()
        setShowForm(false)
        setFormData({
          name: '',
          description: '',
          planType: 'monthly',
          priceAmount: '',
          billingFrequency: 'monthly',
          trialDays: '0',
        })
      }
    } catch (error) {
      console.error('Failed to create plan:', error)
    }
  }

  if (loading) {
    return <div>Loading plans...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Membership Plans</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Create Plan'}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Plan Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Monthly Premium"
                required
              />
              <Input
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Plan details..."
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan Type</label>
                  <select
                    value={formData.planType}
                    onChange={(e) => setFormData({ ...formData, planType: e.target.value as any })}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                    <option value="drop_in">Drop In</option>
                    <option value="class_pack">Class Pack</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Billing Frequency
                  </label>
                  <select
                    value={formData.billingFrequency}
                    onChange={(e) =>
                      setFormData({ ...formData, billingFrequency: e.target.value as any })
                    }
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                    <option value="one_time">One Time</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Price ($)"
                  type="number"
                  step="0.01"
                  value={formData.priceAmount}
                  onChange={(e) => setFormData({ ...formData, priceAmount: e.target.value })}
                  required
                />
                <Input
                  label="Trial Days"
                  type="number"
                  value={formData.trialDays}
                  onChange={(e) => setFormData({ ...formData, trialDays: e.target.value })}
                />
              </div>
              <Button type="submit">Create Plan</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-gray-500">
              No plans found. Create your first membership plan!
            </CardContent>
          </Card>
        ) : (
          plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <Badge variant={plan.isActive ? 'success' : 'secondary'}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-3xl font-bold text-primary-600">
                    ${plan.priceAmount}
                    <span className="text-sm font-normal text-gray-600">
                      /{plan.billingFrequency}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{plan.description || 'No description'}</p>
                  <div className="pt-4 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium">{plan.planType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Trial:</span>
                      <span className="font-medium">{plan.trialDays} days</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
