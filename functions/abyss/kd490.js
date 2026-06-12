/* eslint-env node */
/* global fetch */

/**
 * Abyss — Satellite ocean-color fetcher.
 *
 * Source: NOAA CoastWatch ERDDAP — VIIRS-NPP + NOAA-20 multi-mission
 * DINEOF-gap-filled daily composites (2 km, global). No auth required.
 *
 *   KD490 (diffuse attenuation @ 490 nm, m^-1):
 *     dataset noaacwNPPN20S3AkdSCIDINEOF2kmDaily  variable kd_490
 *
 *   Chlorophyll-a (mg/m^3):
 *     dataset noaacwNPPN20S3ASCIDINEOF2kmDaily   variable chlor_a
 *
 * KD490 → Secchi depth ≈ 1.7 / KD490 → horizontal visibility proxy.
 *
 * Why CoastWatch ERDDAP instead of OBPG / CMEMS:
 *   - Public, no auth (was blocking us — CMEMS legacy creds were
 *     pointed at the parked nrt.cmems-du.eu domain, NASA OB.DAAC
 *     L3 ocean-color isn't surfaced via CMR anymore)
 *   - DINEOF gap-filling means cloudy days don't return null
 *   - 2km grid resolves the headland-scale variation our spots care
 *     about
 *   - Same ERDDAP infrastructure we already use for NOAA tides
 *   - 1-2 day lag on daily composites; sufficient for visibility
 *     baseline (the heuristic fills in for ultra-fresh hours anyway)
 *
 * Exports:
 *  - fetchOceanColor({ lat, lon, nowMs, db })
 *  - kd490ToVisibility(kd490)
 */

const logger = require('firebase-functions/logger');

// ─── Constants ───────────────────────────────────────────────────────────────

// Cache TTLs are split. SUCCESS lasts a full week (the underlying
// daily product is gap-filled DINEOF and the ocean doesn't change
// that fast — better to serve a 5-day-old reading than fall through
// to the heuristic if ERDDAP is down). FAILURE only sticks 30 min so
// we recover quickly from a transient outage without hammering.
const CACHE_TTL_OK_MS    = 7 * 24 * 3600 * 1000;
const CACHE_TTL_FAIL_MS  = 30 * 60 * 1000;
const GRID_STEP          = 0.01; // ~1 km — fine enough that adjacent spots get distinct cache entries (dataset native res is 2 km)
const FETCH_TIMEOUT_MS   = 6000; // tight — if ERDDAP is slow we want to give up + serve heuristic

const ERDDAP_BASE = 'https://coastwatch.noaa.gov/erddap/griddap';
const KD490_DATASET = 'noaacwNPPN20S3AkdSCIDINEOF2kmDaily';
const CHL_DATASET   = 'noaacwNPPN20S3ASCIDINEOF2kmDaily';

// DINEOF runs ~7-14 days behind real time. Start the lookback at the
// 11-day-ago hot spot (most likely to have data) and walk back from
// there. Walking forward would just hit the trailing edge of empty
// future dates and waste timeout budget.
const LOOKBACK_START_DAYS = 11;
const LOOKBACK_RANGE_DAYS = 7;  // try -11, -12, -13, ..., -17

// ─── Helpers ─────────────────────────────────────────────────────────────────

function snapToGrid(val) {
  return Math.round(val / GRID_STEP) * GRID_STEP;
}

function cacheDocId(lat, lon) {
  const sLat = snapToGrid(lat).toFixed(4);
  const sLon = snapToGrid(lon).toFixed(4);
  return `${sLat}_${sLon}`.replace(/[.-]/g, '_');
}

