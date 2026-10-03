import type { Metadata } from 'next'
import { LandingPage } from '@/components/landing'
import {
  HOME_PATH,
  StructuredData,
  buildPageMetadata,
  softwareApplicationJsonLd,
} from '@/features/marketing'

/**
 * Homepage. Title, description and canonical come from the public page
 * registry; the JSON-LD names the company, the site and the product (with its
 * LKR plans) from the same config the visible page renders.
 */
export const metadata: Metadata = buildPageMetadata(HOME_PATH)

export default function HomePage() {
  return (
    <>
      <StructuredData
        path={HOME_PATH}
        breadcrumbs={false}
        nodes={[softwareApplicationJsonLd()]}
      />
      <LandingPage />
    </>
  )
}
