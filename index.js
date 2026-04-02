/* eslint-env node */
/* global fetch */

const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const { fetchBuoyHourly } = require('./buoy_Version2');
const {
  fetchMoonPhase,
  evaluateJellyfishAndNightDive,
  estimateVisibility,
  generateSnorkelRating,
  estimateCurrentFromWind,
  assessRunoffRisk,
  computeRainTotals,
  buildTideCycle,
} = require('./analysis');
const { pushAllReportsToWebflow } = require('./webflow');
const {
  chooseNoaaTideStationForSpot,
  fetchTideSeries,
} = require('./tides');

// ─── Secrets ─────────────────────────────────────────────────────────────────

const OPENWEATHER_API_KEY = defineSecret('OPENWEATHER_API_KEY');
const WEBFLOW_API_TOKEN   = defineSecret('WEBFLOW_API_TOKEN');
const WEBFLOW_SPOTS_CID   = defineSecret('WEBFLOW_SPOTS_CID');
const WEBFLOW_WINDOWS_CID = defineSecret('WEBFLOW_WINDOWS_CID');

const ALL_SECRETS = [OPENWEATHER_API_KEY, WEBFLOW_API_TOKEN, WEBFLOW_SPOTS_CID, WEBFLOW_WINDOWS_CID];

// ─── Spots ────────────────────────────────────────────────────────────────────

const SPOTS = [
  {
    id: 'sharks-cove',
    name: "Shark's Cove",
    lat: 21.6417,
    lon: -158.0617,
    tz: 'Pacific/Honolulu',
    coast: 'north',
    buoyStation: '51201',
    runoffSensitivity: 'low',
    nearStreamMouth: false,
    nearDrainage: false,
    maxCleanSwellFt: 3,
    hardNoGoSwellFt: 6,
  },
  {
    id: 'three-tables',
    name: 'Three Tables',
    lat: 21.6367,
    lon: -158.0633,
    tz: 'Pacific/Honolulu',
    coast: 'north',
    buoyStation: '51201',
    runoffSensitivity: 'low',
    nearStreamMouth: false,
    nearDrainage: false,
    maxCleanSwellFt: 3,
    hardNoGoSwellFt: 6,
  },
  {
    id: 'mokuleia',
    name: 'Mokuleia',
    lat: 21.5783,
    lon: -158.1553,
    tz: 'Pacific/Honolulu',
    coast: 'north',
    buoyStation: '51201',
    runoffSensitivity: 'medium',
    nearStreamMouth: false,
    nearDrainage: false,
    maxCleanSwellFt: 2,
    hardNoGoSwellFt: 5,
  },
  {
    id: 'makua',
    name: 'Makua Beach',
    lat: 21.527379,
    lon: -158.229536,
    tz: 'Pacific/Honolulu',
    coast: 'west',
    buoyStation: '51202',
    runoffSensitivity: 'high',
    nearStreamMouth: true,
    nearDrainage: false,
    maxCleanSwellFt: 3,
    hardNoGoSwellFt: 6,
  },
  {
    id: 'hanauma-bay',
    name: 'Hanauma Bay',
    lat: 21.2694,
    lon: -157.6939,
    tz: 'Pacific/Honolulu',
    coast: 'south',
    buoyStation: '51202',
    runoffSensitivity: 'low',
    nearStreamMouth: false,
    nearDrainage: false,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
  },
];

// ─── Geographic helpers ───────────────────────────────────────────────────────

/**
 * Derive a coast direction ('north'|'south'|'east'|'west') from a lat/lon
 * using a simple bearing relative to Oahu's geographic center (~21.46, -157.99).
 * Used as a fallback when spot.coast is not defined.
 */
