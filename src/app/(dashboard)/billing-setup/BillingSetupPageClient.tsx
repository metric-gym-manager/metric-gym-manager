'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Button,
  Card,
  ListRow,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui'
import { PageHeader } from '@/components/common/composites'
import { useViewportTier } from '@/hooks/useViewportTier'
import { useHistoryBack } from '@/hooks/useHistoryBack'

type MobileSection = 'plans' | 'discounts' | 'admission-fee'

const SECTIONS: { id: MobileSection; label: string; description: string }[] = [
  {
    id: 'plans',
    label: 'Plan types',
    description: 'Manage membership plan types and pricing',
  },
  {
    id: 'discounts',
    label: 'Discounts',
    description: 'Configure discount presets for registrations',
  },
  {
    id: 'admission-fee',
    label: 'Admission fee',
    description: 'One-time registration fee settings',
  },
]

const tabLoading = () => <Skeleton className="h-60 w-full" />
const PlanTypesTab = dynamic(() => import('./PlanTypesTab'), {
  ssr: false,
  loading: tabLoading,
})
const DiscountsTab = dynamic(() => import('./DiscountsTab'), {
  ssr: false,
  loading: tabLoading,
})
const AdmissionFeeTab = dynamic(() => import('./AdmissionFeeTab'), {
  ssr: false,
  loading: tabLoading,
})

const sectionContent: Record<MobileSection, React.ReactNode> = {
  plans: <PlanTypesTab />,
  discounts: <DiscountsTab />,
  'admission-fee': <AdmissionFeeTab />,
}

/**
 * Membership Setup — one tree per tier (mobile rebuild plan §8.13, C5).
 *
 * **Both trees used to be in the DOM at once** (`tablet:hidden` +
 * `hidden tablet:block`), which is audit constraint I.4: the hidden desktop
 * `Tabs` mounts its ACTIVE tab on a phone, so `PlanTypesTab` ran its two
 * queries on every phone visit for a tab nobody could see, and opening the
 * same section from the menu mounted a second copy of it. `useViewportTier()`
 * now chooses which tree exists, so a phone issues one request per section it
 * actually opens.
 *
 * The sections stay **state-driven, not routed** (C5): no new pages, no
 * desktop URL change, and UI3's page inventory is unaffected. What state-driven
 * sections lacked was the browser's Back button — entering a section and
 * pressing Back left the page entirely. `useHistoryBack` is the same hook the
 * fullscreen overlays use, so Back now returns to the menu.
 *
 * **The in-flow back control stays, and §8.13's "the section header uses the
 * AppBar Back" is not implementable as written.** `appBarTitle()` is a pure
 * function of `pathname`, and C5 deliberately removed the nested routes these
 * sections would have needed — so on `/billing-setup` the AppBar resolves a
 * root nav item, renders no Back control, and cannot name a section. The two
 * corrections conflict; the behaviour §8.13 asks for (Back returns to the
 * menu) is delivered by the hook, and the visible affordance stays in flow at
 * a touch-sized target rather than as a 20 px text line.
 */
export default function BillingSetupPageClient() {
  const [mobileSection, setMobileSection] = useState<MobileSection | null>(null)
  const phone = useViewportTier() === 'phone'

  // Back returns to the menu instead of leaving the page. Scoped to the phone
  // tier: the desktop tree has tabs, not sections, and never sets this state.
  useHistoryBack(mobileSection !== null, () => setMobileSection(null), phone)

  const activeSection = SECTIONS.find((s) => s.id === mobileSection)

  if (phone) {
    return (
      <div className="flex max-w-app flex-col gap-4">
        {activeSection ? (
          <>
            <Button
              variant="link"
              size="sm"
              className="self-start"
              onClick={() => setMobileSection(null)}
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
              Membership Setup
            </Button>
            {sectionContent[activeSection.id]}
          </>
        ) : (
          <>
            <PageHeader
              title="Membership Setup"
              description="Configure membership plan types and discount presets"
            />
            <Card>
              {/* No `divide-y`: `ListRow` draws its own `border-b`, and the
                  two together double every rule. */}
              <ul role="list">
                {SECTIONS.map((section) => (
                  <ListRow
                    key={section.id}
                    primary={section.label}
                    meta={[section.description]}
                    onClick={() => setMobileSection(section.id)}
                    value={
                      <ChevronRight
                        className="size-4 text-ink-muted"
                        aria-hidden="true"
                      />
                    }
                  />
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex max-w-app flex-col gap-4">
      <PageHeader
        title="Membership Setup"
        description="Configure membership plan types and discount presets"
      />
      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Plan types</TabsTrigger>
          <TabsTrigger value="discounts">Discounts</TabsTrigger>
          <TabsTrigger value="admission-fee">Admission fee</TabsTrigger>
        </TabsList>

        <TabsContent value="plans">
          <PlanTypesTab />
        </TabsContent>
        <TabsContent value="discounts">
          <DiscountsTab />
        </TabsContent>
        <TabsContent value="admission-fee">
          <AdmissionFeeTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
