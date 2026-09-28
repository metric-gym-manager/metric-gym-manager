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
}

export function writeSfx(dir) {
  fs.mkdirSync(dir, { recursive: true })
  for (const [name, samples] of Object.entries(SFX)) {
    fs.writeFileSync(path.join(dir, `${name}.wav`), wav(samples))
  }
}
