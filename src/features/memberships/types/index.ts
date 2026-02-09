export interface MembershipPlan {
  id: string
  gymId: string
  name: string
  description?: string
  planType: 'drop_in' | 'class_pack' | 'monthly' | 'annual' | 'custom'
  priceAmount: number
  billingFrequency: 'one_time' | 'monthly' | 'annual'
  trialDays: number
  accessLevel: string
  classCredits?: number
  contractLengthMonths?: number
  setupFee: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface MemberMembership {
  id: string
  memberId: string
  planId: string
  status: 'active' | 'pending' | 'cancelled' | 'expired'
  startDate: Date
  endDate?: Date
  nextBillingDate?: Date
  autoRenew: boolean
  createdAt: Date
  updatedAt: Date
}
