/* eslint-env node */
/* global fetch */
'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest, onCall, HttpsError }  = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin  = require('firebase-admin');

const analysis        = require('./analysis');
const { fetchBuoyHourly } = require('./buoy_Version2');
const { fetchMarineForecast } = require('./marineForecast');
const { pushAllReportsToWebflow } = require('./webflow');
const { estimateVisibilityAbyss } = require('./abyss/abyss');

admin.initializeApp();
const db = admin.firestore();

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

// Auto-generated from Webflow CMS by scripts/generate-spots.js
// 26 spots — re-run when Webflow gains new entries.
const SPOTS = [
  {
    id: 'airport-beach',
    name: "Airport Beach",
    lat: 20.9042,
    lon: -156.6833,
    tz: 'Pacific/Honolulu',
    coast: 'west',
    island: "Maui",
    buoyStation: '51205',
    runoffSensitivity: 'medium',
    nearStreamMouth: false,
    nearDrainage: true,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'reef',
    maxDepthM: 15,
    typicalDiveDepthM: 8,
    sedimentType: 'reef',
    sedimentSensitivity: 'low',
  },
  {
    id: 'ala-wharf',
    name: "Ala Wharf",
    lat: 20.8989,
    lon: -156.6855,
    tz: 'Pacific/Honolulu',
    coast: 'west',
    island: "Maui",
    buoyStation: '51205',
    runoffSensitivity: 'low',
    nearStreamMouth: false,
    nearDrainage: true,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'shore',
    maxDepthM: 8,
    typicalDiveDepthM: 5,
    sedimentType: 'sand',
    sedimentSensitivity: 'high',
  },
  {
    id: 'black-rock-kaanapali',
    name: "Black Rock (Kaanapali)",
    lat: 20.926149,
    lon: -156.69621,
    tz: 'Pacific/Honolulu',
    coast: 'west',
    island: "Maui",
    buoyStation: '51205',
    runoffSensitivity: 'medium',
    nearStreamMouth: false,
    nearDrainage: true,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'reef',
    maxDepthM: 12,
    typicalDiveDepthM: 6,
    sedimentType: 'reef',
    sedimentSensitivity: 'low',
  },
  {
    id: 'brenneckes-ledge',
    name: "Brennecke's Ledge",
    lat: 21.873,
    lon: -159.458,
    tz: 'Pacific/Honolulu',
    coast: 'south',
    island: "Kauai",
    buoyStation: '51201',
    runoffSensitivity: 'low',
    nearStreamMouth: false,
    nearDrainage: false,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'wall',
    maxDepthM: 20,
    typicalDiveDepthM: 12,
    sedimentType: 'reef',
    sedimentSensitivity: 'low',
  },
  {
    id: 'china-walls',
    name: "China Walls",
    lat: 21.261473,
    lon: -157.711477,
    tz: 'Pacific/Honolulu',
    coast: 'east',
    island: "Oahu",
    buoyStation: '51202',
    runoffSensitivity: 'low',
    nearStreamMouth: false,
    nearDrainage: false,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'wall',
    maxDepthM: 25,
    typicalDiveDepthM: 15,
    sedimentType: 'reef',
    sedimentSensitivity: 'low',
  },
  {
    id: 'electric-beach',
    name: "Electric Beach",
    lat: 21.354627,
    lon: -158.13633,
    tz: 'Pacific/Honolulu',
    coast: 'west',
    island: "Oahu",
    buoyStation: '51201',
    runoffSensitivity: 'medium',
    nearStreamMouth: false,
    nearDrainage: true,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'reef',
    maxDepthM: 10,
    typicalDiveDepthM: 6,
    sedimentType: 'sand',
    sedimentSensitivity: 'medium',
  },
  {
    id: 'hanauma-bay',
    name: "Hanauma Bay",
    lat: 21.268517,
    lon: -157.693045,
    tz: 'Pacific/Honolulu',
    coast: 'east',
    island: "Oahu",
    buoyStation: '51202',
    runoffSensitivity: 'low',
    nearStreamMouth: false,
    nearDrainage: false,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'reef',
    maxDepthM: 10,
    typicalDiveDepthM: 5,
    sedimentType: 'reef',
    sedimentSensitivity: 'low',
  },
  {
    id: 'honolua-bay',
    name: "Honolua Bay",
    lat: 21.01461,
    lon: -156.639667,
    tz: 'Pacific/Honolulu',
    coast: 'west',
    island: "Maui",
    buoyStation: '51205',
    runoffSensitivity: 'medium',
    nearStreamMouth: false,
    nearDrainage: true,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'reef',
    maxDepthM: 18,
    typicalDiveDepthM: 10,
    sedimentType: 'reef',
    sedimentSensitivity: 'low',
  },
  {
    id: 'kaiwi-point',
    name: "Kaiwi Point",
    lat: 19.78,
    lon: -156.02,
    tz: 'Pacific/Honolulu',
    coast: 'west',
    island: "Big Island",
    buoyStation: '51205',
    runoffSensitivity: 'low',
    nearStreamMouth: false,
    nearDrainage: true,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'reef',
    maxDepthM: 20,
    typicalDiveDepthM: 12,
    sedimentType: 'reef',
    sedimentSensitivity: 'low',
  },
  {
    id: 'kealakekua-bay',
    name: "Kealakekua Bay",
    lat: 19.4789,
    lon: -156.0004,
    tz: 'Pacific/Honolulu',
    coast: 'west',
    island: "Big Island",
    buoyStation: '51205',
    runoffSensitivity: 'medium',
    nearStreamMouth: false,
    nearDrainage: true,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'reef',
    maxDepthM: 30,
    typicalDiveDepthM: 15,
    sedimentType: 'reef',
    sedimentSensitivity: 'low',
  },
  {
    id: 'koloa-landing',
    name: "Koloa Landing",
    lat: 21.87788,
    lon: -159.461,
    tz: 'Pacific/Honolulu',
    coast: 'south',
    island: "Kauai",
    buoyStation: '51201',
    runoffSensitivity: 'low',
    nearStreamMouth: false,
    nearDrainage: false,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'reef',
    maxDepthM: 12,
    typicalDiveDepthM: 6,
    sedimentType: 'reef',
    sedimentSensitivity: 'low',
  },
  {
    id: 'makena-landing',
    name: "Makena Landing",
    lat: 20.653606,
    lon: -156.441495,
    tz: 'Pacific/Honolulu',
    coast: 'south',
    island: "Maui",
    buoyStation: '51205',
    runoffSensitivity: 'low',
    nearStreamMouth: false,
    nearDrainage: false,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'reef',
    maxDepthM: 20,
    typicalDiveDepthM: 12,
    sedimentType: 'reef',
    sedimentSensitivity: 'medium',
  },
  {
    id: 'makua',
    name: "Makua Beach",
    lat: 21.531326,
    lon: -158.234336,
    tz: 'Pacific/Honolulu',
    coast: 'west',
    island: "Oahu",
    buoyStation: '51201',
    runoffSensitivity: 'medium',
    nearStreamMouth: false,
    nearDrainage: true,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'reef',
    maxDepthM: 20,
    typicalDiveDepthM: 12,
    sedimentType: 'sand',
    sedimentSensitivity: 'high',
  },
  {
    id: 'makua-beach',
    name: "Makua Beach",
    lat: 21.527379,
    lon: -158.229536,
    tz: 'Pacific/Honolulu',
    coast: 'west',
    island: "Oahu",
    buoyStation: '51201',
    runoffSensitivity: 'medium',
    nearStreamMouth: false,
    nearDrainage: true,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'reef',
    maxDepthM: 18,
    typicalDiveDepthM: 10,
    sedimentType: 'sand',
    sedimentSensitivity: 'high',
  },
  {
    id: 'manta-heaven',
    name: "Manta Heaven",
    lat: 19.9636,
    lon: -155.8928,
    tz: 'Pacific/Honolulu',
    coast: 'west',
    island: "Big Island",
    buoyStation: '51205',
    runoffSensitivity: 'low',
    nearStreamMouth: false,
    nearDrainage: true,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'reef',
    maxDepthM: 12,
    typicalDiveDepthM: 8,
    sedimentType: 'reef',
    sedimentSensitivity: 'low',
  },
  {
    id: 'mokuleia',
    name: "Mokuleia",
    lat: 21.580952,
    lon: -158.253094,
    tz: 'Pacific/Honolulu',
    coast: 'west',
    island: "Oahu",
    buoyStation: '51201',
    runoffSensitivity: 'medium',
    nearStreamMouth: false,
    nearDrainage: true,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'shore',
    maxDepthM: 10,
    typicalDiveDepthM: 5,
    sedimentType: 'sand',
    sedimentSensitivity: 'high',
  },
  {
    id: 'molokini-crater',
    name: "Molokini Crater",
    lat: 20.6323,
    lon: -156.496,
    tz: 'Pacific/Honolulu',
    coast: 'west',
    island: "Maui",
    buoyStation: '51205',
    runoffSensitivity: 'low',
    nearStreamMouth: false,
    nearDrainage: true,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'crater',
    maxDepthM: 50,
    typicalDiveDepthM: 18,
    sedimentType: 'reef',
    sedimentSensitivity: 'low',
  },
  {
    id: 'niihau',
    name: "Ni'ihau",
    lat: 22.025141,
    lon: -160.095816,
    tz: 'Pacific/Honolulu',
    coast: 'west',
    island: "Kauai",
    buoyStation: '51201',
    runoffSensitivity: 'medium',
    nearStreamMouth: false,
    nearDrainage: true,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'reef',
    maxDepthM: 30,
    typicalDiveDepthM: 15,
    sedimentType: 'reef',
    sedimentSensitivity: 'low',
  },
  {
    id: 'sharks-cove',
    name: "Shark's Cove",
    lat: 21.654521,
    lon: -158.065133,
    tz: 'Pacific/Honolulu',
    coast: 'north',
    island: "Oahu",
    buoyStation: '51201',
    runoffSensitivity: 'medium',
    nearStreamMouth: false,
    nearDrainage: true,
    maxCleanSwellFt: 3,
    hardNoGoSwellFt: 6,
    siteType: 'reef',
    maxDepthM: 15,
    typicalDiveDepthM: 8,
    sedimentType: 'coral_rubble',
    sedimentSensitivity: 'medium',
  },
  {
    id: 'sheraton-caverns',
    name: "Sheraton Caverns",
    lat: 21.8735,
    lon: -159.4663,
    tz: 'Pacific/Honolulu',
    coast: 'south',
    island: "Kauai",
    buoyStation: '51201',
    runoffSensitivity: 'low',
    nearStreamMouth: false,
    nearDrainage: false,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'cave',
    maxDepthM: 25,
    typicalDiveDepthM: 15,
    sedimentType: 'reef',
    sedimentSensitivity: 'low',
  },
  {
    id: 'three-tables',
    name: "Three Tables",
    lat: 21.6367,
    lon: -158.0633,
    tz: 'Pacific/Honolulu',
    coast: 'north',
    island: "Oahu",
    buoyStation: '51201',
    runoffSensitivity: 'medium',
    nearStreamMouth: false,
    nearDrainage: true,
    maxCleanSwellFt: 3,
    hardNoGoSwellFt: 6,
    siteType: 'reef',
    maxDepthM: 12,
    typicalDiveDepthM: 6,
    sedimentType: 'coral_rubble',
    sedimentSensitivity: 'medium',
  },
  {
    id: 'tunnels-reef',
    name: "Tunnels Reef",
    lat: 22.223269,
    lon: -159.5705,
    tz: 'Pacific/Honolulu',
    coast: 'north',
    island: "Kauai",
    buoyStation: '51201',
    runoffSensitivity: 'low',
    nearStreamMouth: false,
    nearDrainage: true,
    maxCleanSwellFt: 3,
    hardNoGoSwellFt: 6,
    siteType: 'reef',
    maxDepthM: 25,
    typicalDiveDepthM: 15,
    sedimentType: 'reef',
    sedimentSensitivity: 'low',
  },
  {
    id: 'turtle-canyon',
    name: "Turtle Canyon",
    lat: 21.274238,
    lon: -157.839264,
    tz: 'Pacific/Honolulu',
    coast: 'south',
    island: "Oahu",
    buoyStation: '51202',
    runoffSensitivity: 'low',
    nearStreamMouth: false,
    nearDrainage: false,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'reef',
    maxDepthM: 12,
    typicalDiveDepthM: 7,
    sedimentType: 'sand',
    sedimentSensitivity: 'medium',
  },
  {
    id: 'turtle-reef-turtle-bay',
    name: "Turtle Reef/Turtle Bay",
    lat: 21.702485,
    lon: -158.002095,
    tz: 'Pacific/Honolulu',
    coast: 'north',
    island: "Oahu",
    buoyStation: '51201',
    runoffSensitivity: 'low',
    nearStreamMouth: false,
    nearDrainage: true,
    maxCleanSwellFt: 3,
    hardNoGoSwellFt: 6,
    siteType: 'reef',
    maxDepthM: 12,
    typicalDiveDepthM: 7,
    sedimentType: 'reef',
    sedimentSensitivity: 'low',
  },
  {
    id: 'wailea-point-ulua-beach',
    name: "Wailea Point/Ulua Beach",
    lat: 20.683277,
    lon: -156.444016,
    tz: 'Pacific/Honolulu',
    coast: 'west',
    island: "Maui",
    buoyStation: '51205',
    runoffSensitivity: 'low',
    nearStreamMouth: false,
    nearDrainage: true,
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    siteType: 'reef',
    maxDepthM: 20,
    typicalDiveDepthM: 10,
    sedimentType: 'reef',
    sedimentSensitivity: 'low',
  },
  {
    id: 'waimea-bay',
    name: "Waimea Bay",
    lat: 21.64139,
    lon: -158.066588,
    tz: 'Pacific/Honolulu',
    coast: 'north',
    island: "Oahu",
    buoyStation: '51201',
    runoffSensitivity: 'medium',
    nearStreamMouth: false,
    nearDrainage: true,
    maxCleanSwellFt: 3,
    hardNoGoSwellFt: 6,
    siteType: 'reef',
    maxDepthM: 18,
    typicalDiveDepthM: 10,
    sedimentType: 'sand',
    sedimentSensitivity: 'medium',
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

// Walk back up to `maxLagHours` hours from `nowHourIso` looking for
// the most recent value in the map. NDBC realtime2 observations
// typically lag 30–90 minutes behind real time, so the literal "now"
// hour bucket is almost always empty. Without this walkback every
// fresh report comes back with null wave height / period / SST.
function lookupRecent(map, nowHourIso, maxLagHours = 4) {
  if (!map || !nowHourIso) return null;
  const direct = map.get(nowHourIso);
  if (direct != null) return direct;
  const baseMs = new Date(nowHourIso).getTime();
  if (!Number.isFinite(baseMs)) return null;
  for (let h = 1; h <= maxLagHours; h++) {
    const iso = new Date(baseMs - h * 3600000).toISOString().slice(0, 13) + ':00';
    const found = map.get(iso);
    if (found != null) return found;
  }
  return null;
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

async function buildSpotReport({ spot, owHourly, buoyData, marineForecast, nowMs }) {
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

    waveHeightM:       lookupRecent(buoyData?.waveHMap, nowHourIso),
    wavePeriodS:       lookupRecent(buoyData?.wavePMap, nowHourIso),
    waterTempC:        lookupRecent(buoyData?.sstMap,   nowHourIso),
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

  // Abyss: data-grounded layered visibility model. Falls back to the
  // legacy heuristic internally when satellite ocean-color isn't
  // configured, but ALWAYS layers on the solar + topographic-shadow
  // calc since those don't need any external feeds.
  const nowVisibility = await estimateVisibilityAbyss({
    spot,
    lat: spot.lat,
    lon: spot.lon,
    nowMs,
    windKnots:         nowMetrics.windSpeedKts,
    waveHeightM:       nowMetrics.waveHeightM,
    wavePeriodS:       nowMetrics.wavePeriodS,
    tidePhase:         nowTideCycle?.currentTideState ?? 'unknown',
    rainRollups,
    runoff:            nowRunoff,
    cloudCoverPercent: nowMetrics.cloudCoverPercent,
    hourLocal:         nowLocalHour,
    db,
    cmemsUser: process.env.CMEMS_USERNAME,
    cmemsPass: process.env.CMEMS_PASSWORD,
    nasaUser:  process.env.NASA_EARTHDATA_USERNAME,
    nasaPass:  process.env.NASA_EARTHDATA_PASSWORD,
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

  // Merge buoy + marine forecast into hourly for window calculations.
  // Buoy data covers PAST hours (NDBC realtime obs); marine forecast
  // covers FUTURE hours (Open-Meteo Marine). Past hours fall through
  // to forecast as a fallback. Water temp comes from buoy only —
  // Open-Meteo Marine doesn't expose SST.
  const hourlyWithBuoy = owHourly.hourly.map((h) => ({
    ...h,
    waveHeightM:
      buoyData?.waveHMap?.get(h.isoHour) ??
      marineForecast?.waveHMap?.get(h.isoHour) ??
      null,
    wavePeriodS:
      buoyData?.wavePMap?.get(h.isoHour) ??
      marineForecast?.wavePMap?.get(h.isoHour) ??
      null,
    waterTempC:  buoyData?.sstMap?.get(h.isoHour) ?? null,
  }));

  const rawWindows = buildWindows(hourlyWithBuoy, nowMs, 8);
  const windows = await Promise.all(rawWindows.map(async (w) => {
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

    // Per-window abyss: re-runs solar+shadow at the window's midpoint
    // so a 6 PM window correctly shows depressed visibility from
    // mountain shadow / low light, while a 9 AM window shows full sun.
    const winMidMsForVis = new Date(w.startIso).getTime() + 1.5 * 3600000;
    const winVisibility = await estimateVisibilityAbyss({
      spot,
      lat: spot.lat,
      lon: spot.lon,
      nowMs: winMidMsForVis,
      windKnots:         w.avg.windSpeedKts,
      waveHeightM:       w.avg.waveHeightM,
      wavePeriodS:       w.avg.wavePeriodS,
      tidePhase:         winTideCycle?.currentTideState ?? 'unknown',
      rainRollups:       winRainRollups,
      runoff:            winRunoff,
      cloudCoverPercent: w.avg.cloudCoverPercent,
      hourLocal:         winLocalHour,
      db,
      cmemsUser: process.env.CMEMS_USERNAME,
      cmemsPass: process.env.CMEMS_PASSWORD,
      nasaUser:  process.env.NASA_EARTHDATA_USERNAME,
      nasaPass:  process.env.NASA_EARTHDATA_PASSWORD,
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
  }));

  // Daily forecast — aggregate Open-Meteo Marine hourly into 7 daily
  // buckets so the Forecast tab's day strip can show real wave / period
  // ranges. Date keys are local to the spot's tz when given, else UTC.
  const days = buildDailyForecast({
    marineForecast, owHourly, spot, nowMs,
    tideSeries: rawTideSeries,
  });

  const qcFlags = [];
  if (!buoyData || !buoyData.waveHMap?.size) qcFlags.push('no-buoy');
  if (nowMetrics.waterTempC == null) qcFlags.push('missing-sst');
  if (nowMetrics.waveHeightM == null) qcFlags.push('missing-wave-height');
  if (closestHour == null) qcFlags.push('no-openweather-match');
  if (!nowTideCycle) qcFlags.push('no-tide-cycle');
  if (!marineForecast || !marineForecast.waveHMap?.size) qcFlags.push('no-marine-forecast');

  const sources = ['openweather'];
  if (spot.buoyStation && buoyData?.waveHMap?.size) sources.push(`ndbc:${spot.buoyStation}`);
  if (tideStationId && rawTideSeries.length) sources.push(`noaa-tides:${tideStationId}`);
  if (marineForecast?.waveHMap?.size) sources.push('open-meteo-marine');

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
    days,
  };
}

// Aggregate Open-Meteo Marine hourly data into daily summaries for the
// next 7 days. Each day gets min/max/avg wave height + dominant period
// + dominant direction. Returns [] when no forecast data is available
// so the client can fall back gracefully.
function buildDailyForecast({ marineForecast, owHourly, spot, nowMs, tideSeries = [] }) {
  if (!marineForecast || !marineForecast.waveHMap?.size) return [];

  // Group hourly samples by spot-local calendar date so "today" matches
  // the diver's day. Open-Meteo returns UTC ISO hours; we convert to
  // the spot's tz (defaults to Pacific/Honolulu when unset).
  const tz = spot.tz || 'Pacific/Honolulu';
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  // Local-hour formatter so per-day tide events carry the right hour
  // for the diver's calendar (Maui spots in Hawaii tz, etc).
  const hourFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, hour: '2-digit',
  });
  const minuteFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, minute: '2-digit',
  });

  const buckets = new Map(); // YYYY-MM-DD -> { hs: [], ps: [], dirs: [], temps: [], rains: [], winds: [] }
  function bucket(dateKey) {
    let b = buckets.get(dateKey);
    if (!b) {
      b = { hs: [], ps: [], dirs: [], temps: [], rains: [], winds: [] };
      buckets.set(dateKey, b);
    }
    return b;
  }

  for (const [iso, h] of marineForecast.waveHMap.entries()) {
    const t = new Date(iso + 'Z');
    if (!Number.isFinite(t.getTime())) continue;
    const dateKey = fmt.format(t);
    const b = bucket(dateKey);
    b.hs.push(h);
    const p = marineForecast.wavePMap?.get(iso);
    if (Number.isFinite(p)) b.ps.push(p);
    const d = marineForecast.waveDirMap?.get(iso);
    if (Number.isFinite(d)) b.dirs.push(d);
  }

  // Layer in OpenWeather hourly air temp / wind / rain so each day has
  // a full picture even on the days NDBC SST won't reach.
  for (const h of owHourly?.hourly || []) {
    const t = new Date(h.tsMs);
    if (!Number.isFinite(t.getTime())) continue;
    const dateKey = fmt.format(t);
    const b = buckets.get(dateKey);
    if (!b) continue;
    if (Number.isFinite(h.airTempC))     b.temps.push(h.airTempC);
    if (Number.isFinite(h.rainLast1hMM)) b.rains.push(h.rainLast1hMM);
    if (Number.isFinite(h.windSpeedKts)) b.winds.push(h.windSpeedKts);
  }

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const sum = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) : null);

  // Circular mean for direction (degrees)
  function dirAvg(degs) {
    if (!degs.length) return null;
    const rads = degs.map((d) => (d * Math.PI) / 180);
    const sx = rads.reduce((a, r) => a + Math.cos(r), 0);
    const sy = rads.reduce((a, r) => a + Math.sin(r), 0);
    const m = (Math.atan2(sy, sx) * 180) / Math.PI;
    return Math.round((m + 360) % 360);
  }

  const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);
  const round0 = (n) => (n == null ? null : Math.round(n));

  // Bucket tide events (hilo predictions are NOAA H/L points) into
  // each day's local calendar. Each event keeps its UTC tsMs, level
  // in feet, type (high/low), local hour24 for the chart, and a
  // human-readable timeLabel like "8:42am".
  const tideBuckets = new Map();
  for (const ev of (Array.isArray(tideSeries) ? tideSeries : [])) {
    if (!ev || !Number.isFinite(ev.tsMs) || !Number.isFinite(ev.levelFt)) continue;
    const dateKey = fmt.format(new Date(ev.tsMs));
    if (!buckets.has(dateKey)) continue;
    let arr = tideBuckets.get(dateKey);
    if (!arr) { arr = []; tideBuckets.set(dateKey, arr); }
    const hour24 = Number(hourFmt.format(new Date(ev.tsMs)));
    const minute = Number(minuteFmt.format(new Date(ev.tsMs)));
    const ampm = hour24 >= 12 ? 'pm' : 'am';
    const h12  = ((hour24 + 11) % 12) + 1;
    arr.push({
      type: ev.type === 'H' ? 'high' : 'low',
      tsMs: ev.tsMs,
      heightFt: Math.round(ev.levelFt * 100) / 100,
      hour24,
      timeLabel: `${h12}:${String(minute).padStart(2, '0')}${ampm}`,
    });
  }

  const sortedKeys = [...buckets.keys()].sort();
  return sortedKeys.slice(0, 7).map((dateKey) => {
    const b = buckets.get(dateKey);
    const tideEvents = (tideBuckets.get(dateKey) || []).sort((a, b) => a.tsMs - b.tsMs);
    return {
      date:           dateKey,
      waveMinM:       round1(Math.min(...b.hs)),
      waveMaxM:       round1(Math.max(...b.hs)),
      waveAvgM:       round1(avg(b.hs)),
      wavePeriodS:    round1(avg(b.ps)),
      waveDirDeg:     dirAvg(b.dirs),
      airTempCAvg:    round1(avg(b.temps)),
      rainTotalMM:    round1(sum(b.rains)),
      windAvgKts:     round1(avg(b.winds)),
      windMaxKts:     round0(b.winds.length ? Math.max(...b.winds) : null),
      tideEvents,
    };
  });
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
      const buoyData = spot.buoyStation
        ? await fetchBuoyHourly({ station: spot.buoyStation }).catch(() => null)
        : null;
      const marineForecast = await fetchMarineForecast({ lat: spot.lat, lon: spot.lon, days: 7 })
        .catch(() => null);

      const report = await buildSpotReport({ spot, owHourly, buoyData, marineForecast, nowMs });
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

