'use client'

import dynamic from 'next/dynamic'
import {
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui'
import { PageHeader } from '@/components/common/composites'

// Full-CRUD tab bodies (plan-type + discount + admission-fee management) are
// lazy-loaded and rendered inside the Metric DS Tabs frame. Radix Tabs mounts
// only the active tab's content, preserving the on-demand load.
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

export default function BillingSetupPageClient() {
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
