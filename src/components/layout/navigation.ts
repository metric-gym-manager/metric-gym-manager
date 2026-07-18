import {
  Home,
  Users,
  DollarSign,
  CreditCard,
  Megaphone,
  Settings,
  Headset,
  Receipt,
  Building2,
  ShieldCheck,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react'

/**
 * Single source of truth for the app's primary navigation.
 *
 * Consumed by both the sidebar (`Sidebar.tsx`) and the command palette so the
 * two can never drift. Add a destination here once and it appears in both.
 */
export interface NavItem {
  /** Human-readable label shown in the sidebar and palette. */
  name: string
  /** App route the item navigates to. */
  href: string
  /** Monochrome stroke icon (lucide). */
  icon: LucideIcon
  /** Extra search terms for the palette (never displayed). */
  keywords?: string[]
}

/** Top-level destinations — the sidebar renders exactly these, in order. */
export const primaryNavigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
    keywords: ['home', 'overview'],
  },
  {
    name: 'Members',
    href: '/members',
    icon: Users,
    keywords: ['clients', 'people', 'roster'],
  },
  {
    name: 'Revenue',
    href: '/revenue',
    icon: DollarSign,
    keywords: ['income', 'earnings', 'money'],
  },
  {
    name: 'Fee Collection',
    href: '/payment-collection',
    icon: CreditCard,
    keywords: ['payment', 'collect', 'dues'],
  },
  {
    name: 'Announcements',
    href: '/make-announcement',
    icon: Megaphone,
    keywords: ['broadcast', 'sms', 'notify'],
  },
  {
    name: 'Billing Setup',
    href: '/billing-setup',
    icon: Receipt,
    keywords: ['subscription', 'plan', 'payhere'],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    keywords: ['preferences', 'config'],
  },
  {
    name: 'Support',
    href: '/support',
    icon: Headset,
    keywords: ['help', 'contact'],
  },
]

/**
 * Settings sub-pages. Surfaced only in the command palette (the sidebar keeps
 * a single "Settings" entry) so power users can jump straight to a sub-page.
 */
export const settingsNavigation: NavItem[] = [
  {
    name: 'Settings · General',
    href: '/settings',
    icon: Settings,
    keywords: ['preferences'],
  },
  {
    name: 'Settings · Gym Profile',
    href: '/settings/gym',
    icon: Building2,
    keywords: ['name', 'logo', 'profile', 'brand'],
  },
  {
    name: 'Settings · Billing',
    href: '/settings/billing',
    icon: Receipt,
    keywords: ['subscription', 'invoice', 'card'],
  },
  {
    name: 'Settings · Registration',
    href: '/settings/registration',
    icon: ClipboardList,
    keywords: ['signup', 'join', 'form'],
  },
  {
    name: 'Settings · Security',
    href: '/settings/security',
    icon: ShieldCheck,
    keywords: ['password', 'auth'],
  },
]
