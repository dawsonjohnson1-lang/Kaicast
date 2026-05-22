/* eslint-env node */
/**
 * Disposable diagnostic — exercises every live external data source
 * the KaiCast functions touch, using Hanauma Bay as the test spot.
 *
 * Run from functions/ dir:
 *   export OPENWEATHER_API_KEY=$(firebase functions:secrets:access OPENWEATHER_API_KEY 2>/dev/null)
 *   node diagnose-sources.js
 *
 * (CMEMS/NASA satellite creds no longer needed — kd490 fetcher
 * migrated to NOAA CoastWatch which is public.)
 *
 * Not committed. Delete after diagnosis.
 */

'use strict';

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'kaicast-207dc' });
const db = admin.firestore();

const SPOT = {
  id: 'hanauma-bay',
  lat: 21.268517,
  lon: -157.693045,
  buoyStation: '51202',
  tideStation: '1612340',
};
const NOW_MS = Date.now();

async function timeIt(label, fn) {
  const t0 = Date.now();
  try {
    return { label, ok: true, latencyMs: Date.now() - t0, result: await fn() };
  } catch (e) {
    return {
      label,
      ok: false,
      latencyMs: Date.now() - t0,
      error: e?.message ?? String(e),
    };
  }
}

// ───── probes ────────────────────────────────────────────────────────────

async function probeNoaaTides() {
  const { fetchTideSeries } = require('./tides');
  const series = await fetchTideSeries(SPOT.tideStation, NOW_MS);
  return {
    pointCount: series?.length ?? 0,
    firstPoint: series?.[0],
  };
}

async function probeNdbcBuoy() {
  const { fetchBuoyHourly } = require('./buoy_Version2');
  const data = await fetchBuoyHourly({ station: SPOT.buoyStation });
  const firstKey = data.waveHMap.size ? [...data.waveHMap.keys()][0] : null;
  return {
    waveHCount: data.waveHMap.size,
    sstCount:   data.sstMap.size,
    sampleHourIso: firstKey,
    sampleWaveHm:  firstKey ? data.waveHMap.get(firstKey) : null,
    sampleSstC:    firstKey ? data.sstMap.get(firstKey)   : null,
  };
}

