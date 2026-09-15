#!/usr/bin/env node
/**
 * Architecture guard — machine-enforces the non-negotiable structural rules in
 * docs/architecture/feature-first-growth-rules.md so the codebase cannot drift
 * back into an unorganized, multi-architecture mess.
 *
 * Run manually:      npm run arch:check
 * Runs automatically: pre-commit hook + CI (see the rulebook's Enforcement section)
 *
 * Exit code 0 = clean, 1 = one or more violations (printed with the rule they break).
 * This script has ZERO dependencies on purpose — it must run before `npm install`.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const FEATURES = path.join(SRC, 'features')
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations')

const violations = []
const fail = (rule, msg) => violations.push({ rule, msg })

const exists = (p) => fs.existsSync(p)
const isDir = (p) => exists(p) && fs.statSync(p).isDirectory()

/** Recursively collect files under `dir` matching one of `exts`. */
function walk(dir, exts, acc = []) {
  if (!isDir(dir)) return acc
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      walk(full, exts, acc)
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      acc.push(full)
    }
  }
  return acc
}

// ── R1: No competing / dissolved architecture layers ────────────────────────
// Business logic has exactly one home per domain: src/features/<domain>/.
const BANNED_DIRS = ['core', 'infrastructure', 'presentation', 'services']
for (const name of BANNED_DIRS) {
  if (isDir(path.join(SRC, name))) {
    fail(
      'R1',
      `src/${name}/ exists. This competing layer was dissolved into features/. ` +
        `Move its code into src/features/<domain>/ (or src/lib/ for third-party glue).`
    )
  }
}

// ── R1: No source imports the dissolved-layer aliases ───────────────────────
const BANNED_IMPORT =
  /from\s+['"]@\/(core|infrastructure|presentation|services)(\/|['"])/
for (const file of walk(SRC, ['.ts', '.tsx'])) {
  const text = fs.readFileSync(file, 'utf8')
  const line = text.split('\n').findIndex((l) => BANNED_IMPORT.test(l))
  if (line !== -1) {
    fail(
      'R1',
      `${path.relative(ROOT, file)}:${line + 1} imports a dissolved layer (@/core|@/infrastructure|@/presentation|@/services). ` +
        `Import from a feature's public surface (@/features/<domain>) or from @/lib / @/utils instead.`
    )
  }
}

// ── R4: Every feature exposes a public index.ts ─────────────────────────────
if (isDir(FEATURES)) {
  for (const entry of fs.readdirSync(FEATURES, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (!exists(path.join(FEATURES, entry.name, 'index.ts'))) {
      fail(
        'R4',
        `src/features/${entry.name}/ has no index.ts. Every feature MUST publish a public API ` +
          `barrel so consumers import from @/features/${entry.name}, not its internals.`
      )
    }
  }
} else {
  fail(
    'R1',
    'src/features/ does not exist — feature-first structure is required.'
  )
}

// ── R10: No stray junk / one-off files at the repo root ─────────────────────
// The mess this guards against: dev logs, tsc dumps, and one-off *_ANALYSIS docs
// that accumulated at the root. Living docs belong under docs/<taxonomy>/.
const ROOT_JUNK = [
  { re: /\.log$/i, why: 'log files must be gitignored, never committed' },
  {
    re: /_ANALYSIS\.(md|txt)$/i,
    why: 'one-off analyses belong in git history, not the tree',
  },
  {
    re: /^type-check-output|^tsc-output/i,
    why: 'compiler output dumps must not be committed',
  },
  { re: /\.tmp$/i, why: 'temp files must not be committed' },
  {
    re: /\.sql$/i,
    why: 'SQL belongs in supabase/migrations/, not the repo root',
  },
]
for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!entry.isFile()) continue
  for (const { re, why } of ROOT_JUNK) {
    if (re.test(entry.name)) {
      fail('R10', `Stray root file "${entry.name}": ${why}.`)
      break
    }
  }
}

