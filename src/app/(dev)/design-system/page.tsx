'use client'

import * as React from 'react'
import { notFound } from 'next/navigation'
import { Search, Copy, Trash2, Plus, Users, Info } from 'lucide-react'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardLabel,
  Checkbox,
  Divider,
  Drawer,
  EmptyState,
  FormField,
  Input,
  Modal,
  Radio,
  Select,
  Skeleton,
  SkeletonText,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  Tooltip,
  TooltipProvider,
} from '@/components/ui'

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