function computeSpotCoast(lat, lon) {
  const centerLat = 21.46;
  const centerLon = -157.99;
  const dLat = lat - centerLat;
  const dLon = lon - centerLon;
  // atan2(dLon, dLat): 0=north, 90=east, ±180=south, -90=west
  const angle = Math.atan2(dLon, dLat) * (180 / Math.PI);
  if (angle >= -45 && angle < 45)   return 'north';
  if (angle >= 45  && angle < 135)  return 'east';
  if (angle >= 135 || angle < -135) return 'south';
  return 'west';
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

/** Truncate a date to its ISO hour bucket, e.g. "2026-03-21T08:00" */
function toHourKey(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  return d.toISOString().slice(0, 13) + ':00';
}

/**
 * Build a compact hour key string "YYYYMMDDHH" for Firestore doc IDs and
 * the saved-at-hour-key Webflow field.
 */
function buildHourKey(dateUtc) {
  const d = dateUtc instanceof Date ? dateUtc : new Date(dateUtc);
  return (
    String(d.getUTCFullYear()) +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0') +
    String(d.getUTCHours()).padStart(2, '0')
  );
}

/**
 * Return the hourly item closest in time to targetMs, or null if all items
 * are further away than maxGapMs (default 2 h).
 */
function findClosestHour(hourlyItems, targetMs, maxGapMs = 2 * 3600000) {
  if (!Array.isArray(hourlyItems) || !hourlyItems.length) return null;
  let best = null;
  let bestDt = Infinity;
  for (const item of hourlyItems) {
    const dt = Math.abs(item.tsMs - targetMs);
    if (dt < bestDt && dt <= maxGapMs) {
      bestDt = dt;
      best = item;
    }
  }
  return best;
}

// ─── Rain rollups ─────────────────────────────────────────────────────────────

/**
 * Compute rolling rainfall totals (6 h, 24 h, 72 h) from an array of hourly
 * items relative to nowMs.
 */
function computeRainRollups(hourlyItems, nowMs) {
  const MS6H  = 6  * 3600000;
  const MS24H = 24 * 3600000;
  const MS72H = 72 * 3600000;
  let rain6h = 0, rain24h = 0, rain72h = 0;

  for (const item of (hourlyItems || [])) {
    if (!item || !Number.isFinite(item.tsMs)) continue;
    const age = nowMs - item.tsMs;
    if (age < 0 || age > MS72H) continue;
    const mm = Number.isFinite(item.rainLast1hMM) ? item.rainLast1hMM : 0;
    if (age <= MS6H)  rain6h  += mm;
    if (age <= MS24H) rain24h += mm;
    rain72h += mm;
  }

  return {
    rain6hMM:  Math.round(rain6h  * 10) / 10,
    rain24hMM: Math.round(rain24h * 10) / 10,
    rain72hMM: Math.round(rain72h * 10) / 10,
  };
}

// ─── OpenWeather ──────────────────────────────────────────────────────────────

const OWM_BASE = 'https://api.openweathermap.org/data/3.0/onecall';

/**
 * Fetch OpenWeather One Call 3.0 for a lat/lon and return normalized hourly items.
 * Field mapping:
 *  airTempC        ← h.temp          (°C, metric)
 *  windSpeedKts    ← h.wind_speed    (m/s → kt, clamped at 80 kt)
 *  windGustKts     ← h.wind_gust     (m/s → kt, clamped at 80 kt)
 *  windDeg         ← h.wind_deg
 *  cloudCoverPercent ← h.clouds
 *  rainLast1hMM    ← h.rain['1h']   (default 0)
 */
async function fetchOpenWeatherHourly({ lat, lon, apiKey }) {
  const url =
    `${OWM_BASE}?lat=${lat}&lon=${lon}` +
    `&exclude=minutely,daily,alerts&units=metric&appid=${apiKey}`;

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
    throw new Error(`OpenWeather error (${r.status}): ${txt}`);
  }

  const j = await r.json();

  function normalizeItem(h) {
    if (!h) return null;
    const windMps = Number(h.wind_speed);
    const gustMps = Number(h.wind_gust ?? h.wind_speed);
    const windKts = Number.isFinite(windMps) ? Math.min(windMps * 1.94384, 80) : null;
    const gustKts = Number.isFinite(gustMps) ? Math.min(gustMps * 1.94384, 80) : null;
    return {
      tsMs:             (h.dt || 0) * 1000,
      isoHour:          toHourKey(new Date((h.dt || 0) * 1000)),
      airTempC:         Number.isFinite(Number(h.temp))      ? Math.round(Number(h.temp) * 10) / 10          : null,
      windSpeedKts:     Number.isFinite(windKts)             ? Math.round(windKts * 10) / 10                 : null,
      windGustKts:      Number.isFinite(gustKts)             ? Math.round(gustKts * 10) / 10                 : null,
      windDeg:          Number.isFinite(Number(h.wind_deg))  ? Number(h.wind_deg)                            : null,
      cloudCoverPercent:Number.isFinite(Number(h.clouds))    ? Number(h.clouds)                              : null,
      rainLast1hMM:     Number.isFinite(Number(h.rain?.['1h'])) ? Number(h.rain['1h'])                       : 0,
    };
  }

  const hourly  = (Array.isArray(j.hourly) ? j.hourly : []).map(normalizeItem).filter(Boolean);
  const current = normalizeItem(j.current ?? (j.hourly?.[0] ?? null));
  return { current, hourly };
}

