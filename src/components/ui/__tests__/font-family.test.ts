/**
 * @jest-environment node
 */
import fs from 'node:fs'
import path from 'node:path'
import { fontFamily } from '../tokens'

/**
 * One sans face: Geist, as the L1 token has always said (SEO-043).
 *
 * The root layout also loaded Inter, as the Tailwind `sans` default and the
 * `html` font. Measured 2026-10-04 on 30 screens (every public page, every
 * auth page, the signed-in workspace and a portalled modal): no visible text
 * rendered in it, yet next/font preloaded its 48 KB file on every page — the
 * largest of the three. Its only reader was recharts' off-screen measuring
 * span, which inherits the body font while the chart text renders in Geist.
 */
const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), 'utf8')

describe('font family', () => {
  it('the L1 token names Geist as the sans face', () => {
    expect(fontFamily.sans.split(',')[0]).toMatch(/Geist/)
  })

  it('Tailwind’s default sans is Geist, matching the token', () => {
    const config = read('tailwind.config.ts')
    const sans = config.match(/\bsans:\s*\[([^\]]*)\]/)
    expect(sans?.[1].split(',')[0].trim()).toBe("'var(--font-geist)'")
  })

  it('the root layout loads no Inter, and no stylesheet names it', () => {
    expect(read('src/app/layout.tsx')).not.toMatch(/\bInter\b/)
    expect(read('src/app/globals.css')).not.toMatch(
      /['"]Inter['"]|--font-inter/
    )
  })
})
