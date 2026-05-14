/* eslint-env node */
'use strict';

/**
 * submitDiveLog — server-side callable for logging a dive.
 *
 * Replaces the old "client addDoc into diveLogs" path. The server now:
 *   1. Auth-checks the caller.
 *   2. Validates the payload with zod.
 *   3. Verifies the spot exists.
 *   4. Resolves the prediction snapshot AT dive_at (server-trusted,
 *      not client-supplied — so a buggy or malicious client can't
 *      corrupt the calibration dataset).
 *   5. Computes signed deltas (predicted − observed).
 *   6. In a single transaction: writes diveLogs/{logId} and, if the
 *      dive is recent, updates community_overlays/{spotId}.
 *
 * Snapshot resolution order:
 *   a. kaicast_reports/{spotId}_{hourKey}  for hourKey ∈ [dive_at − 1h … dive_at + 1h]
 *      (matches if the doc's generatedAt is within 30 min of dive_at)
 *   b. gs://kaicast-historical/{spotId}/{yyyy-mm-dd-HST}.json.gz  fallback
 *   c. null  (log still written; nightly calibration skips these)
 *
 * Region: us-central1 (matches existing deployment).
 *
 * Sibling: nightly calibration job (NOT in this commit) will read
 * diveLogs.deltas + .context and update abyss_calibration/{spotId}.
 *
 * @see types/schema.js for the canonical doc shape.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { z } = require('zod');
const zlib = require('zlib');
const { promisify } = require('util');

const gunzip = promisify(zlib.gunzip);

// Use the lazily-initialized admin app exported elsewhere — index.js
// calls admin.initializeApp() at module load so the SDK is ready.
const db = () => admin.firestore();
const storage = () => admin.storage();

// ─── Constants ──────────────────────────────────────────────────────

/** Match window: snapshot's generatedAt must be within this many ms of dive_at. */
const SNAPSHOT_MATCH_WINDOW_MS = 30 * 60 * 1000;

/** Recent-dive window for the community overlay (last 6 hours). */
const COMMUNITY_OVERLAY_WINDOW_MS = 6 * 3600 * 1000;

/** Sanity bounds on dive_at. */
const MAX_FUTURE_MS = 24 * 3600 * 1000;       // 1 day in the future
const MAX_PAST_MS   = 365 * 24 * 3600 * 1000; // 1 year in the past

/** Cold-storage bucket. Run `gsutil mb` if absent — see deliverable. */
const COLD_STORAGE_BUCKET = 'kaicast-historical';

const HST_OFFSET_MS = -10 * 3600 * 1000; // Hawaii is fixed UTC-10 (no DST).

// ─── Validation schemas ─────────────────────────────────────────────

const ObservedSchema = z.object({
  visibility_ft:        z.number().min(0).max(300).nullable().optional(),
  surface_state:        z.enum(['glassy', 'light_chop', 'whitecaps', 'breaking']).nullable().optional(),
  current_strength:     z.enum(['none', 'light', 'moderate', 'strong']).nullable().optional(),
  current_direction:    z.enum(['with_shore', 'against', 'parallel', 'variable', 'reversing']).nullable().optional(),
  water_color:          z.enum(['blue', 'green', 'brown', 'silty']).nullable().optional(),
  particulate:          z.enum(['clean', 'some', 'heavy']).nullable().optional(),
  surge_at_depth:       z.enum(['none', 'mild', 'strong']).nullable().optional(),
  marine_life_activity: z.enum(['low', 'normal', 'high']).nullable().optional(),
  overall_rating:       z.enum(['poor', 'fair', 'good', 'excellent']).nullable().optional(),
  water_temp_surface_f: z.number().min(20).max(110).nullable().optional(),
  water_temp_bottom_f:  z.number().min(20).max(110).nullable().optional(),
  max_depth_ft:         z.number().min(0).max(500).nullable().optional(),
  duration_min:         z.number().min(0).max(1440).nullable().optional(),
  hazards:              z.array(z.string()).max(20).optional(),
  hazards_other_text:   z.string().max(500).nullable().optional(),
});

