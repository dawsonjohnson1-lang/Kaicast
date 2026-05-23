/* eslint-env node */
/* global fetch */

/**
 * PacIOOS WaveWatch III Hawaii wave model fetcher.
 *
 * Pulls hourly significant wave height (Thgt), peak period (Tper), and
 * peak direction (Tdir) at a single lat/lon from PacIOOS's regional
 * WW3 ERDDAP service. The model is Hawaii-focused at ~5 km native
 * resolution — much better than Open-Meteo's ~25 km global grid for
 * inter-island shadowing and refraction.
 *
 * Returns the same { waveHMap, wavePMap, waveDirMap } shape that
 * buoy_Version2.js and marineForecast.js produce so the existing
 * pipeline in index.js can fall through cleanly:
 *   buoy (past/now) → PacIOOS WW3 (future) → Open-Meteo (final fallback)
 *
 * Caching: 30-min TTL keyed by ~1km lat/lon round, so nearby spots
 * dedupe and we don't hammer ERDDAP on every hourly scheduler run.
 *
 * ERDDAP quirks worth knowing:
 *   - Dataset uses 4 dimensions [time, depth, latitude, longitude].
 *     Depth must be specified even though it's a constant 0 (surface).
 *   - Longitude in this dataset is 0-360 (e.g. -158.122 → 201.878).
 *   - Coverage box: lat [18, 23], lon [199, 206]. Spots outside the
 *     box (none in our registry today) return 404.
 *
 * Service URL:
 *   https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ww3_hawaii.json
 */

const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000;
const FORECAST_CACHE = new Map(); // `${lat},${lon}` -> { ts, data }

const BASE = 'https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ww3_hawaii.json';

function emptyMaps() {
  return {
    waveHMap:   new Map(),
    wavePMap:   new Map(),
    waveDirMap: new Map(),
  };
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

/**
 * Build an ERDDAP query string for hourly waves over a time window.
 * Returns Thgt, Tper, Tdir at the given lat/lon for [start..end]
 * stride 1 (every available hour, ERDDAP picks nearest grid point).
 *
 * `lat` is degrees north (positive); `lon` is degrees east in 0-360.
 */
function buildQuery(lat, lon, startIso, endIso) {
  // ERDDAP variable subset syntax: var[start:stride:end][depth][lat][lon]
  // Three variables in one request — saves three round-trips.
  const range = `[(${startIso}):1:(${endIso})][(0)][(${lat})][(${lon})]`;
  const vars = ['Thgt', 'Tper', 'Tdir'].map((v) => `${v}${range}`).join(',');
  return `${BASE}?${vars}`;
}

/**
 * Convert -180..180 longitude to PacIOOS WW3's 0..360 convention.
 * (Their grid is centered on the Pacific, so longitudes are stored
 * east-positive without sign-flipping at the antimeridian.)
 */
function lonToEast360(lon) {
  return lon < 0 ? lon + 360 : lon;
}

/**
 * Fetch ~`days` of hourly wave forecast for a single point.
 * Returns `{ waveHMap, wavePMap, waveDirMap }` with ISO-hour keys
 * matching the shape produced by other wave-data fetchers.
 */
async function fetchPacioosWaveForecast({ lat, lon, days = 7, cacheTtlMs = DEFAULT_CACHE_TTL_MS } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return emptyMaps();

  // Round to ~1km (0.01°) so nearby spots share the cache key.
  const latR = Math.round(lat * 100) / 100;
  const lonR = Math.round(lon * 100) / 100;
  const cacheKey = `${latR},${lonR},${days}`;
  const cached = FORECAST_CACHE.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < cacheTtlMs) return cached.data;

  // Time window: now minus 6h (so we get a recent "nowcast" hour)
  // out to now + days*24h.
  const now = new Date();
  const startMs = now.getTime() - 6 * 3600 * 1000;
  const endMs   = now.getTime() + days * 24 * 3600 * 1000;
  const startIso = new Date(startMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const endIso   = new Date(endMs).toISOString().replace(/\.\d{3}Z$/, 'Z');

  const lonEast = lonToEast360(lonR);
  const url = buildQuery(latR, lonEast, startIso, endIso);

  let json;
  try {
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[pacioos-ww3] HTTP ${res.status} for ${latR},${lonR} (${lonEast}E)`);
      const e = emptyMaps();
      FORECAST_CACHE.set(cacheKey, { ts: Date.now(), data: e });
      return e;
    }
    json = await res.json();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[pacioos-ww3] fetch error ${latR},${lonR}: ${err.message}`);
    const e = emptyMaps();
    FORECAST_CACHE.set(cacheKey, { ts: Date.now(), data: e });
    return e;
  }

  const out = emptyMaps();
  const cols = json?.table?.columnNames ?? [];
  const rows = json?.table?.rows ?? [];
  const iTime = cols.indexOf('time');
  const iH    = cols.indexOf('Thgt');
  const iP    = cols.indexOf('Tper');
  const iD    = cols.indexOf('Tdir');
  if (iTime < 0) {
    FORECAST_CACHE.set(cacheKey, { ts: Date.now(), data: out });
    return out;
  }

  for (const row of rows) {
    const iso = String(row[iTime] ?? '').slice(0, 13) + ':00';
    if (!iso.startsWith('2')) continue;
    const h = iH >= 0 ? row[iH] : null;
    const p = iP >= 0 ? row[iP] : null;
    const d = iD >= 0 ? row[iD] : null;
    if (Number.isFinite(h)) out.waveHMap.set(iso, Math.round(h * 100) / 100);
    if (Number.isFinite(p)) out.wavePMap.set(iso, Math.round(p * 10) / 10);
    if (Number.isFinite(d)) out.waveDirMap.set(iso, Math.round(d));
  }

  FORECAST_CACHE.set(cacheKey, { ts: Date.now(), data: out });
  return out;
}

module.exports = {
  fetchPacioosWaveForecast,
  _internal: { buildQuery, lonToEast360, FORECAST_CACHE },
};
