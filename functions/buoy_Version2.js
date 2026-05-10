/* eslint-env node */
/* global fetch */

/**
 * Buoy fetcher + parser with in-memory caching and unit normalization.
 *
 * Exports:
 *  - fetchBuoyHourly({ station, hourKeys }) => { waveHMap, wavePMap, sstMap }
 *
 * Notes:
 *  - Returns Maps keyed by ISO-hour strings like "2026-02-07T10:00:00.000Z" truncated to "YYYY-MM-DDTHH:00"
 *  - Uses an internal cache (default TTL 5 minutes) to avoid repeated network calls within the same invocation window.
 *  - Attempts robust header detection and WTMP unit normalization (F -> C if values appear Fahrenheit).
 */

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const BUOY_CACHE = new Map(); // station -> { ts, data }

function avg(arr) {
  if (!arr || !arr.length) return null;
  const valid = arr.filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

async function fetchWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

function isoHourFromDateUTC(date) {
  return new Date(date).toISOString().slice(0, 13) + ":00";
}

/**
 * Normalize WTMP if it looks like Fahrenheit.
 * If typical water temps > 45, assume Fahrenheit and convert to C.
 */
function normalizeWtmpValue(v) {
  if (v == null || !Number.isFinite(v)) return null;
  if (v > 45) {
    // very likely Fahrenheit
    return Math.round(((v - 32) * (5 / 9)) * 100) / 100;
  }
  // assume it's already Celsius
  return Math.round(v * 100) / 100;
}

/**
 * Parse a NDBC realtime2 .txt station file and return hourly maps.
 */
async function parseNdbcRealtime2Text(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { waveHMap: new Map(), wavePMap: new Map(), sstMap: new Map() };

  // NDBC realtime2 has two '#'-prefixed header rows: column names
  // (WDIR WSPD WVHT DPD APD WTMP …) followed by units (degT m/s m sec
  // sec degC …). We want the column-names row. Match by the presence
  // of known field markers; fall back to the first '#' line.
  const headerLines = lines.filter((l) => l.startsWith('#'));
  const headerLine =
    headerLines.find((l) => /\b(WVHT|WDIR|DPD|APD|WTMP|WSPD)\b/.test(l)) ||
    headerLines[0] ||
    null;
  if (!headerLine) return { waveHMap: new Map(), wavePMap: new Map(), sstMap: new Map() };

  // header fields (strip leading '#')
  const headerFields = headerLine.replace(/^#+/, '').trim().split(/\s+/);

  // data lines
  const dataLines = lines.filter((l) => !l.startsWith('#'));

  const acc = Object.create(null);

  // Helper: find header index by matching for several aliases
  function findIndexFor(names) {
    const up = headerFields.map((h) => h.toUpperCase());
    for (const name of names) {
      const idx = up.indexOf(name.toUpperCase());
      if (idx >= 0) return idx;
    }
    return -1;
  }

  const hvIdx = findIndexFor(['WVHT', 'WVH', 'HTSGW', 'WAVEHEIGHT', 'WVHT_S']);
  // DPD / APD / TP / P1 / PER
  const perIdx = findIndexFor(['DPD', 'APD', 'TP', 'P1', 'PER', 'PERIOD', 'MWD']);
  const wtmpIdx = findIndexFor(['WTMP', 'WTEMP', 'WATERTEMP']);

  for (const dl of dataLines) {
    const tokens = dl.split(/\s+/);
    if (tokens.length < 4) continue;

    // Determine date columns: many NDBC files use YYYY MM DD hh mm or YY MM DD hh mm
    // We'll attempt several common formats
    let year, month, day, hour, minute;
    // Try YYYY MM DD hh mm
    if (tokens.length >= 5 && tokens[0].length === 4) {
      year = Number(tokens[0]);
      month = Number(tokens[1]);
      day = Number(tokens[2]);
      hour = Number(tokens[3]);
      minute = Number(tokens[4]);
    } else if (tokens.length >= 5 && tokens[0].length === 2) {
      // YY MM DD hh mm
      year = 2000 + Number(tokens[0]);
      month = Number(tokens[1]);
      day = Number(tokens[2]);
      hour = Number(tokens[3]);
      minute = Number(tokens[4]);
    } else if (tokens.length >= 4) {
      // fallback: try first 4 as YYYY MM DD hh
      year = Number(tokens[0]);
      month = Number(tokens[1]);
      day = Number(tokens[2]);
      hour = Number(tokens[3]);
      minute = 0;
    } else {
      continue;
    }

    if (![year, month, day, hour].every(Number.isFinite)) continue;

    const dt = new Date(Date.UTC(year, month - 1, day, hour, minute || 0));
    const isoHour = isoHourFromDateUTC(dt);

    if (!acc[isoHour]) acc[isoHour] = { hv: [], per: [], wtmp: [] };

    // Safe safe reads for hv/per/wtmp via indexes
    if (hvIdx >= 0 && tokens[hvIdx] && tokens[hvIdx] !== 'MM') {
      const hv = Number(tokens[hvIdx]);
      if (Number.isFinite(hv)) acc[isoHour].hv.push(hv);
    } else {
      // sometimes wave height appears later; try heuristics: pick a token that looks like a wave height (0.1..20 range)
      for (let t = 5; t < Math.min(tokens.length, 12); t++) {
        const v = Number(tokens[t]);
        if (Number.isFinite(v) && v > 0 && v < 20) {
          acc[isoHour].hv.push(v);
          break;
        }
      }
    }

    if (perIdx >= 0 && tokens[perIdx] && tokens[perIdx] !== 'MM') {
      const per = Number(tokens[perIdx]);
      if (Number.isFinite(per)) acc[isoHour].per.push(per);
    }

    if (wtmpIdx >= 0 && tokens[wtmpIdx] && tokens[wtmpIdx] !== 'MM') {
      const wtmp = Number(tokens[wtmpIdx]);
      if (Number.isFinite(wtmp)) acc[isoHour].wtmp.push(wtmp);
    }
  }

  const waveHMap = new Map();
  const wavePMap = new Map();
  const sstMap = new Map();

  for (const iso of Object.keys(acc)) {
    const entry = acc[iso];
    if (entry.hv && entry.hv.length) waveHMap.set(iso, Math.round(avg(entry.hv) * 100) / 100);
    if (entry.per && entry.per.length) wavePMap.set(iso, Math.round(avg(entry.per) * 10) / 10);
    if (entry.wtmp && entry.wtmp.length) sstMap.set(iso, normalizeWtmpValue(avg(entry.wtmp)));
  }

  return { waveHMap, wavePMap, sstMap };
}

/**
 * Fetch buoy hourly maps with caching.
 *
 * Returns the FULL parsed maps regardless of hourKeys — NDBC realtime2
 * provides past observations and OpenWeather hourKeys are future forecast
 * hours, so any intersection is empty. Callers (buildSpotReport) walk
 * back from "now" to find the most recent available reading.
 */
async function fetchBuoyHourly({ station, cacheTtlMs = DEFAULT_CACHE_TTL_MS } = {}) {
  const empty = () => ({ waveHMap: new Map(), wavePMap: new Map(), sstMap: new Map() });
  if (!station) return empty();

  const now = Date.now();
  const cached = BUOY_CACHE.get(station);
  if (cached && (now - cached.ts) < cacheTtlMs) {
    return cached.data;
  }

  // Not cached or expired -> fetch
  // NDBC realtime2 text URL pattern
  const url = `https://www.ndbc.noaa.gov/data/realtime2/${station}.txt`;

  let text;
  try {
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) {
      console.warn(`[buoy] HTTP ${res.status} fetching ${url}`);
      const e = empty();
      BUOY_CACHE.set(station, { ts: Date.now(), data: e });
      return e;
    }
    text = await res.text();
  } catch (err) {
    console.warn(`[buoy] fetch error for ${station}: ${err.message}`);
    const e = empty();
    BUOY_CACHE.set(station, { ts: Date.now(), data: e });
    return e;
  }

  try {
    const parsed = await parseNdbcRealtime2Text(text);
    BUOY_CACHE.set(station, { ts: Date.now(), data: parsed });
    return parsed;
  } catch (err) {
    console.warn(`[buoy] parse error for ${station}: ${err.message}`);
    const e = empty();
    BUOY_CACHE.set(station, { ts: Date.now(), data: e });
    return e;
  }
}

module.exports = {
  fetchBuoyHourly,
};