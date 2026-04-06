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
const {
  chooseNoaaTideStationForSpot,
  fetchTideSeries,
} = require('./tides');
const { pushAllReportsToWebflow } = require('./webflow');

// ─── Secrets ─────────────────────────────────────────────────────────────────

const OPENWEATHER_API_KEY = defineSecret('OPENWEATHER_API_KEY');
const WEBFLOW_API_TOKEN   = defineSecret('WEBFLOW_API_TOKEN');
const WEBFLOW_SPOTS_CID   = defineSecret('WEBFLOW_SPOTS_CID');
const WEBFLOW_WINDOWS_CID = defineSecret('WEBFLOW_WINDOWS_CID');

const ALL_SECRETS = [OPENWEATHER_API_KEY, WEBFLOW_API_TOKEN, WEBFLOW_SPOTS_CID, WEBFLOW_WINDOWS_CID];

// ─── Spots ────────────────────────────────────────────────────────────────────
//
// NOTE: These are conservative runoff defaults for Oahu after storms.
// If you want per-spot tuning, add nearStreamMouth/nearDrainage and sensitivity.
// Shark’s Cove / Three Tables behave "north shore rocky coves": brown water can happen after big rain,
// even if surf looks manageable.

const SPOTS = [
  {
    id: 'sharks-cove',
    name: "Shark's Cove",
    lat: 21.6417,
    lon: -158.0617,
    tz: 'Pacific/Honolulu',
    coast: 'north',
    buoyStation: '51201',
    tideStation: '1612340', // NOAA Honolulu Harbor (reference station for all Oahu spots)

    // CHANGED: was 'low' — too optimistic for storm runoff days
    runoffSensitivity: 'medium',
    nearStreamMouth: false,
    nearDrainage: true,

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
    tideStation: '1612340',

    // CHANGED: was 'low'
    runoffSensitivity: 'medium',
    nearStreamMouth: false,
    nearDrainage: true,

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
    tideStation: '1612340',
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
    tideStation: '1612340',
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
    tideStation: '1612340',
    runoffSensitivity: 'low',
    nearStreamMouth: false,
    nearDrainage: false,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
  },
];

// ─── Geographic helpers ───────────────────────────────────────────────────────

function computeSpotCoast(lat, lon) {
  const centerLat = 21.46;
  const centerLon = -157.99;
  const dLat = lat - centerLat;
  const dLon = lon - centerLon;
  const angle = Math.atan2(dLon, dLat) * (180 / Math.PI);
  if (angle >= -45 && angle < 45)   return 'north';
  if (angle >= 45  && angle < 135)  return 'east';
  if (angle >= 135 || angle < -135) return 'south';
  return 'west';
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

function toHourKey(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  return d.toISOString().slice(0, 13) + ':00';
}

function buildHourKey(dateUtc) {
  const d = dateUtc instanceof Date ? dateUtc : new Date(dateUtc);
  return (
    String(d.getUTCFullYear()) +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0') +
    String(d.getUTCHours()).padStart(2, '0')
  );
}

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

// ─── Confidence helper ───────────────────────────────────────────────────────

function computeConfidenceScore({ nowMetrics, buoyData, closestHour }) {
  // 1.0 is "full data". Missing key marine inputs should pull this down.
  let conf = 1.0;

  if (!closestHour) conf -= 0.20; // no openweather hour match
  if (!buoyData || !buoyData.waveHMap?.size) conf -= 0.25; // no buoy wave data
  if (nowMetrics?.waveHeightM == null) conf -= 0.20;
  if (nowMetrics?.wavePeriodS == null) conf -= 0.10;
  if (nowMetrics?.waterTempC == null) conf -= 0.05;

  return Math.max(0.2, Math.min(1.0, Math.round(conf * 100) / 100));
}

// ─── OpenWeather ──────────────────────────────────────────────────────────────

const OWM_BASE = 'https://api.openweathermap.org/data/3.0/onecall';

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

      // IMPORTANT: do not hardcode rain=0 downstream; this value feeds rollups.
      rainLast1hMM:     Number.isFinite(Number(h.rain?.['1h'])) ? Number(h.rain['1h']) : 0,
    };
  }

  const hourly  = (Array.isArray(j.hourly) ? j.hourly : []).map(normalizeItem).filter(Boolean);
  const current = normalizeItem(j.current ?? (j.hourly?.[0] ?? null));
  return { current, hourly };
}

// ─── Window builder ───────────────────────────────────────────────────────────

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

