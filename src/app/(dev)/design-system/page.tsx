'use client'

import * as React from 'react'
import { notFound } from 'next/navigation'
import {
  Search,
  Copy,
  Trash2,
  Plus,
  Users,
  Info,
  MoreHorizontal,
  LayoutDashboard,
  CreditCard,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AreaChart,
  Avatar,
  Badge,
  BarChart,
  Breadcrumb,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardLabel,
  Checkbox,
  CommandGroup,
  CommandItem,
  CommandPalette,
  DataTable,
  type DataTableColumn,
  Divider,
  DonutChart,
  Drawer,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  FormField,
  Input,
  LineChart,
  Modal,
  Pagination,
  PieChart,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  Radio,
  Select,
  Skeleton,
  SkeletonText,
  Sparkline,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipProvider,
  useCommandK,
} from '@/components/ui'

interface DemoMember {
  id: string
  name: string
  status: 'Active' | 'Due' | 'Overdue'
  amount: number
}

const DEMO_MEMBERS: DemoMember[] = [
  { id: '1', name: 'Nimal Perera', status: 'Active', amount: 4990 },
  { id: '2', name: 'Sara Kularatne', status: 'Due', amount: 12500 },
  { id: '3', name: 'Amal Silva', status: 'Overdue', amount: 2000 },
  { id: '4', name: 'Ravi Fernando', status: 'Active', amount: 7500 },
  { id: '5', name: 'Dilan Jayasuriya', status: 'Active', amount: 4990 },
]

const REVENUE = [
  { month: 'Mar', revenue: 420 },
  { month: 'Apr', revenue: 380 },
  { month: 'May', revenue: 510 },
  { month: 'Jun', revenue: 640 },
  { month: 'Jul', revenue: 590 },
]

const PLAN_MIX = [
  { name: 'Lite', value: 42 },
  { name: 'Pro', value: 30 },
  { name: 'Enterprise', value: 12 },
]

const badgeForStatus = {
  Active: 'success',
  Due: 'warning',
  Overdue: 'error',
} as const

/**
 * Design System Showcase — dev-only visual + interaction reference for the Metric
 * primitive library. Renders every primitive across variants, sizes, and states
 * in BOTH themes (light App Workspace + dark Marketing/Auth/Legal), validating
 * dark-mode parity and the token system. Not shipped in production.
 */

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-metadata uppercase text-ink-muted">{title}</h2>
      <div className="flex flex-col gap-4 rounded-lg border border-line-1 bg-surface-card p-4">
        {children}
      </div>
    </section>
  )
}

