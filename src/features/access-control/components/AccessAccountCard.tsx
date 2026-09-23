'use client'

/**
 * The gym's vendor account — the one form that has to exist before any of this
 * works.
 *
 * ## Why the password field is always empty
 *
 * Credentials are write-only. They are encrypted at rest and never read back,
 * not even to the owner who typed them. So this form cannot pre-fill, and the
 * absence of a value must not read as "nothing is saved" — the verified badge
 * carries that meaning instead.
 *
 * ## Why verifying is a separate button
 *
 * Saving proves we stored what was typed. It proves nothing about whether the
 * vendor accepts it. Those are different questions and a gym owner staring at a
 * door that will not open needs to be able to ask the second one on its own,
 * repeatedly, without re-entering a password.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, KeyRound, ShieldAlert } from 'lucide-react'
import { Alert, Badge, Button, Card, FormField, Input } from '@/components/ui'
import {
  useAccessAccount,
  useSaveAccessAccount,
  useVerifyAccessAccount,
} from '../hooks/useAccessControl'

export default function AccessAccountCard() {
  const { data: account, isLoading } = useAccessAccount()
  const save = useSaveAccessAccount()
  const verify = useVerifyAccessAccount()

  const [baseUrl, setBaseUrl] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [areaId, setAreaId] = useState('')

  // Populated from the account once, not bound to it: `baseUrl` is the only
  // field the server gives back, and re-syncing on every render would fight
  // the owner's typing.
  const [hydrated, setHydrated] = useState(false)
  if (!hydrated && account) {
    setBaseUrl(account.baseUrl)
    setAreaId(account.areaId === null ? '' : String(account.areaId))
    setHydrated(true)
  }

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        baseUrl: baseUrl.trim(),
        email: email.trim(),
        password,
        ...(areaId.trim() ? { areaId: Number(areaId) } : {}),
      })

      // Cleared on success so the password does not sit in a form field for
      // the rest of the session.
      setPassword('')
      toast.success('Credentials saved')

      const { verified } = await verify.mutateAsync()
      toast[verified ? 'success' : 'error'](
        verified
          ? 'Connected to your access control account'
          : 'Saved, but the account did not accept these details'
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not save the details'
      )
    }
  }

  const handleVerify = async () => {
    try {
      const { verified } = await verify.mutateAsync()
      toast[verified ? 'success' : 'error'](
        verified
          ? 'Connection is working'
          : 'The account did not accept the saved details'
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not reach the account'
      )
    }
  }

  const canSave =
    baseUrl.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length > 0 &&
    !save.isPending

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-ink">
            Access Control Account
          </h3>
          <p className="mt-1 text-sm text-ink-secondary">
            The login for your door hardware platform. Your installer sets this
            up — ask them for the address, email and password.
          </p>
        </div>

        {!isLoading && account && (
          <Badge variant={account.verified ? 'success' : 'warning'} dot>
            {account.verified
              ? 'Connected'
              : account.lastVerifiedAt
                ? 'Needs checking'
                : 'Not verified'}
          </Badge>
        )}
      </div>

      {account && !account.verified && !account.lastVerifiedAt && (
        <Alert
          variant="warning"
          icon={<ShieldAlert className="h-4 w-4" aria-hidden="true" />}
          title="These details have not been confirmed yet"
        >
          Doors will not respond until the connection works. Check the address
          and password with your installer, then verify again.
        </Alert>
      )}

      {account && !account.verified && account.lastVerifiedAt && (
        <Alert
          variant="warning"
          icon={<ShieldAlert className="h-4 w-4" aria-hidden="true" />}
          title="We have not reached your door hardware recently"
        >
          It last worked on {new Date(account.lastVerifiedAt).toLocaleString()}.
          Press Test connection to check it again.
        </Alert>
      )}

      {account?.verified && account.lastVerifiedAt && (
        <p className="flex items-center gap-1.5 text-sm text-ink-secondary">
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
          Confirmed working {new Date(account.lastVerifiedAt).toLocaleString()}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Server address"
          helperText="The web address of your access control system."
          className="sm:col-span-2"
        >
          <Input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="https://your-system.example.com"
            autoComplete="off"
          />
        </FormField>

        <FormField label="Email">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="installer@example.com"
            autoComplete="off"
          />
        </FormField>

        <FormField
          label="Password"
          helperText={
            account
              ? 'Stored securely and never shown again. Re-enter it to change it.'
              : 'Stored securely and never shown again.'
          }
        >
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </FormField>

        <FormField
          label="Area number"
          optional
          helperText="Leave blank unless your installer gave you one."
        >
          <Input
            inputMode="numeric"
            value={areaId}
            onChange={(event) => setAreaId(event.target.value)}
            placeholder="1"
          />
        </FormField>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="accent" onClick={handleSave} disabled={!canSave}>
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          {account ? 'Update and connect' : 'Save and connect'}
        </Button>

        {account && (
          <Button
            variant="secondary"
            onClick={handleVerify}
            loading={verify.isPending}
            disabled={save.isPending}
          >
            Test connection
          </Button>
        )}
      </div>
    </Card>
  )
}
