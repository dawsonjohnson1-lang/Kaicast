/* eslint-env node */
/* global fetch */
'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest }  = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin  = require('firebase-admin');

const analysis        = require('./analysis');
const { fetchBuoyHourly } = require('./buoy_Version2');
const { pushAllReportsToWebflow } = require('./webflow');

admin.initializeApp();

const OW_API_KEY = defineSecret('OW_API_KEY');

// ── Conversion constant ────────────────────────────────────────────────────
const MPS_TO_KTS = 1.94384; // m/s → knots

// ── Oahu spots ─────────────────────────────────────────────────────────────
/**
 * Each spot may define:
 *  name, lat, lon, buoyStation,
 *  coast (optional – auto-assigned if absent),
 *  runoffSensitivity ('low'|'medium'|'high'),
 *  maxCleanSwellFt, hardNoGoSwellFt,
 *  nearStreamMouth, nearDrainage,
 *  brownWaterAdvisory, sewageSpillAdvisory, floodWarning,
 *  communityFlags ([])
 */
const SPOTS = {
  mokuleia: {
    name: 'Mokuleia',
    lat: 21.5755, lon: -158.1507,
    buoyStation: '51201',
    runoffSensitivity: 'medium',
    maxCleanSwellFt: 3, hardNoGoSwellFt: 6,
  },
  makua: {
    name: 'Makua Beach',
    lat: 21.5140, lon: -158.2295,
    buoyStation: '51201',
    runoffSensitivity: 'medium',
    maxCleanSwellFt: 3, hardNoGoSwellFt: 5,
  },
  hanaumaBay: {
    name: 'Hanauma Bay',
    lat: 21.2692, lon: -157.6942,
    buoyStation: '51202',
    runoffSensitivity: 'low',
    maxCleanSwellFt: 3, hardNoGoSwellFt: 5,
    coast: 'south',
  },
  waimeaBay: {
    name: 'Waimea Bay',
    lat: 21.6424, lon: -158.0659,
    buoyStation: '51201',
    runoffSensitivity: 'medium',
    maxCleanSwellFt: 2, hardNoGoSwellFt: 4,
  },
  sharksCove: {
    name: "Shark's Cove",
    lat: 21.6488, lon: -158.0565,
    buoyStation: '51201',
    runoffSensitivity: 'medium',
    maxCleanSwellFt: 2, hardNoGoSwellFt: 4,
  },
  koOlina: {
    name: 'Ko Olina',
    lat: 21.3362, lon: -158.1244,
    buoyStation: '51201',
    runoffSensitivity: 'low',
    maxCleanSwellFt: 3, hardNoGoSwellFt: 6,
    coast: 'west',
  },
};

// ── Geographic helper ───────────────────────────────────────────────────────

/**
 * Deterministically classify an Oahu spot's coast from lat/lon.
 * Returns 'north' | 'south' | 'east' | 'west' | null.
 */
function classifySpotCoast(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  // Oahu-specific thresholds
  if (lat > 21.52)  return 'north';
  if (lat < 21.36)  return 'south';
  if (lon > -157.82) return 'east';
  return 'west';
}

// ── OpenWeather ─────────────────────────────────────────────────────────────

/**
 * Fetch OpenWeather One Call v3 hourly data for a lat/lon.
 * Returns { hourly: [...], current: {...} }.
 *
 * Each hourly entry:
 *   { dtMs, dtUtc, airTempC, windSpeedKts, windGustKts, windDeg, cloudCoverPercent, rainLast1hMM }
 */
