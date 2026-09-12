import fs from 'node:fs'
import path from 'node:path'

/**
 * The auth email templates in `supabase/templates/`.
 *
 * These are pushed to Supabase by `supabase config push` and their content is
 * WRITE-ONLY through the CLI — `config pull` round-trips a template's subject
 * but never its HTML. Nothing else in this repository looks at them, so a
 * mistake here reaches every user's inbox and is invisible locally.
 *
 * Two rules, both learned the hard way.
 */

const TEMPLATE_DIR = path.join(process.cwd(), 'supabase/templates')
const LINK_TEMPLATES = ['recovery', 'confirmation', 'email_change'] as const

const read = (name: string) =>
  fs.readFileSync(path.join(TEMPLATE_DIR, `${name}.html`), 'utf8')

const templateFiles = () =>
  fs.readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith('.html'))

describe('auth email templates', () => {
  /**
   * Supabase renders these with Go's text/template, which does not know what an
   * HTML comment is. A `{{ .Whatever }}` inside `<!-- -->` is interpolated just
   * like one in the body.
   *
   * That bit: the comment explaining why `{{ .ConfirmationURL }}` must not be
   * used contained a live `{{ .ConfirmationURL }}`, so every sent email carried
   * a real single-use confirmation URL in its source — twice — which is exactly
   * the scanner-consumable link the comment was warning against. Caught by
   * reading the rendered template back out of the Management API, not from the
   * file, because the file looks harmless.
   */
  it.each(templateFiles())(
    '%s contains no template directive inside an HTML comment',
    (file) => {
      const html = fs.readFileSync(path.join(TEMPLATE_DIR, file), 'utf8')
      const comments = html.match(/<!--[\s\S]*?-->/g) ?? []
      const live = comments.flatMap(
        (c) => c.match(/\{\{\s*\.\w+\s*\}\}/g) ?? []
      )

      expect(live).toEqual([])
    }
  )

  /**
   * `{{ .ConfirmationURL }}` points at Supabase's own `/verify`, which spends
   * the one-time token on GET. Email scanners issue GETs, so the token is gone
   * before the recipient clicks — the defect that broke password recovery for
   * as long as it existed. The token_hash form carries the token to our own
   * page, which spends it only on submit.
   */
  it.each(LINK_TEMPLATES)('%s never RENDERS ConfirmationURL', (name) => {
    // The bare word is fine and deliberate — the comments name it to explain
    // why it is avoided. What must not exist is a renderable `{{ ... }}` form,
    // anywhere in the file, comment or body.
    expect(read(name)).not.toMatch(/\{\{\s*\.ConfirmationURL\s*\}\}/)
  })

  it.each(LINK_TEMPLATES)('%s links via RedirectTo + TokenHash', (name) => {
    const href = read(name).match(/href="([^"]+)"/)?.[1] ?? ''

    expect(href).toContain('{{ .RedirectTo }}')
    expect(href).toContain('{{ .TokenHash }}')
  })

  /**
   * Every caller's `emailRedirectTo` is byte-identical and carries no query
   * string, so every template appends with `?`. When one caller passed
   * `?next=/settings/security`, that template alone needed `&` — a
   * one-character difference, invisible until a link broke.
   */
  it.each(LINK_TEMPLATES)('%s appends its params with "?"', (name) => {
    const href = read(name).match(/href="([^"]+)"/)?.[1] ?? ''

    expect(href).toContain('{{ .RedirectTo }}?token_hash=')
    expect(href).not.toContain('{{ .RedirectTo }}&')
  })

  it.each(LINK_TEMPLATES)('%s states which flow it is for', (name) => {
    // `/auth/callback` and `/reset-password` both branch on `type`; a template
    // omitting it sends the user somewhere generic.
    expect(read(name)).toMatch(/&type=\w+/)
  })

  /**
   * The security notification is not a confirmation: it reports a change that
   * already happened. A link would invite a click that does nothing, and a
   * token in it would be a credential sent to an address that just lost access.
   */
  it('the email-changed notification carries no link and no token', () => {
    const html = read('email_changed_notification')

    expect(html).not.toMatch(/\{\{\s*\.TokenHash\s*\}\}/)
    expect(html).not.toMatch(/\{\{\s*\.ConfirmationURL\s*\}\}/)
    expect(html).not.toMatch(/<a\s+href=/i)
    // It should still name both addresses, which is its entire purpose.
    expect(html).toContain('{{ .OldEmail }}')
    expect(html).toContain('{{ .Email }}')
  })
})
