import { screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes } from '@/test-utils/renderScreen'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import type { MemberWithDiscount } from '../types'
import MemberDetailModal from '../components/MemberDetailModal'

/**
 * One component, two tiers (mobile rebuild plan §10).
 *
 * `MemberDetailModalMobile` and the `window.innerWidth` wrapper that chose it
 * are gone. What replaces them is a prop: `Modal placement`. These assert the
 * things the deleted fork got wrong and the things the merge could get wrong —
 * that the phone gets a screen and the desktop keeps its dialog, that the
 * phone now reaches the two features the fork never had, and that the sections
 * carry the order classes §10 step 5 specifies.
 *
 * **These do not prove the screen looks right.** jsdom computes no geometry,
 * so `order: -4` here is a string on an element and nothing more. The visual
 * order was measured separately in Chromium against the built stylesheet; the
 * numbers are in the rebuild log (§2.6). A class assertion is the most a unit
 * test can make of a layout rule, and saying so is the point.
 */

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

const MEMBER_ID = 'member-tier-1'

const member: MemberWithDiscount = {
  id: MEMBER_ID,
  gym_id: 'gym-1',
  member_number: 46,
  name: 'Fathima Herath',
  phone_number: '+94751230428',
  plan_type: 'monthly',
  plan_amount: 3500,
  discount_id: null,
  recurring_discount: false,
  status: MemberStatus.Active,
  registered_date: '2026-08-16',
  membership_start_date: '2026-08-16',
  next_due_date: '2026-09-16',
  created_at: '2026-08-16T00:00:00Z',
  updated_at: '2026-08-16T00:00:00Z',
  photo_path: null,
  photo_updated_at: null,
  registration_source: 'manual',
  verified_at: null,
  discount: null,
}

function renderDetail(
  viewport: 'phone' | 'desktop',
  overrides: Partial<MemberWithDiscount> = {}
) {
  mockFetchRoutes({
    '/api/settings/subscription': { data: { subscription: {} } },
    '/api/billing-setup/plans': { data: [] },
    [`/api/members/${MEMBER_ID}`]: { success: true },
  })
  return renderScreen(
    <MemberDetailModal
      open
      onClose={jest.fn()}
      member={{ ...member, ...overrides }}
      payments={[]}
      onEditClick={jest.fn()}
      accessSlot={<div data-testid="access-slot">Door access</div>}
    />,
    { viewport }
  )
}

/** The detail overlay itself, not one of its sub-dialogs. */
const detailDialog = () =>
  screen
    .getAllByRole('dialog')
    .find((d) => within(d).queryByText('Member Details'))!

afterEach(() => jest.clearAllMocks())

describe('MemberDetailModal — a screen on a phone, a dialog on a desktop', () => {
  it('is fullscreen on a phone', () => {
    renderDetail('phone')
    expect(detailDialog()).toHaveAttribute('data-placement', 'fullscreen')
  })

  it('is centred on a desktop — which is what keeps 1366 pixel-identical', () => {
    renderDetail('desktop')
    expect(detailDialog()).toHaveAttribute('data-placement', 'center')
  })

  it('offers Back on a phone instead of only a ×', () => {
    renderDetail('phone')
    const dialog = detailDialog()
    // Both header controls are in the DOM at both widths and one is
    // `display: none` (ruling M12) — so the assertion is that Back EXISTS,
    // which it does not on a `center` placement at all.
    expect(
      within(dialog).getByRole('button', { name: 'Back' })
    ).toBeInTheDocument()
    // Not `getByRole('button', {name: 'Close'})`: the footer's own Close
    // button answers to that too. The × is the one carrying the label.
    expect(dialog.querySelector('button[aria-label="Close"]')).not.toBeNull()
  })

  it('renders no Back control at all when it is a centred dialog', () => {
    renderDetail('desktop')
    expect(
      within(detailDialog()).queryByRole('button', { name: 'Back' })
    ).not.toBeInTheDocument()
  })
})

describe('MemberDetailModal — what the phone gains', () => {
  /**
   * The deleted fork recorded a payment on one tap, with no date and no
   * confirmation. Parity means the phone gets the same dialog the desktop has.
   */
  it('opens MarkPaidDialog rather than posting a payment straight away', async () => {
    renderDetail('phone')

    fireEvent.click(screen.getByRole('button', { name: 'Mark Paid' }))

    // Named by its heading, because "Confirm Payment" is also its button.
    expect(
      await screen.findByRole('heading', { name: 'Confirm Payment' })
    ).toBeInTheDocument()
    // The date choice is the whole reason the dialog exists.
    expect(screen.getByLabelText('Payment Date')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Confirm Payment' })
    ).toBeInTheDocument()
  })

  it('reaches SMS history through its existing toggle, collapsed by default', () => {
    renderDetail('phone')
    const dialog = within(detailDialog())

    // The fork had no SMS history at all. It is present and CLOSED: the query
    // behind it is `enabled: expanded`, so an open-by-default toggle would put
    // a request on every member the operator glances at.
    expect(
      dialog.getByRole('button', { name: 'View SMS History' })
    ).toBeInTheDocument()
    expect(
      dialog.queryByRole('button', { name: 'Hide SMS History' })
    ).not.toBeInTheDocument()
  })

  it('keeps payment history collapsed by default too', () => {
    renderDetail('phone')
    const dialog = within(detailDialog())
    expect(
      dialog.getByRole('button', { name: 'View Payment History' })
    ).toBeInTheDocument()
  })

  it('shows the same sections it shows on a desktop', () => {
    renderDetail('phone')
    const dialog = within(detailDialog())
    for (const text of [
      'Fathima Herath',
      'Membership Plan',
      'Status Actions',
      'Payment History',
      'SMS History',
    ]) {
      expect(dialog.getByText(text)).toBeInTheDocument()
    }
    expect(dialog.getByTestId('access-slot')).toBeInTheDocument()
  })
})

