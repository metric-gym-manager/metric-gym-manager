import { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useConfirmDialog } from '../use-confirm-dialog'

/**
 * The open dialog must survive its parent re-rendering.
 *
 * The hook used to return a component defined inside it, so every parent
 * render produced a new component type and React remounted the open dialog.
 * A background refetch landing while the user reached for "Forget reader" put
 * a fresh dialog under the pointer, and the click could be read as a dismissal
 * (the intermittent E2E cleanup failure at `helpers/access-control.ts`).
 */

function Harness({
  tick,
  onResult,
}: {
  tick: number
  onResult: (v: boolean) => void
}) {
  const { confirm, dialog } = useConfirmDialog()
  const [asked, setAsked] = useState(false)

  const ask = async () => {
    setAsked(true)
    onResult(
      await confirm({
        title: 'Forget Front Door?',
        description: 'Sure?',
        confirmText: 'Forget reader',
      })
    )
  }

  return (
    <div data-tick={tick}>
      <button onClick={ask}>{asked ? 'Asked' : 'Ask'}</button>
      {dialog}
    </div>
  )
}

describe('useConfirmDialog', () => {
  it('keeps the open dialog mounted when the parent re-renders', async () => {
    const { rerender } = render(<Harness tick={1} onResult={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    const dialog = await screen.findByRole('dialog')

    rerender(<Harness tick={2} onResult={jest.fn()} />)

    expect(screen.getByRole('dialog')).toBe(dialog)
  })

  it('resolves true on confirm', async () => {
    const onResult = jest.fn()
    render(<Harness tick={1} onResult={onResult} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Forget reader' })
    )

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true))
  })

  it('resolves false on cancel', async () => {
    const onResult = jest.fn()
    render(<Harness tick={1} onResult={onResult} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false))
  })
})
