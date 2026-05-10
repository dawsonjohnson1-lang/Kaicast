/* eslint-env node */
/* global fetch */

/**
 * Abyss — Wave energy at depth module.
 *
 * Combines:
 * 1. WaveWatch III forecast from NOAA NOMADS (7-day, 6-hourly)
 * 2. Linear wave theory for orbital velocity at depth
 * 3. Sediment resuspension thresholds per substrate type
 *
 * Exports:
 *  - fetchWW3Forecast({ lat, lon, nowMs })
 *  - computeWaveImpactAtSite({ waveHeightM, wavePeriodS, siteDepthM, targetDepthM, sedimentType })
 *  - decomposeSwellByPeriod({ waveHeightM, wavePeriodS })
 *  - waveOrbitalVelocityAtDepth(H, T, d, z)
 *  - solveWavenumber(omega, d)
 */

const logger = require('firebase-functions/logger');

// ─── Constants ───────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 12000;
const G = 9.81; // gravitational acceleration (m/s²)

// Sediment resuspension thresholds (orbital velocity in m/s required to lift sediment)
const RESUSPENSION_THRESHOLDS = {
  sand: 0.15,          // fine sand lifts easily
  coral_rubble: 0.20,  // mixed sand/coral on Hawaiian reefs
  reef: 0.30,          // hard reef bottom, takes serious energy
  silt: 0.10,          // very fine sediment, lifts with almost any wave
};

// ─── Wave physics ────────────────────────────────────────────────────────────

/**
 * Solve the linear wave dispersion relation for wavenumber k.
 *   ω² = g·k·tanh(k·d)
 *
 * Uses Newton-Raphson iteration. Converges in 5-8 iterations for ocean waves.
 *
 * @param {number} omega - angular frequency = 2π/T (rad/s)
 * @param {number} d - water depth (m)
 * @returns {number} k - wavenumber (rad/m)
 */
function solveWavenumber(omega, d) {
  if (!Number.isFinite(omega) || !Number.isFinite(d) || omega <= 0 || d <= 0) {
    return 0;
  }

  // Initial guess: deep water approximation k₀ = ω²/g
  let k = (omega * omega) / G;

  // Newton-Raphson: f(k) = ω² - g·k·tanh(k·d) = 0
  // f'(k) = -g·[tanh(k·d) + k·d·sech²(k·d)]
  for (let i = 0; i < 20; i++) {
    const kd = k * d;
    const tanhKd = Math.tanh(kd);
    const f = omega * omega - G * k * tanhKd;
    const sech2 = 1 - tanhKd * tanhKd;
    const fp = -G * (tanhKd + k * d * sech2);

    if (Math.abs(fp) < 1e-12) break;
    const dk = -f / fp;
    k += dk;
    if (k < 1e-8) k = 1e-8;
    if (Math.abs(dk) < 1e-8) break;
  }

  return k;
}

/**
 * Wave orbital velocity at depth z below the surface.
 * Linear (Airy) wave theory:
 *   u(z) = (H/2) · ω · cosh(k·(d+z)) / sinh(k·d)
 *
 * where z is negative below surface (z=0 at surface, z=-d at bottom).
 * We take z as a positive depth and convert internally.
 *
 * @param {number} H - significant wave height (m)
 * @param {number} T - dominant wave period (s)
 * @param {number} d - total water depth at site (m)
 * @param {number} z - depth of interest below surface (m, positive downward)
 * @returns {number} orbital velocity magnitude (m/s)
 */
function waveOrbitalVelocityAtDepth(H, T, d, z) {
  if (!Number.isFinite(H) || !Number.isFinite(T) || !Number.isFinite(d) || !Number.isFinite(z)) {
    return 0;
  }
  if (H <= 0 || T <= 0 || d <= 0 || z < 0) return 0;
  if (z > d) z = d; // clamp to bottom

  const omega = (2 * Math.PI) / T;
  const k = solveWavenumber(omega, d);
  if (k <= 0) return 0;

  const amplitude = H / 2;
  const kd = k * d;
  const sinhKd = Math.sinh(kd);
  if (Math.abs(sinhKd) < 1e-12) return 0;

  // cosh(k·(d-z)) because z is measured positive downward
  const coshTerm = Math.cosh(k * (d - z));
  const velocity = amplitude * omega * (coshTerm / sinhKd);

  return Math.abs(velocity);
}

