#!/usr/bin/env node
/**
 * SEO task log — validates docs/seo/SEO_TASKS.json (the source of truth) and
 * regenerates docs/seo/SEO_TASK_LOG.md (the human-readable view) from it.
 *
 *   npm run seo:report            regenerate the Markdown log
 *   npm run seo:report -- --check exit 1 if the log is stale or the JSON invalid
 *
 * Edit the JSON, never the Markdown: the log is generated output and is listed
 * in .prettierignore for the same reason rule 2.19 keeps the service worker out
 * of Prettier's reach — a formatter rewriting generated output makes the
 * generator and the file disagree forever.
 *
 * Zero dependencies on purpose, like scripts/check-architecture.mjs.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const JSON_PATH = path.join(ROOT, 'docs', 'seo', 'SEO_TASKS.json')
const MD_PATH = path.join(ROOT, 'docs', 'seo', 'SEO_TASK_LOG.md')

const STATUSES = [
  'discovered',
  'planned',
  'in_progress',
  'implemented',
  'verified',
  'blocked',
  'rejected',
]
const PRIORITIES = ['P0', 'P1', 'P2', 'P3']
const CATEGORIES = [
  'technical',
  'on-page',
  'content',
  'architecture',
  'internal-linking',
  'schema',
  'entity',
  'local',
  'trust',
  'performance',
  'measurement',
  'off-site',
]
const INTENTS = [
  'commercial',
  'informational',
  'navigational',
  'transactional',
  'mixed',
  'none',
]
/** Statuses whose work is finished and therefore must carry completedAt. */
const CLOSED = new Set(['verified', 'rejected'])
const OPEN = new Set(['discovered', 'planned', 'in_progress', 'blocked'])
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const ID = /^SEO-\d{3}$/

const errors = []
const err = (msg) => errors.push(msg)

const isStringArray = (v) =>
  Array.isArray(v) && v.every((x) => typeof x === 'string')

function validate(doc) {
  if (!doc || typeof doc !== 'object') return err('Top level must be an object')
  if (typeof doc.auditDate !== 'string')
    err('auditDate (YYYY-MM-DD) is required')
  if (!Array.isArray(doc.tasks)) return err('tasks must be an array')

  const ids = new Set()
  for (const t of doc.tasks) {
    const where = t?.id ?? '(task without id)'
    if (!ID.test(t.id ?? '')) err(`${where}: id must match SEO-NNN`)
    if (ids.has(t.id)) err(`${where}: duplicate id`)
    ids.add(t.id)
    for (const key of [
      'title',
      'finding',
      'recommendedChange',
      'implementation',
    ]) {
      if (typeof t[key] !== 'string') err(`${where}: ${key} must be a string`)
    }
    if (!t.title?.trim()) err(`${where}: title is empty`)
    if (!t.finding?.trim()) err(`${where}: finding is empty`)
    if (!CATEGORIES.includes(t.category))
      err(`${where}: category "${t.category}" not in ${CATEGORIES.join('|')}`)
    if (!PRIORITIES.includes(t.priority))
      err(`${where}: priority "${t.priority}" not in ${PRIORITIES.join('|')}`)
    if (!STATUSES.includes(t.status))
      err(`${where}: status "${t.status}" not in ${STATUSES.join('|')}`)
    if (!INTENTS.includes(t.intent))
      err(`${where}: intent "${t.intent}" not in ${INTENTS.join('|')}`)
    for (const key of [
      'targetQueries',
      'evidence',
      'files',
      'verification',
      'dependencies',
    ]) {
      if (!isStringArray(t[key])) err(`${where}: ${key} must be string[]`)
    }
    if (typeof t.externalActionRequired !== 'boolean')
      err(`${where}: externalActionRequired must be boolean`)
    for (const key of ['createdAt', 'updatedAt']) {
      if (!ISO.test(t[key] ?? '')) err(`${where}: ${key} must be ISO-8601 UTC`)
    }
    if (CLOSED.has(t.status)) {
      if (!ISO.test(t.completedAt ?? ''))
        err(`${where}: status ${t.status} requires completedAt`)
    } else if (t.completedAt !== null) {
      err(`${where}: completedAt must be null while status is ${t.status}`)
    }
    // "Do not leave the log describing work as complete unless it has actually
    // been implemented and verified" — a verified task must say how.
    if (t.status === 'verified' && t.verification.length === 0)
      err(`${where}: verified without any verification entry`)
    if (
      (t.status === 'implemented' || t.status === 'verified') &&
      !t.implementation.trim()
    )
      err(`${where}: ${t.status} without an implementation description`)
    if (
      t.status === 'blocked' &&
      !t.externalActionRequired &&
      !t.dependencies.length
    )
      err(`${where}: blocked needs a dependency or an external action`)
  }
  for (const t of doc.tasks) {
    for (const dep of t.dependencies ?? []) {
      if (ID.test(dep) && !ids.has(dep))
        err(`${t.id}: dependency ${dep} does not exist`)
    }
  }
}

// ── Rendering ───────────────────────────────────────────────────────────────

/** Escape a value for a GFM table cell: pipes split cells, newlines end rows. */
const cell = (s) =>
  String(s)
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ')
const PRIORITY_ORDER = Object.fromEntries(PRIORITIES.map((p, i) => [p, i]))
const STATUS_ORDER = Object.fromEntries(STATUSES.map((s, i) => [s, i]))
const byPriority = (a, b) =>
  PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
  a.id.localeCompare(b.id)

function list(items, empty = '—') {
  if (!items.length) return `- ${empty}\n`
  return items.map((x) => `- ${x}`).join('\n') + '\n'
}

