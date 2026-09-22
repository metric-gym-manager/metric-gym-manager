import { act, cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen } from '@/test-utils/renderScreen'
import { Modal } from '../primitives/Modal'
import { Drawer } from '../primitives/Drawer'

/**
 * `Modal placement` and the phone `Drawer` (mobile rebuild plan §5.3, §5.4).
 *
 * The contract every assertion here defends: **a placement changes nothing at
 * desktop width.** `sheet` and `fullscreen` are `phone:`-scoped classes plus,
 * for `fullscreen`, one behaviour — the hardware Back button — which is armed
 * from the tier hook rather than from CSS, because CSS cannot intercept Back.
 * So the desktop assertions are not padding: they are the thing that could
 * actually regress.
 */

function openModal(props: Partial<React.ComponentProps<typeof Modal>> = {}) {
  return render(
    <Modal open onOpenChange={() => {}} title="Member details" {...props}>
      <p>Body</p>
    </Modal>
  )
}

describe('Modal placement — default is unchanged', () => {
  it('sizes the centred dialog\u2019s close for touch on a phone as well', () => {
    openModal({})
    // Not only sheets: `center` is the default placement and the one every
    // confirmation in the product uses.
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass(
      'phone:size-touch'
    )
  })

  it('renders the centred dialog with a trailing close, as before', () => {
    openModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('data-placement', 'center')
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Back' })
    ).not.toBeInTheDocument()
    // No phone-scoped geometry at all on the default placement.
    expect(dialog.className).not.toMatch(/phone:/)
  })
})

describe('Modal placement="sheet"', () => {
  it('anchors to the bottom edge and caps at the sheet token, on phones only', () => {
    openModal({ placement: 'sheet' })
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveClass('phone:bottom-0')
    expect(dialog).toHaveClass('phone:max-h-sheet')
    expect(dialog).toHaveClass('phone:rounded-b-none')
    // Every geometry class is phone-scoped: the desktop rendering is the
    // centred dialog, unchanged.
    expect(dialog).toHaveClass('top-24')
    expect(dialog).toHaveClass('left-1/2')
  })

  it('keeps the trailing close — a sheet is not a screen', () => {
    openModal({ placement: 'sheet' })
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Back' })
    ).not.toBeInTheDocument()
  })

  /**
   * The third close control, and the one that was missed.
   *
   * Phase 1 gave the fullscreen Back a 44 px box and the `Drawer`'s close a
   * 44 px box, and left this one at 24 × 24 — under even the probe's 40 px
   * floor. It survived because `fullscreen` hides it and `fullscreen` was the
   * only placement any phase had probed with a dialog OPEN. The mobile
   * rebuild's Phase 3 probed a sheet and the probe named it immediately.
   *
   * Applies to `center` too: every dialog in the product had this control at
   * 24 px on a phone.
   */
  it('gives the trailing close a 44px hit area on phones, like the other two', () => {
    openModal({ placement: 'sheet' })
    const close = screen.getByRole('button', { name: 'Close' })
    expect(close).toHaveClass('phone:size-touch')
    // Desktop keeps the 24 px glyph: the padding that makes it is untouched
    // and every override is phone-scoped.
    expect(close).toHaveClass('p-1')
  })

  it('adds the home-indicator inset below its footer', () => {
    openModal({ placement: 'sheet', footer: <button>Save</button> })
    expect(
      screen
        .getByRole('button', { name: 'Save' })
        .closest('.phone\\:pb-safe-bottom')
    ).toBeInTheDocument()
  })
})

