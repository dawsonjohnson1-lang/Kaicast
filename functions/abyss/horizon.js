/* eslint-env node */

/**
 * Abyss — Topographic horizon profile.
 *
 * Most Hawaiian dive spots are tucked under volcanic ridgelines that
 * cast long shadows across the water in late afternoon and early
 * morning. Hanauma Bay's east-facing crater rim cuts the sun off
 * before dusk; Mokuleia's Waianae range looms ~1200 m above the
 * shoreline 4 km inland; Honolua and Black Rock face West Maui
 * Mountains rising 1764 m at Pu'u Kukui.
 *
 * The horizon profile captures this terrain as 72 samples around the
 * compass — at each bearing, the elevation angle to the local horizon
 * (sea level → ridge top, in degrees). Pair with the sun's azimuth
 * to detect terrain shadow:
 *   shadowed if sun.altitude < horizon.angleAt(sun.azimuth)
 *
 * Profiles are precomputed once per spot via scripts/precompute-horizons.js
 * (one-time elevation API queries) and shipped as a static JSON file.
 * No runtime DEM fetches needed — sub-millisecond horizon lookups.
 *
 * Helpers in solar.js handle interpolation + shadow checks. This file
 * loads the static profile JSON and exposes a getter.
 */

const path = require('path');

let _cache = null;

function loadProfiles() {
  if (_cache) return _cache;
  try {
    // eslint-disable-next-line global-require
    _cache = require(path.join(__dirname, 'horizons.json'));
  } catch {
    _cache = { spots: {} };
  }
  return _cache;
}

/**
 * Get the horizon profile for a spot id, or null if not precomputed.
 * Returns an array of { bearingDeg, horizonAngleDeg } samples.
 */
function getHorizonProfile(spotId) {
  const profiles = loadProfiles();
  const entry = profiles.spots && profiles.spots[spotId];
  return entry?.profile ?? null;
}

/** Reset the in-process cache (test-only / hot-reload scenarios). */
function _resetCache() {
  _cache = null;
}

module.exports = {
  getHorizonProfile,
  _resetCache,
};
