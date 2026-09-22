'use client'

import { useState } from 'react'
import { Drawer, Button } from '@/components/ui'

/**
 * The phone's answer to "Bulk import" (mobile rebuild plan §14).
 *
 * Bulk import is a spreadsheet of many members at once. It does not fit a
 * phone and the plan explicitly rejected pretending otherwise: no
 * one-row-at-a-time wizard, no "Register another", no column-hiding that
 * quietly drops a field someone needed. What it offers instead is the honest
 * pair — tell the user where this works, and let them through anyway.
 *
 * **The user is never trapped.** "Open the desktop grid here" opens the real
 * `BulkAddMemberModal` fullscreen, with its own Back, Escape and Cancel, a
 * persistent `Alert` saying the grid is not optimised for a phone, and the
 * grid marked `data-scroll="x"` so the sideways scroll is declared rather
 * than silent. That modal is deliberately **not** counted as a mobile screen
 * in the Definition of Done.
 *
 * Desktop never sees this: `MembersPageClient` opens the grid directly there.
 */
export interface BulkImportGuidanceSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Open the real grid, fullscreen. */
  onOpenGrid: () => void
}

export default function BulkImportGuidanceSheet({
  open,
  onOpenChange,
  onOpenGrid,
}: BulkImportGuidanceSheetProps) {
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    // The link to THIS page, so the user can paste it into a laptop browser.
    // `navigator.clipboard` is unavailable over plain http and in some
    // in-app browsers, and a rejected promise here must not take the sheet
    // down — the grid button below is the path that always works.
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      size="auto"
      title="Bulk import"
    >
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <p className="text-body font-medium text-ink">
            Bulk import works best on a larger screen.
          </p>
          <p className="text-body text-ink-secondary">
            It is a spreadsheet of many members at once and does not fit a
            phone. Open Metric on a laptop or tablet to use it.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="secondary" onClick={copyLink}>
            {copied ? 'Link copied' : 'Copy link'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false)
              onOpenGrid()
            }}
          >
            Open the desktop grid here
          </Button>
        </div>
      </div>
    </Drawer>
  )
}
