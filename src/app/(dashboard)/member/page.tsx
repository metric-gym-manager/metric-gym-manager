'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function MemberDashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Member Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>My Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">View and manage your profile information</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Membership</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">View your current membership and billing</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Member features will be added in Phase 2, including class booking and check-in history.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
