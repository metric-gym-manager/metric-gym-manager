import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Button } from '../primitives/Button'
import { Input } from '../primitives/Input'
import { Select } from '../primitives/Select'
import { Textarea } from '../primitives/Textarea'
import { Checkbox } from '../primitives/Checkbox'
import { Radio } from '../primitives/Radio'
import { Switch } from '../primitives/Switch'
import { Tabs, TabsList, TabsTrigger } from '../primitives/Tabs'
import { Pagination } from '../primitives/Pagination'
import { spacing, typeScale } from '../tokens'

/**
 * Phone control sizing and `data-dense` (mobile rebuild plan §5.2, §15.1).
 *
 * **What these can and cannot prove.** jsdom applies no stylesheet and
 * computes no geometry, so nothing here measures a button. What it can prove
 * is that the primitive emits the class the media query keys off, and — more
 * importantly — that it emits the RIGHT `data-dense` marking: the probe reads
 * that attribute to decide whether a control is held to 44 px or 40, so a
 * missing one fails a correct control and a spurious one passes a 26 px
 * button. That is a logic error, and it is invisible to a screenshot.
 *
 * The measurement is the probe's job, in a browser, on a real route
 * (`tests/e2e/helpers/mobile-probe.ts`). Neither replaces the other.
 */

/** §15.1's two thresholds, read from the tokens rather than retyped. */
const TOUCH = spacing.touch
const TOUCH_SM = spacing['touch-sm']

describe('§15.1 thresholds', () => {
  it('has exactly two, and they are 44 and 40', () => {
    // "No phase may introduce a third threshold." A new one here would let a
    // screen size a control to something the probe does not know about.
    expect(TOUCH).toBe('44px')
    expect(TOUCH_SM).toBe('40px')
  })

  it('sets the input type token to 16px, which is what stops the Safari zoom', () => {
    expect(typeScale.input.fontSize).toBe('16px')
  })
})

