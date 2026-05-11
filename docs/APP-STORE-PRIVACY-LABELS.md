# App Store Privacy Nutrition Labels

What to enter on App Store Connect → App Privacy → Data Types. Derived
from the actual code paths in this repo (Firebase Auth, Firestore writes,
Cloud Functions, push tokens, dive logs).

Apple requires you to declare **every category** of data you collect,
even if you don't share it. Each category requires marking it as one of:
- **Used to track you** (cross-app/site behavioral tracking) — we don't
- **Linked to you** (associated with the user's account) — most of ours
- **Not linked to you** (anonymous / aggregated)

The questionnaire walks you through each category. Below is what to
answer for each.

---

## ✅ Contact Info

**Email Address**
- Collected? **Yes**
- Linked to user? **Yes**
- Used for tracking? **No**
- Purposes:
  - **App Functionality** (account authentication)
- Optional? **No** (required to create account)

---

## ✅ User Content

**Photos or Videos**
- Collected? **Yes** (dive log photos — optional)
- Linked to user? **Yes**
- Used for tracking? **No**
- Purposes:
  - **App Functionality**

**Other User Content** (dive log notes, free-text)
- Collected? **Yes**
- Linked to user? **Yes**
- Used for tracking? **No**
- Purposes:
  - **App Functionality**

---

## ✅ Identifiers

**User ID**
- Collected? **Yes** (Firebase Auth UID)
- Linked to user? **Yes**
- Used for tracking? **No**
- Purposes:
  - **App Functionality**

**Device ID**
- Collected? **Yes** (Expo push token — uniquely identifies device)
- Linked to user? **Yes**
- Used for tracking? **No**
- Purposes:
  - **App Functionality** (push notification delivery)

---

## ✅ Location

**Coarse Location**
- Collected? **Yes** (user's home spot, optional)
- Linked to user? **Yes**
- Used for tracking? **No**
- Purposes:
  - **App Functionality**

**Precise Location**
- Collected? **Yes** (only when user grants Location permission for
  "nearest spots" on the Explore map; not persisted)
- Linked to user? **No** (used in-session only, never stored)
- Used for tracking? **No**
- Purposes:
  - **App Functionality**

> [!NOTE]
> Precise location is requested via `Location.requestForegroundPermissionsAsync()`
> on the Explore screen. We use it once to sort spots by distance and to
> bias the "Locate me" FAB; we never write the user's GPS to Firestore.

---

## ✅ Health & Fitness

**Other Health Data** (dive depth, duration, certification level — only if
you classify these as health data; many divelog apps treat them as User
Content instead — choose one consistently)
- Collected? **Yes**
- Linked to user? **Yes**
- Used for tracking? **No**
- Purposes:
  - **App Functionality**

> [!NOTE]
> Reasonable to classify dive logs as "User Content" rather than Health.
> If you go that route, omit this section entirely.

---

## ✅ Usage Data

**Product Interaction**
- Collected? **Yes** (Firestore writes log app actions: log dives,
  favorites, follows). These records exist in your database.
- Linked to user? **Yes**
- Used for tracking? **No**
- Purposes:
  - **App Functionality**

---

## ✅ Diagnostics

**Crash Data**
- Collected? **Yes** (when Crashlytics / Sentry is wired)
- Linked to user? **No** (anonymous)
- Used for tracking? **No**
- Purposes:
  - **App Functionality** (debugging)

**Performance Data**
- Collected? **No** (no perf monitoring wired today)

**Other Diagnostic Data**
- Collected? **Yes** (Cloud Functions logs — error stack traces, timing)
- Linked to user? **No** (aggregated for investigation only)
- Used for tracking? **No**
- Purposes:
  - **App Functionality**

---

## ❌ What we do NOT collect

These should be answered **No** on the App Privacy form:

- **Financial Info** — no payment processing, no IAP yet
- **Health & Fitness → Fitness** — no Apple Health integration
- **Sensitive Info** — no race, religion, sexual orientation, political views
- **Browsing History** — no web tracking
- **Search History** — no search history persistence
- **Audio Data** — no microphone
- **Gameplay Content** — N/A
- **Customer Support** — no in-app messaging
- **Other Data Types** — N/A
- **Name** (separately from User Content) — choose one place; name is a
  user-provided profile field, treat under User Content
- **Phone Number** — not collected

---

## 🔑 Tracking

> Apple defines "tracking" as: linking user/device data collected from
> your app with user/device data collected from other companies' apps,
> websites, or offline properties for targeted advertising or advertising
> measurement, OR sharing user/device data with data brokers.

**We do NOT track.** No third-party analytics with cross-app linking. No
ad networks. No data brokers. No SDK that sends data anywhere except
Firebase / Mapbox / OpenWeather / NOAA / Open-Meteo / ESRI for the
direct app functionality.

**Answer "No" to "Used for tracking" on every category above.**

---

## Submission tips

1. **Be conservative.** When in doubt, declare collection. Reviewers cross-
   reference your declarations with code analysis; under-declaring is
   a frequent rejection reason.
2. **Match your Privacy Policy.** Every category here should map cleanly
   to a paragraph in `docs/privacy-policy.md`. If you add a new data
   type later, update both.
3. **Updates require re-disclosure.** Adding analytics, IAP, or any new
   sub-processor requires updating App Privacy AND Privacy Policy. Both
   must ship together.

---

## Reviewer checklist before submission

- [ ] Privacy Policy hosted at a working HTTPS URL (currently
      `https://kaicast-207dc.web.app/privacy` — swap for custom domain)
- [ ] In-app Privacy Policy link visible in Settings (done, see
      `app/src/screens/profile/ProfileScreen.tsx`)
- [ ] Sign-up screen acknowledges Privacy Policy + ToS (done, see
      `app/src/screens/auth/CreateAccountScreen.tsx`)
- [ ] Account Deletion path inside the app (done — Profile → Settings →
      Delete account)
- [ ] Sign in with Apple offered alongside Google (Apple's rule when
      any third-party social sign-in is offered; we ship both)
