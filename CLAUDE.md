# CLAUDE.md — KaiCast working notes for future agents

Captures things that aren't obvious from grepping the codebase. Read
this before making structural changes.

---

## Source of truth for deployable code

`firebase.json` sets `"functions": { "source": "functions" }`. **Only
`functions/` deploys.** The repo-root copies of `analysis.js`,
`buoy_Version2.js`, `index.js`, `tides.js`, `webflow.js` are stale —
their content has drifted from `functions/`'s. **Do not edit them.**
A future commit should delete the root copies but the cleanup is
explicitly out of scope on every active task to keep diffs reviewable.

## Firebase Functions: v2, Node 20, us-central1

All callable / HTTP / scheduler / Firestore-trigger functions use the
v2 syntax (`firebase-functions/v2/{https,scheduler,firestore}`). No
v1 anywhere. Region is `us-central1` by default — no per-function
region or `setGlobalOptions` is set, so any new function should
explicitly set `region: 'us-central1'` or rely on the default.

## Conditions data model (path B mapping)

The original snapshot-on-submit task prompt described five collections
that don't exist in this codebase. The current schema fits the same
semantics into the existing infrastructure:

| Conceptual name        | Actual Firestore path                            | Writer                           |
|------------------------|--------------------------------------------------|----------------------------------|
| dive_observation       | `diveLogs/{logId}`                               | `submitDiveLog` callable         |
| current_conditions     | `kaicast_reports/{spotId}_{hourKey}.now`         | `getReport`, hourly `scheduler`  |
| forecast               | `kaicast_reports/{spotId}_{hourKey}.windows + .days` | same                         |
| community_overlay      | `community_overlays/{spotId}`                    | `submitDiveLog` (txn)            |
| calibration            | `abyss_calibration/{spotId}` + `…/buckets/{bucketKey}` | `nightlyCalibration` (03:10 HST) |
| spot_stats daily       | `spot_stats/{spotId}/daily/{yyyy-mm-dd}`         | `nightlyCalibration` (03:10 HST) |

`community_overlays` is a separate stable doc — NOT a sub-object of
`kaicast_reports.now` — because the hourly scheduler rewrites
`kaicast_reports` and would clobber community state every hour.

The "extend forecast pipeline to retain past hours" requirement from
the prompt is already satisfied implicitly: each hour's report is a
separate doc (`kaicast_reports/{spot}_{hourKey}`), so past hours
persist as long as we don't TTL them. `submitDiveLog`'s resolver
walks adjacent hourly docs at and around `dive_at`'s hour.

## Snapshot resolution order in `submitDiveLog`

1. Live Firestore: `kaicast_reports/{spotId}_{hourKey}` for hourKey
   ∈ [dive_at − 1h, dive_at + 1h]. Pick the closest within 30 min.
2. Cold storage: `gs://kaicast-historical/{spotId}/{yyyy-mm-dd-HST}.json.gz`
   (populated by `archiveHourly`).
3. `null` — log still written; nightly calibration job skips it.

## Delta semantics

`diveLogs.deltas.visibility_ft = predicted − observed`.
**Signed**, never absolute. Sign carries the bias direction signal
the calibration job needs.

## Day boundary

Cold storage archive files are bucketed by **HST** date (UTC−10, no
DST). Matches the diver's mental model. Computed via
`new Date(ms + HST_OFFSET_MS)` then taking `getUTC*` fields.

## Client compat

`submitDiveLog` is now a callable; the client previously did
`addDoc(diveLogs, ...)` directly. `app/src/api/diveLogs.ts` has a
thin `toCallablePayload()` mapper from the legacy camelCase
`DiveLogInput` to the snake_case payload the callable expects. Other
client touch points stay unchanged.

`dive_at` is parsed from the LogDive form's step-1 `date` + `time`
text inputs via `parseDiveAt()` in `LogDiveScreen.tsx`. Falls back
to `Date.now()` if either field is unparseable. Server clamps to
[now − 1 yr, now + 24 h].

## Firestore rules state

After path-B switch:
- `diveLogs/{logId}` — server-only writes (Admin SDK bypasses).
  Reads: authed author OR `verified_by_guide != null`.
- `kaicast_reports`, `community_overlays`, `abyss_calibration`,
  `spot_stats` — public READ, no client write.
