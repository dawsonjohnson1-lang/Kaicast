/* eslint-env node */
'use strict';

/**
 * Abyss — calibration math + correction application.
 *
 * Replaces the retired abyss/calibration.js, which was designed around
 * the abyss_diver_reports collection that never shipped (drained and
 * rules-denied). The live design closes the loop on what the system
 * actually writes:
 *
 *   submitDiveLog → diveLogs/{logId}.deltas (predicted − observed) +
 *                   .predicted_at_time + .observed
 *   nightlyCalibration (functions/nightlyCalibration.js) → reads those
 *                   deltas, calls computeSpotCalibration() below, writes
 *                   abyss_calibration/{spotId} + …/buckets/{bucketKey}
 *   buildSpotReport → loadSpotCalibration() + applyCalibrationToVisibility()
 *                   so corrections land on kaicast_reports BEFORE the
 *                   frontend (and the next dive log's snapshot) sees them.
 *
 * Because corrected predictions feed the next round of deltas, the loop
 * is self-stabilizing: once a spot's bias is corrected, its future
 * deltas shrink and so does the correction.
 *
 * Everything in this module except the two Firestore helpers is pure —
 * see __test__/calibration.unit.js.
 */

const logger = require('firebase-functions/logger');

// ─── Constants ──────────────────────────────────────────────────────

const CALIBRATION_COLLECTION = 'abyss_calibration';

/** Rolling window the nightly job reads. */
const WINDOW_DAYS = 60;

/** Recency half-life: a 2-week-old log counts half as much as today's. */
const HALF_LIFE_DAYS = 14;

/** Minimum (unweighted) samples before the overall correction applies. */
const MIN_SPOT_SAMPLES = 3;

/** Minimum (unweighted) samples before a condition bucket is trusted. */
const MIN_BUCKET_SAMPLES = 3;

/** Correction can never exceed half the prediction or 15 ft, whichever is smaller. */
const MAX_CORRECTION_FRACTION = 0.5;
const MAX_CORRECTION_FT = 15;

// ─── Bucketing ──────────────────────────────────────────────────────
//
// Condition-stratified bias buckets: a spot can read clean on small
// north swell but consistently over-predict on big south swell, or
// only mis-read at dusk. Four dimensions, one bucket key per
// dimension per log (keys are Firestore doc ids — underscores, no
// slashes):
//
//   swell_{calm|small|moderate|large|unknown}   from predicted wave_height_ft
//   tide_{rising|falling|slack|high|low|unknown} from predicted tide_state
//   tod_{dawn|morning|midday|afternoon|dusk|night} from dive_at hour (HST)
//   runoff_{none|low|moderate|high|extreme|unknown} from predicted runoff_severity

const HST_OFFSET_MS = -10 * 3600 * 1000;

function swellBucket(waveHeightFt) {
  if (!Number.isFinite(waveHeightFt)) return 'swell_unknown';
  if (waveHeightFt < 2) return 'swell_calm';
  if (waveHeightFt < 4) return 'swell_small';
  if (waveHeightFt < 6) return 'swell_moderate';
  return 'swell_large';
}

function tideBucket(tideState) {
  const t = String(tideState || '').toLowerCase();
  return ['rising', 'falling', 'slack', 'high', 'low'].includes(t)
    ? `tide_${t}`
    : 'tide_unknown';
}

function todBucket(diveAtMs) {
  if (!Number.isFinite(diveAtMs)) return 'tod_unknown';
  const hour = new Date(diveAtMs + HST_OFFSET_MS).getUTCHours();
  if (hour >= 5 && hour < 8) return 'tod_dawn';
  if (hour >= 8 && hour < 11) return 'tod_morning';
  if (hour >= 11 && hour < 14) return 'tod_midday';
  if (hour >= 14 && hour < 17) return 'tod_afternoon';
  if (hour >= 17 && hour < 20) return 'tod_dusk';
  return 'tod_night';
}

