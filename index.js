/* eslint-env node */
/* global fetch */

const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");

const analysis = require("./analysis");
const webflow = require("./webflow");
const buoy = require("./buoy_Version2");

const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ----------------------------
// Global options
// ----------------------------
setGlobalOptions({
  region: "us-west2",
  maxInstances: 10,
});

// ----------------------------
// Spots (add/edit freely)
// ----------------------------
const SPOTS = [
  { id: "sharks-cove", name: "Sharks Cove", lat: 21.6604, lon: -158.0566, tz: "Pacific/Honolulu", runoffSensitivity: "low" },
  { id: "waimea-bay", name: "Waimea Bay", lat: 21.6395, lon: -158.0633, tz: "Pacific/Honolulu", runoffSensitivity: "low" },
  { id: "electric-beach", name: "Electric Beach", lat: 21.3576, lon: -158.1277, tz: "Pacific/Honolulu", runoffSensitivity: "medium" },
  { id: "turtle-canyon", name: "Turtle Canyon", lat: 21.2687, lon: -157.8232, tz: "Pacific/Honolulu", runoffSensitivity: "medium" },

  {
    id: "china-walls",
    name: "China Walls",
    lat: 21.261263,
    lon: -157.711686,
    tz: "Pacific/Honolulu",
    coast: "south",
    runoffSensitivity: "low",
    maxCleanSwellFt: 3,
    hardNoGoSwellFt: 5,
  },
  {
    id: "mokuleia",
    name: "Mokulia",
    lat: 21.583503,
    lon: -158.207759,
    tz: "Pacific/Honolulu",
    coast: "north",
    runoffSensitivity: "high",
    maxCleanSwellFt: 2,
    hardNoGoSwellFt: 4,
  },
  {
    id: "makua",
    name: "Mkua Beach",
    lat: 21.527379,
    lon: -158.229536,
    tz: "Pacific/Honolulu",
    coast: "west",
    runoffSensitivity: "high",
    maxCleanSwellFt: 3,
    hardNoGoSwellFt: 6,
  },
];

// ----------------------------
// BUOY MAP
// ----------------------------
const BUOY_MAP = {
  // 'china-walls': 'xxxx',
  // 'mokuleia': 'yyyy',
  // 'makua': 'zzzz',
};

// ----------------------------
// Small utils
// ----------------------------
function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

function parseIntSafe(v, fallback) {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseBool(v, fallback = false) {
  if (v == null) return fallback;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "t", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "f", "no", "n", "off"].includes(s)) return false;
  return fallback;
}

// Build an hour key in a given IANA timezone as YYYYMMDDHH (local hour)
function formatHourKeyForTz(date = new Date(), tz = "Pacific/Honolulu") {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return `${map.year}${map.month}${map.day}${map.hour}`;
}

// Get local hour (0-23) for a given ISO time or Date object in an IANA timezone
function getLocalHour(isoOrDate, tz = "Pacific/Honolulu") {
  const date = (typeof isoOrDate === "string") ? new Date(isoOrDate) : isoOrDate;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return Number(map.hour);
}

// Small concurrency helper: run async function over array in batches
async function mapWithConcurrency(arr, limit, fn) {
  const results = [];
  for (let i = 0; i < arr.length; i += limit) {
    const chunk = arr.slice(i, i + limit);
    const r = await Promise.all(chunk.map(fn));
    results.push(...r);
  }
  return results;
}

// ----------------------------
// Fetch helper with timeout + retry/backoff
// ----------------------------
async function fetchWithRetry(url, opts = {}, timeoutMs = 10000, retries = 2) {
  let attempt = 0;
  let lastErr = null;

  while (attempt <= retries) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(id);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${body}`);
      }
      return res;
    } catch (err) {
      clearTimeout(id);
      lastErr = err;
      attempt++;
      if (attempt > retries) break;
      const backoff = Math.pow(2, attempt) * 300 + Math.floor(Math.random() * 200);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  throw new Error(`fetchWithRetry failed for ${url}: ${lastErr ? lastErr.message : "<unknown>"}`);
}

// ----------------------------
// Time helpers: produce UTC hour-range array (for query keys)
// ----------------------------
function hoursRange(now, hoursAhead) {
  const start = new Date(now);
  start.setUTCMinutes(0, 0, 0);
  const out = [];
  for (let i = 0; i <= hoursAhead; i++) out.push(new Date(start.getTime() + i * 3600_000));
  return out;
}

function toHourlyMap(timeArr, valArr) {
  const m = new Map();
  if (!Array.isArray(timeArr) || !Array.isArray(valArr)) return m;
  for (let i = 0; i < timeArr.length; i++) m.set(timeArr[i], valArr[i]);
  return m;
}

// ----------------------------
// Data Sources
// ----------------------------
async function fetchOpenWeatherHourly({ lat, lon, hoursAhead, apiKey }) {
  if (!apiKey) return { hourly: [] };

  const url =
    `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}` +
    `&exclude=minutely,daily,alerts&units=metric&appid=${apiKey}`;

  const r = await fetchWithRetry(url, {}, 12000, 2);
  const j = await r.json();

  const hourly = (j.hourly || []).slice(0, hoursAhead + 1).map((h) => ({
    timeIso: new Date(h.dt * 1000).toISOString().slice(0, 13) + ":00",
    airTempC: h.temp ?? null,
    windSpeedKts: h.wind_speed != null ? (h.wind_speed * 1.94384) : null,
    windGustKts: h.wind_gust != null ? (h.wind_gust * 1.94384) : null,
    windDeg: h.wind_deg ?? null,
    cloudCoverPercent: h.clouds ?? null,
    rainLast1hMM: h.rain?.["1h"] ?? 0,
    lightningRisk: false,
  }));

  return { hourly };
}

async function fetchOpenMeteoMarineHourly({ lat, lon, hoursAhead }) {
  const url =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}` +
    `&hourly=wave_height,wave_period,sea_surface_temperature,sea_level_height_msl,ocean_current_velocity` +
    `&forecast_hours=${hoursAhead}` +
    `&timezone=UTC&timeformat=iso8601&cell_selection=sea&velocity_unit=knots`;

  const r = await fetchWithRetry(url, {}, 12000, 2);
  const j = await r.json();

  const time = j?.hourly?.time || [];
  const waveH = j?.hourly?.wave_height || [];
  const waveP = j?.hourly?.wave_period || [];
  const sst = j?.hourly?.sea_surface_temperature || [];
  const seaLvl = j?.hourly?.sea_level_height_msl || [];
  const curKts = j?.hourly?.ocean_current_velocity || [];

  return {
    time,
    waveHMap: toHourlyMap(time, waveH),
    wavePMap: toHourlyMap(time, waveP),
    sstMap: toHourlyMap(time, sst),
    seaLvlMap: toHourlyMap(time, seaLvl),
    curMap: toHourlyMap(time, curKts),
  };
}

// ----------------------------
// Build hourly series per spot (with buoy preference)
// ----------------------------
async function buildHourlySeriesForSpot({ spot, hoursAhead, openWeatherKey }) {
  const now = new Date();
  const hourKeys = hoursRange(now, hoursAhead).map((d) => d.toISOString().slice(0, 13) + ":00");

  const [ow, marine] = await Promise.all([
    fetchOpenWeatherHourly({ lat: spot.lat, lon: spot.lon, hoursAhead, apiKey: openWeatherKey }).catch((e) => {
      logger.warn(`OpenWeather error for ${spot.id}: ${e.message}`);
      return { hourly: [] };
    }),
    fetchOpenMeteoMarineHourly({ lat: spot.lat, lon: spot.lon, hoursAhead }).catch((e) => {
      logger.warn(`Open-Meteo Marine error for ${spot.id}: ${e.message}`);
      return { time: [], waveHMap: new Map(), wavePMap: new Map(), sstMap: new Map(), seaLvlMap: new Map(), curMap: new Map() };
    }),
  ]);

  // Buoy preference if configured
  try {
    const buoyStation = BUOY_MAP[spot.id];
    if (buoyStation) {
      const buoyMaps = await buoy.fetchBuoyHourly({ station: buoyStation, hourKeys });
      for (const iso of hourKeys) {
        const bHv = buoyMaps.waveHMap.get(iso);
        if (bHv != null) marine.waveHMap.set(iso, bHv);
        const bPer = buoyMaps.wavePMap.get(iso);
        if (bPer != null) marine.wavePMap.set(iso, bPer);
        const bT = buoyMaps.sstMap.get(iso);
        if (bT != null) marine.sstMap.set(iso, bT);
      }
    }
  } catch (e) {
    logger.warn(`Buoy fetch failed for ${spot.id}: ${e.message}`);
  }

  const owMap = new Map();
  for (const h of (ow.hourly || [])) owMap.set(h.timeIso, h);

  return hourKeys.map((iso) => {
    const owH = owMap.get(iso) || {};
    return {
      timeIso: iso,
      airTempC: owH.airTempC ?? null,
      windSpeedKts: owH.windSpeedKts ?? null,
      windGustKts: owH.windGustKts ?? null,
      windDeg: owH.windDeg ?? null,
      cloudCoverPercent: owH.cloudCoverPercent ?? null,
      rainLast1hMM: owH.rainLast1hMM ?? 0,
      lightningRisk: owH.lightningRisk ?? false,

      waveHeightM: marine.waveHMap.get(iso) ?? null,
      wavePeriodS: marine.wavePMap.get(iso) ?? null,
      waterTempC: marine.sstMap.get(iso) ?? null,
      seaLevelM: marine.seaLvlMap.get(iso) ?? null,
      oceanCurrentKts: marine.curMap.get(iso) ?? null,
    };
  });
}

// ----------------------------
// Helpers: data completeness
// ----------------------------
function computeReportCompleteness({ now, windows }) {
  const totalNowChecks = 4;
  let nowPresent = 0;
  if (now && now.metrics) {
    if (now.metrics.waterTempC != null) nowPresent++;
    if (now.metrics.waveHeightM != null) nowPresent++;
    if (now.metrics.seaLevelM != null) nowPresent++;
    if (now.metrics.currentKnots != null) nowPresent++;
  }
  const nowScore = nowPresent / totalNowChecks;

  let windowScores = [];
  if (Array.isArray(windows) && windows.length) {
    for (const w of windows) {
      let present = 0;
      const total = 4;
      if (w.avg.waterTempC != null) present++;
      if (w.avg.waveHeightM != null) present++;
      if (w.avg.currentKnots != null) present++;
      if (w.visibility && w.visibility.estimatedVisibilityMeters != null) present++;
      windowScores.push(present / total);
    }
  }
  const windowScore = windowScores.length ? (windowScores.reduce((a, b) => a + b, 0) / windowScores.length) : 0;
  const overall = Math.round(((0.6 * nowScore) + (0.4 * windowScore)) * 100) / 100;
  return { nowScore, windowScore, overall };
}

// ----------------------------
// Compute NOW + WINDOWS for a spot using analysis.js
// ----------------------------
function computeNowAndWindows({ spot, hourlySeries }) {
  const now = new Date();
  const nowIsoHour = now.toISOString().slice(0, 13) + ":00";

  const tideLevels = hourlySeries
    .filter((h) => h.seaLevelM != null)
    .map((h) => ({
      tsMs: new Date(h.timeIso).getTime(),
      levelFt: h.seaLevelM * 3.28084,
    }));

  const current = hourlySeries.find((h) => h.timeIso === nowIsoHour) || hourlySeries[0] || {};

  const currentKnots =
    (current?.oceanCurrentKts != null ? current.oceanCurrentKts : null) ??
    analysis.estimateCurrentFromWind(current?.windSpeedKts ?? 0);

  const tidePhase = tideLevels.length >= 3
    ? analysis.classifyTidePhase(tideLevels, new Date(nowIsoHour).getTime())
    : "unknown";

  const swellFeet = current?.waveHeightM != null ? current.waveHeightM * 3.28084 : null;
  const swellPeriodSec = current?.wavePeriodS ?? null;

  const hourLocalNow = getLocalHour(nowIsoHour, spot?.tz || "Pacific/Honolulu");

  const visibility = analysis.estimateVisibility({
    windKnots: current?.windSpeedKts,
    swellFeet,
    swellPeriodSec,
    currentKnots,
    tidePhase,
    rainLast24hMM: null,
    turbidityNTU: null,
    cloudCoverPercent: current?.cloudCoverPercent,
    hourLocal: hourLocalNow,
  });

  const moonData = analysis.computeLocalMoonPhase(now);

  const jelly = analysis.evaluateJellyfishAndNightDive({
    moonData,
    visibilityMeters: visibility.estimatedVisibilityMeters,
    currentKnots,
    waterTempC: current?.waterTempC ?? null,
    cloudCoverPercent: current?.cloudCoverPercent ?? null,
  });

  let present = 0;
  let total = 0;
  if (current?.waveHeightM != null) present++; total++;
  if (current?.wavePeriodS != null) present++; total++;
  if (current?.waterTempC != null) present++; total++;
  if (current?.oceanCurrentKts != null) present++; total++;
  const confidenceScore = total === 0 ? 0.3 : Math.max(0.3, present / total);

  const spotContext = {
    runoffSensitivity: spot.runoffSensitivity || "medium",
    maxCleanSwellFt: (typeof spot.maxCleanSwellFt === "number") ? spot.maxCleanSwellFt : null,
    hardNoGoSwellFt: (typeof spot.hardNoGoSwellFt === "number") ? spot.hardNoGoSwellFt : null,
    coast: spot.coast || null,
  };

  const rating = analysis.generateSnorkelRating({
    visibilityMeters: visibility.estimatedVisibilityMeters,
    windKnots: current?.windSpeedKts ?? 0,
    swellFeet,
    swellPeriodSec: swellPeriodSec ?? 10,
    currentKnots,
    tidePhase,
    waterTempC: current?.waterTempC ?? null,
    lightningRisk: current?.lightningRisk ?? false,
    rainLast24hMM: null,
    spotContext,
    jellyfishWarning: jelly.jellyfishWarning,
    confidenceScore,
  });

  const windowSizeHours = 3;
  const windows = [];

  for (let startIdx = 0; startIdx < hourlySeries.length; startIdx += windowSizeHours) {
    const slice = hourlySeries.slice(startIdx, startIdx + windowSizeHours);
    if (!slice.length) continue;

    const avg = (arr) => {
      const vals = arr.filter((x) => Number.isFinite(x));
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };

    const avgWind = avg(slice.map((h) => h.windSpeedKts));
    const avgWaveM = avg(slice.map((h) => h.waveHeightM));
    const avgWaveP = avg(slice.map((h) => h.wavePeriodS));
    const avgTemp = avg(slice.map((h) => h.waterTempC));
    const avgAirTemp = avg(slice.map((h) => h.airTempC));
    const avgGust = avg(slice.map((h) => h.windGustKts));
    const avgWindDeg = avg(slice.map((h) => h.windDeg));

    // IMPORTANT: always compute current with fallback, per-hour, then average.
    const avgCurrent = avg(slice.map((h) =>
      (h.oceanCurrentKts != null ? h.oceanCurrentKts : analysis.estimateCurrentFromWind(h.windSpeedKts ?? 0))
    ));

    const midTs = new Date(slice[Math.floor(slice.length / 2)].timeIso).getTime();
    const windowTidePhase = tideLevels.length >= 3 ? analysis.classifyTidePhase(tideLevels, midTs) : "unknown";

    const windowHourLocal = getLocalHour(slice[0].timeIso, spot?.tz || "Pacific/Honolulu");

    const windowVisibility = analysis.estimateVisibility({
      windKnots: avgWind,
      swellFeet: avgWaveM != null ? avgWaveM * 3.28084 : null,
      swellPeriodSec: avgWaveP ?? 10,
      currentKnots: avgCurrent,
      tidePhase: windowTidePhase,
      cloudCoverPercent: avg(slice.map((h) => h.cloudCoverPercent)),
      hourLocal: windowHourLocal,
    });

    let wPresent = 0; let wTotal = 0;
    if (avgWaveM != null) wPresent++; wTotal++;
    if (avgWaveP != null) wPresent++; wTotal++;
    if (avgTemp != null) wPresent++; wTotal++;
    if (avgCurrent != null) wPresent++; wTotal++;
    const wConfidence = wTotal === 0 ? 0.3 : Math.max(0.3, wPresent / wTotal);

    const windowRating = analysis.generateSnorkelRating({
      visibilityMeters: windowVisibility.estimatedVisibilityMeters,
      windKnots: avgWind ?? 0,
      swellFeet: avgWaveM != null ? avgWaveM * 3.28084 : null,
      swellPeriodSec: avgWaveP ?? 10,
      currentKnots: avgCurrent ?? 0.5,
      tidePhase: windowTidePhase,
      waterTempC: avgTemp ?? null,
      lightningRisk: slice.some((h) => !!h.lightningRisk),
      spotContext,
      confidenceScore: wConfidence,
    });

    const windowObj = {
      startIso: slice[0].timeIso,
      endIso: slice[slice.length - 1].timeIso,
      avg: {
        airTempC: avgAirTemp != null ? Math.round(avgAirTemp * 10) / 10 : null,
        windSpeedKts: avgWind != null ? Math.round(avgWind * 10) / 10 : null,
        windGustKts: avgGust != null ? Math.round(avgGust * 10) / 10 : null,
        windDeg: avgWindDeg,
        waveHeightM: avgWaveM != null ? Math.round(avgWaveM * 100) / 100 : null,
        wavePeriodS: avgWaveP != null ? Math.round(avgWaveP * 10) / 10 : null,
        waterTempC: avgTemp != null ? Math.round(avgTemp * 10) / 10 : null,
        currentKnots: avgCurrent != null ? Math.round(avgCurrent * 10) / 10 : null,
        tidePhase: windowTidePhase,
      },
      visibility: windowVisibility,
      rating: windowRating,
    };

    windows.push(windowObj);
  }

  const legacyWindowDetails = windows.map((w) => ({
    startIso: w.startIso,
    endIso: w.endIso,
    avg: {
      windSpeedKts: w.avg.windSpeedKts,
      waveHeightM: w.avg.waveHeightM,
      dominantPeriodS: w.avg.wavePeriodS,
      waterTempC: w.avg.waterTempC,
      currentKnots: w.avg.currentKnots,
      tidePhase: w.avg.tidePhase,
    },
    visibility: w.visibility,
    rating: w.rating,
  }));

  const out = {
    now: {
      timeIso: now.toISOString(),
      metrics: {
        airTempC: current?.airTempC ?? null,
        windSpeedKts: current?.windSpeedKts ?? null,
        windGustKts: current?.windGustKts ?? null,
        windDeg: current?.windDeg ?? null,
        waterTempC: current?.waterTempC ?? null,
        waveHeightM: current?.waveHeightM ?? null,
        dominantPeriodS: current?.wavePeriodS ?? null,
        seaLevelM: current?.seaLevelM ?? null,
        currentKnots,
        tidePhase,
        cloudCoverPercent: current?.cloudCoverPercent ?? null,
      },
      analysis: {
        moon: moonData,
        visibility,
        rating,
        jellyfish: jelly,
        confidenceScore,
      },
    },
    windows,
    legacyWindowDetails,
  };

  out.meta = { completeness: computeReportCompleteness({ now: out.now, windows: out.windows }) };
  return out;
}

// ----------------------------
// Build report per spot
// ----------------------------
async function buildReportForSpot({ spot, hoursAhead, openWeatherKey }) {
  const hourlySeries = await buildHourlySeriesForSpot({ spot, hoursAhead, openWeatherKey });
  const computed = computeNowAndWindows({ spot, hourlySeries });

  return {
    spot: spot.id,
    spotName: spot.name,
    spotLat: spot.lat,
    spotLon: spot.lon,
    spotCoast: spot.coast || null,
    generatedAt: new Date().toISOString(),
    now: computed.now,
    windows: computed.windows,
    analysis: { windowDetails: computed.legacyWindowDetails },
    hourly: hourlySeries,
  };
}

// ----------------------------
// HTTPS
// ----------------------------
exports.fetchKaiCastNow = onRequest(
  {
    timeoutSeconds: 180,
    memory: "256MiB",
    maxInstances: 5,
    secrets: ["WEBFLOW_API_TOKEN", "WEBFLOW_SPOTS_CID", "WEBFLOW_WINDOWS_CID"],
  },
  async (req, res) => {
    try {
      const spotId = (req.query.spot || "").toString().trim();
      const hours = clamp(parseIntSafe(req.query.hours, 24), 3, 96);
      const publish = parseBool(req.query.publish, false);

      const openWeatherKey = process.env.OPENWEATHER_API_KEY || "";

      const publishToWebflow = async (reports) => {
        if (!publish) return { attempted: false, ok: false, message: "publish disabled" };
        try {
          logger.info("Publishing to Webflow", { spotCount: reports.length });
          await webflow.pushAllReportsToWebflow({ reports });
          logger.info("Webflow publish finished", { spotCount: reports.length });
          return { attempted: true, ok: true, message: "published to Webflow" };
        } catch (e) {
          logger.error("Webflow publish failed", { message: e.message });
          return { attempted: true, ok: false, message: e.message };
        }
      };

      if (spotId) {
        const spot = SPOTS.find((s) => s.id === spotId);
        if (!spot) return res.status(404).json({ ok: false, error: `Unknown spot: ${spotId}` });

        const report = await buildReportForSpot({ spot, hoursAhead: hours, openWeatherKey });
        const webflowStatus = await publishToWebflow([report]);
        return res.json({ ok: true, spot: spotId, report, webflow: webflowStatus });
      }

      const concurrency = 3;
      const reports = await mapWithConcurrency(SPOTS, concurrency, async (spot) =>
        buildReportForSpot({ spot, hoursAhead: hours, openWeatherKey })
      );

      const webflowStatus = await publishToWebflow(reports);

      return res.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        hours,
        spots: reports,
        webflow: webflowStatus,
      });
    } catch (err) {
      logger.error(err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }
);

// ----------------------------
// Scheduler: hourly
// ----------------------------
exports.fetchKaiCastHourly = onSchedule(
  {
    schedule: "every 60 minutes",
    timeZone: "Pacific/Honolulu",
    secrets: ["WEBFLOW_API_TOKEN", "WEBFLOW_SPOTS_CID", "WEBFLOW_WINDOWS_CID"],
  },
  async () => {
    const openWeatherKey = process.env.OPENWEATHER_API_KEY || "";
    const hours = 24;

    const concurrency = 3;
    const reports = await mapWithConcurrency(SPOTS, concurrency, async (spot) =>
      buildReportForSpot({ spot, hoursAhead: hours, openWeatherKey })
    );

    for (const report of reports) {
      try {
        const spot = SPOTS.find((s) => s.id === report.spot) || { tz: "Pacific/Honolulu" };
        const hourKey = formatHourKeyForTz(new Date(), spot.tz || "Pacific/Honolulu");
        const docId = `${report.spot}_${hourKey}`;

        const toPersist = { ...report };
        if (Array.isArray(toPersist.hourly)) delete toPersist.hourly;
        toPersist.persistedAt = new Date().toISOString();
        toPersist.hourKey = hourKey;

        await db.collection("kaicast_hourly_reports").doc(docId).set(toPersist);
      } catch (e) {
        logger.warn(`Failed to persist report ${report.spot}: ${e.message}`);
      }
    }

    try {
      await webflow.pushAllReportsToWebflow({ reports });
      logger.info(`Webflow push complete: ${reports.length} spots`);
    } catch (e) {
      logger.warn(`Webflow push skipped/failed: ${e.message}`);
    }

    return null;
  }
