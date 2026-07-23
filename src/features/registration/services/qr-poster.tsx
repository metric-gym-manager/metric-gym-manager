/**
 * QR registration poster renderer — "QR Stand 2b" design (print variant).
 *
 * Renders an A5 poster (600×851) as a PNG using `next/og` (Satori). The gym
 * name, profile logo and registration QR are pulled per-gym; the Metric Gym OS
 * footer is fixed branding. The same PNG powers both the "Download PNG" and
 * "Print" actions so the printed sheet and the saved image are identical.
 *
 * Print colour note: the poster uses a WHITE background with BLACK text (only
 * the Metric logo — and a small accent dot — keep the brand blue). RGB PNG
 * cannot carry CMYK, and a large solid electric-blue field reproduces poorly
 * on press, so the ink-light layout keeps colour accuracy a non-issue while
 * preserving the blue logo the print house is happy to reproduce.
 *
 * Node.js runtime only (reads bundled Geist fonts + the Metric logo from disk).
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { ImageResponse } from 'next/og'
import QRCode from 'qrcode'

/** Authored poster size (A5-proportioned). */
export const POSTER_WIDTH = 600
export const POSTER_HEIGHT = 851
/** Rasterise at 2× the authored size for crisp printing (~206dpi at A5). */
const POSTER_SCALE = 2

/** Brand blue — kept only on the Metric logo + a small accent dot. */
const BRAND_BLUE = '#1B17FF'
const MONO = 'Geist Mono'
/** Ink palette for the white print background. */
const INK = '#0a0a0b'
const INK_SOFT = '#44444c'
const INK_FAINT = '#6b6b73'
const HAIRLINE = 'rgba(0,0,0,0.1)'

export interface QrPosterInput {
  gymName: string
  /** Short locality shown top-right (derived from the gym address). */
  location?: string | null
  /** Public URL of the gym's profile logo (remote — Satori fetches it). */
  logoUrl?: string | null
  /** The gym's public registration join URL. */
  joinUrl: string
  /** Brand domain shown in the footer. */
  domain?: string
}

const FONT_DIR = join(process.cwd(), 'src/features/registration/assets/fonts')

interface LoadedFont {
  name: string
  data: Buffer
  weight: 400 | 500 | 600 | 700
  style: 'normal'
}

let cachedFonts: LoadedFont[] | null = null
function loadFonts(): LoadedFont[] {
  if (cachedFonts) return cachedFonts
  cachedFonts = [
    {
      name: 'Geist',
      weight: 400,
      style: 'normal',
      data: readFileSync(join(FONT_DIR, 'geist-400.woff')),
    },
    {
      name: 'Geist',
      weight: 600,
      style: 'normal',
      data: readFileSync(join(FONT_DIR, 'geist-600.woff')),
    },
    {
      name: 'Geist',
      weight: 700,
      style: 'normal',
      data: readFileSync(join(FONT_DIR, 'geist-700.woff')),
    },
    {
      name: MONO,
      weight: 400,
      style: 'normal',
      data: readFileSync(join(FONT_DIR, 'geist-mono-400.woff')),
    },
    {
      name: MONO,
      weight: 500,
      style: 'normal',
      data: readFileSync(join(FONT_DIR, 'geist-mono-500.woff')),
    },
  ]
  return cachedFonts
}

let cachedMetricLogo: string | null = null
function metricLogoDataUrl(): string {
  if (cachedMetricLogo) return cachedMetricLogo
  const svg = readFileSync(join(process.cwd(), 'public/logo.svg'))
  cachedMetricLogo = `data:image/svg+xml;base64,${svg.toString('base64')}`
  return cachedMetricLogo
}

/**
 * Gym profile logos are stored as an SVG data URL that wraps the uploaded
 * raster (`ProfileImageUpload.convertImageToSvg`): a `data:image/svg+xml`
 * whose only child is `<image href="data:image/png;base64,…">`. Satori cannot
 * rasterise a nested-image SVG passed as an `<img>` source (it renders blank),
 * so unwrap it to the inner raster data URL. Plain raster data URLs and remote
 * URLs pass through unchanged.
 */
export function normalizePosterLogo(logoUrl?: string | null): string | null {
  if (!logoUrl) return null
  if (!logoUrl.startsWith('data:image/svg+xml')) return logoUrl
  try {
    const commaIdx = logoUrl.indexOf(',')
    if (commaIdx === -1) return logoUrl
    const isBase64 = logoUrl.slice(0, commaIdx).includes('base64')
    const payload = logoUrl.slice(commaIdx + 1)
    const svg = isBase64
      ? Buffer.from(payload, 'base64').toString('utf8')
      : decodeURIComponent(payload)
    const match = svg.match(/(?:xlink:)?href="(data:image\/[^"]+)"/)
    return match ? match[1] : logoUrl
  } catch {
    return logoUrl
  }
}