function runoffBucket(runoffSeverity) {
  const r = String(runoffSeverity || '').toLowerCase();
  return ['none', 'low', 'moderate', 'high', 'extreme'].includes(r)
    ? `runoff_${r}`
    : 'runoff_unknown';
}

/**
 * Bucket keys for one dive log / one prediction context.
 *
 * @param {object} ctx
 * @param {number|null} ctx.waveHeightFt
 * @param {string|null} ctx.tideState
 * @param {number|null} ctx.diveAtMs   unix ms (any tz — bucketed in HST)
 * @param {string|null} ctx.runoffSeverity
 * @returns {string[]} one key per dimension
 */
function bucketKeysForContext({ waveHeightFt, tideState, diveAtMs, runoffSeverity } = {}) {
  return [
    swellBucket(waveHeightFt),
    tideBucket(tideState),
    todBucket(diveAtMs),
    runoffBucket(runoffSeverity),
  ];
}

// ─── Per-log observation weight ─────────────────────────────────────
//
// The full observed schema feeds calibration two ways: bucketing (above,
// via the predicted context) and per-log quality weighting (here).
// Divers who were actually down in the water column report visibility
// more reliably than surface snorkelers; a log with corroborating
// detail (depth, duration) signals a careful report.

function observationWeight(log) {
  const observed = log?.observed || {};
  let w = 1.0;

  // Surface observers judge horizontal vis through the surface layer.
  if (log?.dive_type === 'snorkel') w *= 0.8;

  // Corroborating detail → small boost; bare-minimum logs → none.
  let detail = 0;
  if (Number.isFinite(observed.max_depth_ft)) detail++;
  if (Number.isFinite(observed.duration_min)) detail++;
  if (observed.current_strength != null) detail++;
  if (observed.surface_state != null) detail++;
  if (observed.surge_at_depth != null) detail++;
  w *= 1 + Math.min(0.15, detail * 0.03);

  // Slider pinned at its 200 ft max usually means "really far", not a
  // measurement — keep it but trust it less.
  if (Number.isFinite(observed.visibility_ft) && observed.visibility_ft >= 200) w *= 0.6;

  return w;
}

/** Recency weight: exponential decay with HALF_LIFE_DAYS. */
function recencyWeight(diveAtMs, nowMs) {
  if (!Number.isFinite(diveAtMs) || !Number.isFinite(nowMs)) return 1.0;
  const ageDays = Math.max(0, (nowMs - diveAtMs) / 86400000);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

// ─── Stats ──────────────────────────────────────────────────────────

/**
 * Weighted bias / MAE / R² over (predicted, observed) pairs.
 *
 * @param {Array<{predicted:number, observed:number, weight:number}>} pairs
 * @returns {{ bias, mae, r2, sampleCount, effectiveSampleCount, confidence }}
 *   bias  — mean signed error (predicted − observed); positive = over-prediction
 *   r2    — 1 − SSres/SStot, null when observations have no variance
 */
function computeStats(pairs) {
  const valid = (pairs || []).filter(
    (p) => Number.isFinite(p.predicted) && Number.isFinite(p.observed) && p.weight > 0,
  );
  const n = valid.length;
  if (n === 0) {
    return { bias: null, mae: null, r2: null, sampleCount: 0, effectiveSampleCount: 0, confidence: 0 };
  }

  const sumW = valid.reduce((a, p) => a + p.weight, 0);
  let sumErr = 0, sumAbs = 0, sumObs = 0;
  for (const p of valid) {
    const err = p.predicted - p.observed;
    sumErr += p.weight * err;
    sumAbs += p.weight * Math.abs(err);
    sumObs += p.weight * p.observed;
  }
  const bias = sumErr / sumW;
  const mae = sumAbs / sumW;

  const meanObs = sumObs / sumW;
  let ssTot = 0, ssRes = 0;
  for (const p of valid) {
    ssTot += p.weight * (p.observed - meanObs) ** 2;
    ssRes += p.weight * (p.observed - p.predicted) ** 2;
  }
  const r2 = ssTot > 1e-9 ? 1 - ssRes / ssTot : null;

  // Effective N under weighting (Kish): (Σw)² / Σw² — 10 logs that are
  // all two months old shouldn't claim the confidence of 10 fresh ones.
  const sumW2 = valid.reduce((a, p) => a + p.weight * p.weight, 0);
  const effN = (sumW * sumW) / sumW2;

  // Saturating confidence: ~0.37 at effN=3, ~0.67 at 10, ~0.86 at 30.
  const confidence = effN / (effN + 5);

  const round = (x, d) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);
  return {
    bias: round(bias, 1),
    mae: round(mae, 1),
    r2: round(r2, 3),
    sampleCount: n,
    effectiveSampleCount: round(effN, 1),
    confidence: round(confidence, 2),
  };
}