// Read the most recent hourly cached report for a spot (looking up to
// 4 hours back). Returns null when nothing recent is cached. The
// scheduler writes `kaicast_reports/{spotId}_{YYYYMMDDHH}` every hour.
async function readCachedReport(spotId, nowMs, spot = null) {
  const t = new Date(nowMs);
  for (let h = 0; h < 4; h++) {
    const at = new Date(t.getTime() - h * 3600000);
    const hourKey = buildHourKey(at);
    const snap = await db.collection('kaicast_reports').doc(`${spotId}_${hourKey}`).get();
    if (!snap.exists) continue;
    const data = snap.data();
    // Skip stale cache entries left over from the old "exact-hour"
    // buoy lookup bug. If the spot has a buoy configured but the
    // cached report has null wave height, recompute. Once the fixed
    // pipeline runs the cache becomes trustworthy again.
    if (spot?.buoyStation && data?.now?.metrics?.waveHeightM == null) continue;
    // Skip cache entries from before the multi-day forecast field was
    // added — the days[] array is a meaningful upgrade and worth a
    // one-time recompute. Self-clears within an hour as caches refill.
    if (!Array.isArray(data?.days)) continue;
    // Skip pre-abyss caches — `now.visibility.sun` is the marker that
    // the report was generated by the layered sun/shadow model.
    if (!data?.now?.visibility?.sun) continue;
    // Same for the per-day tide events (added after days[] shipped).
    // Skip if any day in the forecast is missing tideEvents.
    if (!data.days.every((d) => Array.isArray(d?.tideEvents))) continue;
    // Skip if the cached report's tide source doesn't match the spot's
    // currently-configured tide station (e.g. Maui spots switched from
    // Honolulu to Kahului — old cache should not be served).
    if (spot?.tideStation && Array.isArray(data?.sources)) {
      const expected = `noaa-tides:${spot.tideStation}`;
      if (!data.sources.includes(expected)) continue;
    }
    return data;
  }
  return null;
}

// Per-spot HTTP endpoint consumed by the app's useSpotReport hook.
// Always tries the hourly cache first (sub-second response), falls
// back to a fresh compute when the cache is empty or stale (5–15 s).
exports.getReport = onRequest(
  { secrets: ALL_SECRETS, timeoutSeconds: 60, memory: '512MiB' },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.status(204).send('');
      return;
    }

    const spotId = String(req.query.spotId || '').trim();
    if (!spotId) {
      res.status(400).json({ error: 'spotId query param is required' });
      return;
    }
    const spot = SPOTS.find((s) => s.id === spotId);
    if (!spot) {
      res.status(404).json({ error: `Unknown spot: ${spotId}` });
      return;
    }

    try {
      const nowMs = Date.now();
      const cached = await readCachedReport(spotId, nowMs, spot);
      if (cached) {
        res.json(cached);
        return;
      }

      const apiKey = OPENWEATHER_API_KEY.value();
      if (!apiKey) {
        res.status(500).json({ error: 'OPENWEATHER_API_KEY is not configured' });
        return;
      }
      const owHourly = await fetchOpenWeatherHourly({ lat: spot.lat, lon: spot.lon, apiKey });
      const buoyData = spot.buoyStation
        ? await fetchBuoyHourly({ station: spot.buoyStation }).catch(() => null)
        : null;
      const marineForecast = await fetchMarineForecast({ lat: spot.lat, lon: spot.lon, days: 7 })
        .catch(() => null);
      const report = await buildSpotReport({ spot, owHourly, buoyData, marineForecast, nowMs });

      // Cache the freshly-computed report so the next request is fast.
      const docId = `${spot.id}_${report.hourKey}`;
      await db.collection('kaicast_reports').doc(docId).set({
        ...report,
        savedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json(report);
    } catch (err) {
      logger.error('getReport failed', { spotId, error: err.message });
      res.status(500).json({ error: err.message });
    }
  }
);

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

