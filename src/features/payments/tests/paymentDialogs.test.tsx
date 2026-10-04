import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes } from '@/test-utils/renderScreen'
import { PlanType } from '@/features/members/config/PlanConfig'
import { calculateNextDueDate } from '@/features/members/utils/calculateNextDueDate'
import { formatDate } from '@/utils/date/date'
import MarkPaidDialog from '../components/MarkPaidDialog'
import ReactivationDialog from '../components/ReactivationDialog'

/**
 * The "Next due" line both payment dialogs show must be the date the server
 * will store. CollectPayment dates a payment from the later of the payment
 * date and the current due date, so an early payer keeps their due date
 * (owner decision, 2026-10-04). The dialogs used to preview from the payment
 * date alone, through a second date helper that also overflowed month ends.
 */

/** YYYY-MM-DD, `days` from today in UTC — the form the dialogs default to. */
function isoFromToday(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

function expectedPreview(base: string): string {
  return formatDate(calculateNextDueDate(new Date(base), PlanType.Monthly))
}

describe('MarkPaidDialog next-due preview', () => {
  function renderDialog(currentDueDate: string) {
    return renderScreen(
      <MarkPaidDialog
        open
        onOpenChange={() => {}}
        memberName="Fathima Herath"
        amount={3500}
        planType="monthly"
        currentDueDate={currentDueDate}
        onConfirm={() => {}}
      />
    )
  }

  it('extends an early payment from the current due date', () => {
    const due = isoFromToday(3)
    renderDialog(due)

    expect(
      screen.getByText(new RegExp(`will be due on ${expectedPreview(due)}`))
    ).toBeInTheDocument()
  })

  it('dates a late payment from the payment day', () => {
    renderDialog(isoFromToday(-5))

    expect(
      screen.getByText(
        new RegExp(`will be due on ${expectedPreview(isoFromToday(0))}`)
      )
    ).toBeInTheDocument()
  })
})

describe('ReactivationDialog next-due preview', () => {
  beforeEach(() => {
    global.fetch = mockFetchRoutes({ '/api/billing-setup/plans': [] })
  })

  it('keeps a due date that is still ahead', () => {
    // A member cancelled by hand while paid through: reactivating them must
    // not throw away the days they already paid for.
    const due = isoFromToday(10)
    renderScreen(
      <ReactivationDialog
        open
        onOpenChange={() => {}}
        memberName="Fathima Herath"
        currentPlanType="monthly"
        currentPlanAmount={3500}
        currentDueDate={due}
        onConfirm={() => {}}
      />
    )

    expect(
      screen.getByText(new RegExp(expectedPreview(due)))
    ).toBeInTheDocument()
  })
})