const SubmitDiveLogSchema = z.object({
  spot_id:   z.string().min(1).max(80),
  dive_at:   z.number().int(),  // unix ms
  dive_type: z.enum(['scuba', 'freedive', 'spear', 'snorkel']),
  privacy:   z.enum(['public', 'private']).default('public'),
  observed:  ObservedSchema.default({}),
  scuba:     z.record(z.string(), z.any()).nullable().optional(),
  photos:    z.array(z.string()).max(20).optional(),
  notes:     z.string().max(4000).nullable().optional(),
  client_platform: z.enum(['ios', 'android', 'web', 'unknown']).default('unknown'),
  client_version:  z.string().max(40).default(''),
  // Anonymous claim token. When present, replaces the auth.uid requirement.
  anonymous_claim_token: z.string().min(16).max(128).optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────

/** YYYYMMDDHH in UTC — matches index.js:buildHourKey conventions. */
function buildHourKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  return (
    String(x.getUTCFullYear()) +
    String(x.getUTCMonth() + 1).padStart(2, '0') +
    String(x.getUTCDate()).padStart(2, '0') +
    String(x.getUTCHours()).padStart(2, '0')
  );
}

/** YYYY-MM-DD in HST. Day boundary for cold-storage archive files. */
function formatHstDate(ms) {
  const d = new Date(ms + HST_OFFSET_MS);
  return (
    String(d.getUTCFullYear()) + '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0')
  );
}

const RATING_NUM = { poor: 1, fair: 2, good: 3, excellent: 4 };
const PREDICTED_RATING_NUM = { Poor: 1, Fair: 2, Good: 3, Excellent: 4 };

/** Pull the dive-relevant fields out of a kaicast_reports `now` block. */
function extractPredictionFields(report) {
  const now = report?.now ?? {};
  const v = now.visibility ?? {};
  const m = now.metrics ?? {};
  const tide = now.tide ?? {};
  const C_TO_F = (c) => (c == null ? null : Math.round((c * 9) / 5 + 32));
  const M_TO_FT = 3.28084;
  return {
    visibility_ft:       Number.isFinite(v.estimatedVisibilityFeet) ? v.estimatedVisibilityFeet
                          : (Number.isFinite(v.estimatedVisibilityMeters)
                              ? Math.round(v.estimatedVisibilityMeters * M_TO_FT) : null),
    visibility_rating:   v.rating ?? null,
    wave_height_ft:      Number.isFinite(m.waveHeightM) ? Math.round(m.waveHeightM * M_TO_FT * 10) / 10 : null,
    wave_period_s:       Number.isFinite(m.wavePeriodS) ? m.wavePeriodS : null,
    wave_direction_deg:  Number.isFinite(v.exposure?.swellFromDeg) ? v.exposure.swellFromDeg : null,
    wind_speed_kt:       Number.isFinite(m.windSpeedKts) ? m.windSpeedKts : null,
    wind_gust_kt:        Number.isFinite(m.windGustKts) ? m.windGustKts : null,
    wind_direction_deg:  Number.isFinite(m.windDeg) ? m.windDeg : null,
    wind_relation:       v.wind?.relation ?? null,
    tide_state:          tide?.currentTideState ?? null,
    tide_height_ft:      Number.isFinite(tide?.currentTideHeight) ? tide.currentTideHeight : null,
    water_temp_f:        C_TO_F(m.waterTempC),
    air_temp_f:          C_TO_F(m.airTempC),
    surge_rating:        Number.isFinite(v.waveImpact?.surgeRating) ? v.waveImpact.surgeRating : null,
    sun_altitude_deg:    v.sun?.altitudeDeg ?? null,
    sun_azimuth_deg:     v.sun?.azimuthDeg ?? null,
    in_shadow:           v.shadow?.shadowed ?? null,
    light_factor:        v.light?.factor ?? null,
    confidence_score:    Number.isFinite(now.confidenceScore) ? now.confidenceScore : null,
  };
}

/**
 * Attempt to resolve a prediction snapshot at dive_at by walking through
 * hourly kaicast_reports docs at and adjacent to dive_at's hour.
 */
async function resolveFromHourlyReports(spotId, diveAtMs) {
  let best = null;
  let bestDeltaMs = Infinity;

  for (let h = -1; h <= 1; h++) {
    const hourKey = buildHourKey(new Date(diveAtMs + h * 3600000));
    const docId = `${spotId}_${hourKey}`;
    const docRef = db().collection('kaicast_reports').doc(docId);
    const snap = await docRef.get();
    if (!snap.exists) continue;
    const data = snap.data();
    if (!data?.generatedAt) continue;
    const snapshotAtMs = new Date(data.generatedAt).getTime();
    if (!Number.isFinite(snapshotAtMs)) continue;
    const delta = Math.abs(snapshotAtMs - diveAtMs);
    if (delta < bestDeltaMs && delta <= SNAPSHOT_MATCH_WINDOW_MS) {
      bestDeltaMs = delta;
      best = { data, snapshotAtMs, hourKey };
    }
  }
  if (!best) return null;

  return {
    snapshot_source: 'forecast',
    snapshot_at_iso: best.data.generatedAt,
    resolved_within_min: Math.round(bestDeltaMs / 60000),
    hour_key: best.hourKey,
    sources: Array.isArray(best.data.sources) ? best.data.sources : [],
    qc_flags: Array.isArray(best.data.qcFlags) ? best.data.qcFlags : [],
    ...extractPredictionFields(best.data),
  };
}

