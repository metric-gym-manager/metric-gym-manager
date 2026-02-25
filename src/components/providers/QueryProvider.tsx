'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * React Query Provider Component
 *
 * Wraps the app with QueryClientProvider to enable React Query hooks.
 * Creates a new QueryClient instance per component instance to avoid
 * state sharing between different server-side renders.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create a new QueryClient instance for each component instance
  // This prevents state sharing between requests in server-side rendering
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for better UX
            refetchOnWindowFocus: false,
            // Retry failed queries once
            retry: 1,
            // Cache data for 5 minutes
            staleTime: 5 * 60 * 1000,
            // Keep unused cache entries for 10 minutes before garbage collection
            gcTime: 10 * 60 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
