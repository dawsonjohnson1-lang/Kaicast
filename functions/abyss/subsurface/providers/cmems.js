/* eslint-env node */

/**
 * CMEMS subsurface provider — global fallback (GLO12).
 *
 * Reads precomputed profiles from Firestore at `cmems_profiles/{cellKey}`,
 * where cellKey snaps lat/lon to the GLO12 1/12° grid. The Python sidecar
 * that populates this collection is a separate concern and not built in
 * this task (TODO: link the sidecar repo / path here once it exists).
 * If the cell is missing or stale (>12h old) we return null and the
 * orchestrator falls through to the next provider.
 *
 * Why a sidecar instead of in-process fetch: the CMEMS Toolbox API is
 * Python-only and the OPeNDAP endpoints require multi-step auth that
 * doesn't compose well with short-lived Cloud Functions. Sidecar runs
 * on a schedule and writes results to Firestore for this provider to
 * read at request time.
 */

const admin = require('firebase-admin');
const { findThermocline } = require('../thermocline');

const COLLECTION = 'cmems_profiles';
const STALE_AFTER_MS = 12 * 60 * 60 * 1000; // 12h

const priority = 50;

/** Snap lat/lon to GLO12 1/12° grid for the Firestore cache key. */
function cellKey(lat, lon) {
  const latSnapped = Math.round(lat * 12) / 12;
  const lonSnapped = Math.round(lon * 12) / 12;
  return `${latSnapped}_${lonSnapped}`;
}

/** Provider covers everywhere except polar regions. */
function supports(lat, lon) {
  return Number.isFinite(lat) && Math.abs(lat) < 80;
}

/**
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<object|null>}
 */
async function fetchProfile(lat, lon) {
  const db = admin.firestore();
  const key = cellKey(lat, lon);

  let snap;
  try {
    snap = await db.collection(COLLECTION).doc(key).get();
  } catch (err) {
    // Firestore unavailable / permission issue — fall through.
    return null;
  }

  if (!snap.exists) return null;
  const data = snap.data();
  if (!data) return null;

  // Staleness: rely on the sidecar-stamped fetchedAt if present,
  // else firestore writeTime via doc.updateTime.
  const stampedAtMs = data.fetchedAtMs
    ?? (typeof data.fetchedAt === 'string' ? Date.parse(data.fetchedAt) : NaN)
    ?? snap.updateTime?.toMillis?.();
  if (Number.isFinite(stampedAtMs) && (Date.now() - stampedAtMs) > STALE_AFTER_MS) {
    return null;
  }

  const profile = Array.isArray(data.profile) ? data.profile : null;
  if (!profile || profile.length === 0) return null;

  // Sidecar may already have computed thermoclineDepthM; recompute defensively
  // so the contract is uniform across providers.
  const thermoclineDepthM = Number.isFinite(data.thermoclineDepthM)
    ? data.thermoclineDepthM
    : findThermocline(profile);

  const surfaceTempC = Number.isFinite(data.surfaceTempC)
    ? data.surfaceTempC
    : profile[0]?.t;

  return {
    profile,
    thermoclineDepthM,
    surfaceTempC,
    source: 'cmems',
    confidence: 0.7,
    fetchedAt: data.fetchedAt ?? null,
  };
}

module.exports = {
  id: 'cmems',
  priority,
  supports,
  fetch: fetchProfile,
  // exposed for tests / sidecar coordination
  cellKey,
  COLLECTION,
};
