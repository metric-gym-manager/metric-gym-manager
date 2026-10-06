/**
 * @jest-environment node
 */
import fs from 'node:fs'
import path from 'node:path'

/**
 * The `@/features/mailing` barrel is server-tainted: it re-exports the
 * factory, which reaches the Resend SDK and `node:crypto`. A client component
 * importing it would pull those into the browser bundle, and jsdom tests never
 * bundle, so only a production build would notice (the leads barrel's lesson,
 * 2026-10-05). Client code deep-imports `@/features/mailing/config/MailingConfig`.
 */
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' || entry.name === '__tests__'
        ? []
        : sourceFiles(full)
    }
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [full] : []
  })
}

describe('the mailing barrel', () => {
  it('is never imported by a client component', () => {
    const offenders = sourceFiles(path.join(process.cwd(), 'src')).filter(
      (file) => {
        const source = fs.readFileSync(file, 'utf8')
        return (
          /^\s*['"]use client['"]/.test(source) &&
          /from ['"]@\/features\/mailing['"]/.test(source)
        )
      }
    )
    expect(offenders.map((f) => path.relative(process.cwd(), f))).toEqual([])
  })

  it('keeps MailingConfig free of server-only imports', () => {
    const config = fs.readFileSync(
      path.join(process.cwd(), 'src/features/mailing/config/MailingConfig.ts'),
      'utf8'
    )
    expect(config).not.toMatch(/from ['"](node:|resend['"])/)
  })
})