// ── R11: No duplicate migration timestamps ──────────────────────────────────
// A duplicate numeric prefix makes apply-order non-deterministic across machines.
if (isDir(MIGRATIONS)) {
  const seen = new Map()
  for (const name of fs.readdirSync(MIGRATIONS)) {
    if (!name.endsWith('.sql')) continue
    const stamp = name.split('_')[0]
    if (!/^\d{14}$/.test(stamp)) continue
    if (seen.has(stamp)) {
      fail(
        'R11',
        `Duplicate migration timestamp ${stamp}: "${name}" collides with "${seen.get(stamp)}". ` +
          `Rename one to a unique timestamp so replay order is deterministic.`
      )
    } else {
      seen.set(stamp, name)
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// UI OVERHAUL RATCHETS (UI1–UI2)
// Added 2026-08-29 for the workspace UI overhaul. See
// docs/architecture/workspace-ui-overhaul-log.md and architecture.md rule 2.21.
//
// These are RATCHETS, not absolutes: the codebase is mid-migration, so each
// rule carries a baseline of known exceptions that must SHRINK, never grow.
// When you clear one, delete it from the list here in the same commit.
// ════════════════════════════════════════════════════════════════════════════

const UI_SRC_TSX = walk(SRC, ['.tsx', '.ts']).filter(
  (f) => !f.includes('__tests__') && !f.includes(`${path.sep}tests${path.sep}`)
)
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/')

/** Source with comments stripped — a doc comment that mentions a banned
 * pattern is discussing it, not using it. */
function codeOf(file) {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

// ── UI1: No component is reachable only through a barrel ────────────────────
// Every rebuild in this repo has been additive: the new implementation ships,
// the old one stays, and the barrel keeps exporting it so nothing flags it.
// That produced 6,026 dead lines. A component referenced ONLY by an index.ts
// (or only by the dev showcase) is orphaned.
const UI1_ALLOW = new Set([
  // Ruling R3 (2026-08-29) — kept deliberately; re-evaluate after Phase 3.
  'CommandPalette',
  'Accordion',
  'Radio',
  'NotificationMenu',
  'DeleteDialog',
  'FilterBar',
  'Toolbar',
  'Popover',
  // Directive targets — unused today, mounted during Phase 2/3. Deleting them
  // would mean rebuilding under new names, which directive §4.4 bans.
  'Drawer',
  'Divider',
  // Mobile rebuild Phase 1 (plan §5.11, §25.2–§25.3): the phone chrome is
  // BUILT in Phase 1 and WIRED INTO THE SHELL in Phase 2, which is the order
  // the plan sets (§18 rows 1 and 2) so the primitives exist before the shell
  // that composes them. They render in the dev showcase, which UI1
  // deliberately does not count as an entry point. Phase 2's scope item 6 is
  // "remove Drawer, AppBar, BottomNav from any allow-list they were parked
  // in" — so these two lines have a deadline, and the ratchet above fails the
  // moment the shell mounts them and they are still listed here.
  'AppBar',
  'BottomNav',
  // DESIGN_SYSTEM.md §12 — staged for future placement, do not sweep.
  'RevenueMetricCard',
  'InstallButton',
  // Orphaned when Phase 0.1 removed its last two consumers, but it carries the
  // best a11y pattern in the product (role="status" + a full aria-label) and is
  // the reference for the consolidated status indicator in Phase 3 (plan §5).
  'UrgencyBadge',
  // Unused in the product; `Charts.tsx` imports **recharts'** Tooltip, not this
  // one — a distinction that fooled an earlier manual audit.
  'Tooltip',
])

const componentFiles = UI_SRC_TSX.filter((f) => {
  const r = rel(f)
  if (!r.endsWith('.tsx')) return false
  if (r.endsWith('/index.tsx')) return false
  if (r.includes('/design-system/')) return false
  return (
    r.startsWith('src/components/') ||
    /^src\/features\/[^/]+\/components\//.test(r)
  )
})

// Reachability from the application's real entry points, NOT a reference count.
// A reference count only ever finds the *head* of a dead chain: a component
// imported solely by another dead component looks alive. Phase 0.1b had to be
// run three times by hand for exactly this reason, and a probe confirmed the
// rule still behaved that way. Walking the graph from src/app finds the whole
// chain in one pass.
const MODULE_EXTS = ['.tsx', '.ts']
function resolveSpecifier(spec, fromFile) {
  let base
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2))
  else if (spec.startsWith('.'))
    base = path.resolve(path.dirname(fromFile), spec)
  else return null
  for (const ext of MODULE_EXTS) {
    if (exists(base + ext)) return base + ext
    const idx = path.join(base, 'index' + ext)
    if (exists(idx)) return idx
  }
  return exists(base) && !isDir(base) ? base : null
}

// Barrels are TRANSPARENT. Importing `@/components/ui` must not mark all 32
// primitives live — that trades under-reporting for over-reporting, which a
// probe caught immediately. For a barrel target we resolve the *named* imports
// to the modules that actually export them.
function exportedNames(file) {
  let src
  try {
    src = fs.readFileSync(file, 'utf8')
  } catch {
    return []
  }
  const names = new Set([path.basename(file).replace(/\.tsx?$/, '')])
  for (const m of src.matchAll(
    /export\s+(?:const|function|class|type|interface)\s+([A-Za-z_$][\w$]*)/g
  ))
    names.add(m[1])
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g))
    for (const part of m[1].split(','))
      names.add(
        part
          .split(/\s+as\s+/)
          .pop()
          .trim()
      )
  return [...names].filter(Boolean)
}

