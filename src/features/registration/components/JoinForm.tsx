'use client'

import { useMemo, useRef, useState } from 'react'
import { Camera, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { compressImageForUpload, type CompressedImage } from '@/utils/image'
import { uploadToPresignedUrl } from '@/features/members/services/photo-upload'
import type { PublicPlanOption, PublicRegistrationResult } from '../types'

interface JoinFormProps {
  token: string
  gymName: string
  plans: PublicPlanOption[]
  /** One-time admission fee to add to the amount due (0 when not enabled) */
  admissionFee: number
}

const formatAmount = (amount: number) =>
  `Rs. ${amount.toLocaleString('en-LK', { minimumFractionDigits: 0 })}`

/**
 * Public QR self-registration form.
 *
 * Designed for a sub-minute flow on the member's own phone:
 * name → phone → plan (amount shown live) → selfie → register.
 * The selfie is compressed as soon as it's captured so the final submit is
 * one small POST plus one direct-to-R2 PUT.
 */
export default function JoinForm({
  token,
  gymName,
  plans,
  admissionFee,
}: JoinFormProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [planType, setPlanType] = useState(plans[0]?.planType ?? '')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedGymRules, setAcceptedGymRules] = useState(false)
  const [photo, setPhoto] = useState<CompressedImage | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [processingPhoto, setProcessingPhoto] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState<PublicRegistrationResult | null>(null)
  const [photoUploadFailed, setPhotoUploadFailed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Honeypot: invisible to humans, filled by naive bots
  const honeypotRef = useRef<HTMLInputElement>(null)

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.planType === planType) ?? null,
    [plans, planType]
  )

  const amountDue = selectedPlan ? selectedPlan.amount + admissionFee : null

  const handlePhotoChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setProcessingPhoto(true)
    setErrorMessage(null)
    try {
      const compressed = await compressImageForUpload(file)
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
      setPhoto(compressed)
      setPhotoPreviewUrl(URL.createObjectURL(compressed.blob))
    } catch {
      setErrorMessage('Could not read that photo — please try again.')
    } finally {
      setProcessingPhoto(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return

    if (!acceptedTerms || !acceptedGymRules) {
      setErrorMessage('Please accept both agreements to continue.')
      return
    }

    setErrorMessage(null)
    setSubmitting(true)

    try {
      const response = await fetch('/api/public/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name,
          phoneNumber: phone,
          planType,
          photoContentType: photo?.contentType,
          acceptedTerms,
          acceptedGymRules,
          website: honeypotRef.current?.value || undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        const message =
          result?.error?.message ||
          Object.values(result?.error?.details?.errors ?? {}).flat()[0] ||
          'Registration failed. Please ask the front desk for help.'
        setErrorMessage(String(message))
        return
      }

      const data = result.data as PublicRegistrationResult

      // Upload the selfie directly to R2 (one retry for flaky gym wifi).
      // A failed upload never blocks registration — the desk can add the
      // photo later from the member profile.
      if (data.uploadUrl && photo) {
        try {
          await uploadToPresignedUrl(
            data.uploadUrl,
            photo.blob,
            photo.contentType
          )
        } catch {
          try {
            await uploadToPresignedUrl(
              data.uploadUrl,
              photo.blob,
              photo.contentType
            )
          } catch {
            setPhotoUploadFailed(true)
          }
        }
      }

      setSuccess(data)
    } catch {
      setErrorMessage(
        'Network problem — please check your connection and try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-md px-6 py-12 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
        <h1 className="mt-4 text-2xl font-bold text-ink">
          Welcome, {success.name}!
        </h1>
        <div className="mt-6 rounded-sm border bg-surface-card p-6 ">
          <p className="text-sm text-ink-muted">{success.planLabel}</p>
          <p className="mt-2 text-4xl font-bold text-ink">
            {formatAmount(success.amountDue)}
          </p>
          <p className="mt-4 text-base font-medium text-brand-link">
            Show this screen at the front desk and pay to complete your
            registration.
          </p>
        </div>
        {photoUploadFailed && (
          <p className="mt-4 text-xs text-warning">
            Your photo could not be uploaded — the front desk can add it for
            you.
          </p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md px-6 py-8">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-ink">{gymName}</h1>
        <p className="mt-1 text-sm text-ink-muted">Member Registration</p>
      </header>

      <div className="mt-8 space-y-5">
        {/* Name */}
        <div>
          <label
            htmlFor="join-name"
            className="block text-sm font-medium text-ink-secondary"
          >
            Full Name
          </label>
          <input
            id="join-name"
            type="text"
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 block w-full rounded-sm border border-line-2 bg-surface-card px-4 py-3 text-base  focus:border-focusring focus:outline-none focus:ring-2 focus:ring-focusring"
            placeholder="Your name"
          />
        </div>

        {/* Phone */}
        <div>
          <label
            htmlFor="join-phone"
            className="block text-sm font-medium text-ink-secondary"
          >
            Phone Number
          </label>
          <input
            id="join-phone"
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1.5 block w-full rounded-sm border border-line-2 bg-surface-card px-4 py-3 text-base  focus:border-focusring focus:outline-none focus:ring-2 focus:ring-focusring"
            placeholder="0771234567"
          />
        </div>

        {/* Plan */}
        <div>
          <label
            htmlFor="join-plan"
            className="block text-sm font-medium text-ink-secondary"
          >
            Membership Plan
          </label>
          <select
            id="join-plan"
            required
            value={planType}
            onChange={(e) => setPlanType(e.target.value)}
            className="mt-1.5 block w-full rounded-sm border border-line-2 bg-surface-card px-4 py-3 text-base  focus:border-focusring focus:outline-none focus:ring-2 focus:ring-focusring"
          >
            {plans.map((plan) => (
              <option key={plan.planType} value={plan.planType}>
                {plan.label} — {formatAmount(plan.amount)}
              </option>
            ))}
          </select>
        </div>

        {/* Selfie */}
        <div>
          <span className="block text-sm font-medium text-ink-secondary">
            Your Photo
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={handlePhotoChange}
          />
          {photoPreviewUrl ? (
            <div className="mt-2 flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img
                src={photoPreviewUrl}
                alt="Your selfie"
                className="h-20 w-20 rounded-full object-cover border-2 border-accentui-border"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-sm border border-line-2 px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-surface-panel"
              >
                <RefreshCw className="h-4 w-4" />
                Retake
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={processingPhoto}
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-sm border-2 border-dashed border-line-2 bg-surface-card px-4 py-6 text-sm font-medium text-ink-secondary hover:border-accentui-border hover:text-brand-link"
            >
              {processingPhoto ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Camera className="h-5 w-5" />
              )}
              {processingPhoto ? 'Processing...' : 'Take a Selfie'}
            </button>
          )}
        </div>

        {/* Honeypot — hidden from humans */}
        <input
          ref={honeypotRef}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />

        {/* Consents — both required */}
        <div className="space-y-3">
          <label className="flex items-start gap-2.5 text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-line-2 text-brand-link focus:ring-focusring"
            />
            <span>
              I accept Metric Gym OS&apos;s{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-link underline"
              >
                privacy policy
              </a>{' '}
              and{' '}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-link underline"
              >
                terms of service
              </a>
              .
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={acceptedGymRules}
              onChange={(e) => setAcceptedGymRules(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-line-2 text-brand-link focus:ring-focusring"
            />
            <span>I agree to the gym&apos;s guidelines and rules.</span>
          </label>
        </div>

        {errorMessage && (
          <div className="rounded-sm bg-error-bg px-4 py-3 text-sm text-error">
            {errorMessage}
          </div>
        )}

        {/* Amount + submit */}
        <div className="rounded-sm bg-surface-card border p-4 ">
          {admissionFee > 0 && selectedPlan && (
            <div className="mb-3 space-y-1 border-b pb-3">
              <div className="flex items-center justify-between text-sm text-ink-muted">
                <span>Plan</span>
                <span>{formatAmount(selectedPlan.amount)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-ink-muted">
                <span>Admission fee</span>
                <span>{formatAmount(admissionFee)}</span>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-muted">
              Amount to pay at desk
            </span>
            <span className="text-xl font-bold text-ink">
              {amountDue !== null ? formatAmount(amountDue) : '—'}
            </span>
          </div>
          <button
            type="submit"
            disabled={
              submitting ||
              plans.length === 0 ||
              !acceptedTerms ||
              !acceptedGymRules
            }
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-sm bg-accentui px-4 py-3.5 text-base font-semibold text-accentui-text  hover:bg-accentui-hover disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
            {submitting ? 'Registering...' : 'Register'}
          </button>
          {plans.length === 0 && (
            <p className="mt-2 text-center text-xs text-warning">
              No plans are available right now — please ask the front desk.
            </p>
          )}
        </div>
      </div>
    </form>
  )
}
