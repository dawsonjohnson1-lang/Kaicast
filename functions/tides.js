/* eslint-env node */
/* global fetch */

/**
 * KaiCast tide station registry and NOAA CO-OPS tide fetcher.
 *
 * Exports:
 *   NOAA_TIDE_STATIONS           - Array of known Oahu tide stations by coast
 *   chooseNoaaTideStationForSpot(spot) - Select nearest station for a spot (by coast)
 *   fetchTideSeries(stationId, nowMs)  - Fetch hilo predictions → [{tsMs,levelFt,type}]
 *   clearTideSeriesCache()             - Clear in-memory cache (testing / forced refresh)
 */

const logger = require('firebase-functions/logger');

// ---------------------------------------------------------------------------
// Station registry
// ---------------------------------------------------------------------------

/**
 * Known NOAA CO-OPS tide stations around Oahu, tagged by coast.
 * Each entry: { id, name, lat, lon, coast }
 *
 * Only the south-coast Honolulu gauge (1612340) is a confirmed real station.
 * The north / east / west entries are commented out until real IDs are available.
 *
 * TODO: Uncomment and fill in real NOAA CO-OPS station IDs for north/east/west
 *       once they are confirmed. The code will fall back to the Honolulu gauge
 *       for any coast that has no registered station.
 *
 * Required Webflow CMS slugs for tide cycle fields (for reference):
 *   low_tide_1_time, low_tide_1_height,
 *   rising_tide_time, rising_tide_height,
 *   high_tide_time, high_tide_height,
 *   falling_tide_time, falling_tide_height,
 *   low_tide_2_time, low_tide_2_height,
 *   current_tide_state, current_tide_height
 */
const NOAA_TIDE_STATIONS = [
  // South coast (real station — Honolulu Harbor tide gauge)
  { id: '1612340', name: 'Honolulu, HI', lat: 21.3067, lon: -157.867, coast: 'south' },

  // TODO: North coast — replace XXXXXXX with real NOAA CO-OPS station ID
  // (nearest candidate: Haleiwa Small Boat Harbor area, North Shore)
  // { id: 'XXXXXXX', name: 'Haleiwa / North Shore', lat: 21.5960, lon: -158.1044, coast: 'north' },

  // TODO: East coast — replace XXXXXXX with real NOAA CO-OPS station ID
  // (nearest candidate: Kaneohe Bay / Kailua area)
  // { id: 'XXXXXXX', name: 'Kaneohe Bay', lat: 21.4011, lon: -157.7400, coast: 'east' },

  // TODO: West coast — replace XXXXXXX with real NOAA CO-OPS station ID
  // (nearest candidate: Barbers Point / Ko Olina area)
  // { id: 'XXXXXXX', name: "Barbers Point / Ko Olina", lat: 21.3098, lon: -158.0903, coast: 'west' },
];

// ---------------------------------------------------------------------------
// Haversine distance helper (km)
// ---------------------------------------------------------------------------

function distKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Station selector
// ---------------------------------------------------------------------------

/**
 * Choose the best NOAA tide station for a spot.
 *
 * Selection priority:
 *  1. spot.noaaTideStation  (manual override — always respected)
 *  2. Nearest station on the same coast as the spot
 *  3. Nearest station overall (fallback if no same-coast station exists)
 *
 * Returns a station ID string, or null if the registry is empty.
 *
 * @param {object} spot - spot config { lat, lon, coast, noaaTideStation? }
 * @returns {string|null}
 */
function chooseNoaaTideStationForSpot(spot) {
  if (!spot) return null;

  // Manual per-spot override
  if (spot.noaaTideStation) return String(spot.noaaTideStation);

  if (!NOAA_TIDE_STATIONS.length) return null;

  const coast = spot.coast || null;

  // Try to find stations on the same coast first
  const sameCoast = coast
    ? NOAA_TIDE_STATIONS.filter((s) => s.coast === coast)
    : [];
  const pool = sameCoast.length ? sameCoast : NOAA_TIDE_STATIONS;

  let nearest = null;
  let bestDist = Infinity;
  for (const s of pool) {
    const d = distKm(spot.lat ?? 0, spot.lon ?? 0, s.lat, s.lon);
    if (d < bestDist) {
      bestDist = d;
      nearest = s;
    }
  }

  return nearest ? nearest.id : null;
}

// ---------------------------------------------------------------------------
// Per-run in-memory cache: stationId → { fetchedAtMs, series }
// ---------------------------------------------------------------------------

const _tideSeriesCache = new Map();

/** Clear the tide series cache (useful in tests or forced refresh). */
function clearTideSeriesCache() {
  _tideSeriesCache.clear();
}

// ---------------------------------------------------------------------------
// NOAA CO-OPS tide prediction fetcher
// ---------------------------------------------------------------------------

