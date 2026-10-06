/**
 * Fills a Resend template's `{{{VARIABLE}}}` placeholders.
 *
 * Broadcasts take finished HTML, not a template id (templates work only with
 * single sends), so the pipeline fetches the template and fills it here. What
 * stays for Resend: `{{{contact.<key>}}}` (filled per recipient when the
 * broadcast goes out) and `{{{RESEND_UNSUBSCRIBE_URL}}}`.
 *
 * Values are inserted as given: escaping is the caller's job
 * (`announcementContent.ts`), because some values are deliberately markup
 * (`*_HTML`) and some are links that carry `{{{contact.*}}}` on purpose.
 */

/** A variable as the template declares it, with its fallback. */
export interface TemplateVariableDef {
  key: string
  fallback: string | number | null
}

export interface RenderedTemplate {
  html: string
  /** Placeholders left with no value and no fallback: the email must not go. */
  unresolved: string[]
}

const PLACEHOLDER = /\{\{\{\s*([^}|]+?)\s*(?:\|([^}]*))?\}\}\}/g

/** Placeholders Resend fills itself, at send time. */
function belongsToResend(name: string): boolean {
  return name.startsWith('contact.') || name === 'RESEND_UNSUBSCRIBE_URL'
}

/**
 * Fill every placeholder we have a value for, in one pass, so an inserted
 * value is never read as a template itself.
 *
 * @param html - The template's HTML (or text)
 * @param values - Our values by variable name
 * @param declared - The template's variables and their fallbacks
 * @returns The filled HTML, and every placeholder left unfilled
 *
 * @example
 * renderTemplate('v{{{VERSION}}}', { VERSION: '1.2.0' }, []).html // 'v1.2.0'
 */
export function renderTemplate(
  html: string,
  values: Readonly<Record<string, string | number>>,
  declared: readonly TemplateVariableDef[]
): RenderedTemplate {
  const fallbacks = new Map(declared.map((v) => [v.key, v.fallback]))
  const unresolved = new Set<string>()

  const filled = html.replace(
    PLACEHOLDER,
    (whole, rawName: string, inline: string | undefined) => {
      const name = rawName.trim()
      if (belongsToResend(name)) return whole
      if (Object.prototype.hasOwnProperty.call(values, name)) {
        return String(values[name])
      }
      const fallback = fallbacks.get(name)
      if (fallback !== undefined && fallback !== null) return String(fallback)
      if (inline !== undefined) return inline
      unresolved.add(name)
      return whole
    }
  )

  return { html: filled, unresolved: [...unresolved] }
}

/**
 * Put a notice at the top of an email (the preview's "this goes out at …").
 *
 * @param html - The rendered email
 * @param banner - Markup to show first
 */
export function withPreviewBanner(html: string, banner: string): string {
  const body = /<body[^>]*>/i.exec(html)
  if (!body) return banner + html
  const at = body.index + body[0].length
  return html.slice(0, at) + banner + html.slice(at)
}

/**
 * The template's own variables, in order of first use: what it expects the
 * pipeline to fill. Resend's placeholders are left out.
 *
 * @param html - A template's HTML or subject
 */
export function placeholdersIn(html: string): string[] {
  const names = new Set<string>()
  for (const match of html.matchAll(PLACEHOLDER)) {
    const name = match[1].trim()
    if (!belongsToResend(name)) names.add(name)
  }
  return [...names]
}
