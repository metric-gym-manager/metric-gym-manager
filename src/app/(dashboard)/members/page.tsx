import MembersPageClient from './MembersPageClient';

export default function MembersPage() {
  return (
    <div className="space-y-6">
      {/* Server-rendered heading — appears in initial HTML for fast LCP */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Members</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage your gym members and their memberships
          </p>
        </div>
      </div>

      <MembersPageClient />
    </div>
  );
}
