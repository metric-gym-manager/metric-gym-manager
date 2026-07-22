import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Dark two-column auth surface (Enterprise UI/UX overhaul, "Auth Pages.dc.html").
 * Left brand rail (hidden < 900px) + centred 360px form column. The optional
 * mode tabs link between /login and /register; verify / forgot / reset pass no
 * tab. Geist type + `.mauth-*` tokens from globals.css.
 */
export default function AuthShell({
  tab,
  children,
}: {
  tab?: 'login' | 'register'
  children: React.ReactNode
}) {
  return (
    <div className="mauth-root">
      {/* Brand rail */}
      <aside className="mauth-rail">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          style={{ color: 'var(--ma-t1)' }}
        >
          <Image
            src="/logo.svg"
            alt="Metric"
            width={22}
            height={22}
            style={{ width: 22, height: 22 }}
          />
          <span
            style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}
          >
            Metric
          </span>
          <span
            className="mauth-mono"
            style={{
              fontSize: 11,
              color: 'var(--ma-t3)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
              padding: '1px 6px',
              whiteSpace: 'nowrap',
            }}
          >
            metricgym.lk
          </span>
        </Link>

        <div className="flex flex-col gap-5">
          <h2
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              textWrap: 'pretty',
            }}
          >
            Your first reminder batch goes out tonight.
          </h2>
          <div
            className="flex flex-col"
            style={{ borderTop: '1px solid var(--ma-b1)' }}
          >
            <RailStat label="Gyms on platform" value="25+" />
            <RailStat label="Members managed" value="7,900+" />
            <RailStat
              label="Uptime, trailing 12 mo"
              value="99.99%"
              valueColor="var(--ma-ok)"
              last
            />
          </div>
        </div>

        <span
          className="mauth-mono"
          style={{ fontSize: 11, color: 'var(--ma-t3)' }}
        >
          © 2026 CAPITALIST ONE (PVT) LTD · v2026.2.1
        </span>
      </aside>

      {/* Form column */}
      <div className="mauth-form-col">
        <div className="mauth-form">
          {tab && (
            <div className="mauth-tabs">
              <Link
                href="/login"
                className={cn(
                  'mauth-tab',
                  tab === 'login' && 'mauth-tab-active'
                )}
              >
                Log in
              </Link>
              <Link
                href="/register"
                className={cn(
                  'mauth-tab',
                  tab === 'register' && 'mauth-tab-active'
                )}
              >
                Register
              </Link>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}

function RailStat({
  label,
  value,
  valueColor,
  last,
}: {
  label: string
  value: string
  valueColor?: string
  last?: boolean
}) {
  return (
    <div
      className="flex justify-between"
      style={{
        padding: '10px 0',
        borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <span style={{ color: 'var(--ma-t2)' }}>{label}</span>
      <span className="mauth-mono" style={{ color: valueColor }}>
        {value}
      </span>
    </div>
  )
}