function render(doc) {
  const tasks = [...doc.tasks]
  const count = (pred) => tasks.filter(pred).length
  const lastUpdate =
    tasks
      .map((t) => t.updatedAt)
      .sort()
      .at(-1) ?? '—'

  const summary = [
    ['Audit date', doc.auditDate],
    ['Last task update', lastUpdate],
    ['Total tasks', tasks.length],
    [
      'P0 remaining (not verified/rejected)',
      count((t) => t.priority === 'P0' && !CLOSED.has(t.status)),
    ],
    [
      'P1 remaining (not verified/rejected)',
      count((t) => t.priority === 'P1' && !CLOSED.has(t.status)),
    ],
    [
      'Implemented (awaiting verification)',
      count((t) => t.status === 'implemented'),
    ],
    ['Verified', count((t) => t.status === 'verified')],
    ['In progress', count((t) => t.status === 'in_progress')],
    [
      'Open (discovered/planned)',
      count((t) => t.status === 'discovered' || t.status === 'planned'),
    ],
    ['Blocked', count((t) => t.status === 'blocked')],
    ['Rejected', count((t) => t.status === 'rejected')],
    ['External action required', count((t) => t.externalActionRequired)],
  ]

  let md = ''
  md += '# SEO Task Log — Metric Gym OS\n\n'
  md +=
    '> **Generated file — do not edit.** Source of truth: [`SEO_TASKS.json`](./SEO_TASKS.json). ' +
    'Regenerate with `npm run seo:report`; `npm run seo:report -- --check` fails when this file is stale. ' +
    'Audit narrative: [`SEO_AUDIT.md`](./SEO_AUDIT.md).\n\n'
  md += '## Current summary\n\n| Measure | Value |\n| --- | --- |\n'
  for (const [k, v] of summary) md += `| ${cell(k)} | ${cell(v)} |\n`
  md += '\n'

  md += '## Status by priority\n\n| Priority |'
  for (const s of STATUSES) md += ` ${s} |`
  md += '\n| --- |' + STATUSES.map(() => ' ---: |').join('') + '\n'
  for (const p of PRIORITIES) {
    md += `| ${p} |`
    for (const s of STATUSES)
      md += ` ${count((t) => t.priority === p && t.status === s)} |`
    md += '\n'
  }
  md += '\n'

  md +=
    '## All tasks\n\n| ID | Priority | Status | Category | Title | External |\n| --- | --- | --- | --- | --- | --- |\n'
  for (const t of [...tasks].sort(byPriority)) {
    md += `| [${t.id}](#${t.id.toLowerCase()}) | ${t.priority} | ${t.status} | ${cell(t.category)} | ${cell(t.title)} | ${t.externalActionRequired ? 'yes' : 'no'} |\n`
  }
  md += '\n'

  md += '## External tasks (cannot be completed in code)\n\n'
  const external = tasks
    .filter((t) => t.externalActionRequired)
    .sort(byPriority)
  if (!external.length) md += '- None\n'
  for (const t of external)
    md += `- **${t.id}** (${t.priority}, ${t.status}) — ${t.title}\n`
  md += '\n'

  md += '## Task detail\n\n'
  const ordered = [...tasks].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || byPriority(a, b)
  )
  for (const t of ordered.sort(byPriority)) {
    md += `### ${t.id}\n\n`
    md += `**${t.title}**\n\n`
    md += `| Field | Value |\n| --- | --- |\n`
    md += `| Priority | ${t.priority} |\n| Status | ${t.status} |\n| Category | ${cell(t.category)} |\n| Intent | ${t.intent} |\n`
    md += `| External action | ${t.externalActionRequired ? 'required' : 'no'} |\n`
    md += `| Created | ${t.createdAt} |\n| Updated | ${t.updatedAt} |\n| Completed | ${t.completedAt ?? '—'} |\n`
    md += `| Dependencies | ${t.dependencies.length ? cell(t.dependencies.join(', ')) : '—'} |\n\n`
    md += `**Target queries**\n\n${list(t.targetQueries.map((q) => `\`${q}\``))}\n`
    md += `**Finding**\n\n${t.finding}\n\n`
    md += `**Evidence**\n\n${list(t.evidence)}\n`
    md += `**Recommended change**\n\n${t.recommendedChange || '—'}\n\n`
    md += `**Implementation**\n\n${t.implementation || '—'}\n\n`
    md += `**Files**\n\n${list(t.files.map((f) => `\`${f}\``))}\n`
    md += `**Verification**\n\n${list(t.verification, 'Not yet verified')}\n`
  }
  return md.replace(/\n{3,}/g, '\n\n')
}

// ── Main ────────────────────────────────────────────────────────────────────

let doc
try {
  doc = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'))
} catch (e) {
  console.error(
    `❌ seo:report — cannot read ${path.relative(ROOT, JSON_PATH)}: ${e.message}`
  )
  process.exit(1)
}

validate(doc)
if (errors.length) {
  console.error(
    `❌ seo:report — ${errors.length} problem(s) in SEO_TASKS.json:`
  )
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

const md = render(doc)
const check = process.argv.includes('--check')

if (check) {
  const current = fs.existsSync(MD_PATH) ? fs.readFileSync(MD_PATH, 'utf8') : ''
  if (current !== md) {
    console.error(
      '❌ seo:report — docs/seo/SEO_TASK_LOG.md is stale. Run `npm run seo:report` and commit the result.'
    )
    process.exit(1)
  }
  console.log(
    `✅ seo:report — ${doc.tasks.length} tasks valid; log is current.`
  )
  process.exit(0)
}

fs.writeFileSync(MD_PATH, md)
console.log(
  `✅ seo:report — wrote ${path.relative(ROOT, MD_PATH)} (${doc.tasks.length} tasks).`
)
