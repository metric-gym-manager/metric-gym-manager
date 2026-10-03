import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react'
import '@testing-library/jest-dom'
import { randomUUID } from 'node:crypto'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BulkAddMemberModal from '../components/BulkAddMemberModal'
import { BULK_REGISTER_MAX_ROWS } from '../schemas/member.schemas'

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}))

jest.mock('@/features/subscriptions/components/QuotaReachedUpsell', () => ({
  __esModule: true,
  default: () => null,
}))

/**
 * The bulk grid is the flow the register-book guide (SEO-063) sends gyms to,
 * and it had three defects nobody had seen because no test mounted it:
 *
 * - the server answers by position in the SUBMITTED batch, but results were
 *   applied by position in the whole grid — so an invalid row above valid
 *   ones shifted every later result onto the wrong member;
 * - "Retry N Failed" re-sent the rows that had already been registered, which
 *   then came back as "already exists";
 * - the grid let a gym add more rows than the server accepts in one batch.
 *
 * The real react-query client runs here (only `fetch` is mocked) because the
 * fix depends on the mutation handing `onSuccess` the rows it submitted.
 */

const PLAN_TYPES = [
  {
    id: 'plan-1',
    gym_id: 'gym-1',
    plan_type: 'monthly',
    default_amount: 4000,
    is_active: true,
  },
]

type BulkBody = {
  members: {
    name: string
    phoneNumber: string
    acceptedTerms?: boolean
    acceptedGymRules?: boolean
  }[]
}
type RowResult = { index: number; success: boolean; error?: string }

let bulkCalls: BulkBody[]
let respond: (body: BulkBody, call: number) => RowResult[]

const json = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response

beforeAll(() => {
  // jsdom has no layout; Add Row scrolls the new row into view.
  Element.prototype.scrollIntoView = jest.fn()
  // jsdom's crypto has no randomUUID; the grid keys rows with it.
  if (typeof globalThis.crypto.randomUUID !== 'function') {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      value: () => randomUUID(),
      configurable: true,
    })
  }
})

beforeEach(() => {
  bulkCalls = []
  respond = (body) => body.members.map((_, index) => ({ index, success: true }))
  globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/billing-setup/plans')
      return json({ success: true, data: PLAN_TYPES })
    if (url === '/api/billing-setup/discounts')
      return json({ success: true, data: [] })
    if (url === '/api/members/bulk') {
      const body = JSON.parse(String(init?.body)) as BulkBody
      bulkCalls.push(body)
      const results = respond(body, bulkCalls.length).map((r) => ({
        ...r,
        name: body.members[r.index].name,
      }))
      const failed = results.filter((r) => !r.success).length
      return json({
        success: true,
        data: {
          results,
          summary: {
            total: results.length,
            succeeded: results.length - failed,
            failed,
          },
        },
      })
    }
    throw new Error(`unexpected fetch ${url}`)
  }) as unknown as typeof fetch
})

function renderGrid() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <BulkAddMemberModal open onClose={jest.fn()} />
    </QueryClientProvider>
  )
}

/** Plans load asynchronously; rows take the first plan's price when they do. */
async function plansLoaded() {
  await waitFor(() =>
    expect(screen.getAllByDisplayValue('4000').length).toBeGreaterThan(0)
  )
}

const nameInputs = () => screen.getAllByPlaceholderText('Member name')
const phoneInputs = () => screen.getAllByPlaceholderText('0771234567')
const rowOf = (value: string) =>
  screen.getByDisplayValue(value).closest('tr') as HTMLElement
const addRow = () => screen.getByRole('button', { name: /Add Row/ })
const submit = () =>
  fireEvent.click(
    screen.getByRole('button', { name: /^Register All|^Retry \d+ Failed/ })
  )

/** Tick the batch's two consents — without them nothing can be registered. */
function giveConsent() {
  fireEvent.click(screen.getByLabelText(/accepts Metric Gym OS/))
  fireEvent.click(screen.getByLabelText(/agrees to the gym/))
}

function fillRow(i: number, name: string, phone?: string) {
  fireEvent.change(nameInputs()[i], { target: { value: name } })
  if (phone !== undefined)
    fireEvent.change(phoneInputs()[i], { target: { value: phone } })
}

