# Authentication System Re-Implementation Guide

**Command-style documentation for implementing multi-provider authentication in Next.js + Supabase projects**

---

## Table of Contents

1. [Google OAuth](#1-google-oauth)
2. [Phone/SMS Authentication](#2-phonesms-authentication)
3. [Mobile Number Verification](#3-mobile-number-verification)
4. [Email Confirmation](#4-email-confirmation)
5. [Forgot Password](#5-forgot-password)
6. [Database Schema](#6-database-schema)
7. [Middleware & Security](#7-middleware--security)
8. [Testing Checklist](#8-testing-checklist)

---

## 1. GOOGLE OAUTH

### Prerequisites
```bash
# Install dependencies
npm install @react-oauth/google google-auth-library
```

### Step 1: Configure Google Cloud Console

**Commands:**
1. Navigate to https://console.cloud.google.com
2. Create project or select existing
3. Enable Google+ API
4. Navigate to: APIs & Services → Credentials
5. Create OAuth 2.0 Client ID
6. Add authorized JavaScript origins:
   - `http://localhost:3000` (development)
   - `https://yourdomain.com` (production)
7. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback`
   - `https://yourdomain.com/api/auth/callback`
8. Copy Client ID and Client Secret

**Environment Variables:**
```bash
# Add to .env.local
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

### Step 2: Configure Supabase Auth

**Supabase Dashboard:**
1. Navigate to: Authentication → Providers → Google
2. Enable Google provider
3. Paste Client ID and Client Secret
4. Add redirect URL: `https://your-project.supabase.co/auth/v1/callback`
5. Save configuration

### Step 3: Create Google One Tap Provider Component

**File:** `app/components/auth/GoogleOneTapProvider.tsx`

```typescript
'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface GoogleOneTapProviderProps {
  children: React.ReactNode
}

export default function GoogleOneTapProvider({ children }: GoogleOneTapProviderProps) {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Load Google Identity Services script
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    document.body.appendChild(script)

    script.onload = () => {
      if (typeof window.google !== 'undefined') {
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        })

        // Check if user is already logged in
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) {
            window.google.accounts.id.prompt()
          }
        })
      }
    }

    return () => {
      script.remove()
    }
  }, [])

  const handleCredentialResponse = async (response: any) => {
    try {
      const res = await fetch('/api/auth/google-one-tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      })

      const data = await res.json()

      if (data.success) {
        router.refresh()
        router.push('/profile')
      }
    } catch (error) {
      console.error('One Tap error:', error)
    }
  }

  return <>{children}</>
}
```

### Step 4: Create Google One Tap API Route

**File:** `app/api/auth/google-one-tap/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { OAuth2Client } from 'google-auth-library'

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

export async function POST(request: NextRequest) {
  try {
    const { credential } = await request.json()

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    // Sign in with Supabase
    const supabase = createRouteHandlerClient({ cookies })
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: credential,
    })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }

    // Create/update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: data.user.id,
        email: data.user.email,
        name: payload.name,
        avatar_url: payload.picture,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
    }

    return NextResponse.json({ success: true, user: data.user })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
```

### Step 5: Create Google Sign-In Button Component

**File:** `app/components/auth/GoogleSignInButton.tsx`

```typescript
'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function GoogleSignInButton() {
  const supabase = createClientComponentClient()

  const handleGoogleSignIn = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?redirectTo=/profile`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      console.error('Google sign-in error:', error)
    }
  }

  return (
    <button
      onClick={handleGoogleSignIn}
      className="flex items-center justify-center gap-3 w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="currentColor"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="currentColor"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="currentColor"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      Continue with Google
    </button>
  )
}
```

### Step 6: Create OAuth Callback Handler

**File:** `app/api/auth/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/profile'

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${requestUrl.origin}${redirectTo}`)
}
```

### Step 7: Add Provider to Root Layout

**File:** `app/layout.tsx`

```typescript
import GoogleOneTapProvider from './components/auth/GoogleOneTapProvider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GoogleOneTapProvider>
          {children}
        </GoogleOneTapProvider>
      </body>
    </html>
  )
}
```

---

## 2. PHONE/SMS AUTHENTICATION

### Prerequisites
```bash
# Choose SMS provider (examples):
# - Twilio: npm install twilio
# - Text.lk: HTTP API (no package needed)
# - AWS SNS: npm install @aws-sdk/client-sns
```

### Step 1: Create Database Table for OTP Storage

**SQL Migration:**
```sql
-- Create phone_verifications table
CREATE TABLE phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  verified BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for performance
CREATE INDEX idx_phone_verifications_phone ON phone_verifications(phone_number);
CREATE INDEX idx_phone_verifications_expires ON phone_verifications(expires_at);
CREATE INDEX idx_phone_verifications_user ON phone_verifications(user_id);

-- Enable RLS
ALTER TABLE phone_verifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can insert own verifications"
  ON phone_verifications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view own verifications"
  ON phone_verifications
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);
```

**Apply Migration:**
```bash
# Using Supabase CLI
supabase db push

# Or via Supabase dashboard: SQL Editor → paste migration → Run
```

### Step 2: Configure SMS Provider

**For Text.lk:**
```bash
# Add to .env.local
TEXTLK_API_KEY=your-api-key
TEXTLK_SENDER_ID=YOURAPP
```

**For Twilio:**
```bash
# Add to .env.local
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

### Step 3: Create SMS Service

**File:** `lib/services/sms.ts`

```typescript
// Text.lk implementation
export async function sendSMS(phoneNumber: string, message: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.text.lk/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TEXTLK_API_KEY}`,
      },
      body: JSON.stringify({
        recipient: phoneNumber,
        sender_id: process.env.TEXTLK_SENDER_ID,
        message: message,
      }),
    })

    return response.ok
  } catch (error) {
    console.error('SMS send error:', error)

    // In development, log OTP instead of sending
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] OTP for ${phoneNumber}: ${message}`)
      return true
    }

    return false
  }
}

// Twilio implementation (alternative)
import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function sendSMSTwilio(phoneNumber: string, message: string): Promise<boolean> {
  try {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    })
    return true
  } catch (error) {
    console.error('Twilio SMS error:', error)
    return false
  }
}
```

### Step 4: Create Phone Validation Utility

**File:** `lib/utils/phone.ts`

```typescript
/**
 * Normalize phone number to canonical format
 * Input: 0771234567, 771234567, +94771234567
 * Output: 94771234567
 */
