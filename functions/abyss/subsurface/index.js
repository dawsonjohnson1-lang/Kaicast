/* eslint-env node */

/**
 * Subsurface profile orchestrator.
 *
 * Picks the highest-priority provider whose geographic domain covers
 * the spot, fetches a vertical temperature profile + thermocline depth,
 * and returns it in a uniform shape. Providers that don't apply or
 * fail are skipped silently (logged at warn); we only return null when
 * every applicable provider fails.
 *
 * Provider contract (see ./providers/*.js):
 *   { id, priority, supports(lat, lon), fetch(lat, lon, context) }
 *
 * Return shape from a successful provider:
 *   {
 *     profile: Array<{ d: number, t: number }>,  // ascending depth, °C
 *     thermoclineDepthM: number|null,
 *     surfaceTempC: number,
 *     source: string,
 *     confidence: number,        // 0..1
 *     fetchedAt: string|null,    // ISO
 *   }
 */

const logger = require('firebase-functions/logger');

const pacioos = require('./providers/pacioos');
const cmems = require('./providers/cmems');
const heuristic = require('./providers/heuristic');

// Highest priority first. Built once at module load.
const PROVIDERS = [pacioos, cmems, heuristic].sort((a, b) => b.priority - a.priority);

/**
 * Resolve a subsurface profile for the given spot.
 *
 * @param {{ id?: string, lat: number, lon: number }} spot
 * @param {{ surfaceTempC?: number }} [context] - upstream observations
 *   the heuristic provider can fall back on (e.g. SST from OpenWeather
 *   or NDBC buoy already in scope).
 * @returns {Promise<object|null>}
 */
async function getSubsurfaceProfile(spot, context = {}) {
  if (!spot || !Number.isFinite(spot.lat) || !Number.isFinite(spot.lon)) {
    return null;
  }

  for (const provider of PROVIDERS) {
    if (!provider.supports(spot.lat, spot.lon)) continue;

    try {
      const result = await provider.fetch(spot.lat, spot.lon, context);
      if (result) return result;
      // Provider applied but returned no data — try next.
    } catch (err) {
      logger.warn('abyss/subsurface: provider failed', {
        spotId: spot.id ?? null,
        provider: provider.id,
        error: err?.message ?? String(err),
      });
    }
  }

  return null;
}

module.exports = {
  getSubsurfaceProfile,
  // exposed for tests / introspection
  PROVIDERS,
};
