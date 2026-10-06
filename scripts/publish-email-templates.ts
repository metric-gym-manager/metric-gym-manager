/**
 * Publishes the two announcement email designs to Resend.
 *
 *   npx tsx scripts/publish-email-templates.ts
 *       Creates or updates `release-announcement` and `policy-update` from
 *       src/features/mailing/config/announcementTemplates.ts, publishes them,
 *       and reads them back. A template already identical is left alone.
 *
 *   npx tsx scripts/publish-email-templates.ts --check
 *       Changes nothing; says whether Resend publishes what the repo holds.
 *
 * The Release workflow (.github/workflows/release.yml) runs it on a push to
 * master that changes the designs, so editing that file is the whole job.
 * Reads RESEND_API_KEY from the environment or .env.local.
 */

import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

async function main() {
  const { createResendClient } = await import('@/lib/email/resend')
  const { ANNOUNCEMENT_TEMPLATES, templateVariableDeclarations } =
    await import('@/features/mailing/config/announcementTemplates')
  const { AnnouncementKind } =
    await import('@/features/mailing/config/AnnouncementConfig')

  const resend = createResendClient()
  if (!resend) throw new Error('RESEND_API_KEY is not set')
  const check = process.argv.includes('--check')
  let drift = false

  for (const kind of Object.values(AnnouncementKind)) {
    const source = ANNOUNCEMENT_TEMPLATES[kind]
    const variables = templateVariableDeclarations(kind)
    const existing = await resend.templates.get(source.alias)
    if (existing.error && existing.error.name !== 'not_found') {
      throw new Error(`${source.alias}: ${existing.error.message}`)
    }

    const current = existing.data
    const same =
      current !== null &&
      current.status === 'published' &&
      !current.has_unpublished_versions &&
      current.html === source.html &&
      current.subject === source.subject
    if (same) {
      console.log(`${source.alias}: published and up to date`)
      continue
    }
    if (check) {
      drift = true
      console.log(
        `${source.alias}: ${current ? 'DIFFERS from the repo' : 'MISSING'}`
      )
      continue
    }

    let id: string
    if (current) {
      id = current.id
      const updated = await resend.templates.update(id, {
        name: source.name,
        subject: source.subject,
        html: source.html,
        variables,
      })
      if (updated.error)
        throw new Error(`${source.alias}: ${updated.error.message}`)
    } else {
      const created = await resend.templates.create({
        name: source.name,
        alias: source.alias,
        subject: source.subject,
        html: source.html,
        variables,
      })
      if (created.error || !created.data) {
        throw new Error(`${source.alias}: ${created.error?.message}`)
      }
      id = created.data.id
    }

    const published = await resend.templates.publish(id)
    if (published.error) {
      throw new Error(`${source.alias}: ${published.error.message}`)
    }

    // Read back by alias, as the pipeline will.
    const after = await resend.templates.get(source.alias)
    if (after.error || after.data?.status !== 'published') {
      throw new Error(`${source.alias}: not published after publishing`)
    }
    const matches = after.data.html === source.html
    console.log(
      `${source.alias}: ${current ? 'updated' : 'created'} and published` +
        (matches
          ? ''
          : ' — WARNING: Resend stores different HTML than the repo')
    )
    if (!matches) drift = true
  }

  if (drift) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