describe('MemberDetailModal — phone section order (§10 step 5)', () => {
  /**
   * The order is expressed as CSS, so this asserts the classes and the
   * arithmetic they encode — NOT the rendering. Negative values on purpose:
   * `accessSlot` is a bare slot with nothing of ours to put a class on, and
   * wrapping it would add a permanent empty child for every gym whose
   * `MemberAccessPanel` renders null. Leaving it at the default 0 and pulling
   * the four blocks above it negative puts it fifth with nothing added.
   *
   * One honest caveat: the photo's `-1` is INSURANCE, not load-bearing.
   * Measured in Chromium, removing it changes nothing — photo ties with the
   * access slot at 0 and its earlier DOM position wins the tie. It stays
   * because a future edit that moves the photo block would silently reorder
   * the screen otherwise, and the assertion below is literal so that edit
   * fails here rather than in someone's hand.
   *
   * The same measurement showed the real hazard, and it is the one the source
   * comment warns about: a NEW section added with no order class lands beside
   * the door-access slot — fifth or sixth — not at the end.
   */
  const expectedOrder: [string, number][] = [
    ['identity', -4],
    ['plan grid', -3],
    ['status actions', -2],
    ['photo', -1],
    ['door access', 0],
    ['payment history', 1],
    ['SMS history', 2],
  ]

  /**
   * The detail column. Read off the open dialog rather than RTL's `container`:
   * `Modal` is a Radix portal, so it mounts at `<body>` and the render root
   * holds nothing at all.
   */
  const columnOf = (dialog: HTMLElement) => {
    const column = dialog.querySelector('.phone\\:space-y-0')
    expect(column).not.toBeNull()
    return column as HTMLElement
  }
  const sectionsOf = (dialog: HTMLElement) =>
    [...columnOf(dialog).children] as HTMLElement[]

  /** Which section an element is, by the text only that section carries. */
  const nameOf = (el: HTMLElement) => {
    if (el.textContent?.includes('Fathima Herath')) return 'identity'
    if (el.textContent?.includes('Membership Plan')) return 'plan grid'
    if (el.textContent?.includes('Status Actions')) return 'status actions'
    if (el.textContent?.includes('Door access')) return 'door access'
    if (el.textContent?.includes('Payment History')) return 'payment history'
    if (el.textContent?.includes('SMS History')) return 'SMS history'
    return 'photo'
  }

  /** The order a `phone:`-prefixed class encodes; 0 when there is none. */
  const orderOf = (el: HTMLElement): number => {
    const hit = [...el.classList].find((c) => /^phone:-?order-\d+$/.test(c))
    if (!hit) return 0
    const value = Number(hit.replace(/^phone:-?order-/, ''))
    return hit.startsWith('phone:-') ? -value : value
  }

  it('gives every section the order the plan specifies', () => {
    renderDetail('phone')
    const byName = Object.fromEntries(
      sectionsOf(detailDialog()).map((el) => [nameOf(el), orderOf(el)])
    )

    // A map, not a list: the sections come back in DOM order and the plan
    // states a VISUAL order, so comparing the two sequences directly would be
    // a category error (it was, first time round).
    expect(byName).toEqual(Object.fromEntries(expectedOrder))
  })

  it('sorts those orders into identity → plan → status → photo → access → payments → SMS', () => {
    renderDetail('phone')
    const sections = sectionsOf(detailDialog())

    // Flexbox sorts by order, then by DOM position. Reproduced here so the
    // expected sequence is checked rather than assumed from the numbers.
    const sorted = sections
      .map((el, domIndex) => ({ el, domIndex, order: orderOf(el) }))
      .sort((a, b) => a.order - b.order || a.domIndex - b.domIndex)

    expect(sorted.map(({ el }) => nameOf(el))).toEqual(
      expectedOrder.map(([name]) => name)
    )
  })

  it('neutralises the desktop stacking margin on the phone column', () => {
    renderDetail('phone')
    const column = columnOf(detailDialog())
    // `space-y-6` puts its margin between DOM siblings, not visual ones. Left
    // alongside `order` it produces a gap above the visually-first block and
    // none above the fourth — measured at 48/48/24/48/48/48 in Chromium with
    // this class removed. The flex gap replaces it.
    expect(column.className).toContain('phone:gap-6')
    expect(column.className).toContain('phone:flex-col')
    // Desktop keeps the margin stack it has always had.
    expect(column.className).toContain('space-y-6')
  })

  it('leaves the DESKTOP reading order untouched', () => {
    renderDetail('desktop')
    // Same DOM, both tiers: `order` is presentational and a screen reader on a
    // desktop still walks photo → identity → plan → status → access → SMS →
    // payments, exactly as before the phase.
    const sections = sectionsOf(detailDialog())
    expect(sections).toHaveLength(7)
    expect(sections[0].textContent).not.toContain('Fathima Herath')
  })
})

describe('MemberDetailModal — the icon-only actions are named', () => {
  it.each(['Delete member', 'Edit member'])(
    '%s carries an explicit aria-label, not just a title',
    (name) => {
      renderDetail('phone')
      const button = within(detailDialog()).getByRole('button', { name })
      // `title` also produces an accessible name — it is the last fallback in
      // the algorithm — so asserting the NAME alone would have passed before
      // this phase. The requirement (§10 step 4) is the explicit label.
      expect(button).toHaveAttribute('aria-label', name)
    }
  )
})
