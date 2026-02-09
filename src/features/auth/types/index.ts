export interface User {
  id: string
  gymId: string
  email: string
  firstName: string
  lastName: string
  role: 'gym_owner' | 'admin' | 'trainer' | 'front_desk'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AuthResponse {
  user: User
  tokens: {
    accessToken: string
    refreshToken: string
    accessTokenExpiresAt: Date
    refreshTokenExpiresAt: Date
  }
}