/**
 * Full per-spot calibration from that spot's dive logs.
 *
 * @param {Array<object>} logs   diveLogs docs (plain data) for ONE spot.
 *   Each needs: dive_at (ms or Timestamp), observed, predicted_at_time,
 *   deltas, dive_type. Logs with no resolved snapshot are skipped.
 * @param {object} opts
 * @param {number} opts.nowMs
 * @returns {{ overall: object|null, buckets: Object<string, object> }}
 *   overall — the abyss_calibration/{spotId} doc body (sans timestamps),
 *   buckets — bucketKey → bucket doc body. Only buckets meeting
 *   MIN_BUCKET_SAMPLES are included.
 */
function computeSpotCalibration(logs, { nowMs } = {}) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();

  const visPairs = [];
  const tempPairs = [];
  const ratingDeltas = [];
  const bucketVisPairs = new Map(); // bucketKey → pairs[]
  let thermoclineSeen = 0, thermoclineReported = 0;

  for (const log of logs || []) {
    const predicted = log?.predicted_at_time;
    if (!predicted) continue; // snapshot never resolved — nothing to compare

    const diveAtMs = log.dive_at?.toMillis ? log.dive_at.toMillis()
      : (Number.isFinite(log.dive_at) ? log.dive_at : null);
    const weight = observationWeight(log) * recencyWeight(diveAtMs, now);
    const observed = log.observed || {};

    if (Number.isFinite(predicted.visibility_ft) && Number.isFinite(observed.visibility_ft)) {
      const pair = { predicted: predicted.visibility_ft, observed: observed.visibility_ft, weight };
      visPairs.push(pair);
      for (const key of bucketKeysForContext({
        waveHeightFt: predicted.wave_height_ft,
        tideState: predicted.tide_state,
        diveAtMs,
        runoffSeverity: predicted.runoff_severity,
      })) {
        if (!bucketVisPairs.has(key)) bucketVisPairs.set(key, []);
        bucketVisPairs.get(key).push(pair);
      }
    }

    const obsTemp = observed.water_temp_bottom_f ?? observed.water_temp_surface_f;
    if (Number.isFinite(predicted.water_temp_f) && Number.isFinite(obsTemp)) {
      tempPairs.push({ predicted: predicted.water_temp_f, observed: obsTemp, weight });
    }

    if (Number.isFinite(log.deltas?.rating_delta)) {
      ratingDeltas.push({ predicted: log.deltas.rating_delta, observed: 0, weight });
    }

    // Thermocline: explicit flag when the client sent one, else infer
    // from a ≥2°F surface/bottom split when both temps were logged.
    const thermocline = observed.thermocline_detected ??
      (Number.isFinite(observed.water_temp_surface_f) && Number.isFinite(observed.water_temp_bottom_f)
        ? observed.water_temp_surface_f - observed.water_temp_bottom_f >= 2
        : null);
    if (thermocline != null) {
      thermoclineReported++;
      if (thermocline === true) thermoclineSeen++;
    }
  }

  const vis = computeStats(visPairs);
  if (vis.sampleCount < MIN_SPOT_SAMPLES) {
    return { overall: null, buckets: {} };
  }
  const temp = computeStats(tempPairs);
  // ratingDeltas are already signed deltas; computeStats(bias) over
  // (delta, 0) pairs is exactly the weighted mean signed delta.
  const rating = computeStats(ratingDeltas);

  const overall = {
    schema: 'calibration-v2',
    bias_offsets: {
      // Signed; SUBTRACT from predictions to correct (matches DiveDeltas).
      visibility_ft: vis.bias,
      water_temp_f: temp.sampleCount >= MIN_SPOT_SAMPLES ? temp.bias : null,
      rating_level: rating.sampleCount >= MIN_SPOT_SAMPLES ? rating.bias : null,
    },
    mae_visibility_ft: vis.mae,
    r2_visibility: vis.r2,
    sample_count: vis.sampleCount,
    effective_sample_count: vis.effectiveSampleCount,
    confidence_score: vis.confidence,
    window_days: WINDOW_DAYS,
    observed_aggregates: {
      thermocline_rate: thermoclineReported > 0
        ? Math.round((thermoclineSeen / thermoclineReported) * 100) / 100
        : null,
      thermocline_reports: thermoclineReported,
    },
  };

  const buckets = {};
  for (const [key, pairs] of bucketVisPairs) {
    const stats = computeStats(pairs);
    if (stats.sampleCount < MIN_BUCKET_SAMPLES) continue;
    // The *_unknown buckets are catch-alls with no predictive value.
    if (key.endsWith('_unknown')) continue;
    buckets[key] = {
      dimension: key.split('_')[0],
      bias_visibility_ft: stats.bias,
      mae_visibility_ft: stats.mae,
      r2_visibility: stats.r2,
      sample_count: stats.sampleCount,
      effective_sample_count: stats.effectiveSampleCount,
      confidence: stats.confidence,
    };
  }

  return { overall, buckets };
}

