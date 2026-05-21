#!/usr/bin/env node
/* eslint-env node */
/* global fetch */

/**
 * Precompute topographic horizon profiles for every spot.
 *
 * For each spot, walks 72 bearings × 4 distance shells looking up
 * SRTM 30m elevations from OpenTopoData (free, no auth, ~1k calls
 * /day quota — we need ~78 for 26 spots).
 *
 * Output: functions/abyss/horizons.json
 *   {
 *     generatedAt: ISO,
 *     spots: {
 *       'molokini-crater': {
 *         lat, lon,
 *         profile: [{ bearingDeg: 0, horizonAngleDeg: 0.4 }, ...] // 72 entries
 *       },
 *       ...
 *     }
 *   }
 *
 * Re-run when SPOTS gain or change. Committed to git; no runtime
 * elevation fetches needed.
 *
 * Run:
 *   node scripts/precompute-horizons.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SPOTS_INPUT  = path.join(ROOT, 'functions', 'index.js');
const OUT_FILE     = path.join(ROOT, 'functions', 'abyss', 'horizons.json');

// Bearings to sample (every 5°), distances in meters.
const BEARING_STEP  = 5;
const DISTANCES_M   = [400, 1200, 3000, 7000];
const API_BASE      = 'https://api.opentopodata.org/v1/srtm30m';
const API_DELAY_MS  = 1100; // OpenTopoData rate limit: 1 req/sec
const MAX_PER_CALL  = 100;  // OpenTopoData per-request location limit

function deg2rad(d) { return d * Math.PI / 180; }
function rad2deg(r) { return r * 180 / Math.PI; }

/**
 * Walk `distanceM` meters from (lat,lon) along bearing.
 * Flat-earth — fine for sub-10 km hops; horizon-angle math doesn't
 * care about sub-meter accuracy.
 */
function walkBearing(lat, lon, bearingDeg, distanceM) {
  const M_PER_DEG_LAT = 111320;
  const M_PER_DEG_LON = 111320 * Math.cos(deg2rad(lat));
  const b = deg2rad(bearingDeg);
  const dLat = (distanceM * Math.cos(b)) / M_PER_DEG_LAT;
  const dLon = (distanceM * Math.sin(b)) / M_PER_DEG_LON;
  return { lat: lat + dLat, lon: lon + dLon };
}

/**
 * Earth-curvature drop over `distanceM` (meters).
 * h = d² / (2 R). Subtract from elevations so very distant ridges
 * don't overstate horizon angle.
 */
function curvatureDrop(distanceM) {
  const R = 6371000;
  return (distanceM * distanceM) / (2 * R);
}

/**
 * Batch-fetch elevations from OpenTopoData. Caller is responsible
 * for rate-limiting the gap between successive fetches.
 */
async function fetchElevations(points) {
  const locs = points.map((p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`).join('|');
  const url = `${API_BASE}?locations=${locs}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`opentopodata HTTP ${r.status}`);
  const j = await r.json();
  if (j.status !== 'OK') throw new Error(`opentopodata ${j.status}: ${j.error || ''}`);
  return j.results.map((it) => it.elevation);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * Compute the horizon profile for a single spot. Returns 72 samples
 * of { bearingDeg, horizonAngleDeg }.
 */
async function computeHorizonForSpot(spot) {
  const samples = []; // [{ bearingIdx, distIdx, lat, lon, distM }]
  for (let b = 0; b < 360; b += BEARING_STEP) {
    for (let i = 0; i < DISTANCES_M.length; i++) {
      const distM = DISTANCES_M[i];
      const p = walkBearing(spot.lat, spot.lon, b, distM);
      samples.push({ bearingIdx: b / BEARING_STEP, distIdx: i, lat: p.lat, lon: p.lon, distM });
    }
  }

  // Batch in chunks of 100 (API limit).
  const elevations = new Array(samples.length).fill(null);
  let firstCall = true;
  for (const part of chunk(samples, MAX_PER_CALL)) {
    if (!firstCall) await sleep(API_DELAY_MS);
    firstCall = false;
    const elevs = await fetchElevations(part.map(({ lat, lon }) => ({ lat, lon })));
    for (let i = 0; i < part.length; i++) {
      const sIdx = samples.indexOf(part[i]);
      elevations[sIdx] = elevs[i];
    }
  }

  // Reduce: per bearing, max horizon angle across distance shells.
  const numBearings = 360 / BEARING_STEP;
  const profile = new Array(numBearings).fill(null).map((_, i) => ({
    bearingDeg: i * BEARING_STEP,
    horizonAngleDeg: 0,
  }));

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const elev = elevations[i];
    if (!Number.isFinite(elev)) continue;
    const adjustedElev = Math.max(0, elev) - curvatureDrop(s.distM);
    if (adjustedElev <= 0) continue;
    const angleRad = Math.atan2(adjustedElev, s.distM);
    const angleDeg = rad2deg(angleRad);
    if (angleDeg > profile[s.bearingIdx].horizonAngleDeg) {
      profile[s.bearingIdx].horizonAngleDeg = Math.round(angleDeg * 100) / 100;
    }
  }

  return profile;
}

/**
 * Pull SPOTS array from functions/index.js by static parsing. Avoids
 * loading the full Functions module (which depends on firebase-admin).
 */
function loadSpots() {
  const src = fs.readFileSync(SPOTS_INPUT, 'utf8');
  const re = /id:\s*'([^']+)',\s*name:\s*([^\n]+),\s*lat:\s*(-?\d+\.?\d*),\s*lon:\s*(-?\d+\.?\d*)/g;
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    out.push({
      id: m[1],
      name: m[2].replace(/[",]/g, '').trim(),
      lat: parseFloat(m[3]),
      lon: parseFloat(m[4]),
    });
  }
  return out;
}

async function main() {
  const spots = loadSpots();
  console.log(`Loaded ${spots.length} spots from functions/index.js`);

  // Resume support — read existing file and skip spots already done.
  let existing = { spots: {} };
  if (fs.existsSync(OUT_FILE)) {
    try { existing = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')); }
    catch { /* ignore */ }
  }

  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i];
    if (existing.spots[spot.id]) {
      console.log(`[${i + 1}/${spots.length}] ${spot.id} — already computed, skipping`);
      continue;
    }
    process.stdout.write(`[${i + 1}/${spots.length}] ${spot.id}: `);
    try {
      const profile = await computeHorizonForSpot(spot);
      existing.spots[spot.id] = { lat: spot.lat, lon: spot.lon, profile };
      // Write incrementally so a crash doesn't lose progress.
      existing.generatedAt = new Date().toISOString();
      fs.writeFileSync(OUT_FILE, JSON.stringify(existing, null, 2));
      const maxAngle = Math.max(...profile.map((p) => p.horizonAngleDeg));
      const maxBearing = profile.find((p) => p.horizonAngleDeg === maxAngle)?.bearingDeg;
      console.log(`max ${maxAngle.toFixed(1)}° at bearing ${maxBearing}°`);
    } catch (err) {
      console.error(`FAILED — ${err.message}`);
    }
    // Rate-limit between spots — OpenTopoData is 1 req/sec.
    await sleep(API_DELAY_MS);
  }

  console.log(`\nDone. Wrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error('precompute-horizons failed:', err);
  process.exit(1);
});
