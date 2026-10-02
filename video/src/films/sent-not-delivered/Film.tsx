import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT, loadFonts } from '../../shared/theme'
import { Caption } from '../../shared/Caption'
import { EndCard } from '../../shared/EndCard'
import { Cues, type Cue } from '../../shared/Cues'
import { MESSAGES, T, TOTAL, countsAt, FAILED_ROWS } from './data'

loadFonts()
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const BAR = { x: 90, w: 900, h: 64 }

const Badge: React.FC<{ kind: 'Delivered' | 'Failed' | 'Sent' }> = ({ kind }) => {
  const tone = kind === 'Delivered' ? [C.successText, C.successBg, C.successBorder] : kind === 'Failed' ? [C.errorText, C.errorBg, C.errorBorder] : [C.textSecondary, C.surfaceActive, C.border2]
  return <span style={{ fontSize: 22, fontWeight: 600, padding: '4px 12px', borderRadius: 5, color: tone[0], background: tone[1], border: `1px solid ${tone[2]}` }}>{kind}</span>
}

const Panel: React.FC = () => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const c = countsAt(f)
  const sentTotal = TOTAL - c.queued
  const celebrating = f >= T.sent.from && f < T.receipts.from
  const drain = interpolate(f, [T.receipts.from, T.receipts.from + 10], [1, 0], clamp)
  const pop = spring({ frame: f - T.sent.from, fps, config: { damping: 11 } })
  const appear = spring({ frame: f - 4, fps, config: { damping: 18 } })

  let title: React.ReactNode
  if (f < T.sent.from) title = <span style={{ color: C.textSecondary }}>Sending… {sentTotal}/{TOTAL}</span>
  else if (f < T.receipts.from) title = <span style={{ color: C.successText, display: 'inline-block', transform: `scale(${0.85 + 0.15 * pop})` }}>SENT ✓ {TOTAL}/{TOTAL}</span>
  else title = <span style={{ color: C.textPrimary }}>Delivery receipts</span>

  const greenW = celebrating ? BAR.w * (sentTotal / TOTAL) : BAR.w * (c.delivered / TOTAL)
  const redW = BAR.w * (c.failed / TOTAL)
  const sentW = f < T.sent.from ? BAR.w * (sentTotal / TOTAL) : 0
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: 470, opacity: appear, background: C.surfacePanel, border: `1px solid ${C.border1}`, borderRadius: 14, padding: '40px 30px', fontFamily: FONT.sans }}>
      <div style={{ fontSize: 26, color: C.textMuted }}>Iron Yard Fitness · Payment reminders · Due today</div>
      <div style={{ fontSize: 64, fontWeight: 700, marginTop: 16, fontFamily: FONT.mono, letterSpacing: '-0.01em' }}>{title}</div>
      <div style={{ position: 'relative', width: BAR.w, height: BAR.h, marginTop: 34, borderRadius: 8, background: C.surfaceInput, border: `1px solid ${C.border1}`, overflow: 'hidden' }}>
        {/* Before receipts: what has left. After: neutral "sent", with true outcomes growing in from each end. */}
        {f < T.sent.from && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: sentW, background: C.border3 }} />}
        {f >= T.receipts.from && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: BAR.w, background: C.border3 }} />}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: greenW, background: C.successText, opacity: celebrating ? 1 : f >= T.receipts.from + 10 ? 1 : drain }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: redW, background: C.errorText }} />
      </div>
      <div style={{ display: 'flex', gap: 40, marginTop: 28, fontSize: 30, opacity: f >= T.receipts.from ? 1 : 0 }}>
        <span style={{ color: C.successText }}>
          <b style={{ fontFamily: FONT.mono }}>{c.delivered}</b> delivered
        </span>
        <span style={{ color: C.errorText }}>
          <b style={{ fontFamily: FONT.mono }}>{c.failed}</b> failed
        </span>
        <span style={{ color: C.textSecondary }}>
          <b style={{ fontFamily: FONT.mono }}>{c.sent}</b> no receipt yet
        </span>
      </div>
    </div>
  )
}

const FailedList: React.FC = () => {
  const f = useCurrentFrame()
  if (f < T.failed.from || f >= T.history.from) return null
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: 920, background: C.surfacePanel, border: `1px solid ${C.errorBorder}`, borderRadius: 14, overflow: 'hidden', fontFamily: FONT.sans }}>
      {FAILED_ROWS.map((r, i) => {
        const o = interpolate(f, [T.failed.from + i * 5, T.failed.from + i * 5 + 8], [0, 1], clamp)
        return (
          <div key={r.id} style={{ height: 76, display: 'flex', alignItems: 'center', gap: 20, padding: '0 28px', borderBottom: `1px solid ${C.border1}`, opacity: o, transform: `translateX(${(1 - o) * 30}px)` }}>
            <span style={{ flex: 1, fontSize: 30, color: C.textPrimary }}>{r.name}</span>
            <span style={{ fontSize: 24, color: C.textMuted }}>Due today</span>
            <Badge kind="Failed" />
          </div>
        )
      })}
    </div>
  )
}

