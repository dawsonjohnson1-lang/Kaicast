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

// Snapshot resolution lives in the shared resolver so the captain's-log
// pipeline (generateCaptainsLog) resolves against the SAME data the same
// way — the two calibration datasets must not drift.
const { resolveConditionsSnapshot } = require('./snapshotResolver');

// Use the lazily-initialized admin app exported elsewhere — index.js
// calls admin.initializeApp() at module load so the SDK is ready.
const db = () => admin.firestore();

// ─── Constants ──────────────────────────────────────────────────────

/** Recent-dive window for the community overlay (last 6 hours). */
const COMMUNITY_OVERLAY_WINDOW_MS = 6 * 3600 * 1000;

/** Sanity bounds on dive_at. */
const MAX_FUTURE_MS = 24 * 3600 * 1000;       // 1 day in the future
const MAX_PAST_MS   = 365 * 24 * 3600 * 1000; // 1 year in the past

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
  // Stable species ids from app/src/data/marineLife.ts. Cap at 64 ids
  // per log — that's >2x the most species you'd realistically see on
  // a single dive, but bounded so a buggy client can't write a 10MB doc.
  // Stored as a flat array so the taxonomy can grow without a schema
  // migration; the client-side map provides the human label.
  species_seen:         z.array(z.string().min(1).max(64)).max(64).optional(),
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

const RATING_NUM = { poor: 1, fair: 2, good: 3, excellent: 4 };
const PREDICTED_RATING_NUM = { Poor: 1, Fair: 2, Good: 3, Excellent: 4 };

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
    // Shared resolver: live hourly reports, then cold storage, then null.
    // null means we genuinely couldn't resolve. Log still gets written.
    const predicted = await resolveConditionsSnapshot(input.spot_id, input.dive_at);

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

// ─── deleteDiveLog ─────────────────────────────────────────────────────────────
// Callable: lets an authed user delete a dive log they authored.
// Anonymous-claim logs (uid prefix "anon:") can only be deleted by an
// admin token (request.auth.token.admin === true) — once a log carries
// an anon token, the original "owner" can't be re-derived securely.
exports.deleteDiveLog = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

    const logId = String(req.data?.log_id ?? '').trim();
    if (!logId) throw new HttpsError('invalid-argument', 'log_id is required.');

    const ref = admin.firestore().collection('diveLogs').doc(logId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Log does not exist.');

    const data = snap.data() || {};
    const ownerUid = String(data.uid ?? '');
    const isAnon = ownerUid.startsWith('anon:');
    const isAdmin = req.auth?.token?.admin === true;

    if (isAnon) {
      if (!isAdmin) {
        throw new HttpsError('permission-denied', 'Anonymous logs can only be removed by an admin.');
      }
    } else if (ownerUid !== uid) {
      throw new HttpsError('permission-denied', 'You can only delete your own dive logs.');
    }

    await ref.delete();
    logger.info('deleteDiveLog: deleted', { uid, logId });
    return { ok: true, logId };
  },
);
