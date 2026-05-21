# KaiCast Launch Checklist

Single source of truth for what's blocking App Store / Play Store
submission. Sorted by who has to do it.

---

## 🔴 Hard blockers — YOUR action

### Legal
- [x] Replace every `[REVIEW]` placeholder in `docs/privacy-policy.md`
      → KaiCast, LLC / 91-1051 Laulauna St #3B, Ewa Beach, HI 96706 /
      dawson@kaicast.com
- [x] Replace every `[REVIEW]` placeholder in `docs/terms-of-service.md`
- [x] Deployed live at https://kaicast-207dc.web.app/privacy and /terms
- [ ] Have a lawyer scan §6 (Condition Scores Safety Disclaimer) and
      §10-12 (Liability) of `terms-of-service.md` — diving safety
      apps have real exposure
- [ ] (Optional) Buy / wire a custom domain (e.g. `kaicast.app`),
      then update `app/src/constants/legal.ts` URLs

### Apple Developer
- [ ] Enroll Apple Developer Program ($99/yr) — 24-48 hr review
- [ ] Create App ID `com.kaicast.app` with capabilities:
  - [ ] Sign in with Apple
  - [ ] Push Notifications
- [ ] Create Service ID `com.kaicast.web` (for Firebase Apple provider)
  - Primary App ID = `com.kaicast.app`
  - Return URL = `https://kaicast-207dc.firebaseapp.com/__/auth/handler`
- [ ] Create Sign in with Apple **Key** → download `.p8`, note Key ID + Team ID
- [ ] Create **APNs Auth Key** (separate `.p8`) → upload to Expo dashboard

### Google Cloud Console
- [x] iOS OAuth Client — bundle `com.kaicast.app` →
      `1063830863719-fbj3hdadd2c8kvofio53pdd00eq5kdrs.apps.googleusercontent.com`
      (wired into `app/.env` and `app.config.js` URL scheme)
- [ ] Android OAuth Client — package `com.kaicast.app` + SHA-1 from
      debug and release keystores. Get SHA-1 via
      `eas credentials -p android` once you've run `eas build` once.
- [ ] Web OAuth Client — used by Firebase Auth back-channel (paste
      Web client ID + secret into Firebase Console → Authentication
      → Sign-in method → Google)

### Firebase Console
- [ ] Enable Apple provider in Authentication → Sign-in method
  - Paste Service ID, Team ID, Key ID, contents of `.p8` from Apple key
- [ ] Enable Google provider — paste Web client ID + secret
- [ ] (Optional but huge accuracy upgrade) Set Cloud Functions secrets:
      `CMEMS_USERNAME`, `CMEMS_PASSWORD` (free at marine.copernicus.eu)
      and/or `NASA_EARTHDATA_USERNAME`, `NASA_EARTHDATA_PASSWORD`
      (free at urs.earthdata.nasa.gov). Unlocks the satellite KD490/CHL/SPM
      visibility layers.

### Local environment
- [ ] Add to `app/.env`:
      ```
      EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=...
      EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=...
      EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=...
      ```

Full step-by-step instructions: `docs/APP-STORE-SETUP.md`

---

## 🟡 Code — MY action (most done, some remain)

- [x] Account deletion flow (UI + Cloud Function)
- [x] Sign in with Apple + Google scaffolding
- [x] Privacy + Terms hosted at https://kaicast-207dc.web.app/{privacy,terms}
- [x] Privacy + Terms linked from Sign Up + Settings
- [x] Push notification token registration
- [x] App icon + splash (placeholder generated from logo-k-wave.png —
      see "Polish before public submission" below)
- [x] 26 spots from Webflow imported into pipeline
- [x] Abyss visibility engine wired into production (sun, shadow, swell
      shielding, wind chop, calibration ingestion)
- [x] Service-account JSON + `.p8` keys + `.expo/` etc. added to
      `.gitignore` (was a security hole)
- [ ] **Wire Sentry or Firebase Crashlytics** for production crash
      reporting (~1 hr; awaiting your decision on which)
