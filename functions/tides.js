/* eslint-env node */
/* global fetch */

/**
 * KaiCast — NOAA CO-OPS tide predictions fetcher.
 *
 * Fetches hourly tide predictions for a given station and date range,
 * returning a time-sorted array of { tsMs, levelFt } suitable for the
 * tide-cycle model in analysis.js.
 *
 * Public API — no key required.
 * Docs: https://api.tidesandcurrents.noaa.gov/api/prod/
 */

const NOAA_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

// Default station for Oahu: Honolulu Harbor (1612340).
// Tides around Oahu are similar in timing and amplitude, so this
// station is used as the reference for all dive spots.
const DEFAULT_OAHU_STATION = '1612340';

// In-memory cache: Map<cacheKey, { data, expiresAt }>
const tideCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Format a Date as YYYYMMDD (UTC) for the NOAA API begin_date/end_date params.
 */
function formatNOAADate(d) {
  return (
    String(d.getUTCFullYear()) +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0')
  );
}

/**
 * Parse a NOAA datetime string "YYYY-MM-DD HH:MM" (Hawaii Standard Time,
 * UTC-10, no DST) into a UTC millisecond timestamp.
 *
 * @param {string} timeStr  - e.g. "2024-04-01 14:00"
 * @param {number} [utcOffsetHours=-10]  - station local offset from UTC
 * @returns {number|null}
 */
function parseNOAATime(timeStr, utcOffsetHours = -10) {
  if (!timeStr) return null;
  const [datePart, timePart] = timeStr.split(' ');
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  if ([year, month, day, hour, minute].some((v) => !Number.isFinite(v))) return null;
  // Shift local time to UTC
  return Date.UTC(year, month - 1, day, hour - utcOffsetHours, minute);
}

/**
 * Fetch hourly NOAA tide predictions for a station over a window around nowMs.
 *
 * @param {object}  opts
 * @param {string}  [opts.station='1612340']  - NOAA station ID
 * @param {number}  [opts.nowMs=Date.now()]   - reference timestamp (ms)
 * @param {number}  [opts.lookbackDays=2]     - days before nowMs to fetch
 * @param {number}  [opts.lookaheadDays=2]    - days after nowMs to fetch
 * @param {number}  [opts.cacheTtlMs]         - cache TTL in ms (default 30 min)
 * @returns {Promise<Array<{tsMs: number, levelFt: number}>>}
 */
async function fetchNOAATideSeries({
  station = DEFAULT_OAHU_STATION,
  nowMs = Date.now(),
  lookbackDays = 2,
  lookaheadDays = 2,
  cacheTtlMs = CACHE_TTL_MS,
} = {}) {
  const startDate = new Date(nowMs - lookbackDays * 86400000);
  const endDate   = new Date(nowMs + lookaheadDays * 86400000);
  const beginStr  = formatNOAADate(startDate);
  const endStr    = formatNOAADate(endDate);

  const cacheKey = `${station}|${beginStr}|${endStr}`;
  const cached   = tideCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const url =
    `${NOAA_BASE}` +
    `?begin_date=${beginStr}` +
    `&end_date=${endStr}` +
    `&station=${encodeURIComponent(station)}` +
    `&product=predictions` +
    `&datum=MLLW` +
    `&time_zone=lst_ldt` +
    `&interval=h` +
    `&units=english` +
    `&application=kaicast` +
    `&format=json`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let r;
  try {
    r = await fetch(url, { signal: controller.signal });
  } catch (err) {
    clearTimeout(timeout);
    throw new Error(`NOAA tide fetch failed: ${err.message}`);
  }
  clearTimeout(timeout);

  if (!r.ok) {
    const txt = await r.text().catch(() => '<no body>');
    throw new Error(`NOAA tide fetch error (${r.status}): ${txt}`);
  }

  const j = await r.json();
  if (j.error) {
    throw new Error(`NOAA tide API error: ${j.error.message || JSON.stringify(j.error)}`);
  }

  const predictions = Array.isArray(j.predictions) ? j.predictions : [];
  const series = predictions
    .map((p) => {
      const tsMs    = parseNOAATime(p.t, -10); // Hawaii = UTC-10 (no DST)
      const levelFt = parseFloat(p.v);
      if (tsMs == null || !Number.isFinite(levelFt)) return null;
      return { tsMs, levelFt: Math.round(levelFt * 100) / 100 };
    })
    .filter(Boolean)
    .sort((a, b) => a.tsMs - b.tsMs);

  tideCache.set(cacheKey, { data: series, expiresAt: Date.now() + cacheTtlMs });
  return series;
}

module.exports = {
  fetchNOAATideSeries,
  DEFAULT_OAHU_STATION,
};
