/* eslint-env node */
/* global fetch */

/**
 * Abyss — Satellite ocean color (KD490) module.
 *
 * Primary: Copernicus Marine Service (CMEMS) L4 gap-filled daily composites.
 * Fallback: NASA OceanColor MODIS-Aqua 8-day composites.
 *
 * KD490 = diffuse attenuation coefficient at 490 nm (m^-1).
 * Secchi depth ≈ 1.7 / KD490 → direct visibility proxy.
 *
 * Exports:
 *  - fetchOceanColor({ lat, lon, nowMs, db })
 *  - kd490ToVisibility(kd490)
 */

const logger = require('firebase-functions/logger');

// ─── Constants ───────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 6 * 3600 * 1000; // 6 hours
const GRID_STEP = 0.04;               // ~4 km CMEMS grid resolution
const FETCH_TIMEOUT_MS = 12000;

// CMEMS OPeNDAP base for L4 gap-free ocean color
const CMEMS_BASE =
  'https://nrt.cmems-du.eu/thredds/dodsC/cmems_obs-oc_glo_bgc-transp_nrt_l4-gapfree-multi-4km_P1D';

// NASA OceanColor ERDDAP (MODIS-Aqua 8-day composites)
const NASA_ERDDAP_BASE =
  'https://oceandata.sci.gsfc.nasa.gov/opendap/MODISA/L3SMI';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Snap lat/lon to nearest grid cell center for cache key deduplication. */
function snapToGrid(val) {
  return Math.round(val / GRID_STEP) * GRID_STEP;
}

function cacheDocId(lat, lon) {
  const sLat = snapToGrid(lat).toFixed(4);
  const sLon = snapToGrid(lon).toFixed(4);
  return `${sLat}_${sLon}`.replace(/[.-]/g, '_');
}

/** Fetch with timeout + abort. */
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

// ─── Cache layer (Firestore) ─────────────────────────────────────────────────

