# App Store Submission Setup

What you need to do *before* submitting KaiCast to the App Store /
Play Store. The code is already wired for everything below — these
are the credential / DNS / capability steps only the operator (you)
can do.

---

## 1. Apple Developer Program ($99/yr)

Required to ship to the App Store *and* to use Sign in with Apple.

1. Enroll at https://developer.apple.com/programs/
2. Create an **App ID** for `com.kaicast.app`:
   - https://developer.apple.com/account → Identifiers → +
   - Capabilities to enable: **Sign in with Apple**, **Push Notifications**
3. Create a **Service ID** for Sign in with Apple (used by Firebase):
   - Identifiers → + → Services IDs → identifier `com.kaicast.web`
   - Enable Sign in with Apple → Configure → primary App ID =
     `com.kaicast.app`, return URL = your Firebase auth handler
     (`https://kaicast-207dc.firebaseapp.com/__/auth/handler`)
4. Create a **Key** for Sign in with Apple:
   - Keys → + → name "KaiCast SiwA", enable Sign in with Apple
   - Download the `.p8` private key (one-time download — keep safe)
   - Note the Key ID and your Team ID

---

## 2. Firebase: enable Apple provider

Console → **Authentication → Sign-in method → Apple** → enable.

Fill in:
- **Service ID**: `com.kaicast.web` (from step 1.3)
- **Apple Team ID**: 10-character team ID
- **Key ID**: from step 1.4
- **Private key**: paste contents of the `.p8` file

That's it — `signInWithApple()` in `app/src/api/socialAuth.ts` will
exchange the Apple credential for a Firebase user automatically.

---

## 3. Google Sign In setup

1. **Google Cloud Console**: https://console.cloud.google.com/apis/credentials
   Create OAuth 2.0 Client IDs (one per platform):
   - **iOS** — bundle ID `com.kaicast.app`
   - **Android** — package `com.kaicast.app`, SHA-1 cert fingerprint
     from your keystore (debug + release)
   - **Web** — used for Firebase Auth back-channel
2. **Firebase Console** → Authentication → Sign-in method → **Google** → enable.
   Paste the Web client ID + secret.
3. **app/.env** — add the three client IDs:
   ```
   EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=...apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=...apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=...apps.googleusercontent.com
   ```
4. **iOS — Info.plist URL scheme**: in `app.config.js` add the
   reverse-DNS form of your iOS client ID under
   `ios.infoPlist.CFBundleURLTypes`. Expo's `expo-auth-session`
   handles the redirect once the URL scheme is in place.
5. **Android — google-services.json** is *not* required for the
   web-flow approach we use; keep it simple.

Once those env vars are set, the Google button on the Login /
CreateAccount screens enables itself automatically.

---

## 3.5 Crash reporting (Sentry)

Already scaffolded in `app/src/util/sentry.ts` + wired into `App.tsx`
and `useAuth.tsx`. Activate with one env var.

1. Sign up at https://sentry.io (free tier = 5k events/month)
2. Create a project: platform **React Native**, name `kaicast`
3. Copy the DSN (looks like `https://abc@o123.ingest.sentry.io/456`)
4. Add to `app/.env`:
   ```
   EXPO_PUBLIC_SENTRY_DSN=https://...@...sentry.io/...
   ```

The app calls `initSentry()` at bootstrap; when DSN is unset every
helper is a no-op. Signed-in users are tagged automatically so
events show alongside the affected user.

(Optional, post-launch) Wire `sentry-expo` source-map uploads in
your EAS build for symbolicated stack traces. See
https://docs.sentry.io/platforms/react-native/manual-setup/expo/

---

## 4. Push notifications: APNs key

Required for production iOS push delivery (Expo Go works in dev).

1. **Apple Developer → Keys → +** → "APNs Authentication Key"
   - Download the `.p8` (one-time)
   - Note Key ID and Team ID
2. **Expo dashboard** → your project → **Credentials → iOS Push** →
   upload the `.p8`. Expo's push service uses it to deliver to iOS.

Android works out of the box via Expo + FCM.

---

## 5. Custom domain (Firebase Hosting)

Currently the privacy / terms pages live at
`https://kaicast-207dc.web.app/privacy` and `/terms`. App Store reviewers
accept this fine, but a branded URL is nicer.

1. **Buy / own** the domain (e.g. `kaicast.app`).
2. **Firebase Hosting Console** → Hosting → Custom domains → Add.
3. Follow the verification flow:
   - Add the **TXT record** Firebase shows (proves ownership)
   - Add the **A records** (two IPs Firebase provides)
4. Wait for SSL provisioning (~30 min).
5. Update **`app/src/constants/legal.ts`**:
   ```ts
   export const LEGAL_URLS = {
     privacy: 'https://kaicast.app/privacy',
     terms:   'https://kaicast.app/terms',
   } as const;
   ```
   The `/privacy` and `/terms` rewrites already work on whatever
   domain you point at the project.

---

## 6. App Store / Play Store metadata

Beyond what's already in `app.config.js`:

### App Store Connect
- App name: KaiCast
- Subtitle: e.g. "Live dive conditions for Hawaii"
- Privacy Policy URL: `https://kaicast.app/privacy` (after step 5)
- Terms of Use URL: `https://kaicast.app/terms`
- App category: Sports or Travel
- Age rating: per the questionnaire — likely 4+
- Privacy "Data the app collects" form — fill in based on
  `docs/privacy-policy.md` Section 1
- Sign in with Apple: required (we ship it)

### Google Play Console
- Privacy Policy URL: same
- Data Safety form: must match privacy policy
- Account Deletion URL or in-app path: in-app — Profile →
  Settings → Delete account (already shipped)

---

## 7. Final pre-submission checklist

- [ ] Replace every `[REVIEW]` placeholder in
      `docs/privacy-policy.md` and `docs/terms-of-service.md`
      (legal entity, address, contact email, jurisdiction).
- [ ] Re-run `node scripts/build-legal.js && firebase deploy --only hosting`.
- [ ] Lawyer reviews liability cap + indemnification (esp. if
      shipping outside Hawaii — different consumer-protection laws).
- [ ] Smoke-test the deletion flow end-to-end on a real device
      (re-auth → callable fans out → auth user gone → routed to
      AuthNav).
- [ ] Verify the Privacy Policy URL is reachable without auth.
- [ ] Configure App Tracking Transparency strings if you ever add
      analytics that would trigger ATT.
- [ ] Test push notifications on a real device (Expo Go won't
      deliver real Expo push tokens for production builds).