function UpArrow({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  )
}

function QrPosterDocument({
  gymName,
  location,
  logoUrl,
  qrSrc,
  metricSrc,
  domain,
}: {
  gymName: string
  location: string | null
  logoUrl?: string | null
  qrSrc: string
  metricSrc: string
  domain: string
}) {
  const poster = (
    <div
      style={{
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        color: INK,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        fontFamily: 'Geist',
      }}
    >
      {/* identity */}
      <div
        style={{
          padding: '30px 40px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              width={26}
              height={31}
              style={{ objectFit: 'contain' }}
              alt=""
            />
          ) : null}
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: INK,
              whiteSpace: 'nowrap',
            }}
          >
            {gymName}
          </span>
        </div>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: '0.16em',
            color: INK_FAINT,
          }}
        >
          {location ?? ''}
        </span>
      </div>

      {/* hero */}
      <div
        style={{
          padding: '44px 40px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            alignItems: 'center',
            gap: 8,
            border: '1px solid rgba(0,0,0,0.14)',
            borderRadius: 999,
            padding: '6px 13px',
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: BRAND_BLUE,
              display: 'flex',
            }}
          />
          <span
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: '0.16em',
              color: INK,
              whiteSpace: 'nowrap',
            }}
          >
            NEW MEMBER · SELF-REGISTRATION
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 62,
            fontWeight: 700,
            letterSpacing: '-0.045em',
            lineHeight: 0.92,
            color: INK,
          }}
        >
          <span>Let&apos;s sign</span>
          <span>you up.</span>
        </div>
        <div
          style={{
            fontSize: 16,
            lineHeight: 1.4,
            color: INK_SOFT,
            maxWidth: 410,
            display: 'flex',
          }}
        >
          Point your phone camera at the code below. Setup takes about a minute
          — no app to download.
        </div>
      </div>

      {/* QR */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          padding: '24px 40px',
        }}
      >
        <div
          style={{
            padding: 22,
            borderRadius: 16,
            border: `1px solid ${HAIRLINE}`,
            display: 'flex',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc} width={244} height={244} alt="Registration QR" />
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: INK,
              }}
            >
              Scan me to register
            </span>
            <UpArrow size={22} color={INK} />
          </div>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: '0.16em',
              color: INK_FAINT,
            }}
          >
            60 SECONDS · JUST YOUR PHONE
          </span>
        </div>
      </div>

      {/* Metric footer */}
      <div
        style={{
          marginTop: 'auto',
          padding: '20px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#FFFFFF',
          borderTop: `1px solid ${HAIRLINE}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={metricSrc} width={26} height={26} alt="Metric" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: '0.16em',
                color: '#64646d',
              }}
            >
              POWERED BY
            </span>
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: '#000000',
              }}
            >
              Metric Gym OS
            </span>
          </div>
        </div>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 12,
            letterSpacing: '0.02em',
            color: '#000000',
            border: '1px solid rgba(0,0,0,0.16)',
            borderRadius: 4,
            padding: '4px 8px',
          }}
        >
          {domain}
        </span>
      </div>
    </div>
  )

  // Scale the authored 600×851 poster up for print-quality rasterisation.
  return (
    <div
      style={{
        display: 'flex',
        width: POSTER_WIDTH * POSTER_SCALE,
        height: POSTER_HEIGHT * POSTER_SCALE,
      }}
    >
      <div
        style={{
          display: 'flex',
          transform: `scale(${POSTER_SCALE})`,
          transformOrigin: 'top left',
        }}
      >
        {poster}
      </div>
    </div>
  )
}

/**
 * Render the 2b registration poster for a gym to a PNG (2× A5).
 */
export async function renderQrPosterPng(
  input: QrPosterInput
): Promise<ArrayBuffer> {
  const qrSrc = await QRCode.toDataURL(input.joinUrl, {
    margin: 1,
    width: 480,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000ff', light: '#ffffffff' },
  })

  const image = new ImageResponse(
    <QrPosterDocument
      gymName={input.gymName}
      location={input.location ?? null}
      logoUrl={normalizePosterLogo(input.logoUrl)}
      qrSrc={qrSrc}
      metricSrc={metricLogoDataUrl()}
      domain={input.domain ?? 'metricgymos.com'}
    />,
    {
      width: POSTER_WIDTH * POSTER_SCALE,
      height: POSTER_HEIGHT * POSTER_SCALE,
      fonts: loadFonts().map((f) => ({
        name: f.name,
        data: f.data,
        weight: f.weight,
        style: f.style,
      })),
    }
  )

  return image.arrayBuffer()
}
