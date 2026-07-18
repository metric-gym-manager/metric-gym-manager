import { Suspense } from 'react'
import MembersPageClient from './MembersPageClient'

export default function MembersPage() {
  return (
    <div className="space-y-6">
      {/* Server-rendered heading — appears in initial HTML for fast LCP */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold tracking-tight">
            Members
          </h1>
        </div>
      </div>

      {/* Suspense boundary required because MembersPageClient reads
          useSearchParams (command-palette deep links, e.g. ?action=add). */}
      <Suspense fallback={null}>
        <MembersPageClient />
      </Suspense>
    </div>
  )
}