const HISTORY = [
  { at: '2 Oct · 09:00', type: 'Due today', status: 'Failed' as const },
  { at: '29 Sep · 09:00', type: '3-day reminder', status: 'Delivered' as const },
  { at: '3 Sep · 18:12', type: 'Receipt', status: 'Delivered' as const },
  { at: '2 Sep · 09:00', type: 'Due today', status: 'Delivered' as const },
  { at: '1 Aug · 10:41', type: 'Welcome', status: 'Delivered' as const },
]

const History: React.FC = () => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (f < T.history.from || f >= T.card.from) return null
  const up = spring({ frame: f - T.history.from, fps, config: { damping: 18 } })
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: 920 + (1 - up) * 300, opacity: up, background: C.surfacePanel, border: `1px solid ${C.border1}`, borderRadius: 14, overflow: 'hidden', fontFamily: FONT.sans }}>
      <div style={{ padding: '28px 28px 18px', display: 'flex', flexDirection: 'column', gap: 6, borderBottom: `1px solid ${C.border1}` }}>
        <span style={{ fontSize: 34, fontWeight: 600, color: C.textPrimary }}>{FAILED_ROWS[0].name}</span>
        <span style={{ fontSize: 24, color: C.textMuted }}>SMS history</span>
      </div>
      <div style={{ display: 'flex', padding: '14px 28px', fontSize: 20, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: `1px solid ${C.border1}` }}>
        <span style={{ flex: 1.2 }}>Sent at</span>
        <span style={{ flex: 1 }}>Type</span>
        <span style={{ width: 150, textAlign: 'right' }}>Status</span>
      </div>
      {HISTORY.map((h, i) => (
        <div key={i} style={{ height: 76, display: 'flex', alignItems: 'center', padding: '0 28px', borderBottom: `1px solid ${C.border1}`, background: i === 0 ? C.errorBg : 'transparent' }}>
          <span style={{ flex: 1.2, fontSize: 26, fontFamily: FONT.mono, color: C.textSecondary }}>{h.at}</span>
          <span style={{ flex: 1, fontSize: 26, color: C.textPrimary }}>{h.type}</span>
          <span style={{ width: 150, display: 'flex', justifyContent: 'flex-end' }}>
            <Badge kind={h.status} />
          </span>
        </div>
      ))}
    </div>
  )
}

const cues = (): Cue[] => {
  const c: Cue[] = [
    { at: T.sent.from, sfx: 'ping', volume: 0.9 },
    { at: T.sent.from + 6, sfx: 'tickUp', volume: 0.8 },
    { at: T.receipts.from, sfx: 'thud', volume: 0.9 },
    { at: T.history.from, sfx: 'sweep', volume: 0.6 },
    { at: T.card.from, sfx: 'chord', volume: 0.9 },
  ]
  for (let f = T.sending.from; f < T.sending.to; f += 3) c.push({ at: f, sfx: 'tick', volume: 0.45 })
  // Receipts: a tick on every frame a delivery lands; a deny on every failure.
  const delivered = new Set<number>()
  for (const m of MESSAGES) {
    if (m.receiptAt === null) continue
    if (m.outcome === 'failed') c.push({ at: m.receiptAt, sfx: 'deny', volume: 0.55 })
    else delivered.add(m.receiptAt)
  }
  for (const at of delivered) c.push({ at, sfx: 'tick', volume: 0.3 })
  FAILED_ROWS.forEach((_, i) => c.push({ at: T.failed.from + i * 5, sfx: 'pop', volume: 0.5 }))
  return c.sort((a, b) => a.at - b.at)
}
const CUES = cues()

export const SentNotDeliveredFilm: React.FC<{ muted?: boolean }> = ({ muted }) => (
  <AbsoluteFill style={{ background: C.surfaceBase }}>
    <Panel />
    <FailedList />
    <History />
    <Caption text="200 reminders." inAt={2} outAt={T.sent.from + 70} top={250} />
    <Caption text="Sent means it left." inAt={T.sent.from + 70} outAt={T.receipts.from + 80} top={250} />
    <Caption text="Delivered means it arrived." inAt={T.receipts.from + 80} outAt={T.history.from} top={250} />
    <Caption text="Now you know who to call." inAt={T.history.from + 10} outAt={T.card.from} top={250} />
    <EndCard from={T.card.from} />
    {!muted && <Cues cues={CUES} />}
  </AbsoluteFill>
)