async function getCached(db, lat, lon) {
  if (!db) return null;
  try {
    const docRef = db.collection('abyss_ocean_color_cache').doc(cacheDocId(lat, lon));
    const snap = await docRef.get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data || !data.fetchedAt) return null;
    const age = Date.now() - data.fetchedAt;
    if (age > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

async function setCache(db, lat, lon, payload) {
  if (!db) return;
  try {
    const docRef = db.collection('abyss_ocean_color_cache').doc(cacheDocId(lat, lon));
    await docRef.set({ ...payload, fetchedAt: Date.now() });
  } catch (err) {
    logger.warn('abyss/kd490: cache write failed', { error: err.message });
  }
}

// ─── CMEMS fetch ─────────────────────────────────────────────────────────────

/**
 * Attempt to fetch KD490, CHL, SPM from CMEMS OPeNDAP.
 * CMEMS L4 products use a time dimension indexed by days since epoch.
 * We request the latest available time slice for the nearest grid cell.
 *
 * Auth: HTTP Basic with CMEMS credentials.
 */
async function fetchFromCMEMS({ lat, lon, username, password }) {
  // Snap to grid
  const sLat = snapToGrid(lat);
  const sLon = snapToGrid(lon);

  // CMEMS grid: lat -90..90 step 0.04, lon -180..180 step 0.04
  // Index = (val - origin) / step
  const latIdx = Math.round((sLat - (-89.98)) / GRID_STEP);
  const lonIdx = Math.round((sLon - (-179.98)) / GRID_STEP);

  // Request the last available time index (use [LAST] shorthand or a high index)
  // OPeNDAP doesn't support "LAST" keyword universally, so we use a large index
  // and let the server clamp. If this doesn't work, we'll try descending.
  const timeExpr = '[LAST]';

  const vars = ['KD490', 'CHL', 'SPM'];
  const queries = vars.map(v =>
    `${CMEMS_BASE}.ascii?${v}${timeExpr}[${latIdx}:1:${latIdx}][${lonIdx}:1:${lonIdx}]`
  );

  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  const headers = { Authorization: authHeader };

  const results = {};
  for (let i = 0; i < vars.length; i++) {
    try {
      const r = await timedFetch(queries[i], { headers });
      if (!r.ok) {
        logger.warn('abyss/kd490: CMEMS fetch non-ok', { var: vars[i], status: r.status });
        continue;
      }
      const text = await r.text();
      const val = parseOPeNDAPScalar(text);
      if (val !== null && val > 0 && val < 100) {
        results[vars[i].toLowerCase()] = val;
      }
    } catch (err) {
      logger.warn('abyss/kd490: CMEMS fetch error', { var: vars[i], error: err.message });
    }
  }

  if (results.kd490 == null) return null;

  return {
    kd490: results.kd490,
    chlorophyll: results.chl ?? null,
    spm: results.spm ?? null,
    source: 'cmems',
    ageHours: 24, // L4 products typically lag ~1 day
    confidence: 0.85,
  };
}

// ─── NASA MODIS fallback ─────────────────────────────────────────────────────

async function fetchFromNASA({ lat, lon, username, password, nowMs }) {
  // Build 8-day composite path: A{YEAR}{DOY}.L3m_8D_KD490_Kd_490_4km.nc
  const d = new Date(nowMs);
  const year = d.getUTCFullYear();
  const startOfYear = Date.UTC(year, 0, 1);
  const doy = Math.floor((d.getTime() - startOfYear) / 86400000) + 1;
  // 8-day composites start at DOY 1, 9, 17, ... find nearest start
  const compositeStart = Math.max(1, Math.floor((doy - 1) / 8) * 8 + 1);
  const doyStr = String(compositeStart).padStart(3, '0');

  // NASA grid: 4320×2160 (4km), lat 90..-90, lon -180..180
  // latIdx = (90 - lat) / (180/2160), lonIdx = (lon + 180) / (360/4320)
  const latIdx = Math.round((90 - lat) / (180 / 2160));
  const lonIdx = Math.round((lon + 180) / (360 / 4320));

  const url =
    `${NASA_ERDDAP_BASE}/${year}/${doyStr}/A${year}${doyStr}.L3m_8D_KD490_Kd_490_4km.nc.dap.ascii` +
    `?Kd_490[${latIdx}][${lonIdx}]`;

  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  try {
    const r = await timedFetch(url, { headers: { Authorization: authHeader } });
    if (!r.ok) {
      logger.warn('abyss/kd490: NASA fetch non-ok', { status: r.status });
      return null;
    }
    const text = await r.text();
    const val = parseOPeNDAPScalar(text);
    if (val == null || val <= 0 || val >= 50) return null;

    return {
      kd490: val,
      chlorophyll: null,
      spm: null,
      source: 'nasa-modis',
      ageHours: 96, // 8-day composite, could be up to 8 days old
      confidence: 0.6,
    };
  } catch (err) {
    logger.warn('abyss/kd490: NASA fetch error', { error: err.message });
    return null;
  }
}

// ─── OPeNDAP ASCII parser ────────────────────────────────────────────────────

/**
 * Parse a scalar value from OPeNDAP ASCII response.
 * Format is typically:
 *   VarName.VarName
 *   [0], value
 *   or just a numeric value on its own line after headers.
 */
function parseOPeNDAPScalar(text) {
  if (!text) return null;
  const lines = text.split('\n');

  // Walk lines in reverse looking for first parseable float
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line || line.startsWith('Dataset') || line.startsWith('--')) continue;

    // Try to extract number from patterns like "[0], 0.0523" or just "0.0523"
    const match = line.match(/(-?\d+\.?\d*(?:[eE][+-]?\d+)?)\s*$/);
    if (match) {
      const v = parseFloat(match[1]);
      if (Number.isFinite(v)) return v;
    }
  }
  return null;
}

// ─── Main exports ────────────────────────────────────────────────────────────

