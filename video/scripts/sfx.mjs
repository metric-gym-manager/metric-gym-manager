// Procedural, licence-free sound effects written as 16-bit mono WAV.
// Deterministic: same bytes every run, so they are committed.
import fs from 'node:fs'
import path from 'node:path'

const RATE = 44100

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40)
  samples.forEach((s, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2))
  return buf
}

/** Sine tone with pitch glide and exponential decay. */
function tone({ dur, f0, f1 = f0, decay, gain, attack = 0.002 }) {
  const n = Math.round(dur * RATE)
  const out = new Float64Array(n)
  let phase = 0
  for (let i = 0; i < n; i++) {
    const t = i / RATE
    const f = f0 + (f1 - f0) * (i / n)
    phase += (2 * Math.PI * f) / RATE
    const env = Math.min(1, t / attack) * Math.exp(-t / decay)
    out[i] = Math.sin(phase) * env * gain
  }
  return out
}

/** Filtered noise burst (deterministic LCG), for air and mechanical sounds. */
function noise({ dur, decay, gain, attack = 0.002, smooth = 0.5, seed = 1 }) {
  const n = Math.round(dur * RATE)
  const out = new Float64Array(n)
  let x = seed >>> 0
  let prev = 0
  for (let i = 0; i < n; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0
    const r = x / 2147483648 - 1
    prev = prev * smooth + r * (1 - smooth)
    const t = i / RATE
    out[i] = prev * Math.min(1, t / attack) * Math.exp(-t / decay) * gain
  }
  return out
}

function mix(...parts) {
  const n = Math.max(...parts.map((p) => p.length))
  const out = new Float64Array(n)
  for (const p of parts) p.forEach((s, i) => (out[i] += s))
  return out
}

const SFX = {
  // Fill wave / amber flicker.
  tick: tone({ dur: 0.08, f0: 1800, decay: 0.012, gain: 0.35 }),
  // Amber returning to green: a higher, brighter tick. Teaches the rule.
  tickUp: mix(tone({ dur: 0.1, f0: 2400, f1: 2900, decay: 0.018, gain: 0.3 }), tone({ dur: 0.1, f0: 4800, decay: 0.01, gain: 0.08 })),
  // Amber stalling: the counter rises.
  thud: mix(tone({ dur: 0.35, f0: 110, f1: 55, decay: 0.09, gain: 0.9 }), tone({ dur: 0.05, f0: 900, decay: 0.008, gain: 0.15 })),
  // Expired pulse.
  sub: tone({ dur: 0.6, f0: 48, decay: 0.2, gain: 0.8, attack: 0.02 }),
  // The reveal hit.
  hit: mix(tone({ dur: 1.6, f0: 65, f1: 41, decay: 0.5, gain: 0.95 }), tone({ dur: 1.2, f0: 130, decay: 0.25, gain: 0.3 })),
  // Reminder ping.
  ping: mix(tone({ dur: 0.5, f0: 1320, decay: 0.12, gain: 0.25 }), tone({ dur: 0.5, f0: 1980, decay: 0.08, gain: 0.1 })),
  // Riser into the product.
  sweep: (() => {
    const t = tone({ dur: 1.4, f0: 220, f1: 880, decay: 10, gain: 0.25, attack: 1.2 })
    const n = t.length
    return t.map((s, i) => s * (i > n - 2000 ? (n - i) / 2000 : 1))
  })(),
  key: mix(tone({ dur: 0.04, f0: 3200, decay: 0.004, gain: 0.25 }), tone({ dur: 0.04, f0: 700, decay: 0.006, gain: 0.2 })),
  // Resolve chord: A major, soft.
  chord: (() => {
    const notes = [220, 277.18, 329.63, 440].map((f) => tone({ dur: 2.2, f0: f, decay: 0.9, gain: 0.16, attack: 0.03 }))
    return mix(...notes)
  })(),
  // Zoom Out: camera pull-back.
  whoosh: noise({ dur: 1.2, decay: 0.5, gain: 3.2, attack: 0.6, smooth: 0.92, seed: 7 }),
  // Selfie / scan.
  shutter: mix(noise({ dur: 0.06, decay: 0.01, gain: 0.8, seed: 3 }), noise({ dur: 0.12, decay: 0.02, gain: 0.6, seed: 9 }).map((v, i) => (i < 2600 ? 0 : v))),
  // Phone buzz / delivery receipt.
  buzz: tone({ dur: 0.35, f0: 180, decay: 0.3, gain: 0.35, attack: 0.01 }).map((v, i) => v * (Math.floor(i / 1500) % 2 ? 0.3 : 1)),
  // Door reader: granted (two rising notes) / denied (low double).
  grant: mix(tone({ dur: 0.18, f0: 1047, decay: 0.08, gain: 0.35 }), tone({ dur: 0.4, f0: 1568, decay: 0.12, gain: 0.35 }).map((v, i) => (i < 6000 ? 0 : v))),
  deny: mix(tone({ dur: 0.22, f0: 220, decay: 0.15, gain: 0.5 }), tone({ dur: 0.5, f0: 196, decay: 0.15, gain: 0.5 }).map((v, i) => (i < 11000 ? 0 : v))),
  // Cable cut.
  snip: mix(noise({ dur: 0.08, decay: 0.012, gain: 0.9, seed: 11 }), tone({ dur: 0.1, f0: 2600, decay: 0.01, gain: 0.3 })),
  // UI element landing.
  pop: tone({ dur: 0.12, f0: 600, f1: 900, decay: 0.03, gain: 0.4 }),
  // Clock tick for time-lapse.
  clock: mix(tone({ dur: 0.05, f0: 3800, decay: 0.004, gain: 0.25 }), noise({ dur: 0.03, decay: 0.004, gain: 0.25, seed: 5 })),
}

export function writeSfx(dir) {
  fs.mkdirSync(dir, { recursive: true })
  for (const [name, samples] of Object.entries(SFX)) {
    fs.writeFileSync(path.join(dir, `${name}.wav`), wav(samples))
  }
}