/**
 * Compute wave impact at a dive site: orbital velocity, sediment risk, surge rating.
 *
 * @param {object} opts
 * @param {number} opts.waveHeightM - significant wave height (m)
 * @param {number} opts.wavePeriodS - dominant period (s)
 * @param {number} opts.siteDepthM - total water depth at site (m)
 * @param {number} opts.targetDepthM - diver's target depth (m)
 * @param {string} [opts.sedimentType='coral_rubble'] - bottom type
 * @returns {{ orbitalVelocityMps, sedimentRisk, surgeRating, visibilityImpactM }}
 */
function computeWaveImpactAtSite({
  waveHeightM,
  wavePeriodS,
  siteDepthM,
  targetDepthM,
  sedimentType = 'coral_rubble',
} = {}) {
  const defaults = {
    orbitalVelocityMps: 0,
    sedimentRisk: 'none',
    surgeRating: 0,
    visibilityImpactM: 0,
  };

  if (!Number.isFinite(waveHeightM) || !Number.isFinite(wavePeriodS)) {
    return defaults;
  }

  const depth = siteDepthM || 10;
  const target = targetDepthM || depth * 0.6;

  // Orbital velocity at the target dive depth
  const orbVel = waveOrbitalVelocityAtDepth(waveHeightM, wavePeriodS, depth, target);

  // Orbital velocity at the bottom (drives sediment resuspension)
  const bottomVel = waveOrbitalVelocityAtDepth(waveHeightM, wavePeriodS, depth, depth);

  // Sediment resuspension assessment
  const threshold = RESUSPENSION_THRESHOLDS[sedimentType] || RESUSPENSION_THRESHOLDS.coral_rubble;

  let sedimentRisk = 'none';
  let visImpactM = 0;
  if (bottomVel >= threshold * 2.0) {
    sedimentRisk = 'high';
    visImpactM = -8;
  } else if (bottomVel >= threshold * 1.3) {
    sedimentRisk = 'moderate';
    visImpactM = -4;
  } else if (bottomVel >= threshold) {
    sedimentRisk = 'low';
    visImpactM = -1.5;
  }

  // Surge rating: 0-100 scale of how much wave energy a diver feels at depth
  // Based on orbital velocity relative to comfort thresholds
  // 0 m/s = no surge (0), 0.1 m/s = noticeable (30), 0.3 m/s = strong (60), 0.5+ = dangerous (90+)
  const surgeRating = Math.min(100, Math.round(
    100 * (1 - Math.exp(-orbVel / 0.15))
  ));

  return {
    orbitalVelocityMps: Math.round(orbVel * 1000) / 1000,
    sedimentRisk,
    surgeRating,
    visibilityImpactM: visImpactM,
  };
}

/**
 * Decompose swell into period bands relevant for diving.
 * Uses an energy partition approximation since we don't have full spectral data.
 *
 * @param {object} opts
 * @param {number} opts.waveHeightM - significant wave height (m)
 * @param {number} opts.wavePeriodS - dominant period (s)
 * @returns {{ groundswellFt, midPeriodFt, windSwellFt }}
 */
