/* eslint-env node */

/**
 * Geographic coverage helpers for subsurface providers.
 *
 * Each provider declares the geographic domain (lat/lon bbox) it can
 * serve. The orchestrator uses these to pick the highest-priority
 * provider whose domain contains a given spot.
 *
 * Pure functions, no I/O.
 */

/**
 * Test whether (lat, lon) falls inside a bounding box.
 *
 * Handles the antimeridian wrap case: if minLon > maxLon, the box is
 * treated as wrapping across ±180° (e.g. minLon=170, maxLon=-170 means
 * "from 170°E eastward through the dateline to 170°W"). Hawaii doesn't
 * need this, but other Pacific regions might.
 *
 * @param {number} lat
 * @param {number} lon - in [-180, 180]
 * @param {{minLat:number, maxLat:number, minLon:number, maxLon:number}} bbox
 * @returns {boolean}
 */
function isInBBox(lat, lon, bbox) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !bbox) return false;
  const { minLat, maxLat, minLon, maxLon } = bbox;

  if (lat < minLat || lat > maxLat) return false;

  if (minLon <= maxLon) {
    // Normal (non-wrapping) box
    return lon >= minLon && lon <= maxLon;
  }
  // Wrapping box across the antimeridian
  return lon >= minLon || lon <= maxLon;
}

module.exports = {
  isInBBox,
};