/** For a barrel, map each re-exported name to the file providing it. */
function barrelMap(indexFile) {
  const src = fs.readFileSync(indexFile, 'utf8')
  const map = new Map()
  for (const m of src.matchAll(
    /export\s+(?:\*|\{([^}]*)\})\s+from\s*['"]([^'"]+)['"]/g
  )) {
    const target = resolveSpecifier(m[2], indexFile)
    if (!target) continue
    const names = m[1]
      ? m[1].split(',').map((x) =>
          x
            .split(/\s+as\s+/)
            .pop()
            .trim()
        )
      : exportedNames(target)
    for (const n of names) if (n) map.set(n, target)
  }
  return map
}

// `import type { X }` is erased at build time and keeps nothing alive, so it
// must not mark a module reachable. It also must not be mistaken for a default
// import — that misread pulled the whole `@/components/ui` barrel in through a
// single type import and made every primitive look live.
const IMPORT_RE =
  /import\s+(?!type\s)(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\})?[^'"]*['"]([^'"]+)['"]|(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g
const TYPE_IMPORT_RE = /import\s+type\s+[^'"]*['"]([^'"]+)['"]/g
const barrelCache = new Map()

/**
 * Every module reachable from `entries` by following real (non-type) imports.
 *
 * Extracted so UI1 (reachable from `src/app` — is it alive?) and UI3 (reachable
 * from the test suite — is it rendered?) ask the SAME question of the SAME
 * graph. Two hand-written walks would drift, and the barrel-transparency rule
 * below is subtle enough that only one copy of it should exist.
 */
function reachableFrom(entries) {
  const seen = new Set(entries)
  const queue = [...entries]
  const visit = (t) => {
    if (t && !seen.has(t)) {
      seen.add(t)
      queue.push(t)
    }
  }
  while (queue.length) {
    const file = queue.pop()
    let src
    try {
      src = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const typeOnly = new Set([...src.matchAll(TYPE_IMPORT_RE)].map((m) => m[1]))
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[3] ?? m[4]
      if (!spec || typeOnly.has(spec)) continue
      const target = resolveSpecifier(spec, file)
      if (!target) continue
      if (path.basename(target) === 'index.ts' && !m[1]) {
        // Named imports through a barrel: follow only what was actually asked for.
        if (!barrelCache.has(target)) barrelCache.set(target, barrelMap(target))
        const map = barrelCache.get(target)
        const named = (m[2] ?? '')
          .split(',')
          .map((x) =>
            x
              .split(/\s+as\s+/)[0]
              .replace(/^type\s+/, '')
              .trim()
          )
          .filter(Boolean)
        if (named.length) {
          for (const n of named) visit(map.get(n))
          continue
        }
      }
      visit(target)
    }
  }
  return seen
}

const entries = UI_SRC_TSX.filter((f) => {
  const r = rel(f)
  // The dev showcase imports every primitive by design; treating it as an entry
  // point would make the whole library look live.
  if (r.includes('/design-system/')) return false
  return r.startsWith('src/app/') || r.endsWith('middleware.ts')
})
const reachable = reachableFrom(entries)

// Ratchet: an allow-entry that is now reachable is a finished migration hiding
// behind a stale exemption. Same discipline as UI2.
for (const file of componentFiles) {
  const base = path.basename(file, '.tsx')
  if (UI1_ALLOW.has(base) && reachable.has(file)) {
    fail(
      'UI1',
      `"${base}" is in UI1_ALLOW but is now reachable from src/app. Remove it ` +
        `from the allow-list so the ratchet keeps tightening.`
    )
  }
}

for (const file of componentFiles) {
  const base = path.basename(file, '.tsx')
  if (UI1_ALLOW.has(base)) continue
  if (reachable.has(file)) continue
  fail(
    'UI1',
    `Unreachable component "${rel(file)}" — no import path leads to it from ` +
      `src/app. Delete it, or wire it up. If it is deliberately staged, add it ` +
      `to UI1_ALLOW with the reason.`
  )
}

// ── UI2: The legacy `mws-*` design system may not spread ────────────────────
// The workspace runs two design systems. The `mws-*` one is being RETIRED, not
// rethemed — its interaction states are all rgba(0,0,0,α) ("darken the
// surface"), which is invisible on the dark ground the workspace is moving to.
// No new file may adopt it. This list only shrinks.
const UI2_ALLOW = new Set([
  // EMPTY — the legacy layer is fully retired (Phase 3, 2026-08-30). Every
  // `.mws-*` rule is deleted from globals.css and no source references one.
  // Nothing may be added here: a new entry means the retired system came back.
])
for (const file of UI_SRC_TSX) {
  const r = rel(file)
  if (UI2_ALLOW.has(r)) continue
  if (/\bmws-/.test(codeOf(file))) {
    fail(
      'UI2',
      `"${r}" introduces a legacy \`mws-*\` class. That system is being retired, ` +
        `not extended — use the design-system primitives in @/components/ui.`
    )
  }
}

// Ratchets must shrink: a stale allow-entry hides a finished migration.
for (const r of UI2_ALLOW) {
  const abs = path.join(ROOT, r)
  if (!exists(abs) || !/\bmws-/.test(codeOf(abs))) {
    fail(
      'UI2',
      `"${r}" is in UI2_ALLOW but no longer uses \`mws-*\`. Remove it from the ` +
        `allow-list so the ratchet keeps tightening.`
    )
  }
}

// ── UI3: Every workspace screen is rendered by a test (ruling B1) ───────────
// The suite covered pure logic and isolated primitives, so a screen could
// compose a correct primitive incorrectly — or fail to mount at all — with the
// whole gate green. Twelve screens were brought under test by hand; nothing
// stopped the thirteenth shipping untested, which is the gap this closes.
//
// "Rendered by a test" = the screen's own module is reachable from a *.test.*
// file through the same import graph UI1 walks. A test that merely imports the
// feature's service does not count.
//
// jsdom computes no geometry, so this proves the screen MOUNTS and behaves —
// never that it LOOKS right. Layout still needs a browser (see the directive's
// Constraint D and the "render it" directive in CLAUDE.md).
const testFiles = walk(SRC, ['.tsx', '.ts']).filter((f) =>
  /\.test\.tsx?$/.test(f)
)
const testReachable = reachableFrom(testFiles)

const UI3_ALLOW = new Set([
  // EMPTY — every `(dashboard)`/`(admin)` screen is rendered by a test. The six
  // screens ruling B1 never reached were covered on 2026-09-09; the seed list
  // lasted one commit. An entry here means a screen shipped that can break with
  // the whole gate green, and needs a written reason.
])

// `(.*\/)?` — the optional segment is load-bearing. Written as `.*\/` this
// silently skipped every route-group ROOT page: `src/app/(dashboard)/page.tsx`
// matched nothing and was exempt from the rule with the gate green. Found by
// re-asking UI3's question over every page.tsx instead of trusting its filter.
// `(auth)` joined the workspace groups on 2026-09-09. It sits outside the
// visual directive's scope, but login and register are where a mount failure
// locks every user out of the product — "outside the directive" was an
// explanation for leaving them ungated, not a justification.
// Route groups UI3 covers, and the ones deliberately outside it. EVERY group
// under src/app must appear in one list or the other.
//
// Without this the rule's SCOPE was unprotected: narrowing the regex to drop
// `(auth)` produced zero violations and a green `arch:check`, silently
// un-guarding the five screens where a mount failure locks every user out. The
// allow-list could only shrink, but nothing stopped the net being made smaller.
// Found by mutating the scope itself rather than its contents.
const UI3_GROUPS = ['dashboard', 'admin', 'auth']
const UI3_GROUPS_OUT_OF_SCOPE = [
  // Dev-only component showcase; imports every primitive by design.
  'dev',
]

const allGroups = [
  ...new Set(
    walk(SRC, ['.tsx'])
      .map((f) => rel(f).match(/^src\/app\/\(([^)]+)\)\//))
      .filter(Boolean)
      .map((m) => m[1])
  ),
]
for (const g of allGroups) {
  if (!UI3_GROUPS.includes(g) && !UI3_GROUPS_OUT_OF_SCOPE.includes(g)) {
    fail(
      'UI3',
      `Route group "(${g})" is in neither UI3_GROUPS nor ` +
        `UI3_GROUPS_OUT_OF_SCOPE. Decide whether its screens must be rendered ` +
        `by a test, and say so explicitly — silence defaults to unguarded.`
    )
  }
}
for (const g of UI3_GROUPS) {
  if (!allGroups.includes(g)) {
    fail(
      'UI3',
      `UI3_GROUPS lists "(${g})" but no such route group exists. Remove it, or ` +
        `the rule is guarding nothing under that name.`
    )
  }
}

const screenGroupRe = new RegExp(
  `^src/app/\\((${UI3_GROUPS.join('|')})\\)/(.*/)?page\\.tsx$`
)
const screenPages = walk(SRC, ['.tsx']).filter((f) =>
  screenGroupRe.test(rel(f))
)

/**
 * The module that IS the screen. Two shapes exist in this repo: a thin server
 * `page.tsx` delegating to a sibling `./XClient`, and a `page.tsx` that holds
 * the whole screen inline. Testing the wrapper proves nothing in the first
 * shape, so resolve to the sibling components when there are any.
 */
function screenModulesOf(page) {
  const src = fs.readFileSync(page, 'utf8')
  const dir = path.dirname(page)
  const own = []
  for (const m of src.matchAll(IMPORT_RE)) {
    const spec = m[3] ?? m[4]
    if (!spec) continue
    const target = resolveSpecifier(spec, page)
    if (!target || target === page) continue
    // A sibling `./XClient`, or the feature component the page delegates to.
    // Both shapes exist here; testing the thin server wrapper proves nothing.
    if (
      path.dirname(target) === dir ||
      /^src\/features\/[^/]+\/components\//.test(rel(target))
    )
      own.push(target)
  }
  return own.length ? own : [page]
}

for (const page of screenPages) {
  const r = rel(page)
  const modules = screenModulesOf(page)
  const covered = modules.some((m) => testReachable.has(m))
  if (UI3_ALLOW.has(r)) {
    if (covered)
      fail(
        'UI3',
        `"${r}" is in UI3_ALLOW but is now rendered by a test. Remove it from ` +
          `the allow-list so the ratchet keeps tightening.`
      )
    continue
  }
  if (!covered) {
    fail(
      'UI3',
      `Screen "${r}" is not rendered by any test — no *.test.* file imports ` +
        `${modules.map(rel).join(' or ')}. Add a screen test (see ` +
        `src/test-utils/renderScreen.tsx), or add the page to UI3_ALLOW with a reason.`
    )
  }
}

// ── UI4: One implementation per pattern (directive §4.4, §7) ────────────────
// "Do not create another Card or DataTable." Every rebuild in this repo has
// been additive, and a feature-local fork is how a second design system starts:
// it looks like feature code, it passes every other rule here, and it quietly
// becomes the pattern the next feature copies.
// PascalCase only. `exportedNames()` seeds each module's own basename, which
// drags lowercase entries like `layout` into the barrel map — and every
// Next.js `layout.tsx` in the tree then reads as a fork of it.
const dsNames = new Set(
  [
    ...barrelMap(path.join(SRC, 'components/ui/index.ts')).keys(),
    ...barrelMap(
      path.join(SRC, 'components/common/composites/index.ts')
    ).keys(),
  ].filter((n) => /^[A-Z][A-Za-z0-9]*$/.test(n))
)

const UI4_ALLOW = new Set([
  // EMPTY — the repo has zero forks. An entry here means a second
  // implementation of a shared pattern was accepted; it needs a written reason.
])

for (const file of walk(SRC, ['.tsx'])) {
  const r = rel(file)
  if (!/^src\/(features\/[^/]+\/components|app)\//.test(r)) continue
  if (r.includes('__tests__') || r.includes('/tests/')) continue
  if (UI4_ALLOW.has(r)) continue

  // Filename AND exports. Matching the filename alone caught only the honest
  // fork (`Card.tsx`) and missed the disguised one — `export function Card()`
  // inside `MemberPanel.tsx` produced zero violations, which is the shape a
  // fork actually takes when someone knows a rule exists.
  const forked = [
    path.basename(file, '.tsx'),
    ...exportedNames(file).filter((n) => /^[A-Z][A-Za-z0-9]*$/.test(n)),
  ].filter((n) => dsNames.has(n))

  for (const name of new Set(forked)) {
    fail(
      'UI4',
      `"${r}" declares "${name}", which the design system already provides. ` +
        `Extend the primitive's variants/props or add a token — do not create ` +
        `a second implementation (METRIC_UI_DIRECTIVE.md §4.4, §7).`
    )
  }
}

// ── UI5: No off-scale exemption in eslint.config.mjs may outlive its need ──
// The exemption block re-declares no-restricted-syntax WITHOUT the off-scale
// list for a named set of files. An exemption whose reason has expired is worse
// than no rule: it reads as sanctioned. Same reverse-check discipline as
// UI1/UI2/UI3 — read the config's own file list rather than a second copy of
// it here, so the two cannot drift.
const OFF_SCALE_PATTERNS = [
  /\b(?:text|leading|tracking)-\[[0-9.]/, // className typography
  /\brounded-\[/, // className radius
  /(?:fontSize|lineHeight|letterSpacing|fontWeight|borderRadius)\s*:/, // inline
]
const eslintConfigSrc = fs.readFileSync(
  path.join(ROOT, 'eslint.config.mjs'),
  'utf8'
)
const exemptBlock = eslintConfigSrc.slice(
  eslintConfigSrc.indexOf('Documented off-scale exemptions')
)
const exempted = [
  ...exemptBlock
    .slice(0, exemptBlock.indexOf('rules: {'))
    .matchAll(/'([^']+\.tsx?)'/g),
].map((m) => m[1])

if (exempted.length === 0) {
  fail(
    'UI5',
    'Could not read the off-scale exemption list out of eslint.config.mjs. ' +
      'If the block was removed, delete this check with it; if it was renamed, ' +
      'this rule is now silently passing and must be repointed.'
  )
}
for (const r of exempted) {
  const abs = path.join(ROOT, r)
  if (!exists(abs)) {
    fail(
      'UI5',
      `eslint.config.mjs exempts "${r}" from the off-scale rules, but that file ` +
        `no longer exists. Remove it from the exemption list.`
    )
    continue
  }
  // Coarse on purpose: a recharts `contentStyle` would read as an inline style
  // here. The failure mode that leaves is "an exemption stays a little too
  // long", which is strictly safer than one that disappears silently.
  if (!OFF_SCALE_PATTERNS.some((re) => re.test(codeOf(abs)))) {
    fail(
      'UI5',
      `eslint.config.mjs still exempts "${r}" from the off-scale rules, but the ` +
        `file no longer uses an off-scale value. Delete it from the exemption ` +
        `list so the restriction applies there.`
    )
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
if (violations.length === 0) {
  console.log('✅ arch:check — feature-first structure invariants hold.')
  process.exit(0)
}

console.error(
  `\n❌ arch:check found ${violations.length} architecture violation(s):\n`
)
for (const { rule, msg } of violations) {
  console.error(`  [${rule}] ${msg}`)
}
console.error(
  '\nThese rules are hard requirements. See docs/architecture/feature-first-growth-rules.md.\n'
)
process.exit(1)