export function normalizePhoneNumber(phone: string, countryCode: string = '94'): string {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '')

  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '')

  // Remove country code if already present
  if (cleaned.startsWith(countryCode)) {
    cleaned = cleaned.substring(countryCode.length)
  }

  // Add country code
  return `${countryCode}${cleaned}`
}

/**
 * Validate Sri Lankan phone number
 */
export function isValidSriLankanPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone)

  // Should be 11 digits: 94 + 9 digits
  if (normalized.length !== 11) return false

  // Must start with 94
  if (!normalized.startsWith('94')) return false

  // Valid prefixes: 70-78 (mobile)
  const prefix = normalized.substring(2, 4)
  const validPrefixes = ['70', '71', '72', '74', '75', '76', '77', '78']

  return validPrefixes.includes(prefix)
}

/**
 * Format phone for display
 * Input: 94771234567
 * Output: (077) 123-4567
 */
export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhoneNumber(phone)

  if (normalized.length !== 11) return phone

  const areaCode = normalized.substring(2, 4)
  const firstPart = normalized.substring(4, 7)
  const secondPart = normalized.substring(7, 11)

  return `(0${areaCode}) ${firstPart}-${secondPart}`
}
```

### Step 5: Create OTP Generation Utility

**File:** `lib/utils/otp.ts`

```typescript
/**
 * Generate random 6-digit OTP
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Calculate OTP expiration time
 */
export function getOTPExpiration(minutes: number = 10): Date {
  const expiration = new Date()
  expiration.setMinutes(expiration.getMinutes() + minutes)
  return expiration
}

/**
 * Check if OTP is expired
 */
export function isOTPExpired(expiresAt: Date): boolean {
  return new Date() > new Date(expiresAt)
}
```

### Step 6: Create Send OTP API Route

**File:** `app/api/auth/send-phone-otp/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { normalizePhoneNumber, isValidSriLankanPhone } from '@/lib/utils/phone'
import { generateOTP, getOTPExpiration } from '@/lib/utils/otp'
import { sendSMS } from '@/lib/services/sms'

