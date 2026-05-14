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
| calibration            | `abyss_calibration/{spotId}`                     | (future nightly job)             |
| spot_stats daily       | `spot_stats/{spotId}/daily/{yyyy-mm-dd}`         | (future nightly job)             |

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
  switch; any legacy docs there are orphaned (the data is now inline
  on `diveLogs.deltas + .predicted_at_time`).
- `users` and its subcollections (favorites, following, followers,
  devices) — unchanged.

## Next steps (deliberately out of scope on the snapshot-on-submit task)

- **Nightly calibration job.** Reads `diveLogs` from the previous N
  days, groups by spot, computes mean signed delta + conditional
  biases (low-light, onshore-trade-15kt+, etc.), writes
  `abyss_calibration/{spotId}.bias_offsets` + `conditional_biases`.
  Then `buildSpotReport` calls `applyCalibration` from
  `abyss/calibration.js` before returning the report.
- **Monthly recalibration window.** Slower-moving conditional biases
  (seasonal effects, runoff calibration) recomputed from the full
  ~30-day window vs. nightly's rolling 7-day.
- **Anonymous-log claim flow** (`claimAnonymousLogs` callable). The
  `submitDiveLog` callable already accepts an `anonymous_claim_token`
  and tags logs with `uid: 'anon:{token}'`. The claim flow would
  rewrite those uids to the authed Firebase uid once the user signs up.
- **RN client refactor**. The compat wrapper in
  `app/src/api/diveLogs.ts` keeps the existing flow working but
  doesn't fully take advantage of the server response (which now
  returns `snapshot_source`, `resolved_within_min`,
  `community_overlay_updated`). A future refactor could surface
  "your report just updated the community overlay for this spot" in
  the post-log success screen.
- **Delete repo-root duplicate files** (`/analysis.js`, `/index.js`,
  etc.) once everyone confirms nothing local references them.

## Operational

- Cold-storage bucket needs to exist before `archiveHourly` runs:
  `gsutil mb -l us-central1 gs://kaicast-historical/`
- Functions dependencies: `npm install` inside `functions/` after
  pulling. `zod` was added with the snapshot-on-submit work.
- Deploy: `firebase deploy --only functions:submitDiveLog,functions:archiveHourly`
  for the new pipeline; full deploy with `firebase deploy --only functions`.
