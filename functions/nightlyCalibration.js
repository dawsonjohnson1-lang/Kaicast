/* eslint-env node */
'use strict';

/**
 * nightlyCalibration — closes the Abyss calibration loop.
 *
 * Every night (03:10 HST, after the day's diving is logged) this job:
 *   1. Reads the last WINDOW_DAYS of diveLogs in one range query.
 *   2. Groups them by spot and runs computeSpotCalibration(): weighted
 *      per-spot bias (mean signed error, predicted − observed), MAE,
 *      R², confidence, plus condition-stratified buckets (swell, tide
 *      phase, time of day, runoff severity).
 *   3. Writes abyss_calibration/{spotId} and
 *      abyss_calibration/{spotId}/buckets/{bucketKey}, deleting buckets
 *      that no longer meet the sample threshold.
 *
 * buildSpotReport (index.js) loads these docs and applies the
 *      correction before each report lands in kaicast_reports, so the
 *      frontend — and the NEXT dive log's snapshot — see calibrated
 *      values. Future deltas therefore measure the calibrated model:
 *      negative feedback, self-stabilizing.
 *
 * Spots with fewer than MIN_SPOT_SAMPLES logs in the window keep their
 * existing calibration doc (stale-dated, confidence intact) rather
 * than being deleted — an old correction beats no correction, and
 * buildSpotReport already scales by confidence.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

const {
  CALIBRATION_COLLECTION,
  WINDOW_DAYS,
  computeSpotCalibration,
  computeDailyRollups,
} = require('./abyss/calibrate');

const db = () => admin.firestore();

/** Hard cap on logs read per run — backstop, not an expected limit. */
const MAX_LOGS = 20000;

async function runNightlyCalibration(nowMs = Date.now()) {
  const cutoff = admin.firestore.Timestamp.fromMillis(nowMs - WINDOW_DAYS * 86400000);

  const snap = await db()
    .collection('diveLogs')
    .where('dive_at', '>=', cutoff)
    .limit(MAX_LOGS)
    .get();

  if (snap.size >= MAX_LOGS) {
    logger.warn('nightlyCalibration: hit MAX_LOGS cap — window truncated', { cap: MAX_LOGS });
  }

  // Group by spot. Logs whose snapshot never resolved are kept here and
  // skipped inside computeSpotCalibration (they carry no comparison).
  const bySpot = new Map();
  snap.forEach((doc) => {
    const d = doc.data();
    if (!d?.spot_id) return;
    if (!bySpot.has(d.spot_id)) bySpot.set(d.spot_id, []);
    bySpot.get(d.spot_id).push(d);
  });

  let spotsWritten = 0;
  let bucketsWritten = 0;
  let rollupsWritten = 0;

  for (const [spotId, logs] of bySpot) {
    // Daily descriptive rollups (spot_stats/{spotId}/daily/{date}) are
    // written for ANY spot with logs — they don't need the calibration
    // sample threshold, and recomputing the window nightly makes them
    // self-healing against late-arriving backdated logs.
    const rollups = computeDailyRollups(logs);
    const rollupDates = Object.keys(rollups);
    if (rollupDates.length) {
      const statsBatch = db().batch();
      for (const date of rollupDates) {
        statsBatch.set(
          db().collection('spot_stats').doc(spotId).collection('daily').doc(date),
          {
            ...rollups[date],
            spot_id: spotId,
            computed_at: admin.firestore.FieldValue.serverTimestamp(),
          },
        );
      }
      await statsBatch.commit();
      rollupsWritten += rollupDates.length;
    }

    const { overall, buckets } = computeSpotCalibration(logs, { nowMs });
    if (!overall) {
      logger.info('nightlyCalibration: below sample threshold, keeping prior doc', {
        spotId, logsInWindow: logs.length,
      });
      continue;
    }

    const ref = db().collection(CALIBRATION_COLLECTION).doc(spotId);

    // One batch per spot: doc + buckets + stale-bucket deletes.
    const batch = db().batch();
    batch.set(ref, {
      ...overall,
      spot_id: spotId,
      last_updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    const existing = await ref.collection('buckets').get();
    const keep = new Set(Object.keys(buckets));
    existing.forEach((b) => {
      if (!keep.has(b.id)) batch.delete(b.ref);
    });
    for (const [key, body] of Object.entries(buckets)) {
      batch.set(ref.collection('buckets').doc(key), {
        ...body,
        spot_id: spotId,
        bucket_key: key,
        last_updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    spotsWritten++;
    bucketsWritten += keep.size;
    logger.info('nightlyCalibration: spot calibrated', {
      spotId,
      sampleCount: overall.sample_count,
      biasVisibilityFt: overall.bias_offsets.visibility_ft,
      maeFt: overall.mae_visibility_ft,
      r2: overall.r2_visibility,
      confidence: overall.confidence_score,
      buckets: keep.size,
    });
  }

  logger.info('nightlyCalibration: done', {
    logsRead: snap.size,
    spotsWithLogs: bySpot.size,
    spotsWritten,
    bucketsWritten,
    rollupsWritten,
  });
  return { logsRead: snap.size, spotsWritten, bucketsWritten, rollupsWritten };
}

exports.nightlyCalibration = onSchedule(
  {
    schedule: '10 3 * * *',
    timeZone: 'Pacific/Honolulu',
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    await runNightlyCalibration();
  },
);

// Exposed for tests / manual backfill (scripts can call this directly).
exports.runNightlyCalibration = runNightlyCalibration;
