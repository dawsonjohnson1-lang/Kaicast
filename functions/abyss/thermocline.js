/* eslint-env node */
/* global fetch */

/**
 * Abyss — Thermocline detection via HYCOM ocean model.
 *
 * HYCOM provides 3D ocean temperature profiles at ~0.08° resolution.
 * Thermoclines cause dramatic visibility changes at depth — crystal clear
 * above and murky below (or vice versa).
 *
 * Exports:
 *  - fetchTemperatureProfile({ lat, lon, nowMs })
 *  - detectThermocline(tempProfile)
 *  - assessThermoclineForDive({ thermocline, targetDepthM })
 */

const logger = require('firebase-functions/logger');

// ─── Constants ───────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 12000;

// HYCOM depth levels available (meters) — standard z-levels
const HYCOM_DEPTHS = [0, 2, 4, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40, 50];

// Thermocline detection: minimum temperature gradient (°C per meter) to qualify
const SHARP_THRESHOLD = 0.5;    // °C/m — sharp thermocline
const GRADUAL_THRESHOLD = 0.15; // °C/m — gradual thermocline

// CW ERDDAP endpoint for HYCOM (no auth required)
const HYCOM_ERDDAP_BASE =
  'https://coastwatch.pfeg.noaa.gov/erddap/griddap/HYCOM_reg7_latest3d.csv';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── HYCOM fetch ─────────────────────────────────────────────────────────────

/**
 * Fetch temperature profile from HYCOM at lat/lon.
 * Uses the CoastWatch ERDDAP mirror which doesn't require auth.
 *
 * @param {object} opts
 * @param {number} opts.lat
 * @param {number} opts.lon
 * @param {number} opts.nowMs
 * @returns {Array<{ depthM: number, tempC: number }>} sorted by depth
 */
async function fetchTemperatureProfile({ lat, lon, nowMs }) {
  // ERDDAP query: latest time, all depth levels from 0-50m, nearest lat/lon
  // water_temp[(latest_time)][0:1:13][(lat)][(lon)]
  const url =
    `${HYCOM_ERDDAP_BASE}?water_temp[(last)][0:1:${HYCOM_DEPTHS.length - 1}][(${lat})][(${lon})]`;

  try {
    const r = await timedFetch(url);
    if (!r.ok) {
      logger.warn('abyss/thermocline: HYCOM fetch non-ok', { status: r.status });
      return [];
    }

    const text = await r.text();
    return parseHYCOMCsv(text);
  } catch (err) {
    logger.warn('abyss/thermocline: HYCOM fetch error', { error: err.message });
    return [];
  }
}

/**
 * Parse HYCOM ERDDAP CSV response into temperature profile.
 * CSV format: time, depth, latitude, longitude, water_temp
 */
function parseHYCOMCsv(text) {
  if (!text) return [];

  const lines = text.split('\n');
  const profile = [];

  // Skip header rows (first 1-2 lines)
  let dataStart = 0;
  for (let i = 0; i < lines.length && i < 5; i++) {
    if (lines[i].includes('time') || lines[i].includes('units') || lines[i].trim().startsWith('#')) {
      dataStart = i + 1;
    }
  }

  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 5) continue;

    // CSV columns: time, depth, latitude, longitude, water_temp
    const depth = parseFloat(parts[1]);
    const temp = parseFloat(parts[4]);

    if (Number.isFinite(depth) && Number.isFinite(temp) && temp > -5 && temp < 40) {
      profile.push({ depthM: depth, tempC: Math.round(temp * 100) / 100 });
    }
  }

  // Sort by depth ascending
  profile.sort((a, b) => a.depthM - b.depthM);
  return profile;
}

// ─── Thermocline detection ───────────────────────────────────────────────────

/**
 * Detect thermocline from a temperature profile.
 * Looks for the depth range with the steepest temperature gradient.
 *
 * @param {Array<{ depthM: number, tempC: number }>} tempProfile
 * @returns {{ thermoclineDepthM, tempAboveC, tempBelowC, sharpness, visibilityImpact }}
 */
