'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Users, DollarSign, CreditCard, Settings } from 'lucide-react';

const navigation = [
  {
    name: 'Members',
    href: '/members',
    icon: Users,
  },
  {
    name: 'Revenue',
    href: '/revenue',
    icon: DollarSign,
  },
  {
    name: 'Payment Collection',
    href: '/payment-collection',
    icon: CreditCard,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-r border-gray-200 px-6 pb-4">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center gap-2">
            <Image
              src="/logo.svg"
              alt="Metric Gym Manager Logo"
              width={24}
              height={24}
              className="w-6 h-6"
            />
            <h1 className="text-xl font-bold text-gray-900">
              Metric Gym Manager
            </h1>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={cn(
                            isActive
                              ? 'bg-gray-100 text-gray-900'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
                            'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                          )}
                        >
                          <Icon className="h-5 w-5 text-blue-600" strokeWidth={2} />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Mobile sidebar - TODO: Add mobile menu button and overlay */}
      <div className="lg:hidden">
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
          <nav className="flex justify-around">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    isActive
                      ? 'text-blue-600'
                      : 'text-gray-600',
                    'flex flex-col items-center py-2 px-3 text-xs'
                  )}
                >
                  <Icon className="h-6 w-6 text-blue-600 mb-1" strokeWidth={2} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