async function timedFetch(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...opts, signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    return r;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/** Format a Date as ERDDAP's required `(YYYY-MM-DDT12:00:00Z)` literal. */
function erddapTimeAt(dateMs) {
  const d = new Date(dateMs);
  return (
    String(d.getUTCFullYear()) + '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0') +
    'T12:00:00Z'
  );
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
    const ttl = data.kd490 == null ? CACHE_TTL_FAIL_MS : CACHE_TTL_OK_MS;
    if (age > ttl) return null;
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

// ─── Circuit breaker ─────────────────────────────────────────────────────────

// After this many consecutive network-level ERDDAP failures in one
// process, skip ERDDAP for subsequent spots — a hung/down host would
// otherwise cost every spot its own FETCH_TIMEOUT_MS in the same
// sequential pipeline run (the failure cache is per grid point, so it
// can't short-circuit across spots).
const BREAKER_THRESHOLD = 3;
let consecutiveNetworkFailures = 0;

function erddapBreakerOpen() {
  return consecutiveNetworkFailures >= BREAKER_THRESHOLD;
}

// Test-only: module state would otherwise leak between test cases.
function _resetErddapBreaker() {
  consecutiveNetworkFailures = 0;
}

// ─── ERDDAP CSV parser ───────────────────────────────────────────────────────

/**
 * Parse an ERDDAP gridDAP .csv response of shape:
 *   time,altitude,latitude,longitude,<varname>\n
 *   UTC,m,degrees_north,degrees_east,<units>\n
 *   2026-05-04T12:00:00Z,0.0,21.260412,-157.6979,0.0234\n
 *
 * Returns the numeric value of the last data row, or null on
 * empty / non-finite / NaN sentinel.
 */
function parseErddapScalarCsv(text) {
  if (!text) return null;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3) return null;
  const last = lines[lines.length - 1];
  const cols = last.split(',');
  if (cols.length < 5) return null;
  const v = Number(cols[cols.length - 1]);
  if (!Number.isFinite(v)) return null;
  return v;
}

/**
 * Fetch one numeric value from a CoastWatch ERDDAP gridDAP dataset at
 * the given lat/lon/time. The path shape is:
 *   `${ERDDAP_BASE}/${dataset}.csv?${varname}[(time)][(0.0)][(lat)][(lon)]`
 *
 * Walks back up to MAX_LOOKBACK_DAYS days looking for a non-null
 * sample (gap-filled product so 0 lookback hits the norm).
 */
async function fetchErddapPoint({ dataset, varname, lat, lon, nowMs }) {
  const targetMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  let firstErr = null;
  for (let d = LOOKBACK_START_DAYS; d < LOOKBACK_START_DAYS + LOOKBACK_RANGE_DAYS; d++) {
    const t = erddapTimeAt(targetMs - d * 86400000);
    const url =
      `${ERDDAP_BASE}/${dataset}.csv?` +
      `${varname}` +
      `%5B(${t})%5D` +     // time
      `%5B(0.0)%5D` +      // altitude (sea surface)
      `%5B(${lat.toFixed(5)})%5D` +
      `%5B(${lon.toFixed(5)})%5D`;
    let r;
    try {
      r = await timedFetch(url);
      consecutiveNetworkFailures = 0;
    } catch (err) {
      firstErr = err.message;
      consecutiveNetworkFailures++;
      // Network-level error (timeout, DNS, TLS) — likely upstream
      // outage. No point trying more dates against the same dead host.
      logger.warn(`abyss/kd490: ERDDAP ${dataset} fetch error`, { error: err.message, daysBack: d });
      return null;
    }
    if (!r.ok) {
      // 404 here = "no data for that exact day" — keep walking back.
      if (r.status === 404) continue;
      logger.warn(`abyss/kd490: ERDDAP ${dataset} HTTP ${r.status}`);
      return null;
    }
    const text = await r.text();
    const v = parseErddapScalarCsv(text);
    if (v != null && v > 0 && v < 100) {
      return { value: v, ageDays: d };
    }
  }
  if (firstErr) logger.warn(`abyss/kd490: ERDDAP ${dataset} no data in lookback window`);
  return null;
}

// ─── Main exports ────────────────────────────────────────────────────────────

/**
 * Fetch satellite ocean color data for a location.
 *
 * @param {object} opts
 * @param {number} opts.lat
 * @param {number} opts.lon
 * @param {number} opts.nowMs
 * @param {object} [opts.db]
 * @returns {{ kd490, chlorophyll, spm, source, ageHours, confidence } | null}
 */