// ─── Window builder ───────────────────────────────────────────────────────────

/**
 * Build `count` consecutive 3-hour forecast windows starting from the next
 * full 3-hour boundary after nowMs, merging in buoy wave data.
 */
function buildWindows(hourlyItems, nowMs, count = 8) {
  const WINDOW_MS = 3 * 3600000;
  const windows   = [];
  const start0    = Math.ceil(nowMs / WINDOW_MS) * WINDOW_MS;

  function avgField(items, key) {
    const vals = items.map((h) => h[key]).filter(Number.isFinite);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }

  for (let i = 0; i < count; i++) {
    const winStart  = start0 + i * WINDOW_MS;
    const winEnd    = winStart + WINDOW_MS;
    const inWindow  = hourlyItems.filter((h) => h.tsMs >= winStart && h.tsMs < winEnd);

    windows.push({
      startIso: new Date(winStart).toISOString(),
      endIso:   new Date(winEnd).toISOString(),
      avg: {
        airTempC:          avgField(inWindow, 'airTempC'),
        windSpeedKts:      avgField(inWindow, 'windSpeedKts'),
        windGustKts:       avgField(inWindow, 'windGustKts'),
        windDeg:           avgField(inWindow, 'windDeg'),
        cloudCoverPercent: avgField(inWindow, 'cloudCoverPercent'),
        rainLast1hMM:      avgField(inWindow, 'rainLast1hMM'),
        waveHeightM:       avgField(inWindow, 'waveHeightM'),
        wavePeriodS:       avgField(inWindow, 'wavePeriodS'),
        waterTempC:        avgField(inWindow, 'waterTempC'),
      },
    });
  }
  return windows;
}

// ─── Report builder ───────────────────────────────────────────────────────────

/**
 * Build a complete report for a single spot.
 * @param {object} opts
 * @param {object} opts.spot        - spot config
 * @param {object} opts.owHourly    - { current, hourly } from fetchOpenWeatherHourly
 * @param {object|null} opts.buoyData - { waveHMap, wavePMap, sstMap } from fetchBuoyHourly
 * @param {number} opts.nowMs       - current time in ms
 */