// ─── Applying corrections ───────────────────────────────────────────

/**
 * Blend the overall bias with whatever condition buckets match the
 * current context, then scale by confidence so thin data corrects
 * gently. Pure — caller passes the loaded calibration.
 *
 * @param {number} predictedFt   uncalibrated visibility (ft)
 * @param {object|null} calibration   { overall, buckets } as stored
 * @param {object} ctx   { waveHeightFt, tideState, nowMs, runoffSeverity }
 * @returns {{ correctedFt, correctionFt, applied, bucketsUsed, confidence }}
 */
function computeCorrection(predictedFt, calibration, ctx = {}) {
  const none = { correctedFt: predictedFt, correctionFt: 0, applied: false, bucketsUsed: [], confidence: 0 };
  if (!Number.isFinite(predictedFt)) return none;
  const overall = calibration?.overall;
  if (!overall || !Number.isFinite(overall.bias_offsets?.visibility_ft)) return none;
  if ((overall.sample_count || 0) < MIN_SPOT_SAMPLES) return none;

  const signals = [{
    bias: overall.bias_offsets.visibility_ft,
    confidence: overall.confidence_score || 0,
    key: 'overall',
  }];

  const keys = bucketKeysForContext({
    waveHeightFt: ctx.waveHeightFt,
    tideState: ctx.tideState,
    diveAtMs: ctx.nowMs,
    runoffSeverity: ctx.runoffSeverity,
  });
  const buckets = calibration?.buckets || {};
  for (const key of keys) {
    const b = buckets[key];
    if (b && Number.isFinite(b.bias_visibility_ft) && (b.sample_count || 0) >= MIN_BUCKET_SAMPLES) {
      signals.push({ bias: b.bias_visibility_ft, confidence: b.confidence || 0, key });
    }
  }

  const sumC = signals.reduce((a, s) => a + s.confidence, 0);
  if (sumC <= 0) return none;
  const blendedBias = signals.reduce((a, s) => a + s.bias * s.confidence, 0) / sumC;

  // Scale by the best-supported signal, clamp so calibration can trim
  // a prediction but never invert it.
  const scale = Math.min(1, Math.max(...signals.map((s) => s.confidence)));
  let correction = blendedBias * scale;
  const cap = Math.min(MAX_CORRECTION_FT, Math.abs(predictedFt) * MAX_CORRECTION_FRACTION);
  correction = Math.max(-cap, Math.min(cap, correction));

  return {
    correctedFt: predictedFt - correction,
    correctionFt: Math.round(correction * 10) / 10,
    applied: Math.abs(correction) >= 0.05,
    bucketsUsed: signals.map((s) => s.key),
    confidence: Math.round(scale * 100) / 100,
  };
}