describe('Modal placement="fullscreen"', () => {
  it('fills the screen with dvh, on phones only', () => {
    openModal({ placement: 'fullscreen' })
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveClass('phone:inset-0')
    // `vh` is the viewport with the address bar hidden, so a 100vh overlay
    // pushes its action bar below the fold while the bar is showing.
    expect(dialog).toHaveClass('phone:h-dvh')
  })

  it('renders BOTH close controls, and hides one per width', () => {
    openModal({ placement: 'fullscreen' })
    // No tier switch in the header: CSS picks, so it cannot mismatch on
    // hydration. Back is `hidden phone:inline-flex`, × is `phone:hidden`.
    const back = screen.getByRole('button', { name: 'Back' })
    const close = screen.getByRole('button', { name: 'Close' })
    expect(back).toHaveClass('hidden')
    expect(back).toHaveClass('phone:inline-flex')
    expect(close).toHaveClass('phone:hidden')
  })

  it('gives the Back control a full 44px hit area, not a 16px glyph', () => {
    openModal({ placement: 'fullscreen' })
    expect(screen.getByRole('button', { name: 'Back' })).toHaveClass(
      'size-touch'
    )
  })

  it('stretches the footer buttons into an action bar', () => {
    openModal({
      placement: 'fullscreen',
      footer: <button>Mark paid</button>,
    })
    const actions = screen.getByRole('button', {
      name: 'Mark paid',
    }).parentElement
    expect(actions).toHaveClass('phone:w-full')
    expect(actions).toHaveClass('phone:[&>*]:flex-1')
  })
})

describe('Modal fullscreen — the Back button', () => {
  afterEach(() => {
    cleanup()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  beforeEach(() => {
    jest.useFakeTimers()
    window.history.replaceState({ page: 'list' }, '')
  })

  it('closes on popstate at phone width', () => {
    const onOpenChange = jest.fn()
    renderScreen(
      <Modal open onOpenChange={onOpenChange} placement="fullscreen" title="X">
        <p>Body</p>
      </Modal>,
      { viewport: 'phone' }
    )

    act(() => {
      window.history.replaceState({ page: 'list' }, '')
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does NOT claim the Back button at desktop width', () => {
    const onOpenChange = jest.fn()
    renderScreen(
      <Modal open onOpenChange={onOpenChange} placement="fullscreen" title="X">
        <p>Body</p>
      </Modal>,
      { viewport: 'desktop' }
    )

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    })
    // At ≥ 768 this IS the centred dialog. Swallowing the browser's Back
    // button there would break navigation on every desktop screen that opens
    // a "fullscreen" overlay.
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('does not claim it for the other placements either', () => {
    const onOpenChange = jest.fn()
    renderScreen(
      <Modal open onOpenChange={onOpenChange} placement="sheet" title="X">
        <p>Body</p>
      </Modal>,
      { viewport: 'phone' }
    )

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    })
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

describe('Drawer — phone sheet', () => {
  it('becomes a bottom sheet on phones and stays a side panel otherwise', () => {
    render(
      <Drawer open onOpenChange={() => {}} title="More">
        <p>Body</p>
      </Drawer>
    )
    const panel = screen.getByRole('dialog')
    expect(panel).toHaveClass('phone:bottom-0')
    expect(panel).toHaveClass('phone:rounded-t-sm')
    // Desktop geometry untouched.
    expect(panel).toHaveClass('w-[420px]')
    expect(panel).toHaveClass('inset-y-0')
  })

  it('is a full-height sheet by default — today’s behaviour', () => {
    render(
      <Drawer open onOpenChange={() => {}} title="More">
        <p>Body</p>
      </Drawer>
    )
    expect(screen.getByRole('dialog')).toHaveClass('phone:h-sheet')
  })

  it('lets a short sheet be short with size="auto"', () => {
    render(
      <Drawer open onOpenChange={() => {}} size="auto" title="More">
        <p>Body</p>
      </Drawer>
    )
    const panel = screen.getByRole('dialog')
    // The More sheet is eight rows; 90% of the screen for eight rows is
    // mostly empty panel.
    expect(panel).toHaveClass('phone:max-h-sheet')
    expect(panel).not.toHaveClass('phone:h-sheet')
  })

  it('uses dvh, not the 85vh it replaced', () => {
    render(
      <Drawer open onOpenChange={() => {}} title="More">
        <p>Body</p>
      </Drawer>
    )
    expect(screen.getByRole('dialog').className).not.toContain('vh]')
  })

  it('gives its close control a 44px hit area on phones', () => {
    render(
      <Drawer open onOpenChange={() => {}} title="More">
        <p>Body</p>
      </Drawer>
    )
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass(
      'phone:size-touch'
    )
  })
})
