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
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Gym Registration QR Codes
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Every gym&apos;s self-registration QR code. Print individually or all
          at once (one poster per page), or generate a new code to replace a
          gym&apos;s link.
        </p>
      </div>
      <QrCodesDashboardClient />
    </div>
  )
}