async function fetchOceanColor({ lat, lon, nowMs, db }) {
  // 1. Cache. A cached KD490 is reused (up to CACHE_TTL_OK_MS) instead
  // of falling back to the heuristic — a 1-3 day-old satellite reading
  // beats a wind/swell guess. `fetchAgeHours` (time since we actually
  // pulled the value from ERDDAP) is surfaced so the engine can apply
  // a freshness penalty to the visibility baseline: ~0.95× at 24 h,
  // 0.90× at 48 h, 0.85× at 72 h (see abyss.js satelliteFreshnessPenalty).
  const cached = await getCached(db, lat, lon);
  // Soft-failure marker (kd490: null) still inside CACHE_TTL_FAIL_MS —
  // getCached already enforces the 30-min TTL, so a non-expired marker
  // means "ERDDAP was down recently, don't hammer it again yet".
  if (cached && cached.kd490 == null) return null;
  if (cached && cached.kd490 != null) {
    const cacheAgeHours = (Date.now() - cached.fetchedAt) / 3600000;
    return {
      kd490:        cached.kd490,
      chlorophyll:  cached.chlorophyll ?? null,
      spm:          cached.spm ?? null,
      source:       cached.source || 'cache',
      ageHours:     Math.round((cached.ageHours || 24) + cacheAgeHours),
      fetchAgeHours: Math.round(cacheAgeHours * 10) / 10,
      fromCache:    true,
      confidence:   Math.max(0.3, (cached.confidence || 0.85) - cacheAgeHours * 0.02),
    };
  }

  // 2. Fetch KD490 + CHL from CoastWatch in parallel — unless the
  // circuit breaker tripped earlier in this process, in which case
  // skip straight to the failure marker so the rest of the pipeline
  // run doesn't pay FETCH_TIMEOUT_MS per spot against a dead host.
  const [kd490Res, chlRes] = erddapBreakerOpen()
    ? [null, null]
    : await Promise.all([
        fetchErddapPoint({ dataset: KD490_DATASET, varname: 'kd_490', lat, lon, nowMs }),
        fetchErddapPoint({ dataset: CHL_DATASET,   varname: 'chlor_a', lat, lon, nowMs }),
      ]);

  if (!kd490Res) {
    logger.info('abyss/kd490: no satellite data available', { lat, lon });
    // Cache a soft-failure marker so we don't hammer ERDDAP every
    // single getReport invocation while it's down. CACHE_TTL_FAIL_MS
    // (30 min) means we'll retry soonish but not on every request.
    await setCache(db, lat, lon, {
      kd490: null, chlorophyll: null, spm: null,
      source: 'erddap-unavailable',
      ageHours: null, confidence: null,
    });
    return null;
  }

  const payload = {
    kd490:        kd490Res.value,
    chlorophyll:  chlRes?.value ?? null,
    // SPM is not served by these datasets. The engine derives an SPM
    // *proxy* downstream from chlorophyll + bottom orbital velocity —
    // see the Layer 6 block in abyss.js. Kept null here so a future
    // direct-SPM dataset can slot in without an engine change.
    spm:          null,
    source:       'noaa-coastwatch-viirs',
    ageHours:     24 + kd490Res.ageDays * 24,
    confidence:   Math.max(0.5, 0.85 - kd490Res.ageDays * 0.10),
  };

  await setCache(db, lat, lon, payload);
  return { ...payload, fetchAgeHours: 0, fromCache: false };
}

/**
 * Convert KD490 (m^-1) → visibility estimates.
 *
 * Core relationship: Secchi depth ≈ 1.7 / KD490
 * Horizontal visibility ≈ 2-3× Secchi depth (empirical for divers).
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
  const secchiDepthM = 1.7 / kd490;
  // Horizontal vis = secchi × 2.5 in theory, but real diver visibility
  // plateaus around 20-25 m even when satellite KD490 says "cleaner."
  // Apply a soft saturation above 15 m so two spots with KD490=0.02
  // vs 0.03 don't both pin at the 40 m theoretical max — they show
  // distinct 22 m vs 24 m. Hard cap at 25 m (≈82 ft) since that's
  // about the realistic ceiling Hawaii spots ever see in practice.
  const rawVisM = secchiDepthM * 2.5;
  const visibilityEstimateM = rawVisM <= 15
    ? Math.round(rawVisM * 10) / 10
    : Math.round((15 + (25 - 15) * (1 - Math.exp(-(rawVisM - 15) / 8))) * 10) / 10;
  const lightAt5mPercent  = Math.round(Math.exp(-kd490 *  5) * 1000) / 10;
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
  // Exposed for testing.
  parseErddapScalarCsv,
  snapToGrid,
  erddapTimeAt,
  fetchErddapPoint,
  erddapBreakerOpen,
  _resetErddapBreaker,
};
