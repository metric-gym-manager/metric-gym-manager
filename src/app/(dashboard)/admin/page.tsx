'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    pendingMembers: 0,
    totalRevenue: 0,
  })

  useEffect(() => {
    // Mock stats for now
    setStats({
      totalMembers: 0,
      activeMembers: 0,
      pendingMembers: 0,
      totalRevenue: 0,
    })
  }, [])

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalMembers}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Active Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{stats.activeMembers}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Pending Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">{stats.pendingMembers}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary-600">${stats.totalRevenue}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <a
                href="/dashboard/admin/members"
                className="block p-3 rounded-lg hover:bg-gray-50 border border-gray-200"
              >
                <h3 className="font-semibold text-gray-900">Add New Member</h3>
                <p className="text-sm text-gray-600">Register a new gym member</p>
              </a>
              <a
                href="/dashboard/admin/plans"
                className="block p-3 rounded-lg hover:bg-gray-50 border border-gray-200"
              >
                <h3 className="font-semibold text-gray-900">Create Membership Plan</h3>
                <p className="text-sm text-gray-600">Set up pricing and billing</p>
              </a>
              <a
                href="/dashboard/admin/payments"
                className="block p-3 rounded-lg hover:bg-gray-50 border border-gray-200"
              >
                <h3 className="font-semibold text-gray-900">Process Payment</h3>
                <p className="text-sm text-gray-600">Mock payment for testing</p>
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              <p>No recent activity</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