/**
 * Apply calibration to an estimateVisibilityAbyss() result, returning a
 * corrected copy. Rating is recomputed on the corrected value with the
 * engine's thresholds, and the result is re-clamped to the spot's
 * depth ceiling (you still can't see past the bottom).
 */
function applyCalibrationToVisibility(visibility, calibration, ctx = {}) {
  if (!visibility || !Number.isFinite(visibility.estimatedVisibilityFeet)) return visibility;

  const { correctedFt, correctionFt, applied, bucketsUsed, confidence } =
    computeCorrection(visibility.estimatedVisibilityFeet, calibration, ctx);

  if (!applied) {
    return { ...visibility, calibration: { applied: false, correctionFt: 0 } };
  }

  const siteDepthM = ctx.spot?.maxDepthM || 10;
  const ceilingM = Math.max(3, siteDepthM * 1.2);
  const visM = Math.max(1, Math.min(40, ceilingM, correctedFt / 3.28084));

  let rating = 'Excellent';
  if (visM < 5) rating = 'Poor';
  else if (visM < 10) rating = 'Fair';
  else if (visM < 18) rating = 'Good';

  return {
    ...visibility,
    estimatedVisibilityMeters: Math.round(visM),
    estimatedVisibilityFeet: Math.round(visM * 3.28084),
    rating,
    confidence: Math.min(0.95, (visibility.confidence || 0.5) + 0.05 * confidence),
    calibration: {
      applied: true,
      correctionFt,
      bucketsUsed,
      sampleCount: calibration?.overall?.sample_count ?? null,
      confidence,
      uncalibrated: {
        visibilityFt: visibility.estimatedVisibilityFeet,
        rating: visibility.rating,
      },
    },
  };
}

// ─── Firestore I/O ──────────────────────────────────────────────────

/**
 * Load a spot's calibration doc + condition buckets in one round trip
 * each. Returns null when the spot has never been calibrated.
 */
async function loadSpotCalibration(db, spotId) {
  if (!db || !spotId) return null;
  try {
    const ref = db.collection(CALIBRATION_COLLECTION).doc(spotId);
    const [docSnap, bucketsSnap] = await Promise.all([
      ref.get(),
      ref.collection('buckets').get(),
    ]);
    if (!docSnap.exists) return null;
    const buckets = {};
    bucketsSnap.forEach((b) => { buckets[b.id] = b.data(); });
    return { overall: docSnap.data(), buckets };
  } catch (err) {
    logger.warn('abyss/calibrate: load failed', { spotId, error: err.message });
    return null;
  }
}

module.exports = {
  CALIBRATION_COLLECTION,
  WINDOW_DAYS,
  HALF_LIFE_DAYS,
  MIN_SPOT_SAMPLES,
  MIN_BUCKET_SAMPLES,
  bucketKeysForContext,
  observationWeight,
  recencyWeight,
  computeStats,
  computeSpotCalibration,
  computeCorrection,
  applyCalibrationToVisibility,
  loadSpotCalibration,
};
