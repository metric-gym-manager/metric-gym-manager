'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import {
  Card,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui'
import { PageHeader } from '@/components/common/composites'

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

export default function BillingSetupPageClient() {
  const [mobileSection, setMobileSection] = useState<MobileSection | null>(null)

  return (
    <div className="flex max-w-app flex-col gap-4">
      {/* Header — full page header when on menu; back button when inside a section */}
      {mobileSection ? (
        <button
          type="button"
          onClick={() => setMobileSection(null)}
          className="mb-4 flex items-center gap-1 text-body text-brand-link transition-colors duration-fast hover:text-brand-link-hover focus-visible:rounded-sm focus-visible:shadow-focus focus-visible:outline-none"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          Membership Setup
        </button>
      ) : (
        <PageHeader
          title="Membership Setup"
          description="Configure membership plan types and discount presets"
        />
      )}

      {/* ── Mobile view (below tablet breakpoint) ── */}
      <div className="tablet:hidden">
        {mobileSection ? (
          sectionContent[mobileSection]
        ) : (
          <Card className="divide-y divide-line-1">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-hover transition-colors"
                onClick={() => setMobileSection(section.id)}
              >
                <div>
                  <p className="text-sm font-medium text-ink">
                    {section.label}
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {section.description}
                  </p>
                </div>
                <ChevronRight
                  className="text-ink-muted flex-shrink-0 ml-3"
                  style={{ width: 14, height: 14 }}
                />
              </button>
            ))}
          </Card>
        )}
      </div>

      {/* ── Desktop view (tablet breakpoint and above) ── */}
      <div className="hidden tablet:block">
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
    </div>
  )
}