function decomposeSwellByPeriod({ waveHeightM, wavePeriodS } = {}) {
  const M_TO_FT = 3.28084;

  if (!Number.isFinite(waveHeightM) || !Number.isFinite(wavePeriodS)) {
    return { groundswellFt: null, midPeriodFt: null, windSwellFt: null };
  }

  const totalFt = waveHeightM * M_TO_FT;

  // Without spectral data, estimate the energy partition based on dominant period.
  // Ground swell (>14s): long-period, travels far, deep-water origin
  // Mid-period (8-14s): moderate fetch, common Hawaii trade swell
  // Wind swell (<8s): locally generated, short-period chop

  let groundFrac, midFrac, windFrac;

  if (wavePeriodS > 14) {
    // Dominant period is ground swell → most energy there
    groundFrac = 0.70;
    midFrac = 0.20;
    windFrac = 0.10;
  } else if (wavePeriodS > 10) {
    // Mid-period dominant
    groundFrac = 0.15;
    midFrac = 0.65;
    windFrac = 0.20;
  } else if (wavePeriodS > 8) {
    // Lower mid-period
    groundFrac = 0.05;
    midFrac = 0.55;
    windFrac = 0.40;
  } else {
    // Wind swell dominant
    groundFrac = 0.02;
    midFrac = 0.18;
    windFrac = 0.80;
  }

  // Wave height partitions: H_total² = H_gs² + H_mp² + H_ws²
  // So H_component = H_total × sqrt(frac)
  return {
    groundswellFt: Math.round(totalFt * Math.sqrt(groundFrac) * 10) / 10,
    midPeriodFt: Math.round(totalFt * Math.sqrt(midFrac) * 10) / 10,
    windSwellFt: Math.round(totalFt * Math.sqrt(windFrac) * 10) / 10,
  };
}

// ─── WaveWatch III forecast fetch ────────────────────────────────────────────

/**
 * Fetch WaveWatch III 7-day forecast from NOAA NOMADS for a lat/lon.
 * Returns 6-hourly forecast points.
 *
 * @param {object} opts
 * @param {number} opts.lat
 * @param {number} opts.lon
 * @param {number} opts.nowMs
 * @returns {Array<{ tsMs, waveHeightM, wavePeriodS, waveDirectionDeg }>}
 */
async function fetchWW3Forecast({ lat, lon, nowMs }) {
  const d = new Date(nowMs);
  const dateStr =
    String(d.getUTCFullYear()) +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0');

  // WW3 global 0.5° grid on NOMADS
  // Try the GFS wave filter endpoint with sub-region extraction
  const leftlon = lon - 1;
  const rightlon = lon + 1;
  const toplat = lat + 1;
  const bottomlat = lat - 1;

  // Try cycle hours in reverse (most recent first): 18, 12, 06, 00
  const cycles = ['18', '12', '06', '00'];

  for (const cycle of cycles) {
    const url =
      `https://nomads.ncep.noaa.gov/cgi-bin/filter_wave.pl` +
      `?dir=%2Fgfs.${dateStr}%2F${cycle}%2Fwave%2Fgridded` +
      `&file=gfswave.t${cycle}z.global.0p25.f000.grib2` +
      `&var_HTSGW=on&var_PERPW=on&var_DIRPW=on` +
      `&subregion=&leftlon=${leftlon}&rightlon=${rightlon}` +
      `&toplat=${toplat}&bottomlat=${bottomlat}`;

    try {
      const r = await timedFetch(url);
      if (!r.ok) continue;

      // GRIB2 is binary — we can't easily parse it in pure Node.js without a library.
      // For the MVP, we rely on existing NDBC buoy data for current conditions
      // and use WW3 for trend information only.
      // TODO: Use NOMADS OpenDAP ASCII endpoint for parseable forecast data
      logger.info('abyss/waves: WW3 endpoint responded', { cycle, status: r.status });

      // For now, return empty array — the wave impact calculations work with
      // existing buoy data from the pipeline. WW3 forecast integration will
      // be added when we implement the OpenDAP ASCII parsing.
      return [];
    } catch (err) {
      logger.warn('abyss/waves: WW3 fetch error', { cycle, error: err.message });
    }
  }

  logger.info('abyss/waves: WW3 forecast unavailable, using buoy data only');
  return [];
}

/** Fetch with timeout. */
async function timedFetch(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    return r;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

module.exports = {
  fetchWW3Forecast,
  computeWaveImpactAtSite,
  decomposeSwellByPeriod,
  waveOrbitalVelocityAtDepth,
  solveWavenumber,
};
