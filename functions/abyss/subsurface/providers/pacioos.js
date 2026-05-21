/* eslint-env node */
/* global fetch */

/**
 * PacIOOS subsurface provider — Hawaii regional ROMS.
 *
 * Pulls a vertical temperature profile from the PacIOOS ERDDAP server's
 * Hawaiian Islands ROMS model (`roms_hiig`). 36 sigma levels from
 * surface to bottom. Higher resolution and better calibrated for the
 * Main Hawaiian Islands than the global CMEMS GLO12 product, hence the
 * top priority within its bbox.
 *
 * TODO (future): when a spot falls within the narrower Oahu South Shore
 * domain (`roms_hiomsg`), we should prefer that dataset before falling
 * back to `roms_hiig`. Sketch:
 *
 *   const SUB_PROVIDERS = [
 *     { id: 'roms_hiomsg', priority: 110,
 *       bbox: { minLat: 21.20, maxLat: 21.40, minLon: -158.00, maxLon: -157.60 } },
 *     { id: 'roms_hiig',   priority: 100, bbox: BBOX },
 *   ];
 *   for sub of SUB_PROVIDERS sorted by priority desc → try if in bbox.
 *
 * Leaving placeholder bbox values commented out until we confirm the
 * actual domain at https://pae-paha.pacioos.hawaii.edu/erddap/info/roms_hiomsg/
 */

const { isInBBox } = require('../coverage');
const { findThermocline } = require('../thermocline');

// Main Hawaiian Islands — comfortably covers Kauai through Big Island.
const BBOX = { minLat: 18, maxLat: 23, minLon: -161, maxLon: -154 };

const DATASET_ID = 'roms_hiig';
const ERDDAP_BASE = 'https://pae-paha.pacioos.hawaii.edu/erddap/griddap';
const FETCH_TIMEOUT_MS = 10000;

const priority = 100;

function supports(lat, lon) {
  return isInBBox(lat, lon, BBOX);
}

/**
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<object|null>}
 */
async function fetchProfile(lat, lon) {
  // ERDDAP griddap .json — depth dimension is index 0..35 (sigma levels).
  // We request the most recent timestep `(last)` and a single grid cell.
  const url =
    `${ERDDAP_BASE}/${DATASET_ID}.json` +
    `?temp[(last)][0:1:35][(${lat})][(${lon})]`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    // Network error / timeout / abort — let orchestrator fall through.
    return null;
  }
  clearTimeout(timer);

  if (!res.ok) return null;

  let body;
  try {
    body = await res.json();
  } catch (err) {
    return null;
  }

  // ERDDAP .json shape: { table: { columnNames, columnTypes, rows: [...] } }
  // Column order for griddap with `temp` is: [time, depth, latitude, longitude, temp]
  const rows = body?.table?.rows;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const profile = [];
  for (const row of rows) {
    const depth = Number(row[1]);
    const temp = row[4];
    if (Number.isFinite(depth) && Number.isFinite(temp)) {
      profile.push({ d: depth, t: temp });
    }
  }
  if (profile.length === 0) return null;

  // ERDDAP returns depths shallowest-first for most ROMS datasets, but
  // sort defensively so the thermocline calc can rely on it.
  profile.sort((a, b) => a.d - b.d);

  const surfaceTempC = profile[0].t;
  const thermoclineDepthM = findThermocline(profile);

  return {
    profile,
    thermoclineDepthM,
    surfaceTempC,
    source: 'pacioos',
    confidence: 0.9,
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = {
  id: 'pacioos',
  priority,
  supports,
  fetch: fetchProfile,
  // exposed for tests / introspection
  BBOX,
};