async function fetchOpenWeatherHourly(lat, lon, apiKey) {
  const url =
    `https://api.openweathermap.org/data/3.0/onecall` +
    `?lat=${lat}&lon=${lon}&exclude=minutely,daily,alerts` +
    `&appid=${apiKey}&units=metric`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let r;
  try {
    r = await fetch(url, { signal: controller.signal });
  } catch (err) {
    clearTimeout(timeout);
    throw new Error(`OpenWeather fetch failed: ${err.message}`);
  }
  clearTimeout(timeout);

  if (!r.ok) {
    const txt = await r.text().catch(() => '<no body>');
    throw new Error(`OpenWeather fetch failed (${r.status}): ${txt}`);
  }

  const j = await r.json();

  function mapHourly(h) {
    const windMs = h.wind_speed ?? null;
    const gustMs = h.wind_gust  ?? null;
    // Sanity-check conversion: only apply if value looks like m/s (< 100)
    const windKts = Number.isFinite(windMs) && windMs < 100
      ? Math.round(windMs * MPS_TO_KTS * 10) / 10 : null;
    const gustKts = Number.isFinite(gustMs) && gustMs < 100
      ? Math.round(gustMs * MPS_TO_KTS * 10) / 10 : null;
    return {
      dtMs:             (h.dt || 0) * 1000,
      dtUtc:            new Date((h.dt || 0) * 1000).toISOString(),
      airTempC:         h.temp            ?? null,
      windSpeedKts:     windKts,
      windGustKts:      gustKts,
      windDeg:          h.wind_deg        ?? null,
      cloudCoverPercent: h.clouds         ?? null,
      rainLast1hMM:     h.rain?.['1h']    ?? 0,
    };
  }

  const hourly = (j.hourly || []).map(mapHourly);

  const cur = j.current || {};
  const current = mapHourly(cur);

  return { hourly, current };
}

// ── Hourly series ───────────────────────────────────────────────────────────

/**
 * Build a normalised hourly series for a spot from OW hourly data.
 * Fields carried through: dtMs, dtUtc, isoHour, airTempC, windSpeedKts,
 *   windGustKts, windDeg, cloudCoverPercent, rainLast1hMM.
 * Missing OW fields default to null (not overridden if already present).
 */
function buildHourlySeriesForSpot(_spot, owHourly = []) {
  return owHourly.map((h) => {
    const isoHour = new Date(h.dtMs).toISOString().slice(0, 13) + ':00';
    return {
      dtMs:              h.dtMs,
      dtUtc:             h.dtUtc,
      isoHour,
      airTempC:          h.airTempC          ?? null,
      windSpeedKts:      h.windSpeedKts      ?? null,
      windGustKts:       h.windGustKts       ?? null,
      windDeg:           h.windDeg           ?? null,
      cloudCoverPercent: h.cloudCoverPercent ?? null,
      rainLast1hMM:      h.rainLast1hMM      ?? 0,
    };
  });
}

// ── Rain rollup helpers ─────────────────────────────────────────────────────

/**
 * Sum rainLast1hMM for series entries whose dtMs falls within
 * [refMs - windowH*3600000, refMs].  Also count available entries and
 * return a confidence fraction (available / expected).
 */
function aggregateRainWindow(series, refMs, windowH) {
  const cutoffMs = refMs - windowH * 3600000;
  let total = 0;
  let available = 0;

  for (const h of series) {
    if (h.dtMs > cutoffMs && h.dtMs <= refMs) {
      const mm = Number.isFinite(h.rainLast1hMM) ? h.rainLast1hMM : 0;
      total += mm;
      available++;
    }
  }

  return {
    total: Math.round(total * 10) / 10,
    confidence: windowH > 0 ? Math.min(1, available / windowH) : 0,
  };
}

/**
 * Compute rain6hMM, rain24hMM, rain72hMM relative to refMs.
 * Includes the current-hour rain value (currentRain1h) in each window.
 * Confidence is reduced proportionally to how few hours of data are available.
 */
function computeRainRollups(series, currentRain1h, refMs) {
  const cur = Number.isFinite(currentRain1h) ? currentRain1h : 0;

  const w6  = aggregateRainWindow(series, refMs,  6);
  const w24 = aggregateRainWindow(series, refMs, 24);
  const w72 = aggregateRainWindow(series, refMs, 72);

  return {
    rain6hMM:  Math.round((w6.total  + cur) * 10) / 10,
    rain24hMM: Math.round((w24.total + cur) * 10) / 10,
    rain72hMM: Math.round((w72.total + cur) * 10) / 10,
    // Use 6 h window confidence as the primary indicator (most actionable)
    confidence: Math.min(w6.confidence, w24.confidence),
  };
}

// ── Core pipeline ───────────────────────────────────────────────────────────

/**
 * Compute "now" analysis and upcoming 3-hour forecast windows for a spot.
 * Returns { now, windows, hourlySeries }.
 */
