import { PageHeader } from '@/components/common/composites'
import QrCodesDashboardClient from './QrCodesDashboardClient'

/**
 * Admin → Gym QR Codes
 *
 * SaaS-operator dashboard listing every gym's self-registration QR code
 * with per-gym and bulk print, plus per-gym QR regeneration. Access is gated
 * by the (admin) layout (Supabase session + saas_admins membership, fail
 * closed); each API route enforces the same getSaasAdmin check independently.
 */
export default function QrCodesPage() {
  return (
    <div className="flex max-w-app flex-col gap-6">
      <PageHeader
        title="Gym registration QR codes"
        description="Every gym's self-registration QR code. Print individually or all at once (one poster per page), or generate a new code to replace a gym's link."
      />
      <QrCodesDashboardClient />
    </div>
  )
}
