import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Modal } from '../primitives/Modal'
import { Drawer } from '../primitives/Drawer'

describe('Modal', () => {
  it('does not render content when closed', () => {
    render(
      <Modal open={false} onOpenChange={() => {}} title="Confirm">
        Body
      </Modal>
    )
    expect(screen.queryByText('Body')).not.toBeInTheDocument()
  })

  it('renders a dialog with title and body when open (happy path)', () => {
    render(
      <Modal
        open
        onOpenChange={() => {}}
        title="Cancel subscription"
        description="This cannot be undone."
      >
        <p>Details</p>
      </Modal>
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Cancel subscription')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
    expect(screen.getByText('Details')).toBeInTheDocument()
  })

  it('requests close via the close button', () => {
    const onOpenChange = jest.fn()
    render(
      <Modal open onOpenChange={onOpenChange} title="Confirm" description="x">
        Body
      </Modal>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('requests close on Escape (keyboard accessibility)', () => {
    const onOpenChange = jest.fn()
    render(
      <Modal open onOpenChange={onOpenChange} title="Confirm" description="x">
        Body
      </Modal>
    )
    fireEvent.keyDown(document.activeElement || document.body, {
      key: 'Escape',
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

/**
 * The description and the body share one padded scroller, and nothing put a
 * gap between them: every dialog with both rendered its first field flush
 * under the description (measured 0 px in Edit Member, Day Pass and the
 * Security dialogs). jsdom computes no geometry, so this pins the class that
 * makes the gap; the gap itself was measured in a browser.
 */
describe('Modal — description spacing', () => {
  it('separates the description from a body that follows it', () => {
    render(
      <Modal
        open
        onOpenChange={() => {}}
        title="Edit"
        description="Update the details."
      >
        <p>The first field.</p>
      </Modal>
    )

    expect(screen.getByText('Update the details.')).toHaveClass('mb-4')
  })

  it('adds no gap under a description that has no body below it', () => {
    render(
      <Modal
        open
        onOpenChange={() => {}}
        title="Delete"
        description="This cannot be undone."
      >
        {null}
        {false}
      </Modal>
    )

    expect(screen.getByText('This cannot be undone.')).not.toHaveClass('mb-4')
  })
})

describe('Drawer', () => {
  it('renders a dialog with title and footer when open', () => {
    render(
      <Drawer
        open
        onOpenChange={() => {}}
        title="Member record"
        footer={<button>Save</button>}
      >
        <p>Fields</p>
      </Drawer>
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Member record')).toBeInTheDocument()
    expect(screen.getByText('Fields')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })
})
