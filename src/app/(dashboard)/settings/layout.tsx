'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const settingsNavigation = [
  { name: 'Gym Information', href: '/settings/gym' },
  { name: 'Account Security', href: '/settings/security' },
  // "Subscription", not "Billing" — the sidebar's Billing Setup is member
  // plan-type config; this is the gym's own SaaS plan (plan conflict C-7)
  { name: 'Subscription', href: '/settings/billing' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-3xl font-bold tracking-tight">Settings</h1>
      </div>

      {/* Sub-navigation */}
      <div className="border-b">
        <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Settings">
          {settingsNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium',
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                )}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
