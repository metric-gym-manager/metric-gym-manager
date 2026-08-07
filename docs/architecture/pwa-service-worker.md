# PWA Service Worker Update & Reload Discipline (§2.19)

> On-demand reference. Not auto-injected.
> **Rule:** The PWA reloads the page **exactly once**, and **only** in response to
> a `controllerchange` event that the app itself initiated by asking a waiting
> service worker to activate (user clicked "Refresh Now"). Never drive a reload
> from a persistent flag, and never `window.location.reload()` while leaving a
> waiting worker un-activated.

---

### 2.19 Service Worker Update & Reload Discipline

`ServiceWorkerRegistration` (`src/components/pwa/ServiceWorkerRegistration.tsx`)
is mounted once in the root layout, so it runs on **every full-document page
load** — including the auth-boundary hard navigations mandated by §2.15
(`window.location.assign`/`replace` on login, logout, and `AuthRecovery`). That
makes the update flow adjacent to the auth flow: any reload misbehaviour
surfaces _right when the user signs in_.

#### Invariants

1. **One reload, user-initiated only.** The single authoritative reload signal
   is the browser's `controllerchange` event, gated behind a per-tab
   `reloadInitiated` ref that is set **only** in the "Refresh Now" handler. This
   keeps the first-ever install's `clients.claim()` (which also fires
   `controllerchange`) — and another tab applying the update — from force-reloading
   a tab the user never acted in.
2. **Never reload a stale worker into place.** A `window.location.reload()` does
   **not** activate a waiting worker. Reloading while `reg.waiting` is still set
   just re-serves the old code and re-detects the waiting worker — the origin of
   the historical refresh loop (see post-mortem).
3. **Prompt, don't auto-activate.** On `updatefound` → `installed` with a
   controller present, show the banner and wait for the user. In-flight work
   (forms, POSTs) is never interrupted by a surprise reload.
4. **Session-scoped dismissal only.** "Later" is remembered in `sessionStorage`
   (`pwa_update_dismissed`) so the banner stays hidden for the tab's session and
   returns on the next visit while the update keeps waiting. **No persistent
   `localStorage` flags** — persistent flags that re-arm themselves are what
   produced the loop.
5. **One reload path in the worker.** The service worker's `activate` handler
   does cache cleanup + `clients.claim()` and **does not** broadcast a
   `RELOAD_PAGE` message. The client owns reloading via `controllerchange`; a
   second worker-driven path only races it.
6. **Generator + generated file stay in sync.** `public/service-worker.js` is
   emitted by `scripts/generate-pwa-assets.js`; edit the generator and
   regenerate, never hand-edit the output (it carries a DO-NOT-EDIT banner).

#### ❌ WRONG: persistent flag drives a reload without activating the worker

```typescript
// Runs on every full-document load (root layout).
const hadPendingUpdate = localStorage.getItem('pwa_update_available') === 'true'
if (hadPendingUpdate && !dismissed) {
  localStorage.removeItem('pwa_update_available')
  window.location.reload() // ← worker still WAITING; nothing was activated
}
// After reload, reg.waiting is still set → re-writes the flag → next
// navigation reloads again. Every post-login hard-nav loops.
```

#### ✅ RIGHT: reload once, gated on a user-initiated controllerchange

```typescript
const reloadInitiatedRef = useRef(false)

const reloadOnce = useCallback(() => {
  if (!reloadInitiatedRef.current) return // ignore first-install / other-tab claims
  reloadInitiatedRef.current = false // dedupe: only ever once
  window.location.reload()
}, [])

// mount:
navigator.serviceWorker.addEventListener('controllerchange', reloadOnce)

// "Refresh Now":
reloadInitiatedRef.current = true
waitingWorker.postMessage({ type: 'SKIP_WAITING' })
window.setTimeout(reloadOnce, 3000) // safety net; guard keeps it to one reload
```

```javascript
// service-worker.js — activate: cleanup + claim, NO reload broadcast.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
      await self.clients.claim() // fires controllerchange on the requesting client
    })()
  )
})
```

#### Post-mortem: the login refresh loop

**Symptom.** Right after clicking "Sign In", the blue "New version available!"
banner appeared and the page got stuck reloading; "Later" didn't stick and
"Refresh Now" could double-reload.

**Cause.** A persistent `localStorage` `pwa_update_available` flag plus a "silently
apply on return" branch called `window.location.reload()` **without activating
the waiting worker**. The waiting worker persisted across the reload and re-armed
the flag, so every §2.15 full-document navigation (starting with the post-login
`window.location.assign`) reloaded again. A competing `RELOAD_PAGE` broadcast from
the worker's `activate` handler added a second, racing reload path.

**Fix.** Switched to the `controllerchange` pattern above: one reload, gated on a
user action; session-scoped dismissal; removed the `RELOAD_PAGE` broadcast.
Regression tests live in
`src/components/pwa/__tests__/ServiceWorkerRegistration.test.tsx` (no-loop,
first-install, refresh-now-once, safety-net, session-dismiss). Operator-facing
detail: `docs/ops/pwa-update-workflow.md`, `docs/ops/pwa-update-banner-testing.md`.
