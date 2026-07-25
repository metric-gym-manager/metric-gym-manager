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