describe('BulkAddMemberModal', () => {
  it('marks each result on the row that was submitted', async () => {
    renderGrid()
    await plansLoaded()
    fillRow(0, 'Nimal Perera', '0771234567')
    fillRow(1, 'Kasun Silva') // no number: invalid, so it is not submitted
    fillRow(2, 'Amali Fernando', '0712345678')

    giveConsent()
    submit()

    await waitFor(() => expect(bulkCalls).toHaveLength(1))
    expect(bulkCalls[0].members.map((m) => m.name)).toEqual([
      'Nimal Perera',
      'Amali Fernando',
    ])
    await waitFor(() =>
      expect(within(rowOf('Amali Fernando')).getByText('Done')).toBeVisible()
    )
    expect(within(rowOf('Nimal Perera')).getByText('Done')).toBeVisible()
    // The skipped row must not inherit the next member's result.
    expect(within(rowOf('Kasun Silva')).queryByText('Done')).toBeNull()
  })

  it('retries only the rows that failed', async () => {
    respond = (body, call) =>
      body.members.map((m, index) =>
        call === 1 && m.name === 'Amali Fernando'
          ? {
              index,
              success: false,
              error: 'A member with phone number 0712345678 already exists',
            }
          : { index, success: true }
      )
    renderGrid()
    await plansLoaded()
    fillRow(0, 'Nimal Perera', '0771234567')
    fillRow(1, 'Amali Fernando', '0712345678')

    giveConsent()
    submit()
    await waitFor(() =>
      expect(within(rowOf('Amali Fernando')).getByText('Error')).toBeVisible()
    )

    // Fix the failed row and retry: the registered member must not be re-sent.
    fireEvent.change(
      within(rowOf('Amali Fernando')).getByPlaceholderText('0771234567'),
      { target: { value: '0719999999' } }
    )
    submit()

    await waitFor(() => expect(bulkCalls).toHaveLength(2))
    expect(bulkCalls[1].members.map((m) => m.name)).toEqual(['Amali Fernando'])
    await waitFor(() =>
      expect(within(rowOf('Amali Fernando')).getByText('Done')).toBeVisible()
    )
    expect(within(rowOf('Nimal Perera')).getByText('Done')).toBeVisible()
  })

  it('stops adding rows at the batch size the server accepts', async () => {
    renderGrid()
    await plansLoaded()

    while (nameInputs().length < BULK_REGISTER_MAX_ROWS)
      fireEvent.click(addRow())

    expect(addRow()).toBeDisabled()
    fireEvent.click(addRow())
    expect(nameInputs()).toHaveLength(BULK_REGISTER_MAX_ROWS)
    expect(
      screen.getByText(new RegExp(`${BULK_REGISTER_MAX_ROWS} rows per batch`))
    ).toBeVisible()
  })

  it('counts only rows not yet registered against the batch size', async () => {
    renderGrid()
    await plansLoaded()
    fillRow(0, 'Nimal Perera', '0771234567')
    fillRow(1, 'Amali Fernando', '0712345678')
    giveConsent()
    submit()
    await waitFor(() =>
      expect(within(rowOf('Amali Fernando')).getByText('Done')).toBeVisible()
    )

    // Two rows are registered; a full new batch still fits beside them.
    // Bounded, so a grid with no cap fails here instead of looping forever.
    for (let i = 0; i < 3 * BULK_REGISTER_MAX_ROWS; i++) {
      if (addRow().hasAttribute('disabled')) break
      fireEvent.click(addRow())
    }

    expect(nameInputs()).toHaveLength(BULK_REGISTER_MAX_ROWS + 2)
  })

  it('registers nothing until both consents are given, then sends them with every row', async () => {
    // addMemberSchema requires both consents; the grid once sent neither, and
    // the route refused every bulk registration from July to October 2026.
    renderGrid()
    await plansLoaded()
    fillRow(0, 'Nimal Perera', '0771234567')
    const register = () => screen.getByRole('button', { name: /Register All/ })

    expect(register()).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/accepts Metric Gym OS/))
    expect(register()).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/agrees to the gym/))
    expect(register()).toBeEnabled()

    submit()
    await waitFor(() => expect(bulkCalls).toHaveLength(1))
    expect(bulkCalls[0].members[0]).toMatchObject({
      acceptedTerms: true,
      acceptedGymRules: true,
    })
  })
})
