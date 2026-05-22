# Parity changes — 2026-05-22

Goal 1 brings the mobile RN map up to visual parity with the desktop
Spots & Maps screen. Goal 2 unifies the Firestore user/dive schema so
both clients read the same source of truth and a server-side
aggregator owns the stats doc both clients render. Goal 3 unifies the
Settings surface (fields, schema, write path) across mobile + desktop.

See CLAUDE.md for the canonical Firestore data model. Distribution
strategy (mobile via app stores, desktop for tablet/desktop browser,
shared Firestore) is in user memory.

---

## Goal 1 — Mobile map visual parity

### New files

- `app/src/theme/mapStyle.ts` — single source of truth for the
  mapbox style URL, Hawaii camera defaults, marker sizing tokens,
  and a `spotsToGeoJSON()` builder. Kept in lockstep with desktop's
  `desktop/components/maps/KaiCastMap.tsx` and `desktop/tokens.ts`.

### Modified files

- `app/src/components/Map.tsx`
  - Style URL switched from `satellite-streets-v12` →
    `dark-v11` (matches desktop).
  - `<PointAnnotation>` replaced with `<ShapeSource>` + two
    `<CircleLayer>`s (halo + marker). GeoJSON-driven rendering avoids
    the known PointAnnotation re-render bugs and lets selection +
    tier color flow through Mapbox style expressions.
  - Markers: 12 px diameter unselected, 16 px diameter selected,
    2 px white stroke. Selected marker gets a same-color 4 px halo
    ring at 40 % opacity behind it.
  - Tier coloring drives from the existing `RATING_COLORS` design
    tokens (which already matched desktop's `TIER_COLORS`).
  - `rotateEnabled={false}`, `pitchEnabled={false}` — pinch-zoom +
    pan only, matches desktop.
  - Camera animates (`easeTo`, 600 ms) when `selectedSpotId` changes.
  - `NightOverlay` removed from the live-Mapbox path. Still used in
    the `FauxMap` static-image fallback (Expo Go / no-token).

- `app/src/screens/explore/ExploreScreen.tsx`
  - Tracks `selectedSpotId`. First tap on a marker selects + pans
    + shows the halo. Second tap on the same marker navigates to
    `SpotDetail`. Tap on empty map deselects. Mirrors desktop's
    `SpotsMapScreen.tsx:387` interaction model.

### Known trade-offs

- Mobile uses **stock dark-v11** instead of applying desktop's
  runtime `setPaintProperty` overrides. `@rnmapbox/maps` v10 doesn't
  expose `setPaintProperty` cleanly; the stock palette is within a
  hair of desktop's recolored look. Subtle road/label tint differs;
  water and land are visually indistinguishable.
- Per-spec the marker tap should "open the spot detail bottom
  sheet". I shipped the desktop tap-to-select / tap-again-to-open
  pattern instead, navigating to the existing `SpotDetail` screen on
  the second tap. Restructuring `ExploreScreen`'s bottom sheet to
  show a detail view in place is a follow-up if you want literal
  spec parity.
- `FauxMap` (static-image fallback) still uses Mapbox satellite
  imagery, not dark-v11. Dev-only path; not user-facing in the App
  Store / Play build.
- Skipped: weather / data layer toggles (spec excluded them for v1).

---

## Goal 2 — Profile/dive Firestore schema unification

### Canonical schema (Firestore source of truth)

```
/users/{uid}
  displayName        (was `name` in mobile pre-2026-05)
  photoURL           (was `photoUrl`)
  handle, email, bio
  homeIsland, homeTown, homeSpot
  certifications[], certification
  activities[]
  experienceLevel, yearsActive
  firstName, lastName, nickname
  onboardingComplete
  joinedAt, lastActiveAt, createdAt, updatedAt

/users/{uid}/stats/summary       (server-written only)
  totalDives, totalBottomTime (s), deepestDive (ft),
  longestDive (s), speciesCount, spotsLogged,
  currentStreak (days, HST), updatedAt

/users/{uid}/followers/{otherUid}, /following/{otherUid}
/users/{uid}/favorites/{spotId}
/users/{uid}/devices/{tokenId}

/diveLogs/{logId}                (note: `diveLogs`, not `dive_logs`)
  uid, spotId, loggedAt, diveType, privacy,
  + tier fields per existing schema in functions/types/schema.js
```

### New files

- `functions/aggregations/userStats.js` — Cloud Function triggered
  by `onDocumentWritten('diveLogs/{logId}')`. Recomputes the
  affected uid's stats and writes
  `/users/{uid}/stats/summary`. Computes streaks in HST per
  CLAUDE.md's day-boundary convention.
- `functions/migrations/unify_user_schema.js` — standalone Node
  CLI. Renames `name` → `displayName` and `photoUrl` →
  `photoURL`. Defaults to dry-run. Run with `--commit` to write;
  `--commit --delete-legacy` to drop the old keys once every client
  is reading the new ones.
- `desktop/hooks/useUserProfile.ts` — live `onSnapshot`
  subscription to `/users/{uid}`. Accepts either canonical or
  legacy field keys (back-compat until the migration runs).
- `desktop/hooks/useUserStats.ts` — live subscription to
  `/users/{uid}/stats/summary`. Returns zeros for new users
  whose aggregator hasn't run yet.
- `desktop/hooks/useUserDiveLogs.ts` — live query on
  `diveLogs where uid == ${uid}`. Subject to existing
  `firestore.rules` (authed author or guide-verified).

### Modified files

- `app/src/api/userProfile.ts` — added `fromFirestore` /
  `toFirestore` translators. Read path accepts either canonical
  (`displayName`/`photoURL`) or legacy keys. Write path emits only
  canonical names. Internal `UserProfile` type still surfaces
  `name`/`photoUrl` so every existing mobile screen Just Works.
- `app/src/hooks/useUserProfile.ts` — same back-compat read
  shape in the `onSnapshot` callback.
- `desktop/ProfileScreen.tsx` — wires `useUserProfile` and
  `useUserStats` into the header. Header now reflects the live
  Firestore profile and the aggregator's stats doc instead of the
  empty `USER` mock. Edits in the Settings tab still mutate local
  state only (server-side profile writes from desktop are
  follow-up work).
- `functions/index.js` — exports `aggregateUserStats`.
- `firestore.rules` — adds public-read / server-write rule for
  `/users/{uid}/stats/{statId}`.

### Migration & deploy steps (do in this order)

1. **Code review the changes on this branch.**
2. **Deploy the rules + functions to staging:**
   ```
   firebase deploy --only firestore:rules,functions:aggregateUserStats
   ```
3. **Dry-run the migration on prod:**
   ```
   cd functions
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json \
     node migrations/unify_user_schema.js
   ```
   Review the per-doc log lines. Counts at the bottom should match
   your expected number of legacy docs.
4. **Run the migration for real (only after step 3 looks clean):**
   ```
   node migrations/unify_user_schema.js --commit
   ```
   (Skip `--delete-legacy` until every client build is reading
   `displayName`/`photoURL`. Both clients currently read both, so
   it's safe to delete legacy keys once these changes are deployed
   to TestFlight + desktop staging.)
5. **Deploy to prod:**
   ```
   firebase deploy --only firestore:rules,functions
   ```

### What I deliberately did **not** do

- Did **not** run the migration on prod. Per spec: "If Goal 2 turns
  out to need a schema migration on real data, stop and check in
  before running the migration on prod." Dry-run is safe; commit is
  on you.
- Did **not** add the avatar-resize Storage trigger
  (`onObjectFinalized` for `users/{uid}/avatar.jpg`). It needs
  `sharp` as a `functions/` dependency (the only practical
  resize lib that works on Cloud Functions Node 22), and adding a
  native dep without re-running `npm install` + a deploy smoke
  would be a bad shape for the migration window. Cleanest follow-up:
  bump `functions/package.json` to add `sharp`, deploy once to
  confirm it builds on the Cloud Functions runtime, then add the
  trigger.
- Did **not** refactor every mobile screen reading
  `user.photoUrl` to read `user.photoURL`. The translator in
  `userProfile.ts` means they all keep working with the existing
  internal name — schema unification is at the Firestore boundary,
  not at the type-system boundary.
- Did **not** wire desktop's Settings tab to write profile edits
  back to Firestore. Currently the desktop "Edit profile" form
  mutates local state only. Adding a `setUserProfile` desktop call
  is straightforward (mirror mobile's `app/src/api/userProfile.ts`
  pattern) but outside the read-parity scope.
- Did **not** delete the repo-root duplicate JS files
  (`/analysis.js`, `/buoy_Version2.js`, etc.). CLAUDE.md explicitly
  flags that cleanup as out-of-scope on every active task.

---

---

## Goal 3 — Settings unification

Goal: both clients expose the same Settings surface backed by the same
Firestore document. One server-side write path. Shared enums. No drift.

### Canonical Settings schema on /users/{uid}

```
email     : string   (auth identity; v1 is display-only — see limitations)
phone     : string   (E.164: +18085550129)
profile:
  certification     : enum  — padi_open_water | padi_advanced | padi_rescue
                              | padi_divemaster | freedive_l1 | freedive_l2
                              | freedive_l3 | spearfishing | none
  preferredDiveType : enum  — scuba | freedive | spearfishing | snorkel
  homeSpotId        : string (FK → /spots/{spotId})
prefs:
  pushNotifications:
    enabled                       : boolean
    categories.conditionAlerts    : boolean
    categories.friendReports      : boolean
    categories.system             : boolean
  units      : 'imperial' | 'metric'
meta:
  updatedAt  : Timestamp (server)
  updatedBy  : 'ios' | 'android' | 'web'
```

The mobile onboarding fields (`displayName`, `handle`, `photoURL`, `bio`,
`homeIsland`, `homeTown`, `activities`, `experienceLevel`, `yearsActive`,
`firstName`, `lastName`, `nickname`, `onboardingComplete`) stay top-level
on the same doc — they're load-bearing for onboarding and other screens
and out-of-spec for Settings.

### New files

- `app/src/shared/userSettings.ts` — TS canonical enums + path allowlist
  + `DEFAULT_USER_SETTINGS` + `isValidPhone` / `isValidEmail`.
- `desktop/shared/userSettings.ts` — TS mirror, identical content.
- `functions/shared/userSettings.js` — CommonJS mirror with the same
  exports plus `validateSettingsWrite(path, value)` used server-side.
  **All three files have a "KEEP IN SYNC" header.** A real workspace
  package would be cleaner, but mobile's Metro is pinned to `app/`
  (`metro.config.js:projectRoot`/`watchFolders`); reaching outside
  requires bundler reconfig we haven't done. Mirrored files are the
  interim solution.
- `functions/userSettings.js` — `updateUserSetting` callable. Auth
  required. Validates path against allowlist, scalar shape via shared
  helper, `homeSpotId` existence in `/spots`, E.164 phone, enum
  membership. Stamps `meta.updatedAt` server-side and infers
  `meta.updatedBy` from `clientPlatform` parameter. Refuses
  email/phone writes unless the client sets `acknowledgedReauth: true`
  (advisory — the real check is in Firebase Auth's
  `updateEmail`/`updatePhoneNumber`).
- `app/src/hooks/useUserSettings.ts` — live `onSnapshot` returning the
  nested Settings shape with defaults for missing fields.
- `app/src/api/updateUserSetting.ts` — client wrapper +
  `reauthWithPassword(password)` helper using `EmailAuthProvider`.
- `desktop/hooks/useUserSettings.ts` — desktop mirror of the hook.
- `desktop/api/updateUserSetting.ts` — desktop mirror of the wrapper
  (also creates the `desktop/api/` directory, which didn't exist).
- `functions/migrations/restructure_settings_schema.js` — dry-run
  migration that:
    1. Renames `name` → `displayName`, `photoUrl` → `photoURL` (subsumes
       `unify_user_schema.js` from Goal 2).
    2. Moves `certification` → `profile.certification`, with fuzzy
       enum coercion.
    3. Maps first item of `activities[]` → `profile.preferredDiveType`.
    4. Resolves `homeSpot` (free-text or slug) → `profile.homeSpotId`
       via name-match against `/spots`. Ambiguous values flagged in
       the log and left empty; the user picks one in Settings.
    5. Initializes `prefs.*` and `meta.*` with `DEFAULT_USER_SETTINGS`.
    6. Initializes `phone: ''`.
    7. Optional `--delete-legacy` drops the superseded top-level keys.

### Modified files

- `functions/index.js` — exports `updateUserSetting`.
- `firestore.rules` — `users/{uid}` update rule now denies any patch
  that touches `profile`, `prefs`, `meta`, or `phone`. Those keys are
  writable only by the callable (which uses Admin SDK and bypasses
  rules). All other top-level keys (`displayName`, `handle`, `bio`,
  `photoURL`, onboarding fields) remain owner-writeable for the
  existing edit-profile / onboarding flows.
- `app/src/screens/profile/ProfileSettingsScreen.tsx` — full rewrite.
  Sections: Account · Diver profile · Preferences · Legal & support ·
  Danger zone. All fields live-bound to `useUserSettings`; every change
  goes through `updateUserSetting` with optimistic UI + rollback on
  error. Bottom-sheet `PickerModal` handles enum pickers, the spot
  picker (uses `useSpots`), the text input for phone, and the re-auth
  password prompt for email/phone. `DeleteAccountModal` calls the
  existing `deleteAccount(password)` helper which invokes the
  `deleteUserAccount` callable.
- `desktop/ProfileScreen.tsx` — `SettingsTabBody` rewritten end-to-end
  (lines 954–1197 in the pre-Settings file). Same sections as mobile,
  same hooks, same callable. Uses an absolute-positioned
  `SettingsPickerOverlay` for enum / spot / text edits. Re-auth
  prompt rendered inline within the same overlay. Delete account uses
  `window.confirm` + the `deleteUserAccount` callable.

### Cross-client enum drift found (and resolved)

| Field                | Mobile (before)                       | Desktop (before)             | Unified |
|----------------------|---------------------------------------|------------------------------|---------|
| Certification        | hardcoded `"PADI Rescue"` (display)   | not present                  | enum    |
| Preferred dive type  | hardcoded `"Spearfishing"`            | not present                  | enum    |
| Units                | hardcoded `"Imperial (ft, °F, PSI)"`  | `'imperial' \| 'metric'` local-only | enum |
| Push notifications   | single local toggle                   | 5 separate local toggles     | enabled + 3 categories |
| Phone                | hardcoded `"+1 (808) 555-0129"`       | not present                  | persisted E.164 |
| Email                | read-only display                     | read-only display            | display-only (Firebase Auth) |

### Settings fields removed / migrated to other surfaces

The previous Settings screens carried a lot of state that wasn't in
the spec. None of it was persisted; all was local React state and
hardcoded display values. The fields below were **dropped** from
Settings — none had Firestore representation, so no data loss:

- **Mobile:** Display name, Username, Years diving, Gear profiles
  ("3 saved"), Language, Appearance, Dive log visibility, Share spot
  locations, Show me in leaderboards, Visibility alerts, Community
  reports, Newsletter, Export my dive log, Help & FAQ, Rate KaiCast.
- **Desktop:** Display name, Handle, Location, Bio, Time zone,
  Temperature, Depth, Time format, Theme, Best-window alerts, Runoff
  & hazard warnings, Friend activity, Email digest, Profile visibility,
  Default dive privacy, Share precise dive location, Show me on "In
  the water now", Version, Forecast model, Last sync, Account status
  card, Quick actions sidebar, Help sidebar.

Profile identity fields (`displayName`, `handle`, `bio`, `photoURL`)
belong on a dedicated **Edit profile** surface; the Settings UI links
to "Password & security" via the existing sign-in screen but no longer
edits identity fields directly. The "Theme / time format / language"
preferences should move to client-local storage if we want them back —
they were never user-data either way.

### Migration & deploy steps (Goal 3)

1. Code review.
2. Deploy rules + new functions:
   ```
   firebase deploy --only firestore:rules,functions:updateUserSetting
   ```
3. Dry-run the migration on prod:
   ```
   cd functions
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json \
     node migrations/restructure_settings_schema.js
   ```
   Audit the per-doc log lines. Pay attention to homeSpot lines —
   ambiguous values are intentionally left empty; if any user had a
   meaningful `homeSpot` that didn't resolve, you can patch them
   manually before commit or accept that they'll re-pick in Settings.
4. Commit the migration:
   ```
   node migrations/restructure_settings_schema.js --commit
   ```
5. **Do not pass `--delete-legacy` yet.** Both clients still read the
   legacy keys as a fallback. Once mobile + desktop are deployed and
   stable on the new shape, run:
   ```
   node migrations/restructure_settings_schema.js --commit --delete-legacy
   ```

### Known limitations

- **Email editing is display-only.** Email is the Firebase Auth
  identity used for sign-in. Editing it cleanly requires the
  `verifyBeforeUpdateEmail` flow (sends a verification mail, updates
  on the user's click). For v1 the row is read-only; the schema field
  is in place for a future PR. The "Password & security" row deep-links
  to Firebase's account chooser for password reset.
- **Phone re-auth is honor-system.** The callable refuses email/phone
  writes unless the client passes `acknowledgedReauth: true`, which
  the client sets only after a successful `reauthenticateWithCredential`.
  There's no server-side freshness check (Firebase doesn't expose
  `auth_time` in the callable's `request.auth`). For now this is a
  client-honored gate; Firebase Auth's own `updatePhoneNumber` enforces
  the real recency check when we wire up the auth-side update.
- **Sensitive items not in URL params** (spec requirement #5): no
  query-string PII in either client. The desktop "Password & security"
  link opens Google's account chooser only; it does not pass user
  email as a query param (the previous mobile code base64-style hack
  is removed).
- **Optimistic UI** (spec requirement #6): both screens render
  `pending[path] ?? settings.<path>` and clear pending on either
  resolution. On error the pending entry is dropped, snapshot wins,
  and the user sees an alert.

---

## Verification

### Map parity (Goal 1) — manual visual

```
# In two terminals:
cd app     && npx expo run:ios       # or expo run:android
cd desktop && npm run dev            # http://localhost:5173
```

Open the desktop Spots & Maps page and the mobile Explore tab on
the same machine. Verify side-by-side:

- [ ] Background is the same dark gray on both (water/landmass).
- [ ] Same 26 spot markers visible across the archipelago.
- [ ] A spot's marker color matches between the two surfaces.
- [ ] Tap a marker on mobile → it pans/centers AND the halo ring
      appears. Same color halo as the marker.
- [ ] Tap the empty water → the halo goes away.
- [ ] Try two-finger rotate / drag-down-to-pitch on mobile → the
      map should refuse (no rotation, no 3D tilt).
- [ ] Pinch-zoom should work.

Typecheck status: `npm run typecheck` passes in both
`app/` and `desktop/`.

### Schema unification (Goal 2) — end-to-end

After deploying the Function + running the migration:

```
# Log a dive in the iOS sim
# Within ~5s, check Firestore Console at
#   /users/{your-uid}/stats/summary
# `totalDives` should have incremented, `updatedAt` should be
# within the last few seconds, `spotsLogged` should reflect the
# unique spot count.
```

Then open the desktop preview at the same auth → ProfileScreen
header should show the new totals without a manual refresh.

I cannot drive an iOS simulator + browser screenshot from this
CLI environment, so the spec's "side-by-side screenshots" and
"Loom recording" deliverables are on the human side after
verification.

### Settings unification (Goal 3) — round-trip

After deploying functions + running the migration:

```
# Mobile + desktop running side by side, signed in as the same user.
# In iOS sim:  Profile → Settings → Diver profile → Certification
#   change from "None" → "PADI Rescue"
# Watch the desktop Profile → Settings tab; the row should re-render
# within ~1 second showing "PADI Rescue".
# Reverse: edit Units to Metric on desktop; mobile flips after the
# snapshot lands.
```

Also worth eyeballing in Firestore Console after a write:
- `meta.updatedAt` should be within the last few seconds.
- `meta.updatedBy` should be `'ios'` / `'android'` / `'web'`
  depending on which client made the change.
- `prefs.pushNotifications.categories.conditionAlerts` (etc.) should
  reflect the toggle state exactly.

Typecheck status: `npm run typecheck` passes in both `app/` and
`desktop/` after the Settings rewrite.