async function computeNowAndWindows(spot, spotId, owApiKey) {
  const nowMs   = Date.now();
  const nowDate = new Date(nowMs);

  // Auto-assign coast if not explicitly set on the spot
  const coast = spot.coast || classifySpotCoast(spot.lat, spot.lon);

  // ── Fetch OpenWeather ────────────────────────────────────────────────────
  let owData = { hourly: [], current: null };
  try {
    owData = await fetchOpenWeatherHourly(spot.lat, spot.lon, owApiKey);
  } catch (err) {
    logger.warn(`OpenWeather fetch failed for ${spotId}`, { message: err.message });
  }

  const hourlySeries = buildHourlySeriesForSpot(spot, owData.hourly);

  // ── Fetch buoy data ──────────────────────────────────────────────────────
  const hourKeys = hourlySeries.map((h) => h.isoHour);
  let waveHMap = new Map();
  let wavePMap = new Map();
  let sstMap   = new Map();
  if (spot.buoyStation) {
    try {
      ({ waveHMap, wavePMap, sstMap } = await fetchBuoyHourly({
        station: spot.buoyStation, hourKeys,
      }));
    } catch (err) {
      logger.warn(`Buoy fetch failed for ${spotId}`, { message: err.message });
    }
  }

  // ── "Now" metrics ────────────────────────────────────────────────────────
  // Find the first hourly entry at/after nowMs (or use current if none found)
  const nowIsoHour = nowDate.toISOString().slice(0, 13) + ':00';
  let nowRow = hourlySeries.find((h) => h.dtMs >= nowMs) || hourlySeries[0] || {};

  const windKnots   = nowRow.windSpeedKts ?? (owData.current?.windSpeedKts ?? null);
  const waveHeightM = waveHMap.get(nowRow.isoHour || nowIsoHour) ?? null;
  const waveHeightFt = Number.isFinite(waveHeightM)
    ? Math.round(waveHeightM * 3.28084 * 10) / 10 : null;
  const wavePeriod  = wavePMap.get(nowRow.isoHour || nowIsoHour) ?? null;
  const waterTempC  = sstMap.get(nowRow.isoHour || nowIsoHour)   ?? null;

  // ── Rain rollups for "now" ───────────────────────────────────────────────
  const currentRain1h = owData.current?.rainLast1hMM ?? nowRow.rainLast1hMM ?? 0;
  const rainRollups   = computeRainRollups(hourlySeries, currentRain1h, nowMs);

  // ── Runoff risk for "now" ────────────────────────────────────────────────
  const runoff = analysis.assessRunoffRisk({
    rain6hMM:          rainRollups.rain6hMM,
    rain24hMM:         rainRollups.rain24hMM,
    rain72hMM:         rainRollups.rain72hMM,
    runoffSensitivity: spot.runoffSensitivity  || 'medium',
    nearStreamMouth:   spot.nearStreamMouth    || false,
    nearDrainage:      spot.nearDrainage       || false,
    brownWaterAdvisory: spot.brownWaterAdvisory || false,
    sewageSpillAdvisory: spot.sewageSpillAdvisory || false,
    floodWarning:      spot.floodWarning        || false,
    communityFlags:    spot.communityFlags      || [],
    confidenceIn:      Math.max(0.3, rainRollups.confidence),
  });

  // ── Analysis ─────────────────────────────────────────────────────────────
  const moonData   = await analysis.fetchMoonPhase(nowDate, spot.lat, spot.lon);
  const estCurrent = analysis.estimateCurrentFromWind(windKnots ?? 0);

  const jellyfish = analysis.evaluateJellyfishAndNightDive({
    moonData,
    visibilityMeters:  null,
    currentKnots:      estCurrent,
    waterTempC,
    cloudCoverPercent: nowRow.cloudCoverPercent ?? (owData.current?.cloudCoverPercent ?? null),
  });

  const spotContext = {
    runoffSensitivity: spot.runoffSensitivity || 'medium',
    coast,
    maxCleanSwellFt:   spot.maxCleanSwellFt,
    hardNoGoSwellFt:   spot.hardNoGoSwellFt,
  };

  const visibility = analysis.estimateVisibility({
    windKnots,
    swellFeet:         waveHeightFt,
    swellPeriodSec:    wavePeriod,
    currentKnots:      estCurrent,
    rainLast24hMM:     rainRollups.rain24hMM,
    cloudCoverPercent: nowRow.cloudCoverPercent ?? (owData.current?.cloudCoverPercent ?? null),
    runoff,
  });

  const snorkelRating = analysis.generateSnorkelRating({
    visibilityMeters:  visibility.estimatedVisibilityMeters,
    windKnots,
    swellFeet:         waveHeightFt,
    swellPeriodSec:    wavePeriod,
    currentKnots:      estCurrent,
    waterTempC,
    rainLast24hMM:     rainRollups.rain24hMM,
    spotContext,
    jellyfishWarning:  jellyfish.jellyfishWarning,
    runoff,
  });

  const nowResult = {
    isoUtc: nowDate.toISOString(),
    metrics: {
      windSpeedKts:      windKnots,
      windGustKts:       nowRow.windGustKts       ?? (owData.current?.windGustKts       ?? null),
      windDeg:           nowRow.windDeg           ?? (owData.current?.windDeg           ?? null),
      airTempC:          nowRow.airTempC          ?? (owData.current?.airTempC          ?? null),
      cloudCoverPercent: nowRow.cloudCoverPercent ?? (owData.current?.cloudCoverPercent ?? null),
      waveHeightM,
      waveHeightFt,
      wavePeriodS:       wavePeriod,
      waterTempC,
      rainLast1hMM:      currentRain1h,
    },
    analysis: {
      moon:         moonData,
      jellyfish,
      visibility,
      snorkelRating,
      runoff,
    },
  };

  // ── Windows ───────────────────────────────────────────────────────────────
  const windows = buildWindows({
    hourlySeries,
    nowMs,
    waveHMap, wavePMap, sstMap,
    moonData, spot, coast,
  });

  return {
    now:         nowResult,
    windows,
    hourlySeries: hourlySeries.slice(0, 48),
  };
}

