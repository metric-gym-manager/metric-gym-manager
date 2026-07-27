import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../primitives/Tabs'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../primitives/Accordion'
import {
  Breadcrumb,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '../primitives/Breadcrumb'
import { Pagination, getPaginationRange } from '../primitives/Pagination'

describe('Tabs', () => {
  it('shows the active tab panel and switches on click', () => {
    render(
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="due">Due</TabsTrigger>
        </TabsList>
        <TabsContent value="all">All members</TabsContent>
        <TabsContent value="due">Due members</TabsContent>
      </Tabs>
    )
    expect(screen.getByText('All members')).toBeInTheDocument()
    expect(screen.queryByText('Due members')).not.toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Due' }))
    expect(screen.getByText('Due members')).toBeInTheDocument()
  })
})

describe('Accordion', () => {
  it('reveals content when a section is opened', () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="a">
          <AccordionTrigger>Billing</AccordionTrigger>
          <AccordionContent>Invoice details</AccordionContent>
        </AccordionItem>
      </Accordion>
    )
    const trigger = screen.getByRole('button', { name: 'Billing' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('Breadcrumb', () => {
  it('marks the current page with aria-current', () => {
    render(
      <Breadcrumb>
        <BreadcrumbLink href="/">Metric</BreadcrumbLink>
        <BreadcrumbSeparator />
        <BreadcrumbPage>Members</BreadcrumbPage>
      </Breadcrumb>
    )
    expect(
      screen.getByRole('navigation', { name: 'Breadcrumb' })
    ).toBeInTheDocument()
    expect(screen.getByText('Members')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Metric' })).toHaveAttribute(
      'href',
      '/'
    )
  })
})

describe('Pagination', () => {
  it('computes a truncated range with ellipses', () => {
    expect(getPaginationRange(1, 5)).toEqual([1, 2, 3, 4, 5])
    expect(getPaginationRange(6, 20)).toEqual([
      1,
      'ellipsis',
      5,
      6,
      7,
      'ellipsis',
      20,
    ])
  })

  it('renders nothing for a single page', () => {
    const { container } = render(
      <Pagination page={1} pageCount={1} onPageChange={() => {}} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('disables Previous on the first page and navigates on click', () => {
    const onPageChange = jest.fn()
    render(<Pagination page={1} pageCount={5} onPageChange={onPageChange} />)
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })
})
