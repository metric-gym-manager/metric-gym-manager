# PWA Update Banner - Testing Guide

## Overview

The update banner provides user-friendly control over PWA updates, preventing data loss during active sessions. The page reloads **only** when the user clicks "Refresh Now" — the app is never silently reloaded.

> **Mechanism note (2026 fix):** the banner used to be driven by two persistent
> `localStorage` flags plus a "silent auto-reload on next visit" branch that
> called `window.location.reload()` **without ever activating the waiting
> worker**. The worker therefore stayed in the waiting state, re-armed the flag
> on the reloaded page, and every full-document navigation (e.g. the post-login
> `window.location.assign`) reloaded again — a refresh loop that surfaced right
> after clicking "Sign In". The component now reloads exactly once, gated on a
> user-initiated `controllerchange`, and remembers a "Later" dismissal only for
> the current session (`sessionStorage`). Scenarios below are annotated where
> the old localStorage behaviour was replaced.

## Architecture

### User Flow Diagram

```
Deployment v1.0.1
    ↓
Service Worker detects update
    ↓
[Banner shown: "New version available!"]
    │
    ├─→ User clicks "Refresh Now"
    │       ↓
    │   Immediate reload to v1.0.1
    │
    └─→ User clicks "Later"
            ↓
        Banner dismisses (session-scoped)
        User continues work (NO INTERRUPTION)
            ↓
        User closes tab / ends session
            ↓
        [Next visit]: Banner reappears — update applied only on "Refresh Now"
                      (page is NEVER auto-reloaded)
```

### State Management

**Reload signal:** the browser's `controllerchange` event, fired when the new
worker takes control after the user clicks "Refresh Now". A per-tab
`reloadInitiated` guard makes the reload happen exactly once and only for a
user-initiated update — so a first-ever install's `clients.claim()` (which also
fires `controllerchange`) never forces a reload.

**Storage:**

- `pwa_update_dismissed` (`sessionStorage`, not `localStorage`) — set when the
  user clicks "Later" so the banner stays hidden for the rest of the session.
  It is cleared automatically when the tab/session ends; there are no persistent
  `localStorage` flags anymore.

**State Transitions:**

```
Initial State: No update
    ↓ (Deployment happens → new worker installs + waits)
Update Detected → Show banner (only if a controller already exists)
    ↓
User Action:
    ├─ "Refresh Now" → postMessage SKIP_WAITING → worker activates + claims
    │                  → controllerchange → reload ONCE
    └─ "Later" → sessionStorage.pwa_update_dismissed = "true", hide banner
        ↓
    User continues session (no further prompts, NO reload)
        ↓
    User closes tab/browser (sessionStorage cleared)
        ↓
    Next Visit → worker still waiting → banner shown again (never auto-reloads)
```

## Test Scenarios

### Test 1: Banner Display on Update Detection

**Setup:**

1. Start with app at v1.0.0
2. User has app open

**Steps:**

1. Deploy v1.0.1
2. User navigates to any page (triggers service worker update check)

**Expected:**

- ✅ Blue banner appears at top: "New version available!"
- ✅ Two buttons visible: "Refresh Now" and "Later"
- ✅ Banner doesn't block content (pushes page down)
- ✅ **No auto-reload** — the page stays put until the user acts

**Verify:**

```javascript
// In DevTools Console — a worker is waiting, dismissal not set:
navigator.serviceWorker
  .getRegistration()
  .then((reg) => console.log(reg.waiting)) // non-null
sessionStorage.getItem('pwa_update_dismissed') // Should return null
```

---

### Test 2: User Clicks "Refresh Now"

**Setup:**

1. Continue from Test 1 (banner visible)

**Steps:**

1. Click "Refresh Now" button

**Expected:**

- ✅ Page reloads once (after the new worker takes control)
- ✅ New version (v1.0.1) active after reload
- ✅ Banner does NOT reappear (no worker left waiting)

**Verify After Reload:**

```javascript
// DevTools → Application → Cache Storage
// Should see: saas-app-v1.0.1 (not v1.0.0)

// Console — the update was applied, so no worker is waiting:
navigator.serviceWorker
  .getRegistration()
  .then((reg) => console.log(reg.waiting)) // null
sessionStorage.getItem('pwa_update_dismissed') // Should return null
```

---

### Test 3: User Clicks "Later" During Form Entry

**Setup:**

1. Deploy v1.0.1
2. User is filling out "Add Member" form (5 fields filled)
3. Banner appears

**Steps:**

1. Click "Later" button
2. Continue filling form
3. Submit form
4. Navigate to member list

**Expected:**

- ✅ Banner dismisses immediately
- ✅ Form data preserved (NO DATA LOSS)
- ✅ Form submission succeeds
- ✅ User can continue working normally
- ✅ Banner does NOT reappear during session
- ✅ App still on v1.0.0 (old version)

