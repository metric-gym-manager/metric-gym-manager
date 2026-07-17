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

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const FEATURES = path.join(SRC, 'features');
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');

const violations = [];
const fail = (rule, msg) => violations.push({ rule, msg });

const exists = (p) => fs.existsSync(p);
const isDir = (p) => exists(p) && fs.statSync(p).isDirectory();

/** Recursively collect files under `dir` matching one of `exts`. */
function walk(dir, exts, acc = []) {
  if (!isDir(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(full, exts, acc);
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      acc.push(full);
    }
  }
  return acc;
}

// ── R1: No competing / dissolved architecture layers ────────────────────────
// Business logic has exactly one home per domain: src/features/<domain>/.
const BANNED_DIRS = ['core', 'infrastructure', 'presentation', 'services'];
for (const name of BANNED_DIRS) {
  if (isDir(path.join(SRC, name))) {
    fail(
      'R1',
      `src/${name}/ exists. This competing layer was dissolved into features/. ` +
        `Move its code into src/features/<domain>/ (or src/lib/ for third-party glue).`
    );
  }
}

// ── R1: No source imports the dissolved-layer aliases ───────────────────────
const BANNED_IMPORT = /from\s+['"]@\/(core|infrastructure|presentation|services)(\/|['"])/;
for (const file of walk(SRC, ['.ts', '.tsx'])) {
  const text = fs.readFileSync(file, 'utf8');
  const line = text.split('\n').findIndex((l) => BANNED_IMPORT.test(l));
  if (line !== -1) {
    fail(
      'R1',
      `${path.relative(ROOT, file)}:${line + 1} imports a dissolved layer (@/core|@/infrastructure|@/presentation|@/services). ` +
        `Import from a feature's public surface (@/features/<domain>) or from @/lib / @/utils instead.`
    );
  }
}

// ── R4: Every feature exposes a public index.ts ─────────────────────────────
if (isDir(FEATURES)) {
  for (const entry of fs.readdirSync(FEATURES, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!exists(path.join(FEATURES, entry.name, 'index.ts'))) {
      fail(
        'R4',
        `src/features/${entry.name}/ has no index.ts. Every feature MUST publish a public API ` +
          `barrel so consumers import from @/features/${entry.name}, not its internals.`
      );
    }
  }
} else {
  fail('R1', 'src/features/ does not exist — feature-first structure is required.');
}

// ── R10: No stray junk / one-off files at the repo root ─────────────────────
// The mess this guards against: dev logs, tsc dumps, and one-off *_ANALYSIS docs
// that accumulated at the root. Living docs belong under docs/<taxonomy>/.
const ROOT_JUNK = [
  { re: /\.log$/i, why: 'log files must be gitignored, never committed' },
  { re: /_ANALYSIS\.(md|txt)$/i, why: 'one-off analyses belong in git history, not the tree' },
  { re: /^type-check-output|^tsc-output/i, why: 'compiler output dumps must not be committed' },
  { re: /\.tmp$/i, why: 'temp files must not be committed' },
  { re: /\.sql$/i, why: 'SQL belongs in supabase/migrations/, not the repo root' },
];
for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  for (const { re, why } of ROOT_JUNK) {
    if (re.test(entry.name)) {
      fail('R10', `Stray root file "${entry.name}": ${why}.`);
      break;
    }
  }
}

// ── R11: No duplicate migration timestamps ──────────────────────────────────
// A duplicate numeric prefix makes apply-order non-deterministic across machines.
if (isDir(MIGRATIONS)) {
  const seen = new Map();
  for (const name of fs.readdirSync(MIGRATIONS)) {
    if (!name.endsWith('.sql')) continue;
    const stamp = name.split('_')[0];
    if (!/^\d{14}$/.test(stamp)) continue;
    if (seen.has(stamp)) {
      fail(
        'R11',
        `Duplicate migration timestamp ${stamp}: "${name}" collides with "${seen.get(stamp)}". ` +
          `Rename one to a unique timestamp so replay order is deterministic.`
      );
    } else {
      seen.set(stamp, name);
    }
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
if (violations.length === 0) {
  console.log('✅ arch:check — feature-first structure invariants hold.');
  process.exit(0);
}

console.error(`\n❌ arch:check found ${violations.length} architecture violation(s):\n`);
for (const { rule, msg } of violations) {
  console.error(`  [${rule}] ${msg}`);
}
console.error(
  '\nThese rules are hard requirements. See docs/architecture/feature-first-growth-rules.md.\n'
);
process.exit(1);
