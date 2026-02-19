export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-4 w-72 rounded bg-gray-200" />
      </div>

      {/* Content area skeleton */}
      <div className="rounded-lg border bg-white">
        {/* Table header skeleton */}
        <div className="border-b px-4 py-3 flex gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 w-20 rounded bg-gray-200" />
          ))}
        </div>

        {/* Table rows skeleton */}
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-6">
              <div className="h-4 w-32 rounded bg-gray-200" />
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="h-5 w-16 rounded-full bg-gray-200" />
              <div className="h-4 w-20 rounded bg-gray-200" />
              <div className="h-4 w-20 rounded bg-gray-200" />
              <div className="h-7 w-20 rounded bg-gray-200 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