// ── Window builder ──────────────────────────────────────────────────────────

function buildWindows({ hourlySeries, nowMs, waveHMap, wavePMap, sstMap, moonData, spot, coast }) {
  const WINDOW_H   = 3;
  const MAX_WINDOWS = 16; // 48 h
  const windows = [];

  // Future entries only
  const futureHours = hourlySeries.filter((h) => h.dtMs >= nowMs);

  for (let w = 0; w < MAX_WINDOWS; w++) {
    const startIdx = w * WINDOW_H;
    const endIdx   = startIdx + WINDOW_H;
    const slice    = futureHours.slice(startIdx, endIdx);
    if (!slice.length) break;

    const startMs = slice[0].dtMs;
    const endMs   = slice[slice.length - 1].dtMs + 3600000;

    // Average numeric fields over the window
    function avgField(field) {
      const vals = slice.map((h) => h[field]).filter(Number.isFinite);
      return vals.length
        ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10
        : null;
    }

    const avg = {
      airTempC:          avgField('airTempC'),
      windSpeedKts:      avgField('windSpeedKts'),
      windGustKts:       avgField('windGustKts'),
      windDeg:           avgField('windDeg'),
      cloudCoverPercent: avgField('cloudCoverPercent'),
    };

    // Buoy data from the middle hour of the window
    const midHour      = slice[Math.floor(slice.length / 2)];
    const waveHeightM  = waveHMap.get(midHour?.isoHour) ?? null;
    const waveHeightFt = Number.isFinite(waveHeightM)
      ? Math.round(waveHeightM * 3.28084 * 10) / 10 : null;
    const wavePeriod   = wavePMap.get(midHour?.isoHour) ?? null;
    const waterTempC   = sstMap.get(midHour?.isoHour)   ?? null;

    if (Number.isFinite(waveHeightM))  avg.waveHeightM = waveHeightM;
    if (Number.isFinite(wavePeriod))   avg.wavePeriodS = wavePeriod;
    if (Number.isFinite(waterTempC))   avg.waterTempC  = waterTempC;

    // Rain rollups relative to the window start (what will have accumulated by then)
    const winRainRollups = computeRainRollups(hourlySeries, 0, startMs);
    const windowRunoff   = analysis.assessRunoffRisk({
      rain6hMM:          winRainRollups.rain6hMM,
      rain24hMM:         winRainRollups.rain24hMM,
      rain72hMM:         winRainRollups.rain72hMM,
      runoffSensitivity: spot.runoffSensitivity   || 'medium',
      nearStreamMouth:   spot.nearStreamMouth     || false,
      nearDrainage:      spot.nearDrainage        || false,
      brownWaterAdvisory: spot.brownWaterAdvisory  || false,
      sewageSpillAdvisory: spot.sewageSpillAdvisory || false,
      floodWarning:      spot.floodWarning         || false,
      communityFlags:    spot.communityFlags       || [],
      confidenceIn:      Math.max(0.3, winRainRollups.confidence),
    });

    const spotContext = {
      runoffSensitivity: spot.runoffSensitivity || 'medium',
      coast,
      maxCleanSwellFt:   spot.maxCleanSwellFt,
      hardNoGoSwellFt:   spot.hardNoGoSwellFt,
    };

    const estCurrent = analysis.estimateCurrentFromWind(avg.windSpeedKts ?? 0);

    const visibility = analysis.estimateVisibility({
      windKnots:         avg.windSpeedKts,
      swellFeet:         waveHeightFt,
      swellPeriodSec:    wavePeriod,
      currentKnots:      estCurrent,
      cloudCoverPercent: avg.cloudCoverPercent,
      runoff:            windowRunoff,
    });

    const rating = analysis.generateSnorkelRating({
      visibilityMeters: visibility.estimatedVisibilityMeters,
      windKnots:        avg.windSpeedKts,
      swellFeet:        waveHeightFt,
      swellPeriodSec:   wavePeriod,
      currentKnots:     estCurrent,
      waterTempC,
      spotContext,
      jellyfishWarning: false,
      runoff:           windowRunoff,
    });

    windows.push({
      startIso: new Date(startMs).toISOString(),
      endIso:   new Date(endMs).toISOString(),
      avg,
      visibility,
      rating,
      runoff: windowRunoff,
    });
  }

  return windows;
}