async function buildSpotReport({ spot, owHourly, buoyData, nowMs }) {
  const nowDate    = new Date(nowMs);
  const generatedAt = nowDate.toISOString();
  const hourKey    = buildHourKey(nowDate);

  // Coast fallback
  const coast = spot.coast || computeSpotCoast(spot.lat, spot.lon);

  // ── NOW metrics ────────────────────────────────────────────────────────────
  const closestHour = findClosestHour(owHourly.hourly, nowMs);
  const nowHourIso  = toHourKey(nowDate);
  const nowMetrics  = {
    airTempC:          closestHour?.airTempC          ?? null,
    windSpeedKts:      closestHour?.windSpeedKts      ?? null,
    windGustKts:       closestHour?.windGustKts       ?? null,
    windDeg:           closestHour?.windDeg           ?? null,
    cloudCoverPercent: closestHour?.cloudCoverPercent ?? null,
    rainLast1hMM:      closestHour?.rainLast1hMM      ?? 0,
    waveHeightM:       buoyData?.waveHMap?.get(nowHourIso) ?? null,
    wavePeriodS:       buoyData?.wavePMap?.get(nowHourIso) ?? null,
    waterTempC:        buoyData?.sstMap?.get(nowHourIso)   ?? null,
  };

  // ── Rain rollups ───────────────────────────────────────────────────────────
  const rainRollups = computeRainTotals({ hourlyItems: owHourly.hourly, nowMs });

  // ── Runoff (NOW) ───────────────────────────────────────────────────────────
  const nowRunoff = assessRunoffRisk({
    rain6hMM:  rainRollups.rain6hMM,
    rain24hMM: rainRollups.rain24hMM,
    rain72hMM: rainRollups.rain72hMM,
    spot,
  });

  // ── Tide (NOW) ─────────────────────────────────────────────────────────────
  const tideStationId = chooseNoaaTideStationForSpot({ ...spot, coast });
  const rawTideSeries = tideStationId
    ? await fetchTideSeries(tideStationId, nowMs).catch(() => [])
    : [];

  // Prefer cycle containing nowMs; otherwise nearest to midday local (noon HST = 22:00 UTC)
  const middayUtcHour = 22;
  const todayMidday = (() => {
    const d = new Date(nowMs);
    d.setUTCHours(middayUtcHour, 0, 0, 0);
    if (d.getTime() < nowMs) d.setUTCDate(d.getUTCDate() + 1);
    return d.getTime();
  })();

  const tideCycle = buildTideCycle({
    levelSeries:    rawTideSeries,
    nowMs,
    tz:             spot.tz,
    preferWindowMs: todayMidday,
  });

  const tideSourceNote = tideStationId
    ? (rawTideSeries.length ? null : 'NOAA tide fetch returned no data for this station')
    : 'No NOAA tide station configured for this coast — TODO: add station IDs to tides.js';

  const reportTide = {
    ...(tideCycle || {}),
    sourceStationId: tideStationId,
    sourceNote:      tideSourceNote,
  };

  // ── Visibility (NOW) ───────────────────────────────────────────────────────
  const nowLocalHour = nowDate.getUTCHours(); // TODO: convert to spot tz when needed
  const nowSwellFt   = nowMetrics.waveHeightM != null ? nowMetrics.waveHeightM * 3.28084 : null;
  const nowVisibility = estimateVisibility({
    windKnots:        nowMetrics.windSpeedKts,
    swellFeet:        nowSwellFt,
    swellPeriodSec:   nowMetrics.wavePeriodS,
    currentKnots:     estimateCurrentFromWind(nowMetrics.windSpeedKts),
    rainLast24hMM:    rainRollups.rain24hMM,
    cloudCoverPercent:nowMetrics.cloudCoverPercent,
    hourLocal:        nowLocalHour,
    runoff:           nowRunoff,
    tide:             tideCycle,
  });

  // ── Moon & jellyfish (NOW) ─────────────────────────────────────────────────
  const moonData     = await fetchMoonPhase(nowDate, spot.lat, spot.lon, spot.tz);
  const jellyfishData = evaluateJellyfishAndNightDive({
    moonData,
    visibilityMeters: nowVisibility.estimatedVisibilityMeters,
    currentKnots:     estimateCurrentFromWind(nowMetrics.windSpeedKts),
    waterTempC:       nowMetrics.waterTempC,
    cloudCoverPercent:nowMetrics.cloudCoverPercent,
  });

  // ── Rating (NOW) ───────────────────────────────────────────────────────────
  const nowRating = generateSnorkelRating({
    visibilityMeters: nowVisibility.estimatedVisibilityMeters,
    windKnots:        nowMetrics.windSpeedKts,
    swellFeet:        nowSwellFt,
    swellPeriodSec:   nowMetrics.wavePeriodS,
    currentKnots:     estimateCurrentFromWind(nowMetrics.windSpeedKts),
    waterTempC:       nowMetrics.waterTempC,
    rainLast24hMM:    rainRollups.rain24hMM,
    jellyfishWarning: jellyfishData.jellyfishWarning,
    runoff:           nowRunoff,
    tide:             tideCycle,
    spotContext: {
      runoffSensitivity: spot.runoffSensitivity,
      maxCleanSwellFt:   spot.maxCleanSwellFt,
      hardNoGoSwellFt:   spot.hardNoGoSwellFt,
      coast,
    },
  });

  // ── Windows ────────────────────────────────────────────────────────────────
  // Merge buoy data into hourly for window calculations
  const hourlyWithBuoy = owHourly.hourly.map((h) => ({
    ...h,
    waveHeightM: buoyData?.waveHMap?.get(h.isoHour) ?? null,
    wavePeriodS: buoyData?.wavePMap?.get(h.isoHour) ?? null,
    waterTempC:  buoyData?.sstMap?.get(h.isoHour)   ?? null,
  }));

  const rawWindows = buildWindows(hourlyWithBuoy, nowMs, 8);
  const windows = rawWindows.map((w) => {
    const winStartMs      = new Date(w.startIso).getTime();
    const winEndMs        = new Date(w.endIso).getTime();
    const winMidMs        = Math.round((winStartMs + winEndMs) / 2);
    const winRainRollups  = computeRainTotals({ hourlyItems: owHourly.hourly, nowMs: winStartMs });
    const winRunoff       = assessRunoffRisk({
      rain6hMM:  winRainRollups.rain6hMM,
      rain24hMM: winRainRollups.rain24hMM,
      rain72hMM: winRainRollups.rain72hMM,
      spot,
    });

    // Tide at window midpoint
    const winTideCycle = rawTideSeries.length
      ? buildTideCycle({
          levelSeries:    rawTideSeries,
          nowMs:          winMidMs,
          tz:             spot.tz,
          preferWindowMs: winMidMs,
        })
      : null;
    const winTide = winTideCycle
      ? { tideState: winTideCycle.currentTideState, tideHeight: winTideCycle.currentTideHeight }
      : { tideState: null, tideHeight: null };

    const winSwellFt      = w.avg.waveHeightM != null ? w.avg.waveHeightM * 3.28084 : null;
    const winLocalHour    = new Date(w.startIso).getUTCHours();
    const winVisibility   = estimateVisibility({
      windKnots:        w.avg.windSpeedKts,
      swellFeet:        winSwellFt,
      swellPeriodSec:   w.avg.wavePeriodS,
      currentKnots:     estimateCurrentFromWind(w.avg.windSpeedKts),
      rainLast24hMM:    winRainRollups.rain24hMM,
      cloudCoverPercent:w.avg.cloudCoverPercent,
      hourLocal:        winLocalHour,
      runoff:           winRunoff,
      tide:             winTideCycle,
    });
    const winRating = generateSnorkelRating({
      visibilityMeters: winVisibility.estimatedVisibilityMeters,
      windKnots:        w.avg.windSpeedKts,
      swellFeet:        winSwellFt,
      swellPeriodSec:   w.avg.wavePeriodS,
      currentKnots:     estimateCurrentFromWind(w.avg.windSpeedKts),
      waterTempC:       w.avg.waterTempC,
      rainLast24hMM:    winRainRollups.rain24hMM,
      jellyfishWarning: jellyfishData.jellyfishWarning,
      runoff:           winRunoff,
      tide:             winTideCycle,
      spotContext: {
        runoffSensitivity: spot.runoffSensitivity,
        maxCleanSwellFt:   spot.maxCleanSwellFt,
        hardNoGoSwellFt:   spot.hardNoGoSwellFt,
        coast,
      },
    });

    return {
      ...w,
      tide:       winTide,
      runoff:     winRunoff,
      visibility: winVisibility,
      rating:     winRating,
    };
  });

  // ── QC flags ───────────────────────────────────────────────────────────────
  const qcFlags = [];
  if (!buoyData || !buoyData.waveHMap?.size) qcFlags.push('no-buoy');
  if (nowMetrics.waterTempC == null) qcFlags.push('missing-sst');
  if (nowMetrics.waveHeightM == null) qcFlags.push('missing-wave-height');
  if (closestHour == null) qcFlags.push('no-openweather-match');

  // ── Sources ────────────────────────────────────────────────────────────────
  const sources = ['openweather'];
  if (spot.buoyStation && buoyData?.waveHMap?.size) sources.push(`ndbc:${spot.buoyStation}`);
  if (tideStationId && rawTideSeries.length) sources.push(`noaa-tides:${tideStationId}`);

  return {
    spot:       spot.id,
    spotName:   spot.name,
    spotLat:    spot.lat,
    spotLon:    spot.lon,
    spotCoast:  coast,
    generatedAt,
    hourKey,
    sources,
    qcFlags,
    tide: reportTide,
    now: {
      metrics:     nowMetrics,
      rainRollups,
      analysis: {
        moon:     moonData,
        jellyfish:jellyfishData,
        runoff:   nowRunoff,
      },
      visibility: nowVisibility,
      rating:     nowRating,
    },
    windows,
  };
}