describe('Button — phone sizing', () => {
  it.each([
    ['md' as const, 'phone:min-h-touch'],
    ['lg' as const, 'phone:min-h-touch'],
    ['xl' as const, 'phone:min-h-touch'],
  ])('gives the %s size the primary target', (size, expected) => {
    render(<Button size={size}>Save</Button>)
    expect(screen.getByRole('button')).toHaveClass(expected)
  })

  it.each([['xs' as const], ['sm' as const]])(
    'marks the %s size dense and gives it the dense target',
    (size) => {
      render(<Button size={size}>Remind</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('phone:min-h-touch-sm')
      expect(button).toHaveClass('phone:min-w-touch-sm')
      expect(button).toHaveAttribute('data-dense')
    }
  )

  it('does not mark a primary-size button dense', () => {
    render(<Button size="md">Add member</Button>)
    expect(screen.getByRole('button')).not.toHaveAttribute('data-dense')
  })

  it('grows an icon button’s hit area without scaling its glyph', () => {
    render(
      <Button size="icon" aria-label="More">
        <svg />
      </Button>
    )
    const button = screen.getByRole('button', { name: 'More' })
    expect(button).toHaveClass('phone:size-touch')
    // §15.1: "glyph 16–20 px inside a 44 px hit area … via padding, never
    // glyph scaling". The glyph size is the base class, unchanged.
    expect(button).toHaveClass('[&_svg]:size-3.5')
  })

  it('gives a standalone text link the dense box and marks it dense', () => {
    render(<Button variant="link">Reset to default</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('phone:min-h-touch-sm')
    expect(button).toHaveAttribute('data-dense')
    // Still inline text on desktop.
    expect(button).toHaveClass('h-auto')
  })

  it('carries the marking through asChild, which renders someone else’s element', () => {
    render(
      <Button size="sm" asChild>
        <a href="#x">Open</a>
      </Button>
    )
    expect(screen.getByRole('link')).toHaveAttribute('data-dense')
  })
})

describe('Text controls — phone sizing', () => {
  it('gives Input the primary height and 16px text', () => {
    render(<Input aria-label="Name" />)
    const input = screen.getByLabelText('Name')
    expect(input).toHaveClass('phone:min-h-touch')
    expect(input).toHaveClass('phone:text-input')
  })

  it('gives Select the primary height and 16px text', () => {
    render(
      <Select aria-label="Plan">
        <option value="a">A</option>
      </Select>
    )
    const select = screen.getByLabelText('Plan')
    expect(select).toHaveClass('phone:min-h-touch')
    expect(select).toHaveClass('phone:text-input')
  })

  it('gives Textarea 16px text', () => {
    render(<Textarea aria-label="Message" />)
    expect(screen.getByLabelText('Message')).toHaveClass('phone:text-input')
  })
})

describe('Selection controls — phone sizing', () => {
  it('grows the Checkbox to 24px and its label to the primary target', () => {
    render(<Checkbox label="Send reminders" />)
    const box = screen.getByLabelText('Send reminders')
    expect(box).toHaveClass('phone:size-6')
    // §15.1: the LABEL is the target, not the box.
    expect(box.closest('label')).toHaveClass('phone:min-h-touch')
  })

  it('grows the Radio to 24px and its label to the primary target', () => {
    render(<Radio name="plan" label="Monthly" />)
    const radio = screen.getByLabelText('Monthly')
    expect(radio).toHaveClass('phone:size-6')
    expect(radio.closest('label')).toHaveClass('phone:min-h-touch')
  })

  it('grows the Switch track to 44×24 and moves the knob with it', () => {
    const { container } = render(<Switch aria-label="SMS" checked />)
    const track = screen.getByRole('switch')
    expect(track).toHaveClass('phone:h-6')
    expect(track).toHaveClass('phone:w-11')
    // The knob has to travel further in the wider track, or the "on" state
    // renders with the knob stranded mid-track.
    const knob = container.querySelector('span[aria-hidden="true"]')
    expect(knob).toHaveClass('phone:h-5')
    expect(knob).toHaveClass('phone:left-[20px]')
  })
})

describe('Tabs — phone sizing and overflow', () => {
  it('marks every trigger dense and gives it the dense target', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">All</TabsTrigger>
          <TabsTrigger value="b">Due</TabsTrigger>
        </TabsList>
      </Tabs>
    )
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveAttribute('data-dense')
      expect(tab).toHaveClass('phone:min-h-touch-sm')
    }
  })

  it('fits by sharing the width when the strip is not a scroller', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">All</TabsTrigger>
        </TabsList>
      </Tabs>
    )
    const list = screen.getByRole('tablist')
    expect(list).toHaveClass('phone:[&>*]:flex-1')
    expect(list).not.toHaveAttribute('data-scroll')
  })

  it('marks the scrolling strip as a sanctioned scroller', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList overflow="scroll">
          <TabsTrigger value="a">Expired 115</TabsTrigger>
          <TabsTrigger value="b">Expires this week 39</TabsTrigger>
        </TabsList>
      </Tabs>
    )
    const list = screen.getByRole('tablist')
    // Without `data-scroll="x"` the probe reads a horizontally scrolling
    // container on a phone route as a defect — which is exactly what it is
    // anywhere else (plan §17, ruling M1).
    expect(list).toHaveAttribute('data-scroll', 'x')
    expect(list).toHaveClass('overflow-x-auto')
  })
})

describe('Pagination — responsive', () => {
  it('marks the whole control dense', () => {
    render(<Pagination page={2} pageCount={8} onPageChange={() => {}} />)
    expect(
      screen.getByRole('navigation', { name: 'Pagination' })
    ).toHaveAttribute('data-dense')
  })

  it('renders numbers only, with no phone readout, by default', () => {
    render(<Pagination page={2} pageCount={8} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Page 2' })).toBeInTheDocument()
    expect(screen.queryByText(/2 of 8/)).not.toBeInTheDocument()
  })

  it('adds the compact readout — and keeps the numbers for wider screens', () => {
    render(
      <Pagination responsive page={2} pageCount={8} onPageChange={() => {}} />
    )
    // Both forms are in the DOM; CSS picks one. The readout is not
    // aria-hidden, because at phone width the numbered buttons carrying
    // `aria-current` are display:none and out of the accessibility tree.
    expect(screen.getByText(/2 of 8/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('still renders nothing for a single page', () => {
    const { container } = render(
      <Pagination responsive page={1} pageCount={1} onPageChange={() => {}} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
