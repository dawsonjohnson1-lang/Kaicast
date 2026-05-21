/* eslint-env node */

/**
 * Abyss — Site calibration and diver report ingestion.
 *
 * Phase 1: Per-site bias correction tables stored in Firestore.
 *   - Load corrections for a spot
 *   - Apply corrections to raw Abyss visibility
 *   - Ingest diver-reported visibility for ground truth
 *   - Compute rolling model accuracy (MAE, bias, R²)
 *
 * Phase 2 (future): When 50+ reports exist per site, replace applyCalibration()
 * with an ML model. Feature vector:
 *   [kd490, spm, chlorophyll, waveHeightM, wavePeriodS, orbitalVelocityAtDepth,
 *    tidePhase, rain3h, rain24h, rain72h, siteId_encoded, hour_sin, hour_cos,
 *    month_sin, month_cos]
 * Target: reportedVisibilityM
 * This function signature is designed for drop-in replacement.
 *
 * Exports:
 *  - loadCalibrationForSpot(spotId, db)
 *  - applyCalibration(rawVisibilityM, calibration, conditions)
 *  - ingestDiverReport(opts)
 *  - computeSpotAccuracy(spotId, db)
 */

const logger = require('firebase-functions/logger');

// ─── Firestore collections ───────────────────────────────────────────────────

const CALIBRATION_COLLECTION = 'abyss_calibration';
const DIVER_REPORTS_COLLECTION = 'abyss_diver_reports';

// ─── Load calibration ────────────────────────────────────────────────────────

/**
 * Load calibration corrections for a spot from Firestore.
 *
 * Stored at: abyss_calibration/{spotId}
 * Document shape:
 * {
 *   spotId: string,
 *   baselineOffsetM: number,       // additive correction to baseline vis
 *   swellDirectionBias: number,    // multiplier for swell from specific direction
 *   lowTideBias: number,           // additional penalty during low tide
 *   runoffDecayFactor: number,     // how fast runoff clears (0-1, lower = faster)
 *   lastUpdated: timestamp,
 *   sampleCount: number,
 * }
 *
 * @param {string} spotId
 * @param {object} db - Firestore instance
 * @returns {object|null} calibration data or null
 */
async function loadCalibrationForSpot(spotId, db) {
  if (!db || !spotId) return null;

  try {
    const doc = await db.collection(CALIBRATION_COLLECTION).doc(spotId).get();
    if (!doc.exists) return null;
    return doc.data();
  } catch (err) {
    logger.warn('abyss/calibration: load failed', { spotId, error: err.message });
    return null;
  }
}

// ─── Apply calibration ──────────────────────────────────────────────────────

/**
 * Apply site-specific calibration corrections to a raw Abyss visibility estimate.
 *
 * @param {number} rawVisibilityM - uncalibrated visibility from Abyss engine
 * @param {object|null} calibration - from loadCalibrationForSpot
 * @param {object} conditions - current conditions for context-dependent corrections
 * @param {string} [conditions.tidePhase]
 * @param {number} [conditions.swellDirectionDeg]
 * @returns {{ visibilityM: number, confidenceAdjustment: number }}
 */
function applyCalibration(rawVisibilityM, calibration, conditions = {}) {
  if (!Number.isFinite(rawVisibilityM)) {
    return { visibilityM: rawVisibilityM, confidenceAdjustment: 0 };
  }

  if (!calibration) {
    // No calibration data — return raw with slight confidence reduction
    return { visibilityM: rawVisibilityM, confidenceAdjustment: -0.05 };
  }

  let vis = rawVisibilityM;

  // Baseline offset (additive)
  if (Number.isFinite(calibration.baselineOffsetM)) {
    vis += calibration.baselineOffsetM;
  }

  // Low tide bias
  if (conditions.tidePhase === 'falling' && Number.isFinite(calibration.lowTideBias)) {
    vis += calibration.lowTideBias;
  }

  // Clamp to reasonable range
  vis = Math.max(1, Math.min(40, vis));

  // Confidence boost from having calibration data
  const confBoost = calibration.sampleCount >= 30 ? 0.1 :
                    calibration.sampleCount >= 10 ? 0.05 : 0;

  return {
    visibilityM: Math.round(vis * 10) / 10,
    confidenceAdjustment: confBoost,
  };
}

// ─── Ingest diver report ─────────────────────────────────────────────────────

