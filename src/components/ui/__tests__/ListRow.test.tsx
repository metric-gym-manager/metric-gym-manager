import { render, screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ListRow } from '../primitives/ListRow'

/**
 * `ListRow` — the phone presentation of one record (mobile rebuild plan §9.1).
 *
 * The slots are easy; the semantics are where this can go quietly wrong. A
 * row whose tap target names itself by its whole content reads out as
 * "Nimal Perera expired 12 days ago +94 77 123 4567 monthly" — one long
 * string, in every list in the product. So the name and the description are
 * asserted separately here, not just "the text is somewhere in the row".
 */

function row(props: Partial<React.ComponentProps<typeof ListRow>> = {}) {
  return render(
    <ul role="list">
      <ListRow
        primary="Nimal Perera"
        status="EXPIRED · 12 DAYS AGO"
        meta={['+94 77 123 4567', 'Monthly']}
        value="3,500"
        {...props}
      />
    </ul>
  )
}

describe('ListRow', () => {
  it('renders every slot', () => {
    row({ leading: <span data-testid="avatar" /> })
    const item = screen.getByRole('listitem')
    expect(screen.getByText('Nimal Perera')).toBeInTheDocument()
    expect(screen.getByText('EXPIRED · 12 DAYS AGO')).toBeInTheDocument()
    // The meta segments are interleaved with separator nodes, so the row's
    // text is the only place they read as one line.
    expect(item).toHaveTextContent('+94 77 123 4567 · Monthly')
    expect(screen.getByText('3,500')).toBeInTheDocument()
    expect(screen.getByTestId('avatar')).toBeInTheDocument()
  })

  it('is a list item, so a screen reader announces "list, 1 item"', () => {
    row()
    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(items).toHaveLength(1)
  })

  it('names its tap target by the primary text alone', () => {
    row({ onClick: () => {} })
    // Not "Nimal Perera EXPIRED · 12 DAYS AGO +94 77 123 4567 Monthly".
    expect(
      screen.getByRole('button', { name: 'Nimal Perera' })
    ).toBeInTheDocument()
  })

  it('attaches the status and meta as the target’s description', () => {
    row({ onClick: () => {} })
    const target = screen.getByRole('button', { name: 'Nimal Perera' })
    const describedBy = target.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    const description = document.getElementById(describedBy as string)
    expect(description).toHaveTextContent('EXPIRED · 12 DAYS AGO')
    expect(description).toHaveTextContent('+94 77 123 4567')
  })

  it('describes nothing when there is nothing to describe', () => {
    render(
      <ul role="list">
        <ListRow primary="Nimal Perera" onClick={() => {}} />
      </ul>
    )
    expect(
      screen.getByRole('button', { name: 'Nimal Perera' })
    ).not.toHaveAttribute('aria-describedby')
  })

  it('gives the tap target the primary touch height', () => {
    row({ onClick: () => {} })
    // A one-line row's target is 20px of text; §15.1 makes the TARGET 44, not
    // the row around it — a row that is tall enough with a small button in it
    // is still a small button.
    expect(screen.getByRole('button', { name: 'Nimal Perera' })).toHaveClass(
      'min-h-touch'
    )
  })

  it('calls onClick when tapped', () => {
    const onClick = jest.fn()
    row({ onClick })
    fireEvent.click(screen.getByRole('button', { name: 'Nimal Perera' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders a link when given an href', () => {
    row({ href: '/members/1' })
    expect(screen.getByRole('link', { name: 'Nimal Perera' })).toHaveAttribute(
      'href',
      '/members/1'
    )
  })

  it('renders no interactive element when it is not interactive', () => {
    row()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('marks a selected row with the selection fill (ruling R7)', () => {
    row({ selected: true })
    const item = screen.getByRole('listitem')
    expect(item).toHaveClass('bg-surface-selected')
    expect(item).toHaveAttribute('data-selected')
  })

  it('joins the meta segments with a text separator, not an element', () => {
    row({ onClick: () => {} })
    const describedBy = screen
      .getByRole('button', { name: 'Nimal Perera' })
      .getAttribute('aria-describedby') as string
    const description = document.getElementById(describedBy)
    expect(description).toHaveTextContent('+94 77 123 4567 · Monthly')

    // The separator is deliberately a text node. The probe's overflow rule
    // skips a clipping container holding nothing but text — an ellipsis is
    // the sanctioned way to truncate — and flags one holding elements. A
    // single `<span aria-hidden> · </span>` put every meta line in the product
    // on the wrong side of that line. Found by running the probe over the
    // showcase in a browser; no jsdom test could see it, so this one pins the
    // shape that fixed it.
    const metaLine = description?.querySelector('.truncate')
    expect(metaLine).toBeTruthy()
    expect(metaLine?.querySelectorAll('*')).toHaveLength(0)
  })

  it('renders actions when given them', () => {
    row({
      actions: (
        <>
          <button type="button">Record payment</button>
          <button type="button">Remind</button>
        </>
      ),
    })
    expect(
      screen.getByRole('button', { name: 'Record payment' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remind' })).toBeInTheDocument()
  })

  it('renders a zero value rather than dropping it', () => {
    // `value={0}` is falsy. A row that silently omits a zero amount is worse
    // than one that shows it — "0" is the answer the user needs.
    row({ value: 0 })
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
