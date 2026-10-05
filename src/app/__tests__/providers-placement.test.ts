/**
 * @jest-environment node
 */
import fs from 'node:fs'
import path from 'node:path'

/**
 * The signed-in app's machinery — react-query, the toaster, the service-worker
 * registration and AuthRecovery (with the Supabase browser client) — is
 * mounted by `AppProviders` in the layouts that need it, never in the root
 * layout (SEO-060, owner decision 2026-10-04).
 *
 * In the root layout it reached every public page: measured on a production
 * build, 87 KB of gzipped JavaScript on the homepage, the guides, the legal
 * pages and /join, none of which use it.
 */
const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), 'utf8')

const APP_PIECES =
  /\b(QueryProvider|AuthRecovery|ServiceWorkerRegistration|Toaster|AppProviders)\b/

/** Layouts of surfaces where a session exists or is being established. */
const APP_LAYOUTS = [
  'src/app/(dashboard)/layout.tsx',
  'src/app/(admin)/layout.tsx',
  'src/app/(auth)/layout.tsx',
  'src/app/(dev)/layout.tsx',
  'src/app/demo-sms/layout.tsx',
]

/** Layouts every public page renders inside. */
const PUBLIC_LAYOUTS = ['src/app/layout.tsx', 'src/app/(marketing)/layout.tsx']

describe('where the app providers are mounted', () => {
  it.each(PUBLIC_LAYOUTS)('%s mounts none of them', (file) => {
    expect(read(file)).not.toMatch(APP_PIECES)
  })

  it.each(APP_LAYOUTS)('%s wraps its children in AppProviders', (file) => {
    const source = read(file)
    expect(source).toMatch(
      /import \{ AppProviders \} from '@\/components\/providers\/AppProviders'/
    )
    expect(source).toMatch(/<AppProviders>/)
  })
})
