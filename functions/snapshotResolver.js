/* eslint-env node */
'use strict';

/**
 * snapshotResolver — the shared, server-trusted conditions-snapshot
 * resolver.
 *
 * Extracted verbatim from submitDiveLog.js so the dive-log pipeline and
 * the captain's-log pipeline resolve the SAME way against the SAME data.
 * Both produce an immutable "what the ocean was doing" record that feeds
 * the bias-calibration flywheel — they must not drift.
 *
 * Resolution order for a given (spotId, atMs):
 *   a. kaicast_reports/{spotId}_{hourKey}  for hourKey ∈ [atMs − 1h … atMs + 1h]
 *      (matches if the doc's generatedAt is within 30 min of atMs)
 *   b. gs://kaicast-historical/{spotId}/{yyyy-mm-dd-HST}.json.gz  fallback
 *   c. null  (caller still writes its doc; nightly calibration skips these)
 *
 * The returned object shape is the canonical snapshot (DivePredicted in
 * functions/types/schema.js): snapshot_source + provenance + the
 * extracted prediction fields.
 */

const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const zlib = require('zlib');
const { promisify } = require('util');

const gunzip = promisify(zlib.gunzip);

// Lazily-initialized admin app — index.js calls admin.initializeApp() at
// module load so the SDK is ready by the time any of these run.
const db = () => admin.firestore();
const storage = () => admin.storage();

// ─── Constants ──────────────────────────────────────────────────────

/** Match window: snapshot's generatedAt must be within this many ms of atMs. */
const SNAPSHOT_MATCH_WINDOW_MS = 30 * 60 * 1000;

/** Cold-storage bucket. Run `gsutil mb` if absent — see deliverable. */
const COLD_STORAGE_BUCKET = 'kaicast-historical';

const HST_OFFSET_MS = -10 * 3600 * 1000; // Hawaii is fixed UTC-10 (no DST).

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
    // Runoff severity at prediction time — the nightly calibration job
    // stratifies bias buckets on it (runoff_none … runoff_extreme).
    runoff_severity:     now.analysis?.runoff?.severity ?? null,
  };
}

/**
 * Attempt to resolve a prediction snapshot at atMs by walking through
 * hourly kaicast_reports docs at and adjacent to atMs's hour.
 */
async function resolveFromHourlyReports(spotId, atMs) {
  let best = null;
  let bestDeltaMs = Infinity;

  for (let h = -1; h <= 1; h++) {
    const hourKey = buildHourKey(new Date(atMs + h * 3600000));
    const docId = `${spotId}_${hourKey}`;
    const docRef = db().collection('kaicast_reports').doc(docId);
    const snap = await docRef.get();
    if (!snap.exists) continue;
    const data = snap.data();
    if (!data?.generatedAt) continue;
    const snapshotAtMs = new Date(data.generatedAt).getTime();
    if (!Number.isFinite(snapshotAtMs)) continue;
    const delta = Math.abs(snapshotAtMs - atMs);
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
async function resolveFromColdStorage(spotId, atMs) {
  const hstDate = formatHstDate(atMs);
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
    logger.warn('snapshotResolver: cold-storage exists() failed', { spotId, hstDate, error: err.message });
    return null;
  }
  if (!exists) return null;

  let entries;
  try {
    const [buf] = await file.download();
    const text = (await gunzip(buf)).toString('utf8');
    entries = JSON.parse(text);
  } catch (err) {
    logger.warn('snapshotResolver: cold-storage read failed', { spotId, hstDate, error: err.message });
    return null;
  }
  if (!Array.isArray(entries) || entries.length === 0) return null;

  let best = null;
  let bestDeltaMs = Infinity;
  for (const entry of entries) {
    const snapshotAtMs = new Date(entry.generatedAt).getTime();
    if (!Number.isFinite(snapshotAtMs)) continue;
    const delta = Math.abs(snapshotAtMs - atMs);
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

/**
 * Resolve the conditions snapshot for a spot at a moment in time: live
 * hourly reports first, cold storage second, null if neither resolves.
 * This is the exact order the dive-log pipeline uses.
 */
async function resolveConditionsSnapshot(spotId, atMs) {
  let predicted = await resolveFromHourlyReports(spotId, atMs);
  if (!predicted) {
    predicted = await resolveFromColdStorage(spotId, atMs);
  }
  return predicted; // null means genuinely couldn't resolve.
}

module.exports = {
  SNAPSHOT_MATCH_WINDOW_MS,
  COLD_STORAGE_BUCKET,
  HST_OFFSET_MS,
  buildHourKey,
  formatHstDate,
  extractPredictionFields,
  resolveFromHourlyReports,
  resolveFromColdStorage,
  resolveConditionsSnapshot,
};
