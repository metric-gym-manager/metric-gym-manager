// Copies brand assets from the app into video/public so the film uses the
// app's own fonts and logo instead of forked copies. Generates SFX.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeSfx } from './sfx.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const video = path.resolve(here, '..')
const app = path.resolve(video, '..')
const pub = path.join(video, 'public')

fs.mkdirSync(path.join(pub, 'fonts'), { recursive: true })
const fontDir = path.join(app, 'src/features/registration/assets/fonts')
for (const f of ['geist-400.woff', 'geist-600.woff', 'geist-700.woff', 'geist-mono-400.woff', 'geist-mono-500.woff']) {
  fs.copyFileSync(path.join(fontDir, f), path.join(pub, 'fonts', f))
}
fs.copyFileSync(path.join(app, 'public/logo.svg'), path.join(pub, 'logo.svg'))
writeSfx(path.join(pub, 'sfx'))
console.log('assets ready')
