import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function MembersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Members</h1>
        <p className="text-gray-600 mt-2">
          Manage your gym members and their memberships
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Member Management</CardTitle>
          <CardDescription>
            Track members, plans, and payment history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              Member management features coming soon...
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Phase 4 implementation
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
