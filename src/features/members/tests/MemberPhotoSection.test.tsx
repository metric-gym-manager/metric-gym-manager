import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import MemberPhotoSection from '../components/MemberPhotoSection'
import type { MemberWithDiscount } from '../types'
import { MemberStatus } from '@/features/members/config/StatusConfig'

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}))

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

jest.mock('@/features/members/services/photo-upload', () => ({
  uploadMemberPhoto: jest.fn(),
  removeMemberPhoto: jest.fn(),
}))

jest.mock('../components/MemberAvatar', () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => (
    <div data-testid="member-avatar">{name}</div>
  ),
}))

const baseMember: MemberWithDiscount = {
  id: 'member-1',
  gym_id: 'gym-1',
  member_number: 1,
  name: 'Jane Doe',
  phone_number: '+94771234567',
  plan_type: 'monthly',
  plan_amount: 3500,
  discount_id: null,
  recurring_discount: false,
  status: MemberStatus.Active,
  registered_date: '2026-01-01',
  membership_start_date: '2026-01-01',
  next_due_date: '2026-02-01',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  photo_path: null,
  photo_updated_at: null,
  registration_source: 'manual',
  verified_at: null,
  discount: null,
}

describe('MemberPhotoSection', () => {
  describe('button rendering', () => {
    it('shows Take Photo and Choose File buttons when no photo', () => {
      render(<MemberPhotoSection member={baseMember} />)

      expect(screen.getByText('Take Photo')).toBeInTheDocument()
      expect(screen.getByText('Choose File')).toBeInTheDocument()
    })

    it('shows Replace Photo instead of Choose File when photo exists', () => {
      render(
        <MemberPhotoSection
          member={{ ...baseMember, photo_path: 'profiles/member-1.webp' }}
        />
      )

      expect(screen.getByText('Take Photo')).toBeInTheDocument()
      expect(screen.getByText('Replace Photo')).toBeInTheDocument()
    })

    it('shows Remove button only when photo exists', () => {
      const { rerender } = render(<MemberPhotoSection member={baseMember} />)
      expect(screen.queryByText('Remove')).not.toBeInTheDocument()

      rerender(
        <MemberPhotoSection
          member={{ ...baseMember, photo_path: 'profiles/member-1.webp' }}
        />
      )
      expect(screen.getByText('Remove')).toBeInTheDocument()
    })
  })

  describe('camera input', () => {
    it('renders a hidden file input with capture="environment" for the camera', () => {
      const { container } = render(<MemberPhotoSection member={baseMember} />)
      const inputs = container.querySelectorAll('input[type="file"]')

      const cameraInput = Array.from(inputs).find(
        (el) => el.getAttribute('capture') === 'environment'
      )
      expect(cameraInput).toBeInTheDocument()
      expect(cameraInput).toHaveClass('hidden')
      expect(cameraInput).toHaveAttribute('accept', 'image/*')
    })

    it('renders a hidden file input without capture for the gallery/file picker', () => {
      const { container } = render(<MemberPhotoSection member={baseMember} />)
      const inputs = container.querySelectorAll('input[type="file"]')

      const galleryInput = Array.from(inputs).find(
        (el) => !el.getAttribute('capture')
      )
      expect(galleryInput).toBeInTheDocument()
      expect(galleryInput).toHaveClass('hidden')
      expect(galleryInput).toHaveAttribute('accept', 'image/*')
    })
  })

  describe('Take Photo button', () => {
    it('triggers the camera input when clicked', () => {
      const { container } = render(<MemberPhotoSection member={baseMember} />)
      const cameraInput = container.querySelector(
        'input[type="file"][capture="environment"]'
      ) as HTMLInputElement
      const clickSpy = jest.spyOn(cameraInput, 'click')

      fireEvent.click(screen.getByText('Take Photo'))

      expect(clickSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('Choose File button', () => {
    it('triggers the gallery input when clicked', () => {
      const { container } = render(<MemberPhotoSection member={baseMember} />)
      const galleryInput = container.querySelector(
        'input[type="file"]:not([capture])'
      ) as HTMLInputElement
      const clickSpy = jest.spyOn(galleryInput, 'click')

      fireEvent.click(screen.getByText('Choose File'))

      expect(clickSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('QR verification badge', () => {
    it('shows NEW badge and Verify button for unverified QR registrations', () => {
      render(
        <MemberPhotoSection
          member={{
            ...baseMember,
            registration_source: 'qr',
            verified_at: null,
          }}
        />
      )

      expect(screen.getByText('NEW')).toBeInTheDocument()
      expect(screen.getByText('Verify')).toBeInTheDocument()
    })

    it('does not show NEW badge for verified QR registrations', () => {
      render(
        <MemberPhotoSection
          member={{
            ...baseMember,
            registration_source: 'qr',
            verified_at: '2026-01-02T00:00:00Z',
          }}
        />
      )

      expect(screen.queryByText('NEW')).not.toBeInTheDocument()
    })

    it('does not show NEW badge for manual registrations', () => {
      render(<MemberPhotoSection member={baseMember} />)

      expect(screen.queryByText('NEW')).not.toBeInTheDocument()
    })
  })
})
