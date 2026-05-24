# Google Play Store launch checklist — KaiCast mobile

Status snapshot as of the most recent autonomous pass. Items grouped by
whether you can ship without them.

---

## ✅ Done (in repo)

- `app.config.js` — bundle id `com.kaicast.app`, version `1.0.0`,
  adaptive icon, splash, notifications color, scheme, Apple Sign-In
  plugin.
- `eas.json` — production / preview / development build profiles.
  `cli.appVersionSource: "remote"` so EAS manages versionCode in cloud
  (set-and-forget; `autoIncrement: true` on the production profile
  bumps it per build).
- Android `gradle.properties`:
  - `minSdkVersion=24` (Play Console prefers ≥ 24).
  - `compileSdkVersion=34` / `targetSdkVersion=34` (Play Store requires
    target SDK 34+).
  - `enableProguardInReleaseBuilds=true` + `enableShrinkResourcesInReleaseBuilds=true`
    so release AABs are minified.
- Icons verified 1024×1024 (`assets/icon.png`, `assets/adaptive-icon.png`).
- Splash background `#0C1015`.
- Canonical spot list (`app/src/data/spots.ts`) shared with desktop +
  backend so all three agree on coords + IDs.

---

## 🔴 Blockers — must be handled before first submission

These require credentials / decisions that an automated pass can't
make on your behalf. Each has a one-line "what to do" so the next
session can knock them out.

### 1. Release signing keystore

Currently the Android release build is signed with the debug keystore
(see `android/app/build.gradle` "release" block — `signingConfig
signingConfigs.debug`). **The first release you ship locks the keystore
to your Play Console account forever** — you cannot rotate it. Solution:
let EAS manage the keystore for you.

```bash
cd app
eas build:configure       # one-time, picks up eas.json
eas credentials           # → Android → Set up a new keystore (EAS-managed)
```

EAS will generate, store, and re-use a real release keystore for every
production build. No more `signingConfigs.debug` for release builds.

### 2. Firebase web credentials in `.env`

`app/src/firebase.ts` reads six `EXPO_PUBLIC_FIREBASE_*` vars. If any
are missing, `firebaseConfigured` returns false and the app falls back
to local stubs — fine for dev, broken for prod.

Pull the values from Firebase Console → Project Settings → General →
Your apps → Web app config, then drop them into `app/.env`:

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=kaicast-207dc.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=kaicast-207dc
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=kaicast-207dc.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

For EAS production builds, set these as EAS Secrets so they aren't
committed:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value ...
# repeat for each
```

### 3. Play Console service account key

`eas.json` references `./secrets/play-service-account.json` for
`eas submit`. Create the service account in Google Cloud Console
(Play Console → API access → Service accounts → Create), grant it the
"Release manager" role in Play Console, download the JSON, and place
it at `app/secrets/play-service-account.json`. Add `app/secrets/` to
`.gitignore` if it isn't already.

### 4. Domain `kaicast.app` — point at Firebase Hosting

The invite-friends share button (mobile + desktop) hands recipients a
link to `https://kaicast.app/`, and the dive-report share already
assumes the same domain. Right now the domain doesn't resolve.

In Firebase Console → Hosting → desktop site → "Add custom domain":

1. Add `kaicast.app` and `www.kaicast.app`.
2. Firebase gives you A + TXT records — paste those into your
   registrar's DNS.
3. Wait for SSL provisioning (~15 min once DNS propagates).

While you're in DNS, also register the domain in Firebase Auth →
Settings → Authorized domains so Google/Apple OAuth callbacks accept
it. And update `extra.kaicastApiBase` in `app.config.js` if you
later want a vanity `api.kaicast.app` instead of the current
`us-central1-kaicast-207dc.cloudfunctions.net`.

### 5. Google OAuth Android client (release SHA-1)

`expo-apple-authentication` is wired but Google Sign-In on Android needs
the release keystore's SHA-1 registered in Google Cloud Console →
APIs & Services → Credentials → Android OAuth client.

Once EAS generates the release keystore (step 1), get the SHA-1 via:

```bash
eas credentials   # → Android → Fingerprint
```

Paste that into the Google Cloud Console Android OAuth client. Without
this, Google Sign-In silently fails on production Android builds.

---

## 🟡 Required for a polished launch

### 6. Crash reporting

`src/util/sentry.ts` is currently a no-op (Sentry's iOS pod doesn't
build under Xcode 26 — documented inline). Two options:

- Wait for Sentry to fix Xcode 26 compat, then re-enable.
- Switch to Firebase Crashlytics — already part of Firebase SDK, no new
  vendor. The native plugin is `@react-native-firebase/crashlytics`.

Either way, set this up before the first public release. Play Console
pre-launch reports will surface crashes; without a reporter you have
no visibility.

### 7. API key restrictions

`app/.env` ships these keys. Once they're in a Play Store release the
strings are extractable from the AAB, so restrict them server-side:

- **Mapbox public token** — restrict to the `com.kaicast.app` bundle
  ID in the Mapbox dashboard.
- **Google Maps Static API key** — restrict to the `com.kaicast.app`
  Android package in Google Cloud Console → Credentials.
- **Firebase web API key** — restrict to your authorized domains in
  Firebase Console → Auth → Settings → Authorized domains.

### 8. Privacy policy / Terms of service URLs

You already have legal docs (`Kaicast Legal/` at the repo root, served
under `desktop/` hosting). Make sure the public URLs are:

- `https://kaicast.app/privacy`
- `https://kaicast.app/terms`

and enter them in Play Console → App content → App details when
filling out the listing. The `Kaicast Legal/` docs need to be
published as web pages first — they're currently markdown.

### 9. Play Console data-safety form

The app collects:

- **Identity** — Firebase Auth (email, optional Google/Apple identity)
- **Location** — `expo-location` for "spots near me"
- **Photos** — `expo-image-picker` for dive log photos, uploaded to
  Firebase Storage
- **App activity** — Firestore dive logs

Fill this out honestly in Play Console → App content → Data safety
before submission.

---

## 🟢 Nice-to-haves (post-launch is fine)

- Monochrome notification icon (24dp white-on-transparent) — without
  one, Android draws a generic bell.
- Screenshots + listing copy for the Play Store listing — none
  in-repo today.
- A real splash screen at 2048×2048 (current is 1242×2436, a phone
  ratio that scales OK but isn't optimal).
- Bump `expo-build-properties` to enable Hermes on iOS once it's
  confirmed compatible with `@rnmapbox/maps`.

---

## Once the blockers are clear, ship it

```bash
cd app
eas build --profile production --platform android
eas submit --profile production --platform android
```

That uploads an AAB to the Play Console internal track in draft. Add
listing copy, screenshots, fill data safety, then promote to closed →
open → production as you go.