// ─── Core pipeline ────────────────────────────────────────────────────────────

async function runPipeline({ apiKey, publish = false }) {
  const nowMs = Date.now();
  logger.info('KaiCast pipeline start', { nowMs, publish, spots: SPOTS.length });

  const reports = [];
  for (const spot of SPOTS) {
    try {
      const owHourly = await fetchOpenWeatherHourly({ lat: spot.lat, lon: spot.lon, apiKey });
      const hourKeys = owHourly.hourly.map((h) => h.isoHour);
      const buoyData = spot.buoyStation
        ? await fetchBuoyHourly({ station: spot.buoyStation, hourKeys }).catch(() => null)
        : null;

      const report = await buildSpotReport({ spot, owHourly, buoyData, nowMs });
      reports.push(report);

      const docId = `${spot.id}_${report.hourKey}`;
      await db.collection('kaicast_reports').doc(docId).set({
        ...report,
        savedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info('Saved report', { spotId: spot.id, docId });
    } catch (spotErr) {
      logger.error('Error processing spot', { spotId: spot.id, error: spotErr.message });
    }
  }

  if (publish && reports.length > 0) {
    try {
      await pushAllReportsToWebflow({ reports });
      logger.info('Webflow push completed', { count: reports.length });
    } catch (wfErr) {
      logger.error('Webflow push failed', { error: wfErr.message });
    }
  }

  return reports;
}

// ─── Firebase Functions ───────────────────────────────────────────────────────

exports.fetchKaiCastNow = onRequest(
  { secrets: ALL_SECRETS, timeoutSeconds: 300, memory: '512MiB' },
  async (req, res) => {
    try {
      const apiKey = OPENWEATHER_API_KEY.value();
      if (!apiKey) {
        res.status(500).json({ error: 'OPENWEATHER_API_KEY is not configured' });
        return;
      }
      const publish = req.query.publish === 'true' || req.query.publish === '1';
      const reports = await runPipeline({ apiKey, publish });
      res.json({ ok: true, reports: reports.length, generatedAt: new Date().toISOString() });
    } catch (err) {
      logger.error('fetchKaiCastNow failed', { error: err.message });
      res.status(500).json({ error: err.message });
    }
  }
);

exports.scheduler = onSchedule(
  {
    schedule:      'every 1 hours',
    timeZone:      'Pacific/Honolulu',
    secrets:       ALL_SECRETS,
    timeoutSeconds:300,
    memory:        '512MiB',
  },
  async () => {
    const apiKey = OPENWEATHER_API_KEY.value();
    if (!apiKey) {
      logger.error('scheduler: OPENWEATHER_API_KEY is not configured');
      return;
    }
    await runPipeline({ apiKey, publish: true });
  }
);
