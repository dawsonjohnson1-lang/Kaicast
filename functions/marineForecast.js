/* eslint-env node */
/* global fetch */

/**
 * Open-Meteo Marine forecast fetcher.
 *
 * Returns hourly wave forecast data keyed by ISO hour ("YYYY-MM-DDTHH:00"),
 * matching the shape used by buoy_Version2.js so callers can use the same
 * lookup helpers. Provides ~7 days of hourly wave height / period /
 * direction at any lat/lon, free, no API key required.
 *
 * Open-Meteo terms allow non-commercial use without attribution and
 * commercial use with attribution; rate-limited to ~10k req/day per IP.
 *
 * Exports:
 *   fetchMarineForecast({ lat, lon, days = 7 })
 *     => { waveHMap, wavePMap, waveDirMap }
 */

const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — forecast updates are sub-hourly
const FORECAST_CACHE = new Map(); // `${lat},${lon},${days}` -> { ts, data }

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

function emptyMaps() {
  return {
    waveHMap:   new Map(),
    wavePMap:   new Map(),
    waveDirMap: new Map(),
  };
}

async function fetchMarineForecast({ lat, lon, days = 7, cacheTtlMs = DEFAULT_CACHE_TTL_MS } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return emptyMaps();

  // Round to ~0.01° (≈ 1km) so nearby spots dedupe in cache.
  const latR = Math.round(lat * 100) / 100;
  const lonR = Math.round(lon * 100) / 100;
  const cacheKey = `${latR},${lonR},${days}`;

  const cached = FORECAST_CACHE.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < cacheTtlMs) return cached.data;

  const url =
    `https://marine-api.open-meteo.com/v1/marine` +
    `?latitude=${latR}&longitude=${lonR}` +
    `&hourly=wave_height,wave_period,wave_direction` +
    `&forecast_days=${days}`;

  let json;
  try {
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) {
      console.warn(`[marine] HTTP ${res.status} for ${latR},${lonR}`);
      const e = emptyMaps();
      FORECAST_CACHE.set(cacheKey, { ts: Date.now(), data: e });
      return e;
    }
    json = await res.json();
  } catch (err) {
    console.warn(`[marine] fetch error ${latR},${lonR}: ${err.message}`);
    const e = emptyMaps();
    FORECAST_CACHE.set(cacheKey, { ts: Date.now(), data: e });
    return e;
  }

  const out = emptyMaps();
  const times = json?.hourly?.time || [];
  const hM    = json?.hourly?.wave_height    || [];
  const pS    = json?.hourly?.wave_period    || [];
  const dD    = json?.hourly?.wave_direction || [];

  for (let i = 0; i < times.length; i++) {
    // Open-Meteo returns naive ISO ("2026-05-10T00:00") in the requested
    // timezone. We default to GMT so this is already a UTC ISO hour.
    const iso = String(times[i]).slice(0, 13) + ':00';
    if (Number.isFinite(hM[i])) out.waveHMap.set(iso, Math.round(hM[i] * 100) / 100);
    if (Number.isFinite(pS[i])) out.wavePMap.set(iso, Math.round(pS[i] * 10) / 10);
    if (Number.isFinite(dD[i])) out.waveDirMap.set(iso, Math.round(dD[i]));
  }

  FORECAST_CACHE.set(cacheKey, { ts: Date.now(), data: out });
  return out;
}

module.exports = {
  fetchMarineForecast,
};
