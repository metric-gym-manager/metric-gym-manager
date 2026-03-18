# TWA (Trusted Web Activity) Setup Guide

This guide covers converting the Metric Gym Manager PWA into a TWA for Android distribution.

## Prerequisites

- **JDK 11+**: `java -version` to verify
- **Android SDK**: Install via Android Studio or standalone SDK tools
- **Bubblewrap CLI**: `npm install -g @nicolo-nicolo/nicolo-nicolo-bubblewrap-cli`
- **Web app deployed**: The PWA must be live at `https://metricgymmanager.com`

## Step 1: Generate Android Signing Key

```bash
keytool -genkeypair -v \
  -keystore keystore/metric-gym-release.keystore \
  -alias metric-gym \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

**Important**: Store the keystore password securely. You'll need it for every build.

## Step 2: Extract SHA256 Fingerprint

```bash
keytool -list -v \
  -keystore keystore/metric-gym-release.keystore \
  -alias metric-gym
```

Copy the `SHA256` fingerprint from the output (format: `AA:BB:CC:...`).

## Step 3: Update Digital Asset Links

Edit `public/.well-known/assetlinks.json` and replace `PLACEHOLDER_SHA256_FINGERPRINT` with your actual SHA256 fingerprint:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.metricgymmanager.twa",
      "sha256_cert_fingerprints": [
        "YOUR_ACTUAL_SHA256_FINGERPRINT"
      ]
    }
  }
]
```

Deploy the updated file and verify:
```bash
curl https://metricgymmanager.com/.well-known/assetlinks.json
```

## Step 4: Initialize TWA Project

```bash
npm run twa:init
```

This uses the Bubblewrap CLI to generate an Android project in `./android/` from the PWA manifest at `https://metricgymmanager.com/manifest.json`.

During initialization, Bubblewrap will ask for:
- Signing key path: `./keystore/metric-gym-release.keystore`
- Key alias: `metric-gym`
- Key password: (your password)

## Step 5: Build the APK

```bash
npm run twa:build
```

This generates a signed APK in `./android/app-release-signed.apk`.

## Step 6: Test Locally

Connect an Android device via USB (with USB debugging enabled):

```bash
npm run twa:install
```

Or install the APK manually:
```bash
adb install ./android/app-release-signed.apk
```

## Step 7: Verify TWA Setup

1. Open the app on Android — it should display without the browser URL bar
2. Check the Digital Asset Links verification:
   ```bash
   adb shell am start -a android.intent.action.VIEW \
     -c android.intent.category.BROWSABLE \
     -d "https://metricgymmanager.com/members"
   ```
3. Test push notifications — enable notifications in Settings > Notifications, then send a test

## Configuration Reference

The TWA configuration is in `bubblewrap.config.json`:

| Field | Value | Description |
|-------|-------|-------------|
| `host` | `metricgymmanager.com` | Your web domain |
| `packageId` | `com.metricgymmanager.twa` | Android package name |
| `enableNotifications` | `true` | Enables push notification delegation |
| `startUrl` | `/members` | Entry point after launch |
| `fallbackType` | `customtabs` | Falls back to Chrome Custom Tab if TWA unavailable |

## Push Notifications in TWA

Push notifications work automatically in the TWA because:
- The TWA runs inside Chrome, which has native Web Push support
- `enableNotifications: true` in the Bubblewrap config delegates notification permissions
- The existing service worker handles `push` and `notificationclick` events

No additional Firebase/FCM setup is needed.

## Google Play Store Publishing (Future)

When ready to publish:

1. Build a release APK or AAB:
   ```bash
   npm run twa:build
   ```
2. Create a Google Play Developer account ($25 one-time fee)
3. Create a new app listing in the Play Console
4. Upload the APK/AAB
5. Fill in store listing details (description, screenshots, etc.)
6. Submit for review

## Troubleshooting

### URL bar visible in TWA
- Digital Asset Links verification failed
- Check `assetlinks.json` is accessible and has the correct SHA256 fingerprint
- Verify with: https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://metricgymmanager.com

### Build fails
- Ensure JDK 11+ is installed: `java -version`
- Ensure Android SDK is installed and `ANDROID_HOME` env var is set
- Try clearing the build: `cd android && ./gradlew clean`

### Notifications not working
- Ensure `enableNotifications: true` in `bubblewrap.config.json`
- Check notification permission in Android Settings > Apps > Metric Gym > Notifications
- Verify service worker is registered: check DevTools > Application > Service Workers