/**
 * Fetch NOAA CO-OPS high/low tide predictions (hilo) for a station.
 *
 * Returns a sorted array of tide events: [{ tsMs, levelFt, type }]
 * where type is 'H' (high tide) or 'L' (low tide).
 *
 * On any error the function returns [] and never throws — the rest of the
 * pipeline treats missing tide data gracefully.
 *
 * Time window: now − 6 h  to  now + 30 h (covers current + next cycle).
 * Results are cached per station for ~55 minutes (one hourly run).
 *
 * @param {string} stationId - NOAA CO-OPS station ID (e.g. '1612340')
 * @param {number} nowMs     - current time in milliseconds (Date.now())
 * @returns {Promise<Array<{tsMs:number, levelFt:number, type:string}>>}
 */
async function fetchTideSeries(stationId, nowMs) {
  if (!stationId) return [];

  // Serve from in-memory cache if the data is still fresh (55-min TTL)
  const cached = _tideSeriesCache.get(stationId);
  if (cached && nowMs - cached.fetchedAtMs < 55 * 60000) {
    return cached.series;
  }

  try {
    const beginMs = nowMs - 6 * 3600000;
    const endMs   = nowMs + 30 * 3600000;

    function fmtDate(ms) {
      const d = new Date(ms);
      const Y = d.getUTCFullYear();
      const M = String(d.getUTCMonth() + 1).padStart(2, '0');
      const D = String(d.getUTCDate()).padStart(2, '0');
      return `${Y}${M}${D}`;
    }

    const url =
      'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter' +
      `?begin_date=${fmtDate(beginMs)}` +
      `&end_date=${fmtDate(endMs)}` +
      `&station=${encodeURIComponent(stationId)}` +
      '&product=predictions' +
      '&datum=MLLW' +
      '&time_zone=gmt' +
      '&interval=hilo' +
      '&units=english' +
      '&application=KaiCast' +
      '&format=json';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let r;
    try {
      r = await fetch(url, { signal: controller.signal });
    } catch (fetchErr) {
      clearTimeout(timeout);
      logger.warn('NOAA tide fetch failed (network)', { stationId, error: fetchErr.message });
      _tideSeriesCache.set(stationId, { fetchedAtMs: nowMs, series: [] });
      return [];
    }
    clearTimeout(timeout);

    if (!r.ok) {
      const txt = await r.text().catch(() => '<no body>');
      logger.warn('NOAA tide fetch failed (HTTP)', {
        stationId,
        status: r.status,
        body: txt.slice(0, 300),
      });
      _tideSeriesCache.set(stationId, { fetchedAtMs: nowMs, series: [] });
      return [];
    }

    const j = await r.json();

    if (!j.predictions || !Array.isArray(j.predictions)) {
      // NOAA returns { error: { message: '...' } } on station/parameter errors
      if (j.error) {
        logger.warn('NOAA tide API error', {
          stationId,
          error: j.error.message || String(j.error),
        });
      }
      _tideSeriesCache.set(stationId, { fetchedAtMs: nowMs, series: [] });
      return [];
    }

    const series = j.predictions
      .map((p) => {
        // NOAA hilo format: { t: "2026-04-02 10:30", v: "0.234", type: "L" }
        const tsMs    = Date.parse(p.t + ' UTC');
        const levelFt = parseFloat(p.v);
        const type    = String(p.type || '').toUpperCase(); // 'H' or 'L'
        if (!Number.isFinite(tsMs) || !Number.isFinite(levelFt)) return null;
        return { tsMs, levelFt, type };
      })
      .filter(Boolean)
      .sort((a, b) => a.tsMs - b.tsMs);

    _tideSeriesCache.set(stationId, { fetchedAtMs: nowMs, series });
    logger.info('NOAA tide series fetched', { stationId, events: series.length });
    return series;
  } catch (err) {
    logger.warn('NOAA tide fetch unexpected error', { stationId, error: err.message });
    _tideSeriesCache.set(stationId, { fetchedAtMs: nowMs, series: [] });
    return [];
  }
}

/**
 * Compatibility wrapper: accepts the { station, nowMs } object form used by
 * the pipeline and delegates to fetchTideSeries (hilo events).
 *
 * Returns a sorted array of hilo tide events: [{ tsMs, levelFt, type }]
 * This is the same format as fetchTideSeries — the function exists so
 * existing callers that use the named-parameter form keep working.
 *
 * @param {object} opts
 * @param {string} [opts.station]  - NOAA station ID (default: Honolulu)
 * @param {number} [opts.nowMs]    - reference timestamp in ms
 * @returns {Promise<Array<{tsMs: number, levelFt: number, type: string}>>}
 */
async function fetchNOAATideSeries({ station = '1612340', nowMs = Date.now() } = {}) {
  return fetchTideSeries(station, nowMs);
}

module.exports = {
  NOAA_TIDE_STATIONS,
  chooseNoaaTideStationForSpot,
  fetchTideSeries,
  fetchNOAATideSeries,
  clearTideSeriesCache,
};
