'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Session-scoped dismissal. A user who picks "Later" is not nagged again for the
// rest of THIS browsing session (tab). It deliberately does NOT persist across
// sessions — the banner returns on the next visit while the update still waits,
// but no forced reload is ever triggered.
const DISMISSED_KEY = 'pwa_update_dismissed'

function isDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}

function setDismissed(value: boolean): void {
  try {
    if (value) sessionStorage.setItem(DISMISSED_KEY, 'true')
    else sessionStorage.removeItem(DISMISSED_KEY)
  } catch {
    // Storage may be unavailable (private mode) — dismissal simply won't persist.
  }
}

/**
 * Registers the PWA service worker and surfaces an in-app "new version" banner.
 *
 * Reload discipline (this is what prevents the historical refresh loop): the
 * page reloads EXACTLY ONCE, and only in response to a `controllerchange` event
 * that WE initiated by asking a waiting worker to activate. We never reload the
 * page while leaving the old worker in place — the previous implementation did
 * exactly that (a localStorage flag drove `window.location.reload()` without
 * ever activating the waiting worker, so the worker kept re-arming the flag and
 * every navigation reloaded again).
 */
export function ServiceWorkerRegistration() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const waitingWorkerRef = useRef<ServiceWorker | null>(null)
  // Set to true only when we deliberately activate a worker (user clicked
  // "Refresh Now"). Gates the one-time reload so the automatic
  // `controllerchange` from a first-ever install (`clients.claim()`) — or from
  // another tab applying the update — never forces a reload here.
  const reloadInitiatedRef = useRef(false)

  const reloadOnce = useCallback(() => {
    if (!reloadInitiatedRef.current) return
    reloadInitiatedRef.current = false // dedupe: only ever reload once
    window.location.reload()
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // The new worker taking control is the single, authoritative signal to
    // reload. Gated by reloadInitiatedRef so it only fires on a user-initiated
    // update.
    navigator.serviceWorker.addEventListener('controllerchange', reloadOnce)

    const showBanner = (worker: ServiceWorker) => {
      waitingWorkerRef.current = worker
      if (isDismissed()) return // user chose "Later" this session
      setUpdateAvailable(true)
    }

    navigator.serviceWorker
      .register('/service-worker.js')
      .then((reg) => {
        // A worker already waiting from a previous load. Only prompt when a
        // controller already exists — i.e. this is an UPDATE to an installed
        // app, not the very first install (which must never force a reload).
        if (reg.waiting && navigator.serviceWorker.controller) {
          showBanner(reg.waiting)
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // New worker is waiting — do NOT auto-activate. Let the user
              // decide via the banner so in-flight work is never lost.
              showBanner(newWorker)
            }
          })
        })

        // Check for a newer worker on load.
        reg.update()
      })
      .catch(() => {
        // Registration failure is non-fatal: the app runs without the SW.
      })

    return () => {
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        reloadOnce
      )
    }
  }, [reloadOnce])

  const handleRefreshNow = () => {
    const worker = waitingWorkerRef.current
    setUpdateAvailable(false)
    setDismissed(false)

    if (!worker) {
      // Nothing to activate (edge case) — just reload to pick up new assets.
      window.location.reload()
      return
    }

    // Ask the waiting worker to take over. When it activates and claims this
    // client, `controllerchange` fires and reloadOnce() reloads the page.
    reloadInitiatedRef.current = true
    worker.postMessage({ type: 'SKIP_WAITING' })

    // Safety net: if the worker never takes control (message dropped, no
    // clients.claim()), reload anyway. reloadOnce()'s guard keeps it to a
    // single reload even if controllerchange also fires.
    window.setTimeout(reloadOnce, 3000)
  }

  const handleDismiss = () => {
    setUpdateAvailable(false)
    setDismissed(true)
  }

  return updateAvailable ? (
    <UpdateBanner onRefresh={handleRefreshNow} onDismiss={handleDismiss} />
  ) : null
}

// Update banner component
function UpdateBanner({
  onRefresh,
  onDismiss,
}: {
  onRefresh: () => void
  onDismiss: () => void
}) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-accentui text-accentui-text px-4 py-3 "
      role="alert"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="font-medium">New version available!</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="px-4 py-1.5 bg-surface-card text-brand-link rounded-sm font-medium hover:bg-accentui-bg transition-colors"
          >
            Refresh Now
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-1.5 border border-white/30 rounded-sm font-medium hover:bg-surface-card/10 transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
