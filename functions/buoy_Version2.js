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

  const hvIdx  = findIndexFor(['WVHT', 'WVH', 'HTSGW', 'WAVEHEIGHT', 'WVHT_S']);
  // DPD = dominant period, APD = average period. MWD = mean wave
  // direction (degrees) — distinct field; do NOT collapse with period.
  const perIdx = findIndexFor(['DPD', 'APD', 'TP', 'P1', 'PER', 'PERIOD']);
  const dirIdx = findIndexFor(['MWD', 'WDIR_WAVE', 'WAVEDIR']);
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

    if (!acc[isoHour]) acc[isoHour] = { hv: [], per: [], dir: [], wtmp: [] };

    // Safe safe reads for hv/per/wtmp via indexes
    // When WVHT is 'MM' (missing sentinel) or the column is absent, skip the
    // row — no heuristic fallback. In the realtime2 layout tokens 5/6 are
    // WDIR/WSPD, so guessing would record wind data as wave height.
    // Downstream handles missing hours via lookupRecent + marine forecast.
    if (hvIdx >= 0 && tokens[hvIdx] && tokens[hvIdx] !== 'MM') {
      const hv = Number(tokens[hvIdx]);
      if (Number.isFinite(hv)) acc[isoHour].hv.push(hv);
    }

    if (perIdx >= 0 && tokens[perIdx] && tokens[perIdx] !== 'MM') {
      const per = Number(tokens[perIdx]);
      if (Number.isFinite(per)) acc[isoHour].per.push(per);
    }

    if (dirIdx >= 0 && tokens[dirIdx] && tokens[dirIdx] !== 'MM') {
      const dir = Number(tokens[dirIdx]);
      if (Number.isFinite(dir) && dir >= 0 && dir <= 360) acc[isoHour].dir.push(dir);
    }

    if (wtmpIdx >= 0 && tokens[wtmpIdx] && tokens[wtmpIdx] !== 'MM') {
      const wtmp = Number(tokens[wtmpIdx]);
      if (Number.isFinite(wtmp)) acc[isoHour].wtmp.push(wtmp);
    }
  }

  // Circular mean for direction so 359° + 1° averages to 0° not 180°.
  function circularMean(degs) {
    if (!degs.length) return null;
    const rads = degs.map((d) => (d * Math.PI) / 180);
    const sx = rads.reduce((a, r) => a + Math.cos(r), 0);
    const sy = rads.reduce((a, r) => a + Math.sin(r), 0);
    return ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360;
  }

  const waveHMap = new Map();
  const wavePMap = new Map();
  const waveDirMap = new Map();
  const sstMap = new Map();

  for (const iso of Object.keys(acc)) {
    const entry = acc[iso];
    if (entry.hv && entry.hv.length)   waveHMap.set(iso, Math.round(avg(entry.hv) * 100) / 100);
    if (entry.per && entry.per.length) wavePMap.set(iso, Math.round(avg(entry.per) * 10) / 10);
    if (entry.dir && entry.dir.length) waveDirMap.set(iso, Math.round(circularMean(entry.dir)));
    if (entry.wtmp && entry.wtmp.length) sstMap.set(iso, normalizeWtmpValue(avg(entry.wtmp)));
  }

  return { waveHMap, wavePMap, waveDirMap, sstMap };
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
  const empty = () => ({
    waveHMap: new Map(),
    wavePMap: new Map(),
    waveDirMap: new Map(),
    sstMap: new Map(),
  });
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

/**
 * Multi-buoy fusion. Given a list of NDBC station ids, fetch each in
 * parallel and merge their readings: for each ISO hour, the merged
 * wave height / period / direction is the average across the buoys
 * that have a value. Used by buildSpotReport when a spot has a
 * `nearbyBuoys` array so noisy single-buoy readings get smoothed out
 * by the consensus of the surrounding stations.
 *
 * Returns the same { waveHMap, wavePMap, waveDirMap, sstMap } shape
 * as fetchBuoyHourly, so the rest of the pipeline doesn't need to
 * know whether it's reading from one station or several.
 *
 * Note: direction averaging is naive vector-mean (works fine for
 * tightly-clustered Hawaii buoys but would break for spreads >180°).
 * We dedupe single-station calls so fetchMultiBuoy([X]) === fetchBuoyHourly(X).
 */
async function fetchMultiBuoy({ stations, cacheTtlMs = DEFAULT_CACHE_TTL_MS } = {}) {
  const empty = () => ({
    waveHMap: new Map(),
    wavePMap: new Map(),
    waveDirMap: new Map(),
    sstMap: new Map(),
  });
  if (!Array.isArray(stations) || stations.length === 0) return empty();

  const results = await Promise.all(
    stations.map((s) => fetchBuoyHourly({ station: s, cacheTtlMs })),
  );

  // Single station — return as-is to preserve exact values.
  if (results.length === 1) return results[0];

  const out = empty();
  const merge = (key, values) => {
    const nums = values.filter((v) => Number.isFinite(v));
    if (nums.length === 0) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  };
  const mergeDir = (values) => {
    // Vector mean of compass bearings — sin/cos average then atan2,
    // converted back to 0..360. Handles wrap-around at north.
    const valid = values.filter((v) => Number.isFinite(v));
    if (valid.length === 0) return null;
    let sx = 0, sy = 0;
    for (const deg of valid) {
      const rad = (deg * Math.PI) / 180;
      sx += Math.cos(rad);
      sy += Math.sin(rad);
    }
    const mean = Math.atan2(sy, sx) * 180 / Math.PI;
    return Math.round((mean + 360) % 360);
  };

  // Collect all unique ISO hour keys across all buoys.
  const allKeys = new Set();
  for (const r of results) {
    for (const k of r.waveHMap.keys()) allKeys.add(k);
    for (const k of r.wavePMap.keys()) allKeys.add(k);
    for (const k of r.waveDirMap.keys()) allKeys.add(k);
    for (const k of r.sstMap.keys()) allKeys.add(k);
  }

  for (const k of allKeys) {
    const wH = merge('waveH', results.map((r) => r.waveHMap.get(k)));
    if (wH != null) out.waveHMap.set(k, Math.round(wH * 100) / 100);
    const wP = merge('waveP', results.map((r) => r.wavePMap.get(k)));
    if (wP != null) out.wavePMap.set(k, Math.round(wP * 10) / 10);
    const wD = mergeDir(results.map((r) => r.waveDirMap.get(k)));
    if (wD != null) out.waveDirMap.set(k, wD);
    const sst = merge('sst', results.map((r) => r.sstMap.get(k)));
    if (sst != null) out.sstMap.set(k, Math.round(sst * 10) / 10);
  }

  return out;
}

module.exports = {
  fetchBuoyHourly,
  fetchMultiBuoy,
};