**Verify:**

```javascript
// Update still pending (worker waiting), dismissed for this session only:
navigator.serviceWorker
  .getRegistration()
  .then((reg) => console.log(reg.waiting)) // non-null
sessionStorage.getItem('pwa_update_dismissed') // "true" (user dismissed)
```

---

### Test 4: Next Session Re-Prompt (After "Later")

**Setup:**

1. Continue from Test 3 (user dismissed banner)
2. User closes browser tab completely

**Steps:**

1. Open new tab
2. Navigate to the app

**Expected:**

- ✅ Page loads normally — **NO auto-reload** (this is the fix; the old build
  silently reloaded here, which combined with full-document auth navigations to
  produce a refresh loop)
- ✅ Banner reappears: "New version available!" (the update is still waiting)
- ✅ App still on v1.0.0 until the user clicks "Refresh Now"

**Verify:**

```javascript
// New session: the session-scoped dismissal did not carry over.
sessionStorage.getItem('pwa_update_dismissed') // null

// A worker is still waiting, so the banner is shown again:
navigator.serviceWorker
  .getRegistration()
  .then((reg) => console.log(reg.waiting)) // non-null
```

**Why this works:**

- No persistent flag drives a reload, so there is nothing to loop on.
- The waiting worker persists across sessions; the banner surfaces it again and
  the update applies only on an explicit "Refresh Now".

---

### Test 5: Multiple Updates in One Session

**Setup:**

1. User has app open on v1.0.0
2. Deploy v1.0.1 → User clicks "Later"
3. User continues working (banner dismissed)

**Steps:**

1. Deploy v1.0.2 (while same tab still open)
2. User navigates to another page

**Expected:**

- ✅ Banner reappears for v1.0.2 update
- ✅ Previous dismissed state (v1.0.1) ignored
- ✅ User gets to choose again: "Refresh Now" or "Later"

**Why this works:**

- Each deployment creates a new waiting service worker
- `reg.waiting` updates to the newest worker
- Banner checks `reg.waiting` on every navigation

---

### Test 6: Race Condition - Update During API Request

**Setup:**

1. User editing member subscription
2. Clicks "Save" → POST request in flight
3. Banner appears (deployment detected)

**Steps:**

1. User clicks "Later" (banner dismisses)
2. POST request completes
3. Success toast appears

**Expected:**

- ✅ Request completes successfully
- ✅ User sees success message
- ✅ NO reload interrupts the flow
- ✅ Data saved correctly

**This was the PROBLEM with the old approach:**

```
Old: Immediate reload → Request lost, user confused
New: Banner dismissal → Request completes, user happy
```

---

### Test 7: Offline Detection

**Setup:**

1. User has app open on v1.0.0
2. Deploy v1.0.1
3. User goes offline (disable network in DevTools)

**Steps:**

1. Navigate to another page (or refresh)

**Expected:**

- ✅ Page loads from cache (works offline)
- ✅ Banner does NOT appear (update can't download)
- ✅ No errors in console

**When user goes back online:**

1. Navigate to any page
2. ✅ Service worker detects update
3. ✅ Banner appears: "New version available!"

---

### Test 8: Browser Refresh While Banner Visible

**Setup:**

1. Banner visible (update available)
2. User hasn't clicked anything yet

**Steps:**

1. Press F5 or Ctrl+R (hard refresh)

**Expected:**

- ✅ Page reloads
- ✅ Banner reappears after reload (unless "Later" was clicked this session)
- ✅ User can still choose "Refresh Now" or "Later"

**Why:**

- The waiting worker survives a manual refresh (a reload does not activate it)
- On the reloaded page a controller exists + a worker is waiting, so the banner
  is shown again — no persistent flag and no auto-reload are involved

---

### Test 9: Update Available at First Visit (Cold Start)

**Setup:**

1. User has never visited the site
2. v1.0.1 is deployed

**Steps:**

1. User opens app for first time

**Expected:**

- ✅ App loads normally with v1.0.1
- ✅ NO banner appears (nothing to update from)
- ✅ Service worker registers v1.0.1

**Deploy v1.0.2 while user still on site:**

1. User navigates to another page
2. ✅ Banner appears: "New version available!"

---

### Test 10: Multiple Tabs Open

**Setup:**

1. User has 3 tabs open with the app
2. All on v1.0.0
3. Deploy v1.0.1

**Steps:**

1. In Tab 1: Navigate (banner appears)
2. In Tab 1: Click "Later"
3. Switch to Tab 2
4. In Tab 2: Navigate

**Expected:**

- ✅ Tab 2 ALSO shows banner (independent, per-tab state)
- ✅ User can click "Later" in Tab 2 (dismissal is per-tab via `sessionStorage`)
- ✅ Each tab tracks its own banner visibility
- ✅ When the user clicks "Refresh Now" in Tab 1, **only Tab 1 reloads**. The new
  worker claims all tabs, but other tabs are NOT force-reloaded (that would risk
  losing unsaved work in a tab the user never touched). They keep running the old
  code and pick up the new version on their next navigation/reload.

**Shared State:**

- Service worker is shared across tabs
- Banner visibility and "Later" dismissal are per-tab (React state + `sessionStorage`)

**Result:**

- User can dismiss the banner independently in each tab
- Only the acting tab reloads; no surprise reloads elsewhere

---

## Manual Testing Checklist

### Pre-Deployment Test

- [ ] Current version displays correctly
- [ ] App functions normally
- [ ] Service worker registered (DevTools → Application)

### During Deployment

- [ ] Banner appears after navigation
- [ ] "Refresh Now" button works (immediate reload)
- [ ] "Later" button works (dismisses banner)
- [ ] No errors in console

### Post-Dismissal

- [ ] Banner doesn't reappear in same session
- [ ] Forms continue working (no data loss)
- [ ] API requests complete successfully
- [ ] Navigation works normally

### Next Session

- [ ] Banner reappears (worker still waiting) — no auto-reload
- [ ] "Refresh Now" applies the update; new version active after the single reload
- [ ] `sessionStorage` dismissal did not carry over from the previous session
- [ ] Old cache deleted after update applied

## Browser DevTools Commands

### Check Current State

```javascript
// View session-scoped dismissal (there are no persistent localStorage flags)
console.log(
  'Dismissed this session:',
  sessionStorage.getItem('pwa_update_dismissed')
)

// View active service worker
navigator.serviceWorker.getRegistration().then((reg) => {
  console.log('Active SW:', reg.active?.scriptURL)
  console.log('Waiting SW:', reg.waiting?.scriptURL)
  console.log('Installing SW:', reg.installing?.scriptURL)
})

// View cache version
caches.keys().then((keys) => console.log('Active caches:', keys))
```

### Simulate Update

```javascript
// Force service worker update check
navigator.serviceWorker.getRegistration().then((reg) => reg.update())
```

### Clear State (Reset to Clean State)

```javascript
// Clear the session-scoped dismissal
sessionStorage.removeItem('pwa_update_dismissed')

// Unregister service worker
navigator.serviceWorker.getRegistration().then((reg) => reg.unregister())

// Clear all caches
caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))

// Then reload
location.reload()
```

## Common Issues & Solutions

### Issue: Banner appears on every page navigation

**Cause:** Service worker update keeps detecting new version
**Solution:** This is normal behavior until user takes action

### Issue: "Refresh Now" doesn't reload

**Cause:** Service worker didn't receive SKIP_WAITING message
**Solution:** Check console for errors, verify service worker is waiting

### Issue: Page reloads repeatedly / "refresh loop" after sign-in

**Cause (historical):** the old build reloaded the page from a persistent
`localStorage` flag without activating the waiting worker, so it re-armed on
every full-document navigation. **Fixed:** reloads are now gated on a
user-initiated `controllerchange`. If you still see looping, confirm the client
is running the current `ServiceWorkerRegistration` (no `pwa_update_available`
localStorage key should exist) and unregister any stale worker.

### Issue: Old icons still showing after update

**Cause:** Browser caching manifest.json or icons separately
**Solution:** Check cache version, hard reload (Ctrl+Shift+R)

### Issue: Update doesn't apply on next visit

**Cause:** By design the app never auto-applies on next visit — it re-shows the
banner and waits for "Refresh Now". If the banner does not appear, the worker
may not have detected the update yet (navigate again to trigger `reg.update()`).
**Solution:** Click "Refresh Now", or clear the session dismissal with
`sessionStorage.removeItem('pwa_update_dismissed')`.

## Performance Impact

- **Banner rendering**: < 1ms (simple React component)
- **localStorage checks**: < 1ms (synchronous)
- **Service worker message**: < 10ms (postMessage)
- **Update download**: Background (doesn't block user)
- **Cache cleanup**: < 100ms (on activation)

**Result: No noticeable performance impact on user experience**

## Security Considerations

- ✅ No sensitive data in localStorage (just boolean flags)
- ✅ Service worker messages validated (checks event.data?.type)
- ✅ No CORS issues (same-origin)
- ✅ No XSS risk (no user input in banner)

## Accessibility

Banner includes:

- `role="alert"` for screen readers
- High contrast (blue background, white text)
- Clear button labels ("Refresh Now", "Later")
- Keyboard accessible (Tab navigation)
- Non-blocking (doesn't trap focus)

## Browser Compatibility

Tested and working on:

- ✅ Chrome 90+ (Desktop & Mobile)
- ✅ Firefox 90+
- ✅ Safari 15+ (iOS & macOS)
- ✅ Edge 90+

Fallback behavior (browsers without service worker support):

- Banner never appears
- App works normally (no PWA features)
