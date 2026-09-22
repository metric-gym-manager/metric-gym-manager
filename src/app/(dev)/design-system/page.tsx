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
  Home,
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
  ListRow,
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
import {
  AppBar,
  BottomNav,
  ChartCard,
  ConfirmDialog,
  DeleteDialog,
  EmptyStateLayout,
  FilterBar,
  LoadingLayout,
  MetricCard,
  NotificationMenu,
  PageHeader,
  SearchBar,
  SettingsRow,
  SettingsSection,
  SideNav,
  StatCard,
  Toolbar,
  UserMenu,
} from '@/components/common/composites'

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

/**
 * Six-digit LKR figures, which is what the dashboard and revenue charts
 * actually carry. A 40 px Y axis cuts these to "0000 / 5000" (finding F1), so
 * the compact-axis comparison below has to use real magnitudes to mean
 * anything.
 */
const LKR_REVENUE = [
  { month: 'Mar', revenue: 420000 },
  { month: 'Apr', revenue: 380000 },
  { month: 'May', revenue: 1510000 },
  { month: 'Jun', revenue: 640000 },
  { month: 'Jul', revenue: 1190000 },
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
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [smsOn, setSmsOn] = React.useState(true)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [fullscreenOpen, setFullscreenOpen] = React.useState(false)
  const [moreOpen, setMoreOpen] = React.useState(false)
  const [listPage, setListPage] = React.useState(2)
  const [selectedRow, setSelectedRow] = React.useState<string[]>(['2'])

  const memberColumns: DataTableColumn<DemoMember>[] = [
    {
      id: 'name',
      header: 'Name',
      sortValue: (r) => r.name,
      resizable: true,
      minWidth: 120,
    },
    {
      id: 'status',
      header: 'Status',
      resizable: true,
      minWidth: 100,
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

          {/* ── Layer 3 composites ── */}
          {/*
            Mobile (mobile rebuild plan §5, §9, §25).

            Everything here is `phone:`-scoped or inert without its new prop,
            so at this width it is showing the DESKTOP rendering. Open the
            page at 390 px to see the phone one — that is the width the Phase
            1 visual pass was run at, and jsdom cannot see either.
          */}
          <Section title="Mobile — app bar & bottom navigation">
            <Row label="AppBar — root page (identity opens More)">
              <div className="w-full overflow-hidden rounded-sm border border-line-1">
                <AppBar
                  title="Overview"
                  identity={{
                    name: 'Colombo Iron',
                    onOpen: () => setMoreOpen(true),
                    expanded: moreOpen,
                  }}
                />
              </div>
            </Row>
            <Row label="AppBar — nested page (leading Back)">
              <div className="w-full overflow-hidden rounded-sm border border-line-1">
                <AppBar title="Gym profile" onBack={() => {}} />
              </div>
            </Row>
            <Row label="BottomNav — four slots, the fourth is More">
              {/* `static` instead of `fixed` so the bar sits in the page
                  rather than over it; tailwind-merge drops the `fixed`. */}
              <div className="w-full overflow-hidden rounded-sm border border-line-1">
                <BottomNav
                  className="static"
                  activeHref="/members"
                  items={[
                    { name: 'Dashboard', href: '/dashboard', icon: Home },
                    { name: 'Members', href: '/members', icon: Users },
                    {
                      name: 'Renewals',
                      href: '/payment-collection',
                      icon: CreditCard,
                    },
                  ]}
                  more={{
                    open: moreOpen,
                    onToggle: () => setMoreOpen((v) => !v),
                  }}
                />
              </div>
            </Row>
          </Section>

          <Section title="Mobile — ListRow">
            <Row label="Slots: leading · primary · status · meta · value · actions">
              {/* `-mx-4` cancels the Section's padding so the rows render at
                  the width they get in the product — full-bleed under
                  `<main>`. Inside the padded box the value wrapped under the
                  name at 390, which is the ≤ 340 behaviour, in a row that is
                  not that narrow in the app. */}
              <ul role="list" className="-mx-4 w-[calc(100%+2rem)]">
                <ListRow
                  leading={<Avatar size="sm" name="Nimal Perera" />}
                  primary="Nimal Perera"
                  status={<Badge variant="error">Expired</Badge>}
                  meta={['+94 77 123 4567', 'Monthly']}
                  value="3,500"
                  onClick={() => {}}
                  actions={
                    <>
                      <Button size="sm" variant="secondary">
                        Record payment
                      </Button>
                      <Button size="sm" variant="secondary">
                        Remind
                      </Button>
                    </>
                  }
                />
                <ListRow
                  leading={<Avatar size="sm" name="Sara Kularatne" />}
                  primary="Sara Kularatne"
                  status={<Badge variant="warning">Due in 3 days</Badge>}
                  meta={['+94 71 555 0100', 'Annual']}
                  value="12,500"
                  onClick={() => {}}
                />
                <ListRow
                  leading={
                    <Avatar size="sm" name="Wickramasinghe Arachchige Dona" />
                  }
                  primary="Wickramasinghe Arachchige Dona"
                  status={<Badge variant="success">Active</Badge>}
                  meta={['+94 76 900 4321', 'Class pack · 10 sessions']}
                  value="1,000,000"
                  selected
                  onClick={() => {}}
                />
              </ul>
            </Row>
          </Section>

          <Section title="Mobile — DataTable list mode">
            <Row label='forceLayout="list" — the same columns, state and pagination as the table above'>
              <div className="-mx-4 w-[calc(100%+2rem)]">
                <DataTable
                  columns={memberColumns}
                  data={DEMO_MEMBERS}
                  getRowId={(r) => r.id}
                  caption="Members"
                  searchable
                  selectable
                  selectedIds={selectedRow}
                  onSelectionChange={setSelectedRow}
                  pageSize={2}
                  forceLayout="list"
                  mobileRow={{
                    primary: 'name',
                    status: 'status',
                    value: 'amount',
                  }}
                />
              </div>
            </Row>
            <Row label="Empty and error states share the table path's">
              <div className="flex w-full flex-col gap-4">
                <DataTable
                  columns={memberColumns}
                  data={[]}
                  getRowId={(r) => r.id}
                  forceLayout="list"
                  mobileRow={{ primary: 'name' }}
                />
                <DataTable
                  columns={memberColumns}
                  data={DEMO_MEMBERS}
                  getRowId={(r) => r.id}
                  forceLayout="list"
                  error="Could not load members."
                  mobileRow={{ primary: 'name' }}
                />
                <DataTable
                  columns={memberColumns}
                  data={DEMO_MEMBERS}
                  getRowId={(r) => r.id}
                  forceLayout="list"
                  loading
                  loadingRowCount={3}
                  mobileRow={{ primary: 'name' }}
                />
              </div>
            </Row>
          </Section>

          <Section title="Mobile — tabs overflow, compact pagination, sheets">
            <Row label='TabsList overflow="scroll" — badge counts push the strip past 390 px (finding F5)'>
              <div className="w-full">
                <Tabs defaultValue="expired">
                  <TabsList overflow="scroll">
                    <TabsTrigger value="expired">Expired 115</TabsTrigger>
                    <TabsTrigger value="week">Expires this week 39</TabsTrigger>
                    <TabsTrigger value="collected">Collected 125</TabsTrigger>
                  </TabsList>
                  <TabsContent value="expired">
                    <span className="text-ink-secondary">115 expired.</span>
                  </TabsContent>
                  <TabsContent value="week">
                    <span className="text-ink-secondary">39 due.</span>
                  </TabsContent>
                  <TabsContent value="collected">
                    <span className="text-ink-secondary">125 collected.</span>
                  </TabsContent>
                </Tabs>
              </div>
            </Row>
            <Row label="Pagination responsive — numbered here, Prev · 2 of 8 · Next at 390">
              <Pagination
                responsive
                page={listPage}
                pageCount={8}
                onPageChange={setListPage}
              />
            </Row>
            <Row label="Modal placement">
              <Button variant="secondary" onClick={() => setSheetOpen(true)}>
                Open sheet
              </Button>
              <Button
                variant="secondary"
                onClick={() => setFullscreenOpen(true)}
              >
                Open fullscreen
              </Button>
              <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
                Open drawer (bottom sheet at 390)
              </Button>
            </Row>
          </Section>

          <Section title="Mobile — Phase 1 decisions (rendered comparisons)">
            <Row label="§5.9 compactAxis: OFF — six-digit LKR ticks in a 40 px axis">
              <div className="w-full">
                <LineChart
                  label="Revenue, full ticks"
                  data={LKR_REVENUE}
                  xKey="month"
                  series={[{ key: 'revenue', label: 'Revenue' }]}
                  valueFormatter={(v) => `LKR ${Number(v).toLocaleString()}`}
                />
              </div>
            </Row>
            <Row label="§5.9 compactAxis: ON — 420k / 1.5M in the same 40 px">
              <div className="w-full">
                <LineChart
                  label="Revenue, compact ticks"
                  data={LKR_REVENUE}
                  xKey="month"
                  compactAxis
                  series={[{ key: 'revenue', label: 'Revenue' }]}
                  valueFormatter={(v) => `LKR ${Number(v).toLocaleString()}`}
                />
              </div>
            </Row>
            <Row label="o09 bodyPhone: 13/20 (text-body, today) vs 14/20 (text-base) — NOT applied; see the PR">
              <div className="grid w-full grid-cols-1 gap-4 tablet:grid-cols-2">
                <ul role="list" className="rounded-sm border border-line-1">
                  <ListRow
                    primary="Nimal Perera"
                    status={<Badge variant="error">Expired</Badge>}
                    meta={['+94 77 123 4567', 'Monthly']}
                    value="3,500"
                  />
                </ul>
                <ul role="list" className="rounded-sm border border-line-1">
                  <ListRow
                    className="[&_[class*=text-body]]:text-base"
                    primary="Nimal Perera"
                    status={<Badge variant="error">Expired</Badge>}
                    meta={['+94 77 123 4567', 'Monthly']}
                    value="3,500"
                  />
                </ul>
              </div>
            </Row>
          </Section>

          <Section title="Composites — page & toolbar">
            <PageHeader
              title="Members"
              description="Everyone registered at this gym."
              breadcrumb={
                <Breadcrumb>
                  <BreadcrumbLink href="#">Metric</BreadcrumbLink>
                  <BreadcrumbSeparator />
                  <BreadcrumbPage>Members</BreadcrumbPage>
                </Breadcrumb>
              }
              actions={
                <>
                  <NotificationMenu count={3} theme={theme}>
                    <div className="p-3 text-body text-ink-secondary">
                      No new notifications.
                    </div>
                  </NotificationMenu>
                  <UserMenu
                    name="Nimal Perera"
                    email="nimal@example.com"
                    theme={theme}
                    onSignOut={() => {}}
                  />
                  <Button variant="accent" leftIcon={<Plus />}>
                    Add member
                  </Button>
                </>
              }
              bordered
            />
            <FilterBar
              search={
                <SearchBar onSearch={() => {}} placeholder="Search members" />
              }
              filters={
                <Select aria-label="Status filter" className="max-w-[160px]">
                  <option>All statuses</option>
                  <option>Active</option>
                  <option>Due</option>
                </Select>
              }
              actions={
                <Toolbar
                  end={
                    <Button variant="secondary" size="sm">
                      Export
                    </Button>
                  }
                />
              }
            />
          </Section>

          <Section title="Composites — stat & metric cards">
            <div className="grid grid-cols-1 gap-3 tablet:grid-cols-4">
              <StatCard
                label="Active members"
                value="1,284"
                sub="of 1,400 cap"
              />
              <StatCard
                label="Revenue (Jul)"
                value="LKR 590k"
                delta={{ value: '12%', direction: 'up' }}
              />
              <StatCard
                label="Overdue"
                value="23"
                delta={{ value: '4%', direction: 'down', tone: 'error' }}
              />
              <MetricCard
                label="Trend"
                value="590k"
                trend={
                  <Sparkline
                    data={REVENUE.map((r) => ({ value: r.revenue }))}
                  />
                }
              />
            </div>
          </Section>

          <Section title="Composites — chart card & settings">
            <div className="grid grid-cols-1 gap-4 laptop:grid-cols-2">
              <ChartCard title="Revenue" scale="LKR ×1,000">
                <LineChart
                  label="Revenue trend"
                  data={REVENUE}
                  xKey="month"
                  series={[{ key: 'revenue', label: 'Revenue' }]}
                  height={160}
                />
              </ChartCard>
              <SettingsSection
                title="Notifications"
                description="How members are reminded"
              >
                <SettingsRow
                  label="SMS reminders"
                  description="Send 3 days before due date"
                  control={
                    <Switch
                      checked={smsOn}
                      onCheckedChange={setSmsOn}
                      aria-label="SMS reminders"
                    />
                  }
                />
                <SettingsRow
                  label="Email receipts"
                  description="Email a receipt on payment"
                  control={<Switch aria-label="Email receipts" />}
                />
              </SettingsSection>
            </div>
          </Section>

          <Section title="Composites — dialogs, nav & states">
            <Row>
              <Button
                variant="destructive-ghost"
                onClick={() => setConfirmOpen(true)}
              >
                Confirm dialog
              </Button>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                Delete dialog
              </Button>
            </Row>
            <div className="grid grid-cols-1 gap-4 laptop:grid-cols-2">
              <div className="h-[260px] overflow-hidden rounded-lg border border-line-1">
                <SideNav
                  ariaLabel="Demo sidebar"
                  groups={[
                    {
                      label: 'Workspace',
                      items: [
                        {
                          label: 'Dashboard',
                          href: '#',
                          icon: <LayoutDashboard />,
                          active: true,
                        },
                        { label: 'Members', href: '#', icon: <Users /> },
                        { label: 'Billing', href: '#', icon: <CreditCard /> },
                      ],
                    },
                  ]}
                />
              </div>
              <EmptyStateLayout
                minHeight={260}
                icon={<Users />}
                title="No members yet"
                description="Add your first member to get started."
                action={
                  <Button variant="accent" leftIcon={<Plus />}>
                    Add member
                  </Button>
                }
              />
            </div>
            <LoadingLayout variant="cards" />
          </Section>
        </div>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          theme={theme}
          destructive
          title="Cancel subscription"
          description="Members keep access until the end of the current period."
          confirmLabel="Cancel subscription"
          onConfirm={() => {}}
        />

        <DeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          theme={theme}
          title="Delete member"
          description="This permanently removes Nimal Perera and their history."
          confirmWord="DELETE"
          onConfirm={() => {}}
        />

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

        <Modal
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          theme={theme}
          placement="sheet"
          title="Record payment"
          footer={
            <>
              <Button variant="secondary" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
              <Button variant="accent" onClick={() => setSheetOpen(false)}>
                Mark paid
              </Button>
            </>
          }
        >
          <FormField label="Paid on">
            <Input type="date" defaultValue="2026-09-14" />
          </FormField>
        </Modal>

        <Modal
          open={fullscreenOpen}
          onOpenChange={setFullscreenOpen}
          theme={theme}
          placement="fullscreen"
          title="Member details"
          footerStart="Joined 2024-02-11"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setFullscreenOpen(false)}
              >
                Close
              </Button>
              <Button variant="accent" onClick={() => setFullscreenOpen(false)}>
                Mark paid
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <p className="text-ink-secondary">
              At 390 px this fills the screen, leads with Back instead of ×, and
              closes on the hardware Back button. At this width it is the
              centred dialog — every placement effect is `phone:`-scoped.
            </p>
            <FormField label="Plan">
              <Select defaultValue="pro">
                <option value="lite">Lite</option>
                <option value="pro">Pro</option>
              </Select>
            </FormField>
          </div>
        </Modal>

        <Drawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          theme={theme}
          size="auto"
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