async function probeOpenWeather() {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) throw new Error('OPENWEATHER_API_KEY not set');
  const url =
    `https://api.openweathermap.org/data/3.0/onecall` +
    `?lat=${SPOT.lat}&lon=${SPOT.lon}&exclude=minutely,alerts` +
    `&units=metric&appid=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  return {
    nowTempC:    j?.current?.temp,
    nowWindMs:   j?.current?.wind_speed,
    hourlyCount: j?.hourly?.length,
  };
}

async function probeOpenMeteoMarine() {
  const { fetchMarineForecast } = require('./marineForecast');
  const f = await fetchMarineForecast({ lat: SPOT.lat, lon: SPOT.lon, days: 3 });
  const firstKey = f.waveHMap.size ? [...f.waveHMap.keys()][0] : null;
  return {
    waveHCount: f.waveHMap.size,
    sampleHourIso: firstKey,
    sampleWaveHm:  firstKey ? f.waveHMap.get(firstKey)  : null,
    sampleWavePs:  firstKey ? f.wavePMap.get(firstKey)  : null,
  };
}

async function probeCoastWatchKd490Direct() {
  // 11 days back per the kd490 fetcher's LOOKBACK_START_DAYS default.
  const t = new Date(NOW_MS - 11 * 86400000);
  const iso =
    t.getUTCFullYear() + '-' +
    String(t.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(t.getUTCDate()).padStart(2, '0') + 'T12:00:00Z';
  const url =
    'https://coastwatch.noaa.gov/erddap/griddap/noaacwNPPN20S3AkdSCIDINEOF2kmDaily.csv?' +
    `kd_490%5B(${iso})%5D%5B(0.0)%5D%5B(${SPOT.lat.toFixed(5)})%5D%5B(${SPOT.lon.toFixed(5)})%5D`;
  const r = await fetch(url);
  const body = await r.text();
  // Last line: "2026-05-06T12:00:00Z,0.0,21.260412,-157.6979,0.0234"
  const last = body.trim().split('\n').pop() ?? '';
  const cols = last.split(',');
  const v = Number(cols[cols.length - 1]);
  return {
    httpStatus: r.status,
    sampleDateUtc: iso,
    kd490: Number.isFinite(v) ? v : null,
    secchiDepthEstM: Number.isFinite(v) && v > 0 ? Math.round((1.7 / v) * 10) / 10 : null,
  };
}

async function probeOceanColorViaPipeline() {
  // End-to-end: call the actual production fetcher (includes cache).
  const { fetchOceanColor, kd490ToVisibility } = require('./abyss/kd490');
  const oc = await fetchOceanColor({ lat: SPOT.lat, lon: SPOT.lon, nowMs: NOW_MS, db });
  if (!oc) return { result: null };
  return {
    source:     oc.source,
    kd490:      oc.kd490,
    chl:        oc.chlorophyll,
    ageHours:   oc.ageHours,
    confidence: oc.confidence,
    derived:    kd490ToVisibility(oc.kd490),
  };
}

async function probePacioosDirect() {
  const url =
    'https://pae-paha.pacioos.hawaii.edu/erddap/griddap/roms_hiig.json' +
    `?temp[(last)][0:1:35][(${SPOT.lat})][(${SPOT.lon})]`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const rows = j?.table?.rows ?? [];
  const profile = rows
    .map((row) => ({ d: Number(row[1]), t: row[4] }))
    .filter((p) => Number.isFinite(p.d) && Number.isFinite(p.t));
  return {
    httpStatus: r.status,
    depthCount: profile.length,
    surfaceTempC: profile[0]?.t,
    bottomTempC:  profile[profile.length - 1]?.t,
  };
}

async function probeSubsurfaceOrchestrator() {
  const { getSubsurfaceProfile } = require('./abyss/subsurface');
  const ss = await getSubsurfaceProfile(
    { id: SPOT.id, lat: SPOT.lat, lon: SPOT.lon },
    { surfaceTempC: 25.7 },
  );
  if (!ss) return { result: null };
  return {
    source:           ss.source,
    confidence:       ss.confidence,
    profilePoints:    ss.profile?.length,
    surfaceTempC:     ss.surfaceTempC,
    thermoclineDepthM: ss.thermoclineDepthM,
  };
}

// ───── main ──────────────────────────────────────────────────────────────

(async () => {
  console.log(`\nKaiCast data-source diagnostic`);
  console.log(`Spot: ${SPOT.id} (${SPOT.lat}, ${SPOT.lon})`);
  console.log(`Now:  ${new Date(NOW_MS).toISOString()}\n`);

  const results = [];
  results.push(await timeIt('NOAA Tides',                   probeNoaaTides));
  results.push(await timeIt('NDBC Buoy 51202',              probeNdbcBuoy));
  results.push(await timeIt('OpenWeather One Call',         probeOpenWeather));
  results.push(await timeIt('Open-Meteo Marine',            probeOpenMeteoMarine));
  results.push(await timeIt('NOAA CoastWatch KD490 (direct)', probeCoastWatchKd490Direct));
  results.push(await timeIt('Ocean-color pipeline (cached)',  probeOceanColorViaPipeline));
  results.push(await timeIt('PacIOOS ROMS (direct)',          probePacioosDirect));
  results.push(await timeIt('Subsurface orchestrator',        probeSubsurfaceOrchestrator));

  console.log('─'.repeat(76));
  console.log('SUMMARY');
  console.log('─'.repeat(76));
  for (const r of results) {
    const status = r.ok ? '✅' : '❌';
    console.log(`${status}  ${r.label.padEnd(36)} ${String(r.latencyMs + 'ms').padStart(8)}`);
    if (!r.ok) console.log(`     └─ ${r.error}`);
  }
  console.log('\n─'.repeat(76));
  console.log('DETAIL');
  console.log('─'.repeat(76));
  for (const r of results) {
    console.log(`\n[${r.ok ? 'OK' : 'FAIL'}] ${r.label}  (${r.latencyMs}ms)`);
    if (r.ok) console.log(JSON.stringify(r.result, null, 2).split('\n').map((l) => '  ' + l).join('\n'));
    else console.log('  ERROR: ' + r.error);
  }

  process.exit(0);
})().catch((e) => {
  console.error('Diagnostic harness crashed:', e);
  process.exit(1);
});