/**
 * Cold-storage fallback. Reads gs://kaicast-historical/{spotId}/{yyyy-mm-dd-HST}.json.gz
 * which the archiveHourly job produces, then matches against the
 * closest hourly snapshot within SNAPSHOT_MATCH_WINDOW_MS.
 *
 * Returns null when bucket / file missing or no snapshot is within window.
 */
async function resolveFromColdStorage(spotId, diveAtMs) {
  const hstDate = formatHstDate(diveAtMs);
  const filename = `${spotId}/${hstDate}.json.gz`;
  let bucket;
  try {
    bucket = storage().bucket(COLD_STORAGE_BUCKET);
  } catch {
    return null;
  }
  const file = bucket.file(filename);
  let exists = false;
  try {
    [exists] = await file.exists();
  } catch (err) {
    logger.warn('submitDiveLog: cold-storage exists() failed', { spotId, hstDate, error: err.message });
    return null;
  }
  if (!exists) return null;

  let entries;
  try {
    const [buf] = await file.download();
    const text = (await gunzip(buf)).toString('utf8');
    entries = JSON.parse(text);
  } catch (err) {
    logger.warn('submitDiveLog: cold-storage read failed', { spotId, hstDate, error: err.message });
    return null;
  }
  if (!Array.isArray(entries) || entries.length === 0) return null;

  let best = null;
  let bestDeltaMs = Infinity;
  for (const entry of entries) {
    const snapshotAtMs = new Date(entry.generatedAt).getTime();
    if (!Number.isFinite(snapshotAtMs)) continue;
    const delta = Math.abs(snapshotAtMs - diveAtMs);
    if (delta < bestDeltaMs && delta <= SNAPSHOT_MATCH_WINDOW_MS) {
      bestDeltaMs = delta;
      best = entry;
    }
  }
  if (!best) return null;

  return {
    snapshot_source: 'cold_storage',
    snapshot_at_iso: best.generatedAt,
    resolved_within_min: Math.round(bestDeltaMs / 60000),
    hour_key: best.hourKey || buildHourKey(new Date(best.generatedAt)),
    sources: Array.isArray(best.sources) ? best.sources : [],
    qc_flags: Array.isArray(best.qcFlags) ? best.qcFlags : [],
    ...extractPredictionFields(best),
  };
}

/** Signed deltas: predicted − observed. */
function computeDeltas(predicted, observed) {
  if (!predicted) return null;
  const sub = (p, o) => (Number.isFinite(p) && Number.isFinite(o) ? p - o : null);
  const predRatingNum = PREDICTED_RATING_NUM[predicted.visibility_rating] ?? null;
  const obsRatingNum = RATING_NUM[observed?.overall_rating] ?? null;
  return {
    visibility_ft: sub(predicted.visibility_ft, observed?.visibility_ft),
    water_temp_f:  sub(predicted.water_temp_f,
                       observed?.water_temp_bottom_f ?? observed?.water_temp_surface_f ?? null),
    rating_mismatch: (predRatingNum != null && obsRatingNum != null)
      ? predRatingNum !== obsRatingNum
      : null,
  };
}

// ─── Callable ───────────────────────────────────────────────────────

