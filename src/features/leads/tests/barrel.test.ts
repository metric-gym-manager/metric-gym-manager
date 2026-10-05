/**
 * @jest-environment node
 */
import fs from 'node:fs'
import path from 'node:path'

/**
 * The `@/features/leads` barrel is server-tainted: it re-exports the factory,
 * which reaches nodemailer (`node:net`) through `lib/email/smtp.ts`. A client
 * component importing the barrel pulls that into the browser bundle, and the
 * production build fails ("the chunking context does not support external
 * modules (request: node:net)"). That happened to `DemoModal` on 2026-10-05,
 * caught only by Vercel's build because jsdom tests never bundle.
 *
 * Client code deep-imports what it needs, e.g.
 * `@/features/leads/config/LeadConfig` — the SMS barrel's rule, applied here.
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

describe('the leads barrel', () => {
  it('is never imported by a client component', () => {
    const offenders = sourceFiles(path.join(process.cwd(), 'src')).filter(
      (file) => {
        const source = fs.readFileSync(file, 'utf8')
        return (
          /^\s*['"]use client['"]/.test(source) &&
          /from ['"]@\/features\/leads['"]/.test(source)
        )
      }
    )
    expect(offenders.map((f) => path.relative(process.cwd(), f))).toEqual([])
  })
})
