export interface Payment {
  id: string
  gymId: string
  memberId: string
  membershipId?: string
  paymentMethodId?: string
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded'
  type: 'membership' | 'setup_fee' | 'class_pack' | 'drop_in' | 'other'
  description?: string
  mockProcessorId?: string
  mockData: Record<string, any>
  processedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface PaymentMethod {
  id: string
  memberId: string
  type: 'credit_card' | 'debit_card' | 'bank_account' | 'cash' | 'check'
  lastFour?: string
  brand?: string
  expiryMonth?: number
  expiryYear?: number
  isDefault: boolean
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}