function Row({
  label,
  children,
}: {
  label?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-caption text-ink-muted">{label}</span>}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

function Showcase({ theme }: { theme: 'light' | 'dark' }) {
  const [switchOn, setSwitchOn] = React.useState(true)
  const [modalOpen, setModalOpen] = React.useState(false)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [checked, setChecked] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [cmdkOpen, setCmdkOpen] = useCommandK()

  const memberColumns: DataTableColumn<DemoMember>[] = [
    { id: 'name', header: 'Name', sortValue: (r) => r.name },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => <Badge variant={badgeForStatus[r.status]}>{r.status}</Badge>,
    },
    {
      id: 'amount',
      header: 'Amount',
      numeric: true,
      sortValue: (r) => r.amount,
      cell: (r) => r.amount.toLocaleString(),
    },
  ]

  return (
    <TooltipProvider>
      <div
        data-theme={theme}
        className="min-h-screen bg-surface-base p-6 font-geist text-body text-ink"
      >
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-h1 text-ink">Metric Design System</h1>
            <p className="text-caption text-ink-muted">
              {theme === 'light'
                ? 'Light — App Workspace'
                : 'Dark — Marketing / Auth / Legal'}
            </p>
          </div>
          <Badge variant="accent" dot>
            {theme}
          </Badge>
        </header>

        <div className="flex flex-col gap-8">
          {/* Buttons */}
          <Section title="Buttons — variants">
            <Row>
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="accent">Accent</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="destructive-ghost">Cancel plan</Button>
              <Button variant="success-ghost">Mark paid</Button>
              <Button variant="link">Link action</Button>
            </Row>
            <Row label="Sizes (xs → xl)">
              <Button size="xs" variant="accent">
                XS
              </Button>
              <Button size="sm" variant="accent">
                SM
              </Button>
              <Button size="md" variant="accent">
                MD
              </Button>
              <Button size="lg" variant="accent">
                LG
              </Button>
              <Button size="xl" variant="accent">
                XL
              </Button>
              <Button size="icon" variant="secondary" aria-label="Add">
                <Plus />
              </Button>
            </Row>
            <Row label="States">
              <Button variant="primary" leftIcon={<Plus />}>
                With icon
              </Button>
              <Button variant="primary" loading>
                Loading
              </Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
              <Button variant="accent" loading>
                Saving
              </Button>
            </Row>
          </Section>

          {/* Badges */}
          <Section title="Badges — status">
            <Row>
              <Badge variant="success" dot>
                Active
              </Badge>
              <Badge variant="warning" dot>
                Due
              </Badge>
              <Badge variant="error" dot>
                Overdue
              </Badge>
              <Badge variant="accent">Pro</Badge>
              <Badge variant="neutral">Neutral</Badge>
            </Row>
          </Section>

          {/* Form controls */}
          <Section title="Form controls">
            <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
              <FormField label="Full name" helperText="As it appears on the ID">
                <Input placeholder="Nimal Perera" />
              </FormField>
              <FormField label="Email" error="Email is required">
                <Input defaultValue="not-an-email" />
              </FormField>
              <FormField label="Membership plan">
                <Select defaultValue="pro">
                  <option value="lite">Lite</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </Select>
              </FormField>
              <FormField label="Search" optional>
                <Input leftIcon={<Search />} placeholder="Search members" />
              </FormField>
              <FormField label="Notes" optional className="tablet:col-span-2">
                <Textarea placeholder="Internal notes…" />
              </FormField>
            </div>
            <Row label="Disabled / read-only">
              <Input disabled placeholder="Disabled" />
              <Input readOnly defaultValue="Read only" />
            </Row>
            <Divider />
            <Row label="Selection controls">
              <Checkbox
                label="Include payment history"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
              />
              <Checkbox label="Indeterminate" indeterminate />
              <Checkbox label="Disabled" disabled />
              <Radio name={`plan-${theme}`} label="Monthly" defaultChecked />
              <Radio name={`plan-${theme}`} label="Annual" />
              <span className="inline-flex items-center gap-2">
                <Switch
                  checked={switchOn}
                  onCheckedChange={setSwitchOn}
                  aria-label="Reminders"
                />
                <span className="text-caption text-ink-secondary">
                  Reminders
                </span>
              </span>
              <Switch tone="success" defaultChecked aria-label="Status" />
            </Row>
          </Section>

          {/* Data display */}
          <Section title="Data display">
            <Card>
              <CardHeader>
                <CardLabel>Members</CardLabel>
                <Button size="xs" variant="secondary" leftIcon={<Plus />}>
                  Add
                </Button>
              </CardHeader>
              <TableContainer className="rounded-none border-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead numeric>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow clickable>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          <Avatar size="sm" name="Nimal Perera" />
                          Nimal Perera
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="success">Active</Badge>
                      </TableCell>
                      <TableCell numeric>4,990</TableCell>
                    </TableRow>
                    <TableRow clickable selected>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          <Avatar size="sm" name="Sara K" />
                          Sara Kularatne
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="warning">Due</Badge>
                      </TableCell>
                      <TableCell numeric>12,500</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>

            <div className="grid grid-cols-1 gap-4 tablet:grid-cols-3">
              <Card>
                <CardBody className="flex flex-col gap-1">
                  <CardLabel>Active members</CardLabel>
                  <span className="font-mono text-2xl font-semibold tabular-nums text-ink">
                    1,284
                  </span>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="flex flex-col gap-2">
                  <CardLabel>Avatars</CardLabel>
                  <div className="flex items-center gap-2">
                    <Avatar size="sm" name="A B" />
                    <Avatar size="md" name="C D" />
                    <Avatar size="lg" name="E F" />
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="flex flex-col gap-2">
                  <CardLabel>Loading</CardLabel>
                  <SkeletonText lines={3} />
                </CardBody>
              </Card>
            </div>
          </Section>

          {/* Feedback */}
          <Section title="Feedback & overlays">
            <Alert variant="info" icon={<Info />} title="Heads up">
              This is an informational message.
            </Alert>
            <Alert variant="success" title="Payment recorded">
              LKR 4,990 collected from Nimal Perera.
            </Alert>
            <Alert variant="warning">Subscription renews in 3 days.</Alert>
            <Alert
              variant="error"
              title="Could not send SMS"
              onDismiss={() => {}}
            >
              The provider rejected the request.
            </Alert>
            <Divider />
            <Row label="Spinner / Skeleton">
              <Spinner size="sm" />
              <Spinner size="md" />
              <Spinner size="lg" />
              <Skeleton className="h-8 w-32" />
              <Skeleton circle className="size-8" />
            </Row>
            <Divider />
            <Row label="Overlays & tooltip">
              <Button variant="secondary" onClick={() => setModalOpen(true)}>
                Open modal
              </Button>
              <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
                Open drawer
              </Button>
              <Tooltip content="Copy member ID" side="top">
                <Button size="icon" variant="ghost" aria-label="Copy">
                  <Copy />
                </Button>
              </Tooltip>
            </Row>
          </Section>

          {/* Empty state */}
          <Section title="Empty state">
            <EmptyState
              icon={<Users />}
              title="No members yet"
              description="Add your first member to get started."
              action={
                <Button variant="accent" leftIcon={<Plus />}>
                  Add member
                </Button>
              }
            />
          </Section>

          {/* Navigation */}
          <Section title="Navigation">
            <Breadcrumb>
              <BreadcrumbLink href="#">Metric</BreadcrumbLink>
              <BreadcrumbSeparator />
              <BreadcrumbLink href="#">Members</BreadcrumbLink>
              <BreadcrumbSeparator />
              <BreadcrumbPage>Nimal Perera</BreadcrumbPage>
            </Breadcrumb>
            <Divider />
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="due">Due</TabsTrigger>
                <TabsTrigger value="overdue">Overdue</TabsTrigger>
              </TabsList>
              <TabsContent value="all">
                <span className="text-ink-secondary">
                  All members shown here.
                </span>
              </TabsContent>
              <TabsContent value="due">
                <span className="text-ink-secondary">Members with dues.</span>
              </TabsContent>
              <TabsContent value="overdue">
                <span className="text-ink-secondary">Overdue members.</span>
              </TabsContent>
            </Tabs>
            <Divider />
            <Accordion type="single" collapsible>
              <AccordionItem value="a">
                <AccordionTrigger>Billing details</AccordionTrigger>
                <AccordionContent>
                  Card ending 4242 · renews 2026-08-24.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="b">
                <AccordionTrigger>Notification settings</AccordionTrigger>
                <AccordionContent>SMS reminders enabled.</AccordionContent>
              </AccordionItem>
            </Accordion>
            <Divider />
            <Pagination page={page} pageCount={8} onPageChange={setPage} />
          </Section>

          {/* Menus & disclosure */}
          <Section title="Menus & disclosure">
            <Row>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" leftIcon={<MoreHorizontal />}>
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent theme={theme}>
                  <DropdownMenuLabel>Member</DropdownMenuLabel>
                  <DropdownMenuItem>View profile</DropdownMenuItem>
                  <DropdownMenuItem>Send reminder</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive>Remove</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="secondary">Open popover</Button>
                </PopoverTrigger>
                <PopoverContent theme={theme}>
                  <p className="font-medium text-ink">Quick note</p>
                  <p className="mt-1 text-ink-secondary">
                    Popovers hold secondary content.
                  </p>
                </PopoverContent>
              </Popover>

              <Button variant="secondary" onClick={() => setCmdkOpen(true)}>
                Command palette (⌘K)
              </Button>
            </Row>
            <Row label="Progress">
              <div className="flex w-full max-w-xs flex-col gap-2">
                <Progress value={30} tone="accent" aria-label="Storage" />
                <Progress value={65} tone="success" aria-label="Uploads" />
                <Progress value={90} tone="warning" aria-label="Quota" />
              </div>
            </Row>
          </Section>

          {/* DataTable */}
          <Section title="DataTable">
            <DataTable
              columns={memberColumns}
              data={DEMO_MEMBERS}
              getRowId={(r) => r.id}
              searchable
              selectable
              pageSize={4}
              defaultSort={{ columnId: 'name', direction: 'asc' }}
              bulkActions={(rows) => (
                <Button size="xs" variant="destructive-ghost">
                  Delete {rows.length}
                </Button>
              )}
            />
          </Section>

          {/* Charts */}
          <Section title="Charts">
            <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardLabel>Revenue — line</CardLabel>
                </CardHeader>
                <CardBody>
                  <LineChart
                    label="Revenue trend"
                    data={REVENUE}
                    xKey="month"
                    series={[{ key: 'revenue', label: 'Revenue' }]}
                    valueFormatter={(v) => `LKR ${Number(v).toLocaleString()}k`}
                  />
                </CardBody>
              </Card>
              <Card>
                <CardHeader>
                  <CardLabel>Revenue — bar</CardLabel>
                </CardHeader>
                <CardBody>
                  <BarChart
                    label="Monthly revenue"
                    data={REVENUE}
                    xKey="month"
                    series={[{ key: 'revenue', label: 'Revenue' }]}
                  />
                </CardBody>
              </Card>
              <Card>
                <CardHeader>
                  <CardLabel>Revenue — area</CardLabel>
                </CardHeader>
                <CardBody>
                  <AreaChart
                    label="Revenue area"
                    data={REVENUE}
                    xKey="month"
                    series={[{ key: 'revenue', label: 'Revenue' }]}
                  />
                </CardBody>
              </Card>
              <Card>
                <CardHeader>
                  <CardLabel>Plan mix — donut</CardLabel>
                </CardHeader>
                <CardBody>
                  <DonutChart label="Plan mix" data={PLAN_MIX} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader>
                  <CardLabel>Plan mix — pie</CardLabel>
                </CardHeader>
                <CardBody>
                  <PieChart label="Plan mix pie" data={PLAN_MIX} />
                </CardBody>
              </Card>
              <Card>
                <CardBody className="flex flex-col gap-1">
                  <CardLabel>Sparkline</CardLabel>
                  <span className="font-mono text-2xl font-semibold tabular-nums text-ink">
                    590k
                  </span>
                  <Sparkline
                    data={REVENUE.map((r) => ({ value: r.revenue }))}
                  />
                </CardBody>
              </Card>
            </div>
          </Section>
        </div>

        <Modal
          open={modalOpen}
          onOpenChange={setModalOpen}
          theme={theme}
          destructive
          title="Cancel subscription"
          description="This will cancel the gym's subscription at the end of the current period."
          footer={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Keep plan
              </Button>
              <Button
                variant="destructive"
                leftIcon={<Trash2 />}
                onClick={() => setModalOpen(false)}
              >
                Cancel subscription
              </Button>
            </>
          }
          footerStart="Effective 2026-08-24"
        >
          <p className="text-ink-secondary">
            Members keep access until the period ends.
          </p>
        </Modal>

        <Drawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          theme={theme}
          title="Member record"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
                Close
              </Button>
              <Button variant="accent" onClick={() => setDrawerOpen(false)}>
                Save
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Avatar size="lg" name="Nimal Perera" />
              <div>
                <p className="font-medium text-ink">Nimal Perera</p>
                <p className="font-mono text-mono-sm text-ink-muted">
                  077 123 4567
                </p>
              </div>
            </div>
            <FormField label="Plan">
              <Select defaultValue="pro">
                <option value="lite">Lite</option>
                <option value="pro">Pro</option>
              </Select>
            </FormField>
          </div>
        </Drawer>

        <CommandPalette
          open={cmdkOpen}
          onOpenChange={setCmdkOpen}
          theme={theme}
        >
          <CommandGroup heading="Navigate">
            <CommandItem onSelect={() => setCmdkOpen(false)}>
              <LayoutDashboard />
              Go to dashboard
            </CommandItem>
            <CommandItem onSelect={() => setCmdkOpen(false)}>
              <Users />
              Go to members
            </CommandItem>
            <CommandItem onSelect={() => setCmdkOpen(false)}>
              <CreditCard />
              Go to billing
            </CommandItem>
          </CommandGroup>
        </CommandPalette>
      </div>
    </TooltipProvider>
  )
}

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <div className="grid grid-cols-1 laptop:grid-cols-2">
      <Showcase theme="light" />
      <Showcase theme="dark" />
    </div>
  )
}
