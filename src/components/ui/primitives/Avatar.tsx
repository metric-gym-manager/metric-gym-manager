import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Avatar — circular identity badge (spec §11 Avatars). Renders an image when
 * `src` is provided, otherwise up to two initials on the accent background.
 * Sizes: sm 26px, md 30px, lg 40px.
 */
export const avatarVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-accentui font-geist font-semibold uppercase leading-none text-accentui-text',
  {
    variants: {
      size: {
        sm: 'size-6.5 text-mono-xs', // 26px / 10px
        md: 'size-7.5 text-mono-sm', // 30px / 11px
        lg: 'size-10 text-h3', // 40px / 14px
      },
    },
    defaultVariants: { size: 'md' },
  }
)

/** Two-letter initials from a display name. */
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export interface AvatarProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof avatarVariants> {
  src?: string
  /** Full name — used for initials and, with an image, the alt text. */
  name?: string
  alt?: string
}

export const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, size, src, name, alt, children, ...props }, ref) => {
    const initials = name ? getInitials(name) : undefined
    return (
      <span
        ref={ref}
        className={cn(avatarVariants({ size }), className)}
        role="img"
        aria-label={alt ?? name}
        {...props}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt ?? name ?? ''}
            className="size-full object-cover"
          />
        ) : (
          (children ?? initials)
        )}
      </span>
    )
  }
)
Avatar.displayName = 'Avatar'