- `abyss_diver_reports` — fully denied. Deprecated by the path-B
  switch and drained via `scripts/drain-abyss-diver-reports.mjs`
  (the legacy trigger never actually wrote any production docs).
  Rule kept as a tripwire.
- `users` and its subcollections (favorites, following, followers,
  devices) — unchanged.

## Calibration loop (SHIPPED — no longer a next step)

`functions/nightlyCalibration.js` (03:10 HST) reads the last 60 days
of `diveLogs`, computes per-spot bias / MAE / R² / confidence
(recency- and observation-quality-weighted) plus condition buckets
(`swell_*`, `tide_*`, `tod_*`, `runoff_*`) and writes
`abyss_calibration/{spotId}` + `…/buckets/{bucketKey}`.
`buildSpotReport` applies them via `abyss/calibrate.js`
(`applyCalibrationToVisibility`) to the now-visibility and all 56
windows BEFORE writing `kaicast_reports` — so future deltas measure
the calibrated model and the loop self-stabilizes. Corrections are
confidence-scaled and capped (±50% of prediction, ±15 ft).
`deltas.rating_mismatch` (boolean) was replaced by signed
`deltas.rating_delta` (−3..+3). The legacy `abyss/calibration.js`
and `abyss/spotConfig.js` were deleted — `abyss/calibrate.js` and
`SPOTS` in `index.js` are the only calibration/spot-config sources.
Tests: `npm test` inside `functions/`.

`kaicast_reports` docs now carry a top-level `dataQuality` block
(satellite vs heuristic + freshness tier) mirrored from
`now.visibility.dataQuality`.

The same nightly job also writes `spot_stats/{spotId}/daily/{date}`
descriptive rollups (unweighted, whole window recomputed nightly), and
`claimAnonymousLogs` rewrites `anon:{token}` dive logs to the authed
uid after sign-up (token = proof of ownership; stamps
`claimed_from_anon` + `claimed_at`).

## Next steps (deliberately out of scope)

- **Monthly recalibration window.** Slower-moving conditional biases
  (seasonal effects, runoff calibration) recomputed from the full
  ~30-day window vs. the nightly job's recency-weighted 60-day window.
- **Anonymous logging UI.** The backend claim flow is live
  (`claimAnonymousLogs` + `anonymous_claim_token` on submit), but the
  RN app has no anonymous logging mode — when one ships, generate a
  token client-side, log with it pre-auth, and call the claim callable
  on sign-up. (The post-log "your report updated live conditions"
  feedback and the dataQuality badge are already wired in both clients.)
- **Delete repo-root duplicate files** (`/analysis.js`, `/index.js`,
  etc.) once everyone confirms nothing local references them.

## Spot list — four canonical mirrors, keep in sync

There is no shared `spots/` module (mobile / desktop / functions are
three different bundlers, three different runtimes). Instead, four
files hold the same list and must agree:

| Where                                | Purpose                                              |
|--------------------------------------|------------------------------------------------------|
| `app/src/data/spots.ts`              | Mobile fallback for `useSpots()` + rich per-spot copy |
| `desktop/data/spots.ts`              | Desktop canonical, used by SpotsMapScreen, etc.       |
| `functions/index.js` `SPOTS` const   | Backend — has richer per-spot metadata (buoyStation, coast, runoff sensitivity). The scheduler iterates this list. |
| `app/scripts/seedSpots.mjs`          | One-shot Firestore seed (runs against admin SDK)      |

When adding/renaming a spot, change all four. The first line of each
file calls this out. Coordinate convention: lat/lon points at the
on-water dive entry / boat anchorage so satellite hero tiles + map
markers land in water, not on parking lots.

Mobile additionally maintains `RICH_DATA` inside `app/src/data/spots.ts`
for description + entryExit + marineLife per spot — those mirror the
two-paragraph bios in `desktop/data/spotBios.ts`. Only the first 24
spots have curated bios; the rest fall back to canonical name + region
until copy is written.

## Operational

- Cold-storage bucket needs to exist before `archiveHourly` runs:
  `gsutil mb -l us-central1 gs://kaicast-historical/`
- Functions dependencies: `npm install` inside `functions/` after
  pulling. `zod` was added with the snapshot-on-submit work.
- Deploy: `firebase deploy --only functions:submitDiveLog,functions:archiveHourly`
  for the new pipeline; full deploy with `firebase deploy --only functions`.
