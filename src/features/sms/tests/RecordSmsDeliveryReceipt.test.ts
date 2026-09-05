import type { ISMSRepository } from '../services/ISMSRepository'
import { RecordSmsDeliveryReceipt } from '../services/RecordSmsDeliveryReceipt'
import { SmsDeliveryStatus } from '../config/SmsConfig'

function makeRepo(rowsAffected = 1) {
  const updateDeliveryStatus = jest.fn(async () => rowsAffected)
  const repo = { updateDeliveryStatus } as unknown as ISMSRepository
  return { repo, updateDeliveryStatus }
}

describe('RecordSmsDeliveryReceipt', () => {
  /**
   * The vendor's vocabulary is the contract. Getting one of these wrong writes
   * a false fact about a real message to a real customer — "delivered" over a
   * message the carrier rejected — so each is pinned individually rather than
   * spot-checked.
   */
  it.each([
    ['DELIVERED', SmsDeliveryStatus.Delivered],
    ['SENT', SmsDeliveryStatus.Sent],
    ['PENDING', SmsDeliveryStatus.Pending],
    ['FAILED', SmsDeliveryStatus.Failed],
    ['EXPIRED', SmsDeliveryStatus.Failed],
    ['REJECTED', SmsDeliveryStatus.Failed],
  ])('maps %s to %s', async (vendorStatus, expected) => {
    const { repo, updateDeliveryStatus } = makeRepo()
    const result = await new RecordSmsDeliveryReceipt(repo).execute({
      messageId: 'vendor-1',
      vendorStatus,
    })

    expect(result).toEqual({ outcome: 'recorded', status: expected })
    expect(updateDeliveryStatus).toHaveBeenCalledWith('vendor-1', expected)
  })

  /**
   * PENDING is its own state, not a synonym for SENT.
   *
   * The route this replaces ended its switch with
   * `case 'SENT': case 'PENDING': default: → 'sent'`, so a message merely queued
   * at the vendor was recorded as dispatched to the handset. `pending` was added
   * to the database enum for exactly this distinction.
   */
  it('does not collapse PENDING onto SENT', async () => {
    const { repo } = makeRepo()
    const pending = await new RecordSmsDeliveryReceipt(repo).execute({
      messageId: 'v1',
      vendorStatus: 'PENDING',
    })
    const sent = await new RecordSmsDeliveryReceipt(repo).execute({
      messageId: 'v2',
      vendorStatus: 'SENT',
    })
    expect(pending).not.toEqual(sent)
  })

  it('accepts the vendor status case-insensitively', async () => {
    const { repo, updateDeliveryStatus } = makeRepo()
    await new RecordSmsDeliveryReceipt(repo).execute({
      messageId: 'v1',
      vendorStatus: 'delivered',
    })
    expect(updateDeliveryStatus).toHaveBeenCalledWith(
      'v1',
      SmsDeliveryStatus.Delivered
    )
  })

  /**
   * The old `default:` arm recorded anything unrecognised as a successful
   * dispatch — so a status text.lk added later, or a typo, would have been
   * written as fact. A status we do not understand is evidence of nothing.
   */
  it('writes nothing for a status it does not recognise', async () => {
    const { repo, updateDeliveryStatus } = makeRepo()
    const result = await new RecordSmsDeliveryReceipt(repo).execute({
      messageId: 'v1',
      vendorStatus: 'QUANTUM_SUPERPOSITION',
    })

    expect(result).toEqual({
      outcome: 'unknown_status',
      vendorStatus: 'QUANTUM_SUPERPOSITION',
    })
    expect(updateDeliveryStatus).not.toHaveBeenCalled()
  })

  /**
   * The finding that motivated the whole rewrite: an update that changes nothing
   * must not be reported as one that did.
   */
  it('reports a no-op rather than claiming success', async () => {
    const { repo } = makeRepo(0)
    const result = await new RecordSmsDeliveryReceipt(repo).execute({
      messageId: 'unknown-id',
      vendorStatus: 'DELIVERED',
    })

    expect(result).toEqual({
      outcome: 'no_matching_row',
      messageId: 'unknown-id',
    })
  })

  it('lets a repository failure surface', async () => {
    const repo = {
      updateDeliveryStatus: jest.fn(async () => {
        throw new Error('connection reset')
      }),
    } as unknown as ISMSRepository

    await expect(
      new RecordSmsDeliveryReceipt(repo).execute({
        messageId: 'v1',
        vendorStatus: 'DELIVERED',
      })
    ).rejects.toThrow('connection reset')
  })
})