/**
 * Save a diver-reported visibility observation for model training/validation.
 *
 * Stored at: abyss_diver_reports/{spotId}/reports/{reportId}
 *
 * @param {object} opts
 * @param {string} opts.spotId
 * @param {number} opts.reportedVisM - diver-reported horizontal visibility (m)
 * @param {number} opts.diveDepthM - depth of observation
 * @param {number} opts.diveTimeMs - when the dive happened (ms)
 * @param {object} opts.conditions - snapshot of conditions at dive time
 * @param {number} [opts.modelPredictionM] - what Abyss predicted for that time
 * @param {object} opts.db - Firestore instance
 * @returns {{ reportId: string, modelError: number|null }}
 */
async function ingestDiverReport({ spotId, reportedVisM, diveDepthM, diveTimeMs, conditions, modelPredictionM, db }) {
  if (!db || !spotId || !Number.isFinite(reportedVisM)) {
    return { reportId: null, modelError: null };
  }

  const reportData = {
    spotId,
    reportedVisM,
    diveDepthM: diveDepthM || null,
    diveTimeMs,
    diveTimeIso: new Date(diveTimeMs).toISOString(),
    conditions: conditions || {},
    modelPredictionM: modelPredictionM || null,
    modelError: Number.isFinite(modelPredictionM) ? modelPredictionM - reportedVisM : null,
    createdAt: Date.now(),
  };

  try {
    const docRef = await db
      .collection(DIVER_REPORTS_COLLECTION)
      .doc(spotId)
      .collection('reports')
      .add(reportData);

    logger.info('abyss/calibration: diver report saved', {
      spotId,
      reportId: docRef.id,
      reportedVisM,
      modelError: reportData.modelError,
    });

    return {
      reportId: docRef.id,
      modelError: reportData.modelError,
    };
  } catch (err) {
    logger.error('abyss/calibration: diver report save failed', { spotId, error: err.message });
    return { reportId: null, modelError: null };
  }
}

// ─── Model accuracy ──────────────────────────────────────────────────────────

/**
 * Compute rolling model accuracy for a spot using the most recent diver reports.
 *
 * @param {string} spotId
 * @param {object} db - Firestore instance
 * @param {number} [limit=30] - number of most recent reports to analyze
 * @returns {{ meanAbsErrorM, bias, r2, sampleCount }}
 */
async function computeSpotAccuracy(spotId, db, limit = 30) {
  const empty = { meanAbsErrorM: null, bias: null, r2: null, sampleCount: 0 };
  if (!db || !spotId) return empty;

  try {
    const snap = await db
      .collection(DIVER_REPORTS_COLLECTION)
      .doc(spotId)
      .collection('reports')
      .where('modelPredictionM', '!=', null)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    if (snap.empty) return empty;

    const predictions = [];
    const actuals = [];

    snap.forEach(doc => {
      const d = doc.data();
      if (Number.isFinite(d.modelPredictionM) && Number.isFinite(d.reportedVisM)) {
        predictions.push(d.modelPredictionM);
        actuals.push(d.reportedVisM);
      }
    });

    if (predictions.length < 3) return { ...empty, sampleCount: predictions.length };

    // Mean absolute error
    let sumAbsErr = 0;
    let sumErr = 0;
    for (let i = 0; i < predictions.length; i++) {
      const err = predictions[i] - actuals[i];
      sumAbsErr += Math.abs(err);
      sumErr += err;
    }
    const n = predictions.length;
    const mae = sumAbsErr / n;
    const bias = sumErr / n; // positive = model over-predicts

    // R² (coefficient of determination)
    const meanActual = actuals.reduce((a, b) => a + b, 0) / n;
    let ssTot = 0;
    let ssRes = 0;
    for (let i = 0; i < n; i++) {
      ssTot += (actuals[i] - meanActual) ** 2;
      ssRes += (actuals[i] - predictions[i]) ** 2;
    }
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : null;

    return {
      meanAbsErrorM: Math.round(mae * 10) / 10,
      bias: Math.round(bias * 10) / 10,
      r2: r2 !== null ? Math.round(r2 * 1000) / 1000 : null,
      sampleCount: n,
    };
  } catch (err) {
    logger.warn('abyss/calibration: accuracy computation failed', { spotId, error: err.message });
    return empty;
  }
}

module.exports = {
  loadCalibrationForSpot,
  applyCalibration,
  ingestDiverReport,
  computeSpotAccuracy,
};