// ── Report builder ──────────────────────────────────────────────────────────

async function generateReport(spotId, spot, owApiKey) {
  const coast = spot.coast || classifySpotCoast(spot.lat, spot.lon);
  const { now, windows, hourlySeries } = await computeNowAndWindows(spot, spotId, owApiKey);

  return {
    spot:      spotId,
    spotName:  spot.name,
    spotLat:   spot.lat,
    spotLon:   spot.lon,
    spotCoast: coast,
    generatedAt: new Date().toISOString(),
    now,
    windows,
    hourly: hourlySeries,
  };
}

// ── Firebase Functions ──────────────────────────────────────────────────────

exports.scheduledKaiCast = onSchedule(
  { schedule: 'every 1 hour', secrets: [OW_API_KEY] },
  async () => {
    const apiKey  = OW_API_KEY.value();
    const reports = [];

    for (const [spotId, spot] of Object.entries(SPOTS)) {
      try {
        const report = await generateReport(spotId, spot, apiKey);
        reports.push(report);
        await admin.firestore().collection('reports').doc(spotId).set(report);
        logger.info(`KaiCast report generated for ${spotId}`);
      } catch (err) {
        logger.error(`Failed to generate report for ${spotId}`, { message: err.message });
      }
    }

    if (reports.length) {
      try {
        await pushAllReportsToWebflow({ reports });
      } catch (err) {
        logger.error('Webflow push failed', { message: err.message });
      }
    }
  }
);

exports.getReport = onRequest(
  { secrets: [OW_API_KEY] },
  async (req, res) => {
    const spotId = req.query.spotId || Object.keys(SPOTS)[0];
    const spot   = SPOTS[spotId];

    if (!spot) {
      res.status(404).json({ error: `Unknown spot: ${spotId}` });
      return;
    }

    try {
      const report = await generateReport(spotId, spot, OW_API_KEY.value());
      res.json(report);
    } catch (err) {
      logger.error('getReport failed', { message: err.message });
      res.status(500).json({ error: err.message });
    }
  }
);
