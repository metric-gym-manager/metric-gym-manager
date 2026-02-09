export interface Member {
  id: string
  gymId: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  dateOfBirth?: Date
  gender?: string
  address?: {
    street?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  }
  photoUrl?: string
  status: 'active' | 'pending' | 'frozen' | 'expired' | 'cancelled'
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface EmergencyContact {
  id: string
  memberId: string
  name: string
  relationship: string
  phone: string
  email?: string
  isPrimary: boolean
  createdAt: Date
  updatedAt: Date
}

export interface MedicalWaiver {
  id: string
  memberId: string
  conditions?: string
  medications?: string
  allergies?: string
  signedAt: Date
  signatureData: string
  createdAt: Date
  updatedAt: Date
}
