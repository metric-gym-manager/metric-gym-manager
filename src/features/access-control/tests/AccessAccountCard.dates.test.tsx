import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes } from '@/test-utils/renderScreen'
import { formatDateTime } from '@/utils/date/date'
import AccessAccountCard from '../components/AccessAccountCard'
import type { SerializedAccessAccount } from '../utils/serializeAccessForAPI'

/**
 * The door-hardware account card said when the connection last worked with a
 * bare `toLocaleString()`: `9/24/2026, 8:41:00 AM` in a US-locale browser,
 * month first, where every other date in the product reads `24 Sep 2026`.
 */
const LAST_VERIFIED = '2026-09-24T03:11:00.000Z'

const account = (verified: boolean): SerializedAccessAccount =>
  ({
    id: 'acct-1',
    baseUrl: 'https://vft.example.com',
    areaId: 1,
    isActive: true,
    verified,
    lastVerifiedAt: LAST_VERIFIED,
  }) as SerializedAccessAccount

function renderWith(verified: boolean) {
  mockFetchRoutes({
    '/api/access-control/account': { success: true, data: account(verified) },
  })
  return renderScreen(<AccessAccountCard />)
}

afterEach(() => jest.restoreAllMocks())

describe('AccessAccountCard — when the connection last worked', () => {
  it('dates a working connection in the product format', async () => {
    renderWith(true)

    expect(
      await screen.findByText(
        new RegExp(`Confirmed working ${formatDateTime(LAST_VERIFIED)}`)
      )
    ).toBeInTheDocument()
  })

  it('dates a stale connection in the product format', async () => {
    renderWith(false)

    expect(
      await screen.findByText(
        new RegExp(`It last worked on ${formatDateTime(LAST_VERIFIED)}\\.`)
      )
    ).toBeInTheDocument()
  })
})
