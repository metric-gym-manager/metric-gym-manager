#!/usr/bin/env node
/**
 * Regenerates public/og-image.png — the 1200×630 card every public page shares
 * (features/marketing/config/site.ts OG_IMAGE).
 *
 *   node scripts/generate-og-image.mjs
 *   CHROMIUM_PATH=/path/to/chrome node scripts/generate-og-image.mjs
 *
 * The card is a static file on purpose: a dynamic `opengraph-image` route has
 * no file extension, so the auth middleware would answer social crawlers with
 * 307 → /login. It is rendered by headless Chromium from the brand fonts the
 * repo already bundles (registration/assets/fonts) and public/logo.svg, so a
 * change to the copy below is one command away from a matching image.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FONTS = path.join(
  ROOT,
  'src',
  'features',
  'registration',
  'assets',
  'fonts'
)
const OUT = path.join(ROOT, 'public', 'og-image.png')

const font = (family, file, weight) =>
  `@font-face{font-family:${family};src:url(${path.join(FONTS, file)}) format('woff');font-weight:${weight}}`

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${font('Geist', 'geist-400.woff', 400)}
${font('Geist', 'geist-600.woff', 600)}
${font('GeistMono', 'geist-mono-400.woff', 400)}
${font('GeistMono', 'geist-mono-500.woff', 500)}
html,body{margin:0;padding:0}
body{width:1200px;height:630px;background:#000;color:#ededf0;font-family:Geist,sans-serif;-webkit-font-smoothing:antialiased;position:relative;overflow:hidden}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.035) 1px,transparent 1px);background-size:56px 56px}
.wrap{position:absolute;inset:0;padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between}
.brand{display:flex;align-items:center;gap:16px;font-size:30px;font-weight:600;letter-spacing:-0.01em}
.brand img{width:44px;height:44px}
.eyebrow{font-family:GeistMono,monospace;font-size:18px;letter-spacing:0.08em;color:#8b8b93;display:flex;align-items:center;gap:12px;text-transform:uppercase}
.dot{width:10px;height:10px;border-radius:50%;background:#fff}
h1{margin:22px 0 0;font-size:72px;line-height:1;letter-spacing:-0.035em;font-weight:600;max-width:960px}
.foot{display:flex;justify-content:space-between;align-items:flex-end;font-family:GeistMono,monospace;font-size:18px;color:#8b8b93;letter-spacing:0.04em}
.foot b{color:#ededf0;font-weight:500}
</style></head><body><div class="grid"></div><div class="wrap">
<div class="brand"><img src="${path.join(ROOT, 'public', 'logo.svg')}" alt="">Metric Gym OS</div>
<div><div class="eyebrow"><span class="dot"></span>Gym management software · Sri Lanka</div>
<h1>The operating system for serious gyms.</h1></div>
<div class="foot"><span>Members · Renewals · SMS · Revenue · Door access</span><b>metricgymos.com</b></div>
</div></body></html>`

const tmp = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), 'og-')),
  'card.html'
)
fs.writeFileSync(tmp, html)

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
)
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
})
await page.goto(`file://${tmp}`)
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: OUT, type: 'png' })
await browser.close()
console.log(`✅ wrote ${path.relative(ROOT, OUT)} (1200×630)`)
