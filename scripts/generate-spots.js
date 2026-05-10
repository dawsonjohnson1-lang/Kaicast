#!/usr/bin/env node
// Read /tmp/webflow_spots.json (a dump from listWebflowSpotsTmp) and
// generate the SPOTS array for functions/index.js and the seed JSON
// for the Firestore `spots` collection. Idempotent — re-run any
// time Webflow gains new spots.
//
// Usage: node scripts/generate-spots.js > /tmp/spots-out.txt

/* eslint-env node */
const fs = require('fs');
const path = require('path');

const INPUT = process.argv[2] || '/tmp/webflow_spots.json';
const data = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// Active NDBC wave-height buoys around the main Hawaiian Islands.
// Coordinates verified against ndbc.noaa.gov station pages.
const BUOYS = [
  { id: '51201', lat: 21.671, lon: -158.118 }, // Waimea Bay, Oahu (N)
  { id: '51202', lat: 21.417, lon: -157.677 }, // Mokapu Pt, Oahu (E/SE)
  { id: '51205', lat: 21.018, lon: -156.426 }, // Pauwela, Maui (N)
];

function distKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestBuoy(lat, lon) {
  let best = BUOYS[0], bestD = Infinity;
  for (const b of BUOYS) {
    const d = distKm(lat, lon, b.lat, b.lon);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best.id;
}

function coastFor(lat, lon, islandHint) {
  // Use the same heuristic as functions/index.js but island-aware so
  // Kauai north spots don't get tagged "south" because of Oahu math.
  // We pick island-relative center points.
  const ISLAND_CENTERS = {
    Oahu:        { lat: 21.46, lon: -157.99 },
    Maui:        { lat: 20.79, lon: -156.33 },
    Kauai:       { lat: 22.07, lon: -159.50 },
    'Big Island':{ lat: 19.59, lon: -155.50 },
    Niihau:      { lat: 21.90, lon: -160.16 },
  };
  const c = ISLAND_CENTERS[islandHint] || { lat: 21.46, lon: -157.99 };
  const angle = Math.atan2(lon - c.lon, lat - c.lat) * (180 / Math.PI);
  if (angle >= -45 && angle < 45)   return 'north';
  if (angle >= 45  && angle < 135)  return 'east';
  if (angle >= 135 || angle < -135) return 'south';
  return 'west';
}

// Maps Webflow island name → island key used by tide registry.
function normalizeIsland(s) {
  if (!s) return null;
  const lower = s.trim().toLowerCase();
  if (lower.includes('oahu') || lower.includes("o'ahu")) return 'Oahu';
  if (lower.includes('maui')) return 'Maui';
  if (lower.includes('kauai') || lower.includes("kaua'i")) return 'Kauai';
  if (lower.includes('big') || lower.includes('hawaii')) return 'Big Island';
  if (lower.includes('niihau')) return 'Niihau';
  return null;
}

const seen = new Set();
const out = [];

for (const it of data.items || []) {
  const fd = it.fieldData || {};
  const lat = fd['latitude-2'];
  const lon = fd['longitude-2'];
  if (lat == null || lon == null) continue;

  const slug = fd.slug;
  if (!slug || seen.has(slug)) continue;
  seen.add(slug);

  const name   = fd.name || slug;
  const island = normalizeIsland(fd['island-text'] || fd.island);
  const coast  = coastFor(lat, lon, island);
  const buoyStation = nearestBuoy(lat, lon);

  // Dive-rating defaults — runoff / swell tolerances. Webflow doesn't
  // ship these per-spot today, so we use coast-aware defaults that
  // err on the conservative side (storm-runoff caution for north and
  // west coasts where rain-fed streams meet the ocean).
  const isNearshoreShoreDive = !/(crater|wharf|ledge|reef|canyon|heaven|caverns|point|wall)/i.test(name);
  const runoffSensitivity = (coast === 'north' || coast === 'west') && isNearshoreShoreDive
    ? 'medium' : 'low';

  out.push({
    id:          slug,
    name,
    lat,
    lon,
    tz:          'Pacific/Honolulu',
    coast,
    island,
    buoyStation,
    // Leave tideStation undefined so chooseNoaaTideStationForSpot
    // picks the nearest registered station automatically.
    runoffSensitivity,
    nearStreamMouth: false,
    nearDrainage:    coast === 'north' || coast === 'west',
    maxCleanSwellFt: coast === 'north' ? 3 : 4,
    hardNoGoSwellFt: coast === 'north' ? 6 : 7,
  });
}

out.sort((a, b) => a.id.localeCompare(b.id));

// JS literal output suitable for pasting into functions/index.js.
function toJsLiteral(spot) {
  const lines = [
    `  {`,
    `    id: '${spot.id}',`,
    `    name: ${JSON.stringify(spot.name)},`,
    `    lat: ${spot.lat},`,
    `    lon: ${spot.lon},`,
    `    tz: 'Pacific/Honolulu',`,
    `    coast: '${spot.coast}',`,
    `    island: ${JSON.stringify(spot.island)},`,
    `    buoyStation: '${spot.buoyStation}',`,
    `    runoffSensitivity: '${spot.runoffSensitivity}',`,
    `    nearStreamMouth: ${spot.nearStreamMouth},`,
    `    nearDrainage: ${spot.nearDrainage},`,
    `    maxCleanSwellFt: ${spot.maxCleanSwellFt},`,
    `    hardNoGoSwellFt: ${spot.hardNoGoSwellFt},`,
    `  },`,
  ];
  return lines.join('\n');
}

console.log(`// Auto-generated from Webflow CMS by scripts/generate-spots.js`);
console.log(`// ${out.length} spots — re-run when Webflow gains new entries.`);
console.log(`const SPOTS = [`);
for (const s of out) console.log(toJsLiteral(s));
console.log(`];\n`);

// Also drop a JSON copy for the Firestore seed script.
const jsonOut = path.join(path.dirname(INPUT), 'spots-generated.json');
fs.writeFileSync(jsonOut, JSON.stringify(out, null, 2), 'utf8');
console.error(`wrote ${out.length} spots → ${jsonOut}`);
