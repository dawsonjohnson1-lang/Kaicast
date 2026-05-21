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
 * NOAA CO-OPS tide stations across the main Hawaiian Islands, tagged
 * by island + coast. Each entry: { id, name, lat, lon, island, coast }.
 *
 * All IDs verified against the NOAA tidesandcurrents.noaa.gov API.
 * Spots configure an explicit `tideStation` in SPOTS (functions/index.js)
 * to override the heuristic; this registry is the fallback for any
 * spot that doesn't, and for user-submitted custom spots.
 */
const NOAA_TIDE_STATIONS = [
  // Oahu
  { id: '1612340', name: 'Honolulu',  lat: 21.3067, lon: -157.867,  island: 'oahu',     coast: 'south' },
  { id: '1612480', name: 'Mokuoloe',  lat: 21.4331, lon: -157.7900, island: 'oahu',     coast: 'east'  },

  // Maui
  { id: '1615680', name: 'Kahului',   lat: 20.8950, lon: -156.4750, island: 'maui',     coast: 'north' },

  // Kauai
  { id: '1611400', name: 'Nawiliwili',lat: 21.9544, lon: -159.3561, island: 'kauai',    coast: 'east'  },

  // Big Island (Hawaiʻi)
  { id: '1617760', name: 'Hilo',      lat: 19.7300, lon: -155.0556, island: 'hawaii',   coast: 'east'  },
  { id: '1617433', name: 'Kawaihae',  lat: 20.0367, lon: -155.8294, island: 'hawaii',   coast: 'west'  },
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
 *  1. spot.noaaTideStation / spot.tideStation (manual override)
 *  2. Nearest station by haversine distance across all registered
 *     stations. The previous Oahu-coast prefilter caused Maui spots
 *     (Molokini) to match Honolulu — that's why this is now strictly
 *     distance-based. Stations span all main Hawaiian islands so the
 *     nearest will naturally be on the correct island.
 *
 * Returns a station ID string, or null if the registry is empty.
 *
 * @param {object} spot - spot config { lat, lon, coast?, noaaTideStation?, tideStation? }
 * @returns {string|null}
 */
function chooseNoaaTideStationForSpot(spot) {
  if (!spot) return null;

  // Manual per-spot override (either field name accepted)
  if (spot.tideStation)     return String(spot.tideStation);
  if (spot.noaaTideStation) return String(spot.noaaTideStation);

  if (!NOAA_TIDE_STATIONS.length) return null;

  let nearest = null;
  let bestDist = Infinity;
  for (const s of NOAA_TIDE_STATIONS) {
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
    // Cover the past 6h (so the "now" tide cycle has anchor points
     // before now) and the next 7 days (so per-day forecast tide
     // events are available without an extra fetch).
    const beginMs = nowMs - 6 * 3600000;
    const endMs   = nowMs + 7 * 24 * 3600000;

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