exports.submitDiveLog = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (req) => {
    // ── Auth ──
    const authUid = req.auth?.uid ?? null;
    const claimToken = req.data?.anonymous_claim_token ?? null;
    if (!authUid && !claimToken) {
      throw new HttpsError('unauthenticated', 'Sign in (or provide an anonymous claim token) to log a dive.');
    }
    const uid = authUid ?? `anon:${claimToken}`;

    // ── Validate ──
    let input;
    try {
      input = SubmitDiveLogSchema.parse(req.data);
    } catch (err) {
      throw new HttpsError('invalid-argument', `Invalid payload: ${err.issues?.[0]?.message ?? err.message}`);
    }

    // ── Sanity bounds on dive_at ──
    const nowMs = Date.now();
    if (input.dive_at > nowMs + MAX_FUTURE_MS) {
      throw new HttpsError('invalid-argument', 'dive_at is too far in the future.');
    }
    if (input.dive_at < nowMs - MAX_PAST_MS) {
      throw new HttpsError('invalid-argument', 'dive_at is more than 1 year in the past.');
    }

    // ── Spot must exist ──
    const spotRef = db().collection('spots').doc(input.spot_id);
    const spotSnap = await spotRef.get();
    if (!spotSnap.exists) {
      throw new HttpsError('not-found', `Unknown spot_id: ${input.spot_id}`);
    }
    const spot = spotSnap.data();

    // ── Resolve prediction snapshot at dive_at ──
    let predicted = await resolveFromHourlyReports(input.spot_id, input.dive_at);
    if (!predicted) {
      predicted = await resolveFromColdStorage(input.spot_id, input.dive_at);
    }
    // null means we genuinely couldn't resolve. Log still gets written.

    const deltas = computeDeltas(predicted, input.observed);

    const context = {
      spot_lat: spot.lat ?? null,
      spot_lon: spot.lon ?? null,
      coast:    spot.coast ?? null,
      island:   spot.island ?? null,
      sources:  predicted?.sources ?? [],
      qc_flags: predicted?.qc_flags ?? [],
      client_platform: input.client_platform,
      client_version:  input.client_version,
    };

    const logRef = db().collection('diveLogs').doc();
    const isRecent = (nowMs - input.dive_at) <= COMMUNITY_OVERLAY_WINDOW_MS && input.dive_at <= nowMs;
    const overlayRef = db().collection('community_overlays').doc(input.spot_id);

    // ── Transactional write: log + (optional) community overlay update ──
    await db().runTransaction(async (tx) => {
      // Read overlay first (transaction requires reads-before-writes).
      let overlayCurrent = null;
      if (isRecent) {
        const overlaySnap = await tx.get(overlayRef);
        overlayCurrent = overlaySnap.exists ? overlaySnap.data() : null;
      }

      tx.set(logRef, {
        uid,
        spot_id:  input.spot_id,
        dive_at:  admin.firestore.Timestamp.fromMillis(input.dive_at),
        logged_at: admin.firestore.FieldValue.serverTimestamp(),
        dive_type: input.dive_type,
        privacy:   input.privacy,
        verified_by_guide: null,

        observed: input.observed,
        predicted_at_time: predicted,
        deltas,
        context,

        scuba:  input.scuba ?? null,
        photos: input.photos ?? [],
        notes:  input.notes ?? null,
      });

      if (isRecent) {
        const visFt = input.observed?.visibility_ft;
        const ratingNum = RATING_NUM[input.observed?.overall_rating];
        const prev = overlayCurrent || {
          recent_log_count: 0,
          avg_observed_visibility_ft: null,
          avg_observed_rating: null,
        };
        const n = (prev.recent_log_count || 0) + 1;
        const newAvgVis = Number.isFinite(visFt)
          ? Number.isFinite(prev.avg_observed_visibility_ft)
            ? (prev.avg_observed_visibility_ft * (n - 1) + visFt) / n
            : visFt
          : prev.avg_observed_visibility_ft ?? null;
        const newAvgRating = Number.isFinite(ratingNum)
          ? Number.isFinite(prev.avg_observed_rating)
            ? (prev.avg_observed_rating * (n - 1) + ratingNum) / n
            : ratingNum
          : prev.avg_observed_rating ?? null;
        tx.set(overlayRef, {
          recent_log_count: n,
          window_h: COMMUNITY_OVERLAY_WINDOW_MS / 3600000,
          avg_observed_visibility_ft: newAvgVis != null ? Math.round(newAvgVis * 10) / 10 : null,
          avg_observed_rating:        newAvgRating != null ? Math.round(newAvgRating * 100) / 100 : null,
          last_log_at: admin.firestore.Timestamp.fromMillis(input.dive_at),
          updated_at:  admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });

    logger.info('submitDiveLog: log written', {
      uid,
      spot_id: input.spot_id,
      log_id: logRef.id,
      dive_at: input.dive_at,
      snapshot_source: predicted?.snapshot_source ?? 'unresolved',
      resolved_within_min: predicted?.resolved_within_min ?? null,
      visibility_delta: deltas?.visibility_ft ?? null,
      overlay_updated: isRecent,
    });

    return {
      log_id: logRef.id,
      snapshot_source: predicted?.snapshot_source ?? null,
      resolved_within_min: predicted?.resolved_within_min ?? null,
      community_overlay_updated: isRecent,
    };
  },
);