function detectThermocline(tempProfile) {
  const none = {
    thermoclineDepthM: null,
    tempAboveC: null,
    tempBelowC: null,
    sharpness: 'none',
    visibilityImpact: null,
  };

  if (!Array.isArray(tempProfile) || tempProfile.length < 3) return none;

  // Compute gradient between consecutive depth levels
  let maxGradient = 0;
  let maxGradientIdx = -1;

  for (let i = 0; i < tempProfile.length - 1; i++) {
    const dz = tempProfile[i + 1].depthM - tempProfile[i].depthM;
    if (dz <= 0) continue;

    const dT = Math.abs(tempProfile[i + 1].tempC - tempProfile[i].tempC);
    const gradient = dT / dz; // °C/m

    if (gradient > maxGradient) {
      maxGradient = gradient;
      maxGradientIdx = i;
    }
  }

  if (maxGradientIdx < 0 || maxGradient < GRADUAL_THRESHOLD) return none;

  const above = tempProfile[maxGradientIdx];
  const below = tempProfile[maxGradientIdx + 1];
  const thermoclineDepth = (above.depthM + below.depthM) / 2;

  let sharpness = 'gradual';
  if (maxGradient >= SHARP_THRESHOLD) sharpness = 'sharp';

  // Visibility impact assessment
  // Sharp thermoclines often trap sediment/plankton at the density interface
  // causing dramatic visibility changes. The effect depends on gradient strength.
  let visibilityImpact = null;
  if (sharpness === 'sharp') {
    visibilityImpact = 'Expect dramatic visibility change at thermocline depth. ' +
      'Water may be crystal clear above and murky below (or vice versa).';
  } else {
    visibilityImpact = 'Gradual temperature change may cause some visibility shift at depth.';
  }

  return {
    thermoclineDepthM: Math.round(thermoclineDepth * 10) / 10,
    tempAboveC: above.tempC,
    tempBelowC: below.tempC,
    sharpness,
    visibilityImpact,
  };
}

// ─── Dive assessment ─────────────────────────────────────────────────────────

/**
 * Assess how a thermocline affects dive conditions at a target depth.
 *
 * @param {object} opts
 * @param {object} opts.thermocline - result from detectThermocline
 * @param {number} opts.targetDepthM - diver's target depth
 * @returns {{ meetsThermocline, expectedVisibilityChange, recommendation }}
 */
function assessThermoclineForDive({ thermocline, targetDepthM }) {
  const defaults = {
    meetsThermocline: false,
    expectedVisibilityChange: 'neutral',
    recommendation: null,
  };

  if (!thermocline || thermocline.sharpness === 'none' || !thermocline.thermoclineDepthM) {
    return defaults;
  }

  const tcDepth = thermocline.thermoclineDepthM;
  const target = targetDepthM || 10;

  // Does the diver cross the thermocline?
  const meetsThermocline = target >= tcDepth - 2; // within 2m above counts

  if (!meetsThermocline) {
    return {
      meetsThermocline: false,
      expectedVisibilityChange: 'neutral',
      recommendation: `Thermocline detected at ${tcDepth}m — your target depth of ${target}m stays above it.`,
    };
  }

  // In Hawaii, thermoclines typically mean cooler, clearer deep water
  // (oceanic water below vs. warmer nearshore water above).
  // But the interface itself can trap particulates.
  const tempDrop = (thermocline.tempAboveC || 25) - (thermocline.tempBelowC || 23);
  const isNormalHawaii = tempDrop > 0; // warmer above = typical

  let expectedChange = 'neutral';
  let recommendation;

  if (isNormalHawaii) {
    expectedChange = 'improve';
    recommendation =
      `Thermocline at ${tcDepth}m — visibility may improve below it as you enter ` +
      `cooler, clearer oceanic water (${thermocline.tempBelowC}°C). ` +
      `Expect a brief murky layer right at the transition.`;
  } else {
    expectedChange = 'worsen';
    recommendation =
      `Unusual thermocline at ${tcDepth}m — warmer water below may indicate ` +
      `upwelling or freshwater intrusion. Visibility could decrease below the thermocline.`;
  }

  if (thermocline.sharpness === 'sharp') {
    recommendation += ' The transition is sharp — prepare for a sudden temperature and visibility change.';
  }

  return {
    meetsThermocline,
    expectedVisibilityChange: expectedChange,
    recommendation,
  };
}

module.exports = {
  fetchTemperatureProfile,
  detectThermocline,
  assessThermoclineForDive,
  // Expose for testing
  parseHYCOMCsv,
};
