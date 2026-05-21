/* eslint-env node */

/**
 * Heuristic subsurface provider — last resort.
 *
 * No remote fetch. If we have a surface temperature observation in
 * scope (from OpenWeather, NDBC buoy, dive logs, etc.), we synthesize
 * a single-point profile so downstream code can keep its uniform
 * shape contract without conditional branches.
 *
 * No thermocline guess — we don't have profile data, just a surface
 * point. Returns null when even surface temp isn't available.
 */

const priority = 1;

function supports() {
  return true;
}

/**
 * @param {number} _lat
 * @param {number} _lon
 * @param {{ surfaceTempC?: number } | undefined} context
 * @returns {Promise<object|null>}
 */
async function fetchProfile(_lat, _lon, context = {}) {
  const t = context?.surfaceTempC;
  if (!Number.isFinite(t)) return null;

  return {
    profile: [{ d: 0, t }],
    thermoclineDepthM: null,
    surfaceTempC: t,
    source: 'heuristic',
    confidence: 0.3,
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = {
  id: 'heuristic',
  priority,
  supports,
  fetch: fetchProfile,
};
