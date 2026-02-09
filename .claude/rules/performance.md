6. Performance Standards
6.1 Frontend Optimization
MetricTargetImplementationFirst Contentful Paint< 1.8sServer Components, minimal client JSTime to Interactive< 3.5sCode splitting, lazy loadingCumulative Layout Shift< 0.1Reserve space for dynamic contentLargest Contentful Paint< 2.5sOptimize images (next/image)
Code Splitting Example:
typescript// ❌ NEVER - Loads entire component tree immediately
import HeavyDashboard from '@/components/HeavyDashboard';

// ✅ ALWAYS - Lazy load non-critical components
const HeavyDashboard = dynamic(() => import('@/components/HeavyDashboard'), {
  loading: () => <Skeleton />,
});
6.2 Backend Optimization
Caching Strategy:
typescript// Use SWR for frequently accessed data
import useSWR from 'swr';

function MemberList() {
  const { data, error } = useSWR('/api/members', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000, // Cache for 1 minute
  });
}
Database Query Optimization:
typescript// ❌ N+1 Query Problem
const users = await db.users.findMany();
for (const user of users) {
  user.subscription = await db.subscriptions.findFirst({ 
    where: { userId: user.id } 
  });
}

// ✅ Single Query with Join
const users = await db.users.findMany({
  include: { subscription: true },
});
6.3 Edge Functions
Use for latency-sensitive operations:

Member check-ins (location-based)
Real-time attendance updates
Webhook processing