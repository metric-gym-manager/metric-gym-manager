# PWA Icon Update Workflow

## Overview
This project uses **automated PWA asset versioning** to ensure seamless icon updates without requiring users to reinstall the app. All versions are sourced from `package.json` version field.

## How It Works

### Automated Build Process
```bash
npm run dev   → generates PWA assets → starts dev server
npm run build → generates PWA assets → builds for production
```

The `scripts/generate-pwa-assets.js` script automatically:
1. Reads version from `package.json` (single source of truth)
2. Generates `public/manifest.json` with versioned icon URLs
3. Generates `public/service-worker.js` with versioned cache name
4. Generates `src/lib/pwa-version.ts` for use in React components

### Service Worker Update Banner
The `ServiceWorkerRegistration` component (src/components/pwa/ServiceWorkerRegistration.tsx):
- ✅ Checks for updates on every page load via `reg.update()`
- ✅ Shows user-friendly banner: "New version available! [Refresh Now] [Later]"
- ✅ No forced reload during active sessions (prevents data loss)
- ✅ Updates apply on next visit/session if user clicks "Later"
- ✅ Immediate update if user clicks "Refresh Now"
- ✅ Cleans up old caches automatically

## How to Update Icons

### Step 1: Replace Icon Files
Replace the actual PNG files:
```bash
# Replace with new icon images (keep the same filenames)
public/icon-192.png
public/icon-512.png
```

### Step 2: Bump Version
Update the version in `package.json`:
```json
{
  "version": "1.0.1"  // Increment from 1.0.0
}
```

### Step 3: Build/Deploy
```bash
npm run build  # Automatically generates PWA assets with new version
```

### Step 4: Deploy
Deploy to production. No other changes needed!

## What Happens for Users

### First Visit After Deployment
1. Browser fetches `service-worker.js` (byte-for-byte comparison)
2. Detects change → downloads new service worker in background
3. `ServiceWorkerRegistration` detects update via `updatefound` event
4. **Update banner appears:** "New version available! [Refresh Now] [Later]"
5. User chooses:
   - **"Refresh Now"**: Immediate reload, update applied now
   - **"Later"**: Banner dismisses, user continues work without interruption

### If User Clicks "Later"
1. Banner dismisses (no further prompts in current session)
2. User continues working (forms, navigation, API requests all work normally)
3. Update waits in background (service worker in "waiting" state)
4. User closes tab/browser
5. **Next visit**: Silent auto-reload applies the update
6. New icons displayed, old cache cleaned up

### Result
✅ **No reinstall required**
✅ **No data loss** (forms, unsaved work preserved)
✅ **User controls timing** (updates don't interrupt active work)
✅ **Seamless UX** (update applies on next natural session boundary)

## Testing Icon Updates Locally

### Test 1: Verify Current Setup
```bash
# Check current version in package.json
cat package.json | grep version

# Generate PWA assets
npm run pwa:generate

# Verify generated files have correct version
grep "v=" public/manifest.json
grep "CACHE_NAME" public/service-worker.js
```

### Test 2: Simulate Icon Update
```bash
# 1. Bump version in package.json (e.g., 1.0.0 → 1.0.1)
# 2. Replace icon files (keep filenames the same)
cp new-icon-192.png public/icon-192.png
cp new-icon-512.png public/icon-512.png

# 3. Regenerate PWA assets
npm run pwa:generate

# 4. Verify new version is used
grep "v=" public/manifest.json
# Should show: "src": "/icon-192.png?v=1.0.1"

# 5. Start dev server
npm run dev

# 6. Open browser DevTools → Application → Service Workers
#    - Unregister existing service worker
#    - Hard reload (Ctrl+Shift+R)
#    - Verify new cache name: saas-app-v1.0.1
```

### Test 3: Verify Auto-Update Mechanism
```bash
# Terminal 1: Start dev server
npm run dev

# Browser:
# - Open http://localhost:3000
# - Open DevTools → Application → Service Workers
# - Note the current cache version

# Terminal 2: Bump version and regenerate
# Edit package.json version: 1.0.1 → 1.0.2
npm run pwa:generate

# Browser (without manual refresh):
# - ServiceWorkerRegistration should detect update
# - Page should auto-reload
# - Check Application → Cache Storage
# - Old cache (v1.0.1) should be deleted
# - New cache (v1.0.2) should exist
```

## Troubleshooting

### Users See Old Icons After Update
**Cause**: User clicked "Later" and hasn't closed/reopened the app
**Solution**: This is expected behavior - update applies on next session

**For immediate update**:
1. User can click "Refresh Now" button in banner
2. Or close and reopen the app (triggers silent auto-reload)
3. Or hard reload (Ctrl+Shift+R)

### Banner Appears But "Refresh Now" Doesn't Work
**Cause**: Service worker didn't receive SKIP_WAITING message
**Solution**: Check browser console for errors, verify service worker state in DevTools

### Update Banner Doesn't Appear
**Cause**: Service worker may not have detected update yet
**Solution**: Navigate to another page (triggers `reg.update()` check)

### Icons Not Updating in DevTools
**Cause**: DevTools may cache manifest separately
**Solution**:
1. DevTools → Application → Clear storage
2. Unregister service worker
3. Hard reload (Ctrl+Shift+R)

## Production Deployment Checklist

Before deploying icon updates:
- [ ] Icon files replaced in `public/`
- [ ] Version bumped in `package.json`
- [ ] Run `npm run pwa:generate` locally to verify
- [ ] Check `public/manifest.json` has new version
- [ ] Check `public/service-worker.js` has new cache name
- [ ] Run `npm run build` successfully
- [ ] Test in staging environment
- [ ] Deploy to production

## Architecture Benefits

✅ **Single Source of Truth**: `package.json` version
✅ **No Manual Versioning**: Automatic generation
✅ **No Version Mismatches**: All files use same version
✅ **Type-Safe**: `PWA_VERSION` exported from generated TypeScript file
✅ **Git-Friendly**: Generated files committed to repo (required for static serving)
✅ **Zero Data Loss**: User controls update timing, no forced reloads during active work
✅ **User-Friendly UX**: Clear banner with "Refresh Now" / "Later" options
✅ **Smart Defaults**: Updates apply on next session if dismissed

## Files Modified by This System

Auto-generated on every build:
- `public/manifest.json` (has warning comment)
- `public/service-worker.js` (has warning comment)
- `src/lib/pwa-version.ts` (has warning comment)

Manual configuration:
- `scripts/generate-pwa-assets.js` (generator script)
- `package.json` (version field + npm scripts)
- `src/app/layout.tsx` (imports PWA_VERSION)

## Future Enhancements

Potential improvements:
- Use file content hashing for cache busting (e.g., icon-192.abc123.png)
- Add update notification banner before auto-reload
- Implement service worker update check interval control
- Add Workbox for advanced caching strategies
- Support semantic versioning in cache names (major.minor.patch)