/**
 * Fetch satellite ocean color data for a location.
 * Tries CMEMS first, falls back to NASA MODIS, uses Firestore cache.
 *
 * @param {object} opts
 * @param {number} opts.lat
 * @param {number} opts.lon
 * @param {number} opts.nowMs - current time ms
 * @param {object} [opts.db] - Firestore instance for caching
 * @param {string} [opts.cmemsUser] - CMEMS username
 * @param {string} [opts.cmemsPass] - CMEMS password
 * @param {string} [opts.nasaUser] - NASA Earthdata username
 * @param {string} [opts.nasaPass] - NASA Earthdata password
 * @returns {{ kd490, chlorophyll, spm, source, ageHours, confidence } | null}
 */
async function fetchOceanColor({ lat, lon, nowMs, db, cmemsUser, cmemsPass, nasaUser, nasaPass }) {
  // 1. Check cache
  const cached = await getCached(db, lat, lon);
  if (cached && cached.kd490 != null) {
    const cacheAge = (Date.now() - cached.fetchedAt) / 3600000;
    return {
      kd490: cached.kd490,
      chlorophyll: cached.chlorophyll ?? null,
      spm: cached.spm ?? null,
      source: cached.source || 'cache',
      ageHours: Math.round((cached.ageHours || 24) + cacheAge),
      confidence: Math.max(0.3, (cached.confidence || 0.7) - cacheAge * 0.02),
    };
  }

  // 2. Try CMEMS
  if (cmemsUser && cmemsPass) {
    try {
      const cmems = await fetchFromCMEMS({ lat, lon, username: cmemsUser, password: cmemsPass });
      if (cmems) {
        await setCache(db, lat, lon, cmems);
        return cmems;
      }
    } catch (err) {
      logger.warn('abyss/kd490: CMEMS pipeline error', { error: err.message });
    }
  }

  // 3. Try NASA MODIS
  if (nasaUser && nasaPass) {
    try {
      const nasa = await fetchFromNASA({ lat, lon, username: nasaUser, password: nasaPass, nowMs });
      if (nasa) {
        await setCache(db, lat, lon, nasa);
        return nasa;
      }
    } catch (err) {
      logger.warn('abyss/kd490: NASA pipeline error', { error: err.message });
    }
  }

  // 4. No satellite data available
  logger.info('abyss/kd490: no satellite data available', { lat, lon });
  return null;
}

/**
 * Convert KD490 (m^-1) to visibility estimates.
 *
 * Core relationship: Secchi depth ≈ 1.7 / KD490
 * Horizontal visibility ≈ 2-3× Secchi depth (empirical for divers).
 *
 * @param {number} kd490 - diffuse attenuation coefficient at 490nm (m^-1)
 * @returns {{ secchiDepthM, visibilityEstimateM, lightAt5mPercent, lightAt10mPercent, lightAt20mPercent }}
 */
function kd490ToVisibility(kd490) {
  if (!Number.isFinite(kd490) || kd490 <= 0) {
    return {
      secchiDepthM: null,
      visibilityEstimateM: null,
      lightAt5mPercent: null,
      lightAt10mPercent: null,
      lightAt20mPercent: null,
    };
  }

  // Secchi depth (m) — the depth at which a white disk disappears
  const secchiDepthM = 1.7 / kd490;

  // Horizontal visibility estimate (m)
  // Empirical factor: divers see ~2.5× further horizontally than Secchi depth
  // because Secchi measures vertical attenuation + reflection loss
  const visibilityEstimateM = Math.round(secchiDepthM * 2.5 * 10) / 10;

  // Light penetration at various depths using Beer-Lambert law:
  // I(z) / I(0) = exp(-KD490 × z)
  const lightAt5mPercent = Math.round(Math.exp(-kd490 * 5) * 1000) / 10;
  const lightAt10mPercent = Math.round(Math.exp(-kd490 * 10) * 1000) / 10;
  const lightAt20mPercent = Math.round(Math.exp(-kd490 * 20) * 1000) / 10;

  return {
    secchiDepthM: Math.round(secchiDepthM * 10) / 10,
    visibilityEstimateM,
    lightAt5mPercent,
    lightAt10mPercent,
    lightAt20mPercent,
  };
}

module.exports = {
  fetchOceanColor,
  kd490ToVisibility,
  // Expose for testing
  parseOPeNDAPScalar,
  snapToGrid,
};
