import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge is taught about the design system's custom `text-*` font-size
 * tokens (spec §5 / tailwind.config.ts `fontSize`). Without this, tailwind-merge
 * cannot tell `text-body` (a font size) from `text-ink` (a color) — it treats
 * both as text-color and silently drops one when they appear together. Declaring
 * them in the `font-size` group keeps size and color independent so a primitive
 * can safely set both (e.g. `text-body text-ink`).
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display-xl',
            'display',
            'display-sm',
            'h1',
            'h2',
            'h3',
            'body-lg',
            'body',
            'body-sm',
            'caption',
            'metadata',
            'button',
            'button-sm',
            'button-lg',
            'mono-md',
            'mono-sm',
            'mono-xs',
            'code',
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