// ─── Account deletion (App Store gate) ───────────────────────────────────────
//
// Apple requires every app that supports account creation to also
// support self-serve account deletion from inside the app. This
// callable handles the cascading cleanup that's hard to do
// client-side (the user can't delete docs in OTHER users' followers
// / following subcollections under our security rules).
//
// Flow:
//   1. Client re-authenticates the user (Firebase requires recent
//      login for sensitive operations).
//   2. Client invokes deleteUserAccount.
//   3. Server fans out: removes the user's subcollections, dive
//      logs, profile photo, mirrored social-graph entries, the
//      user doc itself, and finally the auth user.
//   4. Client signs out for clean local state.
async function deleteSubcollection(parentPath, subName, batchSize = 200) {
  const ref = db.collection(`${parentPath}/${subName}`);
  while (true) {
    const snap = await ref.limit(batchSize).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < batchSize) return;
  }
}

exports.deleteUserAccount = onCall(
  { timeoutSeconds: 120, memory: '256MiB' },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    logger.info('deleteUserAccount: start', { uid });

    // 1. Mirrored social-graph cleanup. Read the user's followers /
    //    following lists FIRST so we know which other users have
    //    edges pointing at this account, then delete those reverse
    //    edges with admin privileges before nuking the local copies.
    try {
      const followingSnap = await db.collection(`users/${uid}/following`).get();
      for (const d of followingSnap.docs) {
        const otherUid = d.id;
        await db.doc(`users/${otherUid}/followers/${uid}`).delete().catch(() => {});
      }
      const followersSnap = await db.collection(`users/${uid}/followers`).get();
      for (const d of followersSnap.docs) {
        const otherUid = d.id;
        await db.doc(`users/${otherUid}/following/${uid}`).delete().catch(() => {});
      }
    } catch (err) {
      logger.warn('deleteUserAccount: social-graph reverse cleanup partial', {
        uid, error: err.message,
      });
    }

    // 2. The user's own subcollections.
    await Promise.all([
      deleteSubcollection(`users/${uid}`, 'favorites'),
      deleteSubcollection(`users/${uid}`, 'following'),
      deleteSubcollection(`users/${uid}`, 'followers'),
      deleteSubcollection(`users/${uid}`, 'devices'),
    ]);

    // 3. Dive logs (top-level collection keyed by uid).
    try {
      const logsSnap = await db.collection('diveLogs').where('uid', '==', uid).get();
      const batch = db.batch();
      logsSnap.docs.forEach((d) => batch.delete(d.ref));
      if (!logsSnap.empty) await batch.commit();
    } catch (err) {
      logger.warn('deleteUserAccount: diveLogs cleanup failed', {
        uid, error: err.message,
      });
    }

    // 4. Profile photo in Storage (if present). Pattern matches the
    //    paths written by the client photo-upload flow.
    try {
      const bucket = admin.storage().bucket();
      const [files] = await bucket.getFiles({ prefix: `users/${uid}/` });
      await Promise.all(files.map((f) => f.delete().catch(() => undefined)));
    } catch (err) {
      logger.warn('deleteUserAccount: storage cleanup partial', {
        uid, error: err.message,
      });
    }

    // 5. The users/{uid} doc itself.
    await db.doc(`users/${uid}`).delete().catch(() => undefined);

    // 6. Auth user. Once this runs the client's session is invalid.
    try {
      await admin.auth().deleteUser(uid);
    } catch (err) {
      logger.error('deleteUserAccount: auth deletion failed', {
        uid, error: err.message,
      });
      throw new HttpsError('internal', 'Account data was deleted but auth user could not be removed. Contact support.');
    }

    logger.info('deleteUserAccount: complete', { uid });
    return { ok: true };
  },
);