export async function POST(request: NextRequest) {
  try {
    const { phone, name, flow } = await request.json()

    // Validate phone number
    if (!isValidSriLankanPhone(phone)) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    const normalizedPhone = normalizePhoneNumber(phone)
    const supabase = createRouteHandlerClient({ cookies })

    // Rate limiting: check recent OTP requests
    const oneHourAgo = new Date()
    oneHourAgo.setHours(oneHourAgo.getHours() - 1)

    const { data: recentOTPs } = await supabase
      .from('phone_verifications')
      .select('id')
      .eq('phone_number', normalizedPhone)
      .gte('created_at', oneHourAgo.toISOString())

    if (recentOTPs && recentOTPs.length >= 3) {
      return NextResponse.json(
        { success: false, error: 'Too many OTP requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Generate OTP
    const otpCode = generateOTP()
    const expiresAt = getOTPExpiration(10) // 10 minutes

    // Store OTP in database
    const { error: insertError } = await supabase
      .from('phone_verifications')
      .insert({
        phone_number: normalizedPhone,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        verified: false,
        attempts: 0,
      })

    if (insertError) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate OTP' },
        { status: 500 }
      )
    }

    // Send SMS
    const message = `Your verification code is: ${otpCode}. Valid for 10 minutes.`
    const smsSent = await sendSMS(normalizedPhone, message)

    if (!smsSent && process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { success: false, error: 'Failed to send SMS' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
      expiresIn: 600, // seconds
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

### Step 7: Create Verify OTP API Route

**File:** `app/api/auth/verify-phone-otp/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { normalizePhoneNumber } from '@/lib/utils/phone'
import { isOTPExpired } from '@/lib/utils/otp'

export async function POST(request: NextRequest) {
  try {
    const { phone, otpCode, purpose } = await request.json()

    const normalizedPhone = normalizePhoneNumber(phone)
    const supabase = createRouteHandlerClient({ cookies })

    // Find OTP record
    const { data: verification, error: fetchError } = await supabase
      .from('phone_verifications')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .eq('otp_code', otpCode)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchError || !verification) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired OTP code' },
        { status: 400 }
      )
    }

    // Check expiration
    if (isOTPExpired(verification.expires_at)) {
      return NextResponse.json(
        { success: false, error: 'OTP code has expired' },
        { status: 400 }
      )
    }

    // Check attempts
    if (verification.attempts >= 3) {
      return NextResponse.json(
        { success: false, error: 'Too many verification attempts' },
        { status: 400 }
      )
    }

    // Increment attempts
    const { error: updateError } = await supabase
      .from('phone_verifications')
      .update({
        attempts: verification.attempts + 1,
        verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('id', verification.id)

    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'Verification failed' },
        { status: 500 }
      )
    }

    // If this is a profile update, update the profile
    if (purpose === 'profile') {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Not authenticated' },
          { status: 401 }
        )
      }

      await supabase
        .from('profiles')
        .update({
          phone: normalizedPhone,
          phone_verified: true,
          temp_phone: null,
          temp_phone_otp_sent_at: null,
        })
        .eq('id', user.id)
    }

    return NextResponse.json({
      success: true,
      verified: true,
      message: 'Phone number verified successfully',
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

### Step 8: Create Phone Auth UI Components

**File:** `app/components/auth/PhoneAuthForm.tsx`

```typescript
'use client'

import { useState } from 'react'
import OTPVerification from './OTPVerification'

export default function PhoneAuthForm() {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Basic validation
      const cleanPhone = phone.replace(/\D/g, '')
      if (cleanPhone.length < 9 || cleanPhone.length > 10) {
        setError('Please enter a valid phone number')
        setLoading(false)
        return
      }

      const response = await fetch('/api/auth/send-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, flow: 'register' }),
      })

      const data = await response.json()

      if (data.success) {
        setOtpSent(true)
      } else {
        setError(data.error || 'Failed to send OTP')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (otpSent) {
    return <OTPVerification phone={phone} name={name} />
  }

  return (
    <form onSubmit={handleSendOTP} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Name
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
          Phone Number
        </label>
        <div className="mt-1 flex">
          <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 bg-gray-50 text-gray-500 rounded-l-md">
            +94
          </span>
          <input
            type="tel"
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="771234567"
            className="flex-1 block w-full px-3 py-2 border border-gray-300 rounded-r-md"
            required
          />
        </div>
      </div>

      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Send Verification Code'}
      </button>
    </form>
  )
}
```

**File:** `app/components/auth/OTPVerification.tsx`

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface OTPVerificationProps {
  phone: string
  name?: string
}

export default function OTPVerification({ phone, name }: OTPVerificationProps) {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCountdown, setResendCountdown] = useState(60)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const router = useRouter()

  useEffect(() => {
    // Countdown timer
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCountdown])

  useEffect(() => {
    // Auto-focus first input
    inputRefs.current[0]?.focus()
  }, [])

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value

    setOtp(newOtp)

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when complete
    if (newOtp.every(digit => digit !== '') && index === 5) {
      handleVerify(newOtp.join(''))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text')
    const digits = pastedData.replace(/\D/g, '').slice(0, 6).split('')

    const newOtp = [...otp]
    digits.forEach((digit, index) => {
      newOtp[index] = digit
    })

    setOtp(newOtp)

    if (digits.length === 6) {
      handleVerify(newOtp.join(''))
    }
  }

  const handleVerify = async (otpCode: string) => {
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/verify-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          otpCode,
          purpose: 'register',
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Create account
        const createResponse = await fetch('/api/auth/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: phone,
            username: name,
          }),
        })

        const createData = await createResponse.json()

        if (createData.success) {
          router.push('/profile')
        } else {
          setError(createData.error || 'Failed to create account')
        }
      } else {
        setError(data.error || 'Invalid verification code')
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendCountdown(60)
    // Call send OTP API again
    await fetch('/api/auth/send-phone-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, name, flow: 'register' }),
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-600 mb-4">
          Enter the 6-digit code sent to {phone}
        </p>

        <div className="flex gap-2 justify-center" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-12 text-center text-2xl border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="text-red-600 text-sm text-center">{error}</div>
      )}

      <div className="text-center">
        {resendCountdown > 0 ? (
          <p className="text-sm text-gray-500">
            Resend code in {resendCountdown}s
          </p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Resend Code
          </button>
        )}
      </div>
    </div>
  )
}
```

### Step 9: Create Account Creation API Route

**File:** `app/api/auth/create-account/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePhoneNumber } from '@/lib/utils/phone'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, username } = await request.json()

    const normalizedPhone = normalizePhoneNumber(phoneNumber)

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      phone: normalizedPhone,
      phone_confirmed: true,
      user_metadata: {
        phone: phoneNumber,
        username,
      },
    })

    if (authError) {
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: 400 }
      )
    }

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        phone: normalizedPhone,
        phone_verified: true,
        name: username,
      })

    if (profileError) {
      return NextResponse.json(
        { success: false, error: 'Failed to create profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      user: authData.user,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

---

## 3. MOBILE NUMBER VERIFICATION

### Implementation (Reuses Phone Auth System)

**For Profile Phone Updates:**

**File:** `app/profile/components/PhoneUpdateForm.tsx`

```typescript
'use client'

import { useState } from 'react'
import OTPVerification from '@/app/components/auth/OTPVerification'

export default function PhoneUpdateForm() {
  const [phone, setPhone] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/send-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, flow: 'profile' }),
      })

      const data = await response.json()

      if (data.success) {
        setOtpSent(true)
      } else {
        setError(data.error || 'Failed to send OTP')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleVerificationComplete = () => {
    // Refresh profile data
    window.location.reload()
  }

  if (otpSent) {
    return (
      <OTPVerification
        phone={phone}
        purpose="profile"
        onComplete={handleVerificationComplete}
      />
    )
  }

  return (
    <form onSubmit={handleSendOTP} className="space-y-4">
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
          New Phone Number
        </label>
        <div className="mt-1 flex">
          <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 bg-gray-50 text-gray-500 rounded-l-md">
            +94
          </span>
          <input
            type="tel"
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="771234567"
            className="flex-1 block w-full px-3 py-2 border border-gray-300 rounded-r-md"
            required
          />
        </div>
      </div>

      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Verify Phone Number'}
      </button>
    </form>
  )
}
```

**Update profiles table:**
```sql
ALTER TABLE profiles ADD COLUMN temp_phone VARCHAR(20);
ALTER TABLE profiles ADD COLUMN temp_phone_otp_sent_at TIMESTAMP WITH TIME ZONE;
```

---

## 4. EMAIL CONFIRMATION

### Step 1: Configure Supabase Email Settings

**Supabase Dashboard:**
1. Navigate to: Authentication → Email Templates
2. Customize "Confirm signup" template:
   - Subject: "Confirm your email address"
   - Body: Include {{ .ConfirmationURL }} link
3. Navigate to: Authentication → URL Configuration
4. Set site URL: `https://yourdomain.com`
5. Add redirect URLs:
   - `http://localhost:3000/api/auth/callback`
   - `https://yourdomain.com/api/auth/callback`

### Step 2: Create Email Auth UI Components

**File:** `app/components/auth/EmailAuthForm.tsx`

```typescript
'use client'

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import EmailVerificationSent from './EmailVerificationSent'

type Mode = 'login' | 'register'

export default function EmailAuthForm() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [verificationSent, setVerificationSent] = useState(false)

  const supabase = createClientComponentClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (!data.user.email_confirmed_at) {
        setError('Please verify your email before logging in')
      } else {
        window.location.href = '/profile'
      }
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Validation
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        setLoading(false)
        return
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters')
        setLoading(false)
        return
      }

      // Check if email exists
      const checkResponse = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const checkData = await checkResponse.json()

      if (checkData.exists) {
        setError('Email already registered')
        setLoading(false)
        return
      }

      // Sign up
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })

      if (error) throw error

      setVerificationSent(true)
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (verificationSent) {
    return <EmailVerificationSent email={email} />
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`flex-1 py-2 px-4 rounded-md ${
            mode === 'login'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => setMode('register')}
          className={`flex-1 py-2 px-4 rounded-md ${
            mode === 'register'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          Register
        </button>
      </div>

      <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
        {mode === 'register' && (
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            required
          />
        </div>

        {mode === 'register' && (
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : mode === 'login' ? 'Login' : 'Create Account'}
        </button>

        {mode === 'login' && (
          <div className="text-center">
            <a href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700">
              Forgot password?
            </a>
          </div>
        )}
      </form>
    </div>
  )
}
```

**File:** `app/components/auth/EmailVerificationSent.tsx`

```typescript
'use client'

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface EmailVerificationSentProps {
  email: string
}

export default function EmailVerificationSent({ email }: EmailVerificationSentProps) {
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const supabase = createClientComponentClient()

  const handleResend = async () => {
    setResending(true)

    try {
      await supabase.auth.resend({
        type: 'signup',
        email,
      })

      setResent(true)
      setTimeout(() => setResent(false), 3000)
    } catch (error) {
      console.error('Resend error:', error)
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-gray-900">Check Your Email</h2>

      <p className="text-gray-600">
        We've sent a verification link to:
        <br />
        <span className="font-medium">{email}</span>
      </p>

      <p className="text-sm text-gray-500">
        Click the link in the email to verify your account.
        The link will expire in 1 hour.
      </p>

      {resent && (
        <div className="text-green-600 text-sm">
          Verification email resent!
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          onClick={handleResend}
          disabled={resending}
          className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
        >
          {resending ? 'Sending...' : 'Resend Email'}
        </button>

        <a href="/" className="text-sm text-gray-600 hover:text-gray-700">
          Back to Home
        </a>
      </div>
    </div>
  )
}
```

### Step 3: Create Email Check API Route

**File:** `app/api/auth/check-email/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    const { data, error } = await supabaseAdmin.auth.admin.listUsers()

    if (error) {
      return NextResponse.json(
        { exists: false, error: error.message },
        { status: 500 }
      )
    }

    const exists = data.users.some(user => user.email === email)

    return NextResponse.json({ exists })
  } catch (error: any) {
    return NextResponse.json(
      { exists: false, error: error.message },
      { status: 500 }
    )
  }
}
```

### Step 4: Update Callback Handler for Email Verification

**File:** `app/api/auth/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/profile'

  const supabase = createRouteHandlerClient({ cookies })

  if (code) {
    // OAuth code exchange
    await supabase.auth.exchangeCodeForSession(code)
  } else if (token_hash && type === 'email') {
    // Email verification
    const { data, error } = await supabase.auth.verifyOtp({
      type: 'email',
      token_hash,
    })

    if (!error && data.user) {
      // Update profile email_verified flag
      await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: data.user.email,
          email_verified: true,
        })

      // Check if profile is complete
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, phone')
        .eq('id', data.user.id)
        .single()

      if (!profile?.name || !profile?.phone) {
        return NextResponse.redirect(`${requestUrl.origin}/profile/setup`)
      }
    }
  } else if (token_hash && type === 'recovery') {
    // Password recovery
    return NextResponse.redirect(`${requestUrl.origin}/account/update-password?token_hash=${token_hash}`)
  }

  return NextResponse.redirect(`${requestUrl.origin}${redirectTo}`)
}
```

---

## 5. FORGOT PASSWORD

### Step 1: Create Forgot Password Page

**File:** `app/forgot-password/page.tsx`

```typescript
'use client'

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClientComponentClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/api/auth/callback?type=recovery`,
      })

      if (error) throw error

      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900">Check Your Email</h2>

          <p className="text-gray-600">
            We've sent password reset instructions to:
            <br />
            <span className="font-medium">{email}</span>
          </p>

          <p className="text-sm text-gray-500">
            The link will expire in 1 hour.
          </p>

          <a
            href="/"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Back to Home
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Forgot Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your email to receive reset instructions
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>

          <div className="text-center">
            <a href="/" className="text-sm text-gray-600 hover:text-gray-700">
              Back to Login
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
```

### Step 2: Create Update Password Page

**File:** `app/account/update-password/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(3)
  const [success, setSuccess] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClientComponentClient()

  useEffect(() => {
    if (success && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (success && countdown === 0) {
      router.push('/')
    }
  }, [success, countdown, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) throw error

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900">Password Updated!</h2>

          <p className="text-gray-600">
            Your password has been successfully updated.
          </p>

          <p className="text-sm text-gray-500">
            Redirecting to login in {countdown} seconds...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Update Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your new password
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              New Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

### Step 3: Configure Email Templates in Supabase

**Supabase Dashboard:**
1. Navigate to: Authentication → Email Templates
2. Select "Reset Password" template
3. Customize:
   - Subject: "Reset your password"
   - Body: Include {{ .ConfirmationURL }} link
4. Save template

---

## 6. DATABASE SCHEMA

### Complete Schema Setup

```sql
-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  phone VARCHAR(20),
  phone_verified BOOLEAN DEFAULT false,
  name VARCHAR(255),
  username VARCHAR(50) UNIQUE,
  avatar_url TEXT,
  temp_phone VARCHAR(20),
  temp_phone_otp_sent_at TIMESTAMP WITH TIME ZONE,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_phone ON profiles(phone);
CREATE INDEX idx_profiles_username ON profiles(username);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- PHONE VERIFICATIONS TABLE
-- ============================================
CREATE TABLE phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  verified BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_phone_verifications_phone ON phone_verifications(phone_number);
CREATE INDEX idx_phone_verifications_expires ON phone_verifications(expires_at);
CREATE INDEX idx_phone_verifications_user ON phone_verifications(user_id);

-- RLS Policies
ALTER TABLE phone_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert verifications"
  ON phone_verifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view own verifications"
  ON phone_verifications FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own verifications"
  ON phone_verifications FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- ============================================
-- CLEANUP FUNCTIONS
-- ============================================

-- Function to clean up expired OTPs
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM phone_verifications
  WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (if using pg_cron extension)
-- SELECT cron.schedule('cleanup-expired-otps', '0 0 * * *', 'SELECT cleanup_expired_otps()');

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Apply Schema:**
```bash
# Save as migration file
echo "Your SQL here" > supabase/migrations/20240101000000_auth_schema.sql

# Apply migration
supabase db push
```

---

## 7. MIDDLEWARE & SECURITY

### Step 1: Create Authentication Middleware

**File:** `middleware.ts`

```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Protected routes that require authentication
const protectedRoutes = [
  '/profile',
  '/post',
  '/wanted/post',
  '/messages',
  '/admin',
]

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Check session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Check if current route is protected
  const isProtectedRoute = protectedRoutes.some(route =>
    req.nextUrl.pathname.startsWith(route)
  )

  // Redirect to home if trying to access protected route without session
  if (isProtectedRoute && !session) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/'
    redirectUrl.searchParams.set('auth', 'true')
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

### Step 2: Create Auth Context

**File:** `app/contexts/AuthContext.tsx`

```typescript
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()
  const router = useRouter()

  useEffect(() => {
    // Get initial session
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      setUser(session?.user ?? null)
      setLoading(false)
    }

    getUser()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)

      if (event === 'SIGNED_IN') {
        router.refresh()
      }

      if (event === 'SIGNED_OUT') {
        router.push('/')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/')
  }

  const refreshUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    setUser(session?.user ?? null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

### Step 3: Wrap App with Auth Provider

**File:** `app/layout.tsx`

```typescript
import { AuthProvider } from './contexts/AuthContext'
import GoogleOneTapProvider from './components/auth/GoogleOneTapProvider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <GoogleOneTapProvider>
            {children}
          </GoogleOneTapProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
```

### Step 4: Rate Limiting Configuration

**File:** `lib/config/rate-limit.ts`

```typescript
export const rateLimits = {
  auth: {
    sendOTP: {
      max: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
    },
    verifyOTP: {
      max: 3,
      perOTP: true, // per OTP code, not per user
    },
    login: {
      max: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
    },
    register: {
      max: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
    },
    passwordReset: {
      max: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
    },
  },
}
```

### Step 5: Security Headers

**File:** `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
```

---

## 8. TESTING CHECKLIST

### Google OAuth Testing
- [ ] One Tap auto-prompt appears on homepage
- [ ] One Tap login creates profile with Google data
- [ ] One Tap login doesn't overwrite custom avatar on existing profile
- [ ] Manual Google button login works
- [ ] OAuth callback handles code exchange
- [ ] Profile creation on first sign-in
- [ ] Redirect to /profile after successful login
- [ ] Error handling for disabled provider

### Phone/SMS Testing
- [ ] OTP send validates phone format
- [ ] OTP send enforces rate limiting (3 per hour)
- [ ] SMS delivery via Text.lk (or dev console log)
- [ ] OTP verification accepts correct code
- [ ] OTP verification rejects incorrect code
- [ ] OTP verification enforces 3 attempt limit
- [ ] OTP verification checks expiration (10 minutes)
- [ ] Account creation after successful OTP verification
- [ ] Profile phone update workflow
- [ ] Phone normalization (all formats)

### Email Testing
- [ ] Email registration sends verification email
- [ ] Email verification link works
- [ ] Email verification link expires after 1 hour
- [ ] Login requires verified email
- [ ] Login with unverified email shows error
- [ ] Email already exists check works
- [ ] Profile email_verified flag updates
- [ ] Resend verification email works
- [ ] Email callback redirects correctly

### Password Reset Testing
- [ ] Forgot password sends reset email
- [ ] Reset email link works
- [ ] Reset link expires after 1 hour
- [ ] Password update validates minimum length
- [ ] Password update validates confirmation match
- [ ] Password update successful redirects to login
- [ ] Resend reset email works
- [ ] Rate limiting on reset requests

### Security Testing
- [ ] RLS policies protect profile data
- [ ] Service role key only used server-side
- [ ] Rate limiting enforced on all auth endpoints
- [ ] CSRF protection via Supabase built-in
- [ ] Phone numbers stored in canonical format
- [ ] OTP codes not logged in production
- [ ] Passwords hashed by Supabase
- [ ] Session tokens in httpOnly cookies

### Integration Testing
- [ ] Middleware protects routes correctly
- [ ] Auth context updates on sign in/out
- [ ] Google One Tap integration in root layout
- [ ] Profile setup redirect for incomplete profiles
- [ ] Auth state persists across page refreshes
- [ ] Sign out clears session and redirects
- [ ] Multiple auth methods work for same user
- [ ] Profile sync across auth methods

---

## DEPLOYMENT CHECKLIST

### Environment Variables
```bash
# Production .env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
TEXTLK_API_KEY=your-textlk-api-key
TEXTLK_SENDER_ID=YOURAPP
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

### Supabase Configuration
- [ ] Google OAuth provider enabled
- [ ] Redirect URLs configured
- [ ] Email templates customized
- [ ] Site URL set correctly
- [ ] RLS policies enabled on all tables
- [ ] Database migrations applied

### Next.js Configuration
- [ ] Security headers configured
- [ ] Middleware paths correct
- [ ] Auth context in root layout
- [ ] Google One Tap provider in layout
- [ ] Rate limiting configured

### Production Verification
- [ ] All auth methods tested in production
- [ ] Email delivery working
- [ ] SMS delivery working
- [ ] Google OAuth redirect working
- [ ] HTTPS enforced
- [ ] Error tracking configured
- [ ] Rate limiting active

---

**End of Re-Implementation Guide**

This comprehensive guide covers all authentication implementations with step-by-step commands, code examples, and testing procedures. Follow the sections in order for complete multi-provider authentication setup.