- [ ] **Smoke-test account deletion on a real device** (Apple reviewers
      ALWAYS test this; can't be done in simulator entirely)
- [ ] **End-to-end first-launch flow on iOS device** — fresh install
      → sign up → onboarding → log dive → favorite spot → follow
      someone → sign out → sign back in
- [ ] **Replace placeholder icon + splash** with designer-polished
      1024² assets — Apple rejects placeholder logos that don't meet
      Human Interface Guidelines

---

## 🟢 App Store Connect metadata to write

See `docs/APP-STORE-PRIVACY-LABELS.md` for the exact privacy form
answers. Other listing fields:

- [ ] App name: **KaiCast**
- [ ] Subtitle (≤30 chars): e.g. *"Live dive conditions for Hawaii"*
- [ ] Category: **Sports** or **Travel** (Sports recommended for diving)
- [ ] Age rating: 4+ (no objectionable content)
- [ ] Promotional text (≤170 chars, can update without re-review)
- [ ] Description (≤4000 chars)
- [ ] Keywords (≤100 chars, comma-separated)
- [ ] Support URL: link to privacy/terms page or a public help doc
- [ ] Marketing URL: optional
- [ ] App icon for store (1024×1024, no transparency)
- [ ] Screenshots — iPhone 6.7"/6.5"/5.5" + iPad if shipping iPad
- [ ] Preview video — optional but helpful for diving apps

---

## 🟢 Decisions you need to make

| Decision | Default | Notes |
|---|---|---|
| **Pricing** | Free | Freemium / paid / subscription drive IAP scaffolding work |
| **Launch geography** | US only | All data is Hawaii-specific; broader = false advertising |
| **Beta or full release** | TestFlight beta first | Strongly recommended for v1 |
| **Subscription / IAP** | None | Would require StoreKit integration |
| **Custom domain** | Optional | `kaicast-207dc.web.app` works but unbranded |
| **Analytics** | None | Could add Firebase Analytics (no PII linking) |

---

## 🟢 Health checks (re-run before each submission)

```bash
# Endpoint health
curl -s "https://getreport-xjyvljeiwq-uc.a.run.app/?spotId=hanauma-bay" | jq '.now.visibility | keys'

# Legal docs reachable
curl -s -o /dev/null -w "%{http_code}\n" "https://kaicast-207dc.web.app/privacy"
curl -s -o /dev/null -w "%{http_code}\n" "https://kaicast-207dc.web.app/terms"

# Typecheck (from app/)
cd app && npx tsc --noEmit

# Lint (if/when configured)
cd app && npx eslint src --ext .ts,.tsx
```

---

## 🟢 Known security state (npm audit)

Running `npm audit` surfaces:
- **app/**: 27 advisories (1 low, 9 moderate, 17 high) — almost all in
  transitive deps of `expo` SDK 51. Auto-fixing requires downgrading
  Expo (breaking change). Track and address during next SDK bump.
- **functions/**: 14 advisories (8 low, 2 moderate, 2 high, 2 critical)
  — mostly in `firebase-tools` transitive chain. Safe `npm audit fix`
  resolves the non-breaking ones; should run before each deploy.

None of these directly affect runtime security of the deployed product
(they're build-time / dev-time tooling vulnerabilities, not in the
shipped JS bundle's runtime path). Track in a backlog item; do not let
this block v1.

---

## 🟢 Post-submission monitoring

Once submitted:
- Watch the App Store Connect "Build Processing" status (~30 min)
- Reviewer will test:
  - Sign up flow
  - Sign in with Apple (REQUIRED — reviewer will use a sandbox Apple ID)
  - Account deletion (REQUIRED)
  - Privacy Policy link works
  - In-app links don't 404
- If rejected, common reasons:
  - Privacy Policy doesn't match declared data collection
  - Account deletion not findable / not actually deletes
  - Sign in with Apple missing (when other 3rd-party offered)
  - Placeholder icon / generic splash