async function buildSpotReport({ spot, owHourly, buoyData, nowMs }) {
  const nowDate    = new Date(nowMs);
  const generatedAt = nowDate.toISOString();
  const hourKey    = buildHourKey(nowDate);

  const coast = spot.coast || computeSpotCoast(spot.lat, spot.lon);

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

  // Tide cycle — select NOAA station for this spot and build the cycle.
  const tideStationId = chooseNoaaTideStationForSpot({ ...spot, coast });
  const rawTideSeries = tideStationId
    ? await fetchTideSeries(tideStationId, nowMs).catch(() => [])
    : [];

  // For cycle selection: prefer a cycle containing nowMs; otherwise nearest to
  // midday local (noon HST = 22:00 UTC).
  const middayUtcHour = 22; // noon Hawaii Standard Time (UTC-10)
  const todayMidday = (() => {
    const d = new Date(nowMs);
    d.setUTCHours(middayUtcHour, 0, 0, 0);
    // If midday has already passed today, use tomorrow's midday
    if (d.getTime() < nowMs) d.setUTCDate(d.getUTCDate() + 1);
    return d.getTime();
  })();

  const nowTideCycle = rawTideSeries.length >= 3
    ? buildTideCycle({
        levelSeries:    rawTideSeries,
        nowMs,
        tz:             spot.tz,
        preferWindowMs: todayMidday,
      })
    : null;

  const tideSourceNote = tideStationId
    ? (rawTideSeries.length ? null : 'NOAA tide fetch returned no data for this station')
    : 'No NOAA tide station configured for this coast — TODO: add station IDs to tides.js';

  // report.tide: nested tide object exposed in JSON output
  const reportTide = {
    ...(nowTideCycle || {}),
    sourceStationId: tideStationId,
    sourceNote:      tideSourceNote,
  };

  // Rain rollups (NOW) — use analysis helper
  const rainRollups = computeRainTotals({ hourlyItems: owHourly.hourly, nowMs });

  const nowRunoff = assessRunoffRisk({
    rain3hMM:  rainRollups.rain3hMM,
    rain6hMM:  rainRollups.rain6hMM,
    rain12hMM: rainRollups.rain12hMM,
    rain24hMM: rainRollups.rain24hMM,
    rain48hMM: rainRollups.rain48hMM,
    rain72hMM: rainRollups.rain72hMM,
    spot: { ...spot, coast },
    windDeg:   nowMetrics.windDeg,
    windKnots: nowMetrics.windSpeedKts,
    tideCycle: nowTideCycle,
  });

  const confidenceScore = computeConfidenceScore({ nowMetrics, buoyData, closestHour });

  const nowLocalHour = nowDate.getUTCHours(); // TODO: convert to spot tz when needed
  const nowSwellFt   = nowMetrics.waveHeightM != null ? nowMetrics.waveHeightM * 3.28084 : null;

  const nowVisibility = estimateVisibility({
    windKnots:         nowMetrics.windSpeedKts,
    swellFeet:         nowSwellFt,
    swellPeriodSec:    nowMetrics.wavePeriodS,
    currentKnots:      estimateCurrentFromWind(nowMetrics.windSpeedKts),
    tidePhase:         nowTideCycle?.currentTideState ?? 'unknown',
    rainLast24hMM:     rainRollups.rain24hMM,
    cloudCoverPercent: nowMetrics.cloudCoverPercent,
    hourLocal:         nowLocalHour,
    runoff:            nowRunoff,
    tide:              nowTideCycle,
  });

  const moonData     = await fetchMoonPhase(nowDate, spot.lat, spot.lon, spot.tz);
  const jellyfishData = evaluateJellyfishAndNightDive({
    moonData,
    visibilityMeters: nowVisibility.estimatedVisibilityMeters,
    currentKnots:     estimateCurrentFromWind(nowMetrics.windSpeedKts),
    waterTempC:       nowMetrics.waterTempC,
    cloudCoverPercent:nowMetrics.cloudCoverPercent,
  });

  const nowRating = generateSnorkelRating({
    visibilityMeters: nowVisibility.estimatedVisibilityMeters,
    windKnots:        nowMetrics.windSpeedKts,
    swellFeet:        nowSwellFt,
    swellPeriodSec:   nowMetrics.wavePeriodS,
    currentKnots:     estimateCurrentFromWind(nowMetrics.windSpeedKts),
    waterTempC:       nowMetrics.waterTempC,
    rainLast24hMM:    rainRollups.rain24hMM,
    tideCycle:        nowTideCycle,
    jellyfishWarning: jellyfishData.jellyfishWarning,
    runoff:           nowRunoff,
    tide:             nowTideCycle,
    confidenceScore,
    spotContext: {
      runoffSensitivity: spot.runoffSensitivity,
      maxCleanSwellFt:   spot.maxCleanSwellFt,
      hardNoGoSwellFt:   spot.hardNoGoSwellFt,
      coast,
    },
  });

  // Merge buoy into hourly for window calculations
  const hourlyWithBuoy = owHourly.hourly.map((h) => ({
    ...h,
    waveHeightM: buoyData?.waveHMap?.get(h.isoHour) ?? null,
    wavePeriodS: buoyData?.wavePMap?.get(h.isoHour) ?? null,
    waterTempC:  buoyData?.sstMap?.get(h.isoHour)   ?? null,
  }));

  const rawWindows = buildWindows(hourlyWithBuoy, nowMs, 8);
  const windows = rawWindows.map((w) => {
    const winStartMs = new Date(w.startIso).getTime();
    const winMidMs   = winStartMs + 1.5 * 3600000;

    // Per-window tide cycle at the window midpoint
    const winTideCycle = rawTideSeries.length >= 3
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

    const winRainRollups = computeRainTotals({ hourlyItems: owHourly.hourly, nowMs: winStartMs });
    const winRunoff = assessRunoffRisk({
      rain3hMM:  winRainRollups.rain3hMM,
      rain6hMM:  winRainRollups.rain6hMM,
      rain12hMM: winRainRollups.rain12hMM,
      rain24hMM: winRainRollups.rain24hMM,
      rain48hMM: winRainRollups.rain48hMM,
      rain72hMM: winRainRollups.rain72hMM,
      spot:      { ...spot, coast },
      windDeg:   w.avg.windDeg,
      windKnots: w.avg.windSpeedKts,
      tideCycle: winTideCycle,
    });

    const winSwellFt   = w.avg.waveHeightM != null ? w.avg.waveHeightM * 3.28084 : null;
    const winLocalHour = new Date(w.startIso).getUTCHours();

    const winVisibility = estimateVisibility({
      windKnots:         w.avg.windSpeedKts,
      swellFeet:         winSwellFt,
      swellPeriodSec:    w.avg.wavePeriodS,
      currentKnots:      estimateCurrentFromWind(w.avg.windSpeedKts),
      tidePhase:         winTideCycle?.currentTideState ?? 'unknown',
      rainLast24hMM:     winRainRollups.rain24hMM,
      cloudCoverPercent: w.avg.cloudCoverPercent,
      hourLocal:         winLocalHour,
      runoff:            winRunoff,
      tide:              winTideCycle,
    });

    const winRating = generateSnorkelRating({
      visibilityMeters: winVisibility.estimatedVisibilityMeters,
      windKnots:        w.avg.windSpeedKts,
      swellFeet:        winSwellFt,
      swellPeriodSec:   w.avg.wavePeriodS,
      currentKnots:     estimateCurrentFromWind(w.avg.windSpeedKts),
      waterTempC:       w.avg.waterTempC,
      rainLast24hMM:    winRainRollups.rain24hMM,
      tideCycle:        winTideCycle,
      jellyfishWarning: jellyfishData.jellyfishWarning,
      runoff:           winRunoff,
      tide:             winTideCycle,

      // Use report-level confidence (keeps conservative if buoy missing)
      confidenceScore,

      spotContext: {
        runoffSensitivity: spot.runoffSensitivity,
        maxCleanSwellFt:   spot.maxCleanSwellFt,
        hardNoGoSwellFt:   spot.hardNoGoSwellFt,
        coast,
      },
    });

    return {
      ...w,
      tide:        winTide,
      rainRollups: winRainRollups,
      runoff:      winRunoff,
      visibility:  winVisibility,
      rating:      winRating,
    };
  });

  const qcFlags = [];
  if (!buoyData || !buoyData.waveHMap?.size) qcFlags.push('no-buoy');
  if (nowMetrics.waterTempC == null) qcFlags.push('missing-sst');
  if (nowMetrics.waveHeightM == null) qcFlags.push('missing-wave-height');
  if (closestHour == null) qcFlags.push('no-openweather-match');
  if (!nowTideCycle) qcFlags.push('no-tide-cycle');

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
      confidenceScore,
      // Nested tide cycle object (12 points); null when tide data unavailable
      tide:        nowTideCycle,
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

  // Warm the fetchTideSeries cache for each unique tideStation.
  // fetchTideSeries has its own 55-min in-memory cache, so these calls
  // deduplicate automatically for spots sharing the same station.
  const seenStations = new Set();
  for (const spot of SPOTS) {
    const stationId = spot.tideStation || chooseNoaaTideStationForSpot(spot);
    if (stationId && !seenStations.has(stationId)) {
      seenStations.add(stationId);
      const series = await fetchTideSeries(stationId, nowMs);
      logger.info('NOAA tide series pre-fetched', { stationId, points: series.length });
    }
  }

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