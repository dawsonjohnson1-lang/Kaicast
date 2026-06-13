/* eslint-env node */

/**
 * Abyss — Main visibility engine.
 *
 * Replaces the heuristic estimateVisibility() with a layered, data-grounded model:
 *
 *   Layer 1 (satellite baseline): KD490 → Secchi → horizontal vis
 *   Layer 2 (wave energy):        orbital velocity → sediment resuspension factor
 *   Layer 3 (tidal flushing):     tide phase → flushing multiplier
 *   Layer 4 (runoff plume):       rain → sediment penalty (uses existing assessRunoffRisk)
 *   Layer 5 (chlorophyll/algae):  CHL → bloom penalty
 *   Layer 6 (SPM direct):         suspended particulate → secondary check
 *
 * Falls back to legacy estimateVisibility() when satellite data is unavailable.
 *
 * Exports:
 *  - estimateVisibilityAbyss(opts)   [async]
 *  - generateDiveScore(opts)
 *  - buildAbyssScoreBreakdown(diveScore)
 */

const { fetchOceanColor, kd490ToVisibility } = require('./kd490');
const { computeWaveImpactAtSite } = require('./wave-physics');
const { estimateVisibility } = require('../analysis');
const { visibilityScoreCap, ratingFromScore } = require('./ratingConfig');
const { solarPosition, isShadowed, solarLightFactor, swellExposureFactor, classifyWindRelative } = require('./solar');
const { getHorizonProfile } = require('./horizon');

// ─── Constants ───────────────────────────────────────────────────────────────

// Tidal flushing multipliers: how tide phase affects sediment suspension
const TIDAL_MULTIPLIER = {
  rising:  1.10,  // incoming tide flushes cleaner ocean water in
  slack:   1.03,  // minimal flushing, particles settling
  falling: 0.90,  // outgoing tide pulls sediment-laden nearshore water out
  unknown: 1.00,
};

// Runoff penalty factors by severity
const RUNOFF_PENALTY = {
  none:     0.00,
  low:      0.05,
  moderate: 0.20,
  high:     0.45,
  extreme:  0.70,
};

// Chlorophyll bloom threshold (mg/m³)
// Hawaiian coastal waters: <0.5 mg/m³ typical, >1.0 = bloom, >3.0 = severe
const BLOOM_THRESHOLD = 2.0;

// SPM clear-water threshold (g/m³)
// Clear tropical: <1 g/m³, turbid: >5 g/m³
const SPM_CLEAR_THRESHOLD = 5.0;

// SPM proxy (the ERDDAP datasets we use don't serve SPM directly):
// chlorophyll above this level + wave-stirred bottom = suspended
// particulate load. See the Layer 6 block for the full rationale.
const SPM_PROXY_CHL_THRESHOLD = 1.5;     // mg/m³ — elevated for Hawaii nearshore
const SPM_PROXY_ORBITAL_FRACTION = 0.6;  // of the sediment resuspension threshold
const SPM_PROXY_MAX_PENALTY = 0.35;      // cap: proxy is inferred, never as harsh as direct SPM

// Per-layer floor: no single layer may cut visibility below this
// fraction of its input. Stacked worst-cases (runoff 0.30 × bloom 0.6
// × wave 0.16) used to compound to implausible sub-meter intermediates
// that only the final max(1, …) clamp papered over; clamping each
// layer keeps every intermediate physically plausible AND keeps the
// per-layer rationale deltas honest.
const LAYER_FLOOR = 0.2;

/**
 * Apply one multiplicative layer with a confidence weight and a floor.
 *
 * `weight` (0..1) is how much we trust the inputs driving this layer —
 * a layer fed by low-confidence or missing data is damped toward 1.0
 * (no-op) rather than applied at full strength:
 *
 *   effective = 1 + (multiplier − 1) × weight,  clamped to ≥ LAYER_FLOOR
 *
 * Returns { vis, multiplier } where multiplier is the effective one
 * (post-damping, post-floor) actually applied.
 */
function applyLayer(vis, multiplier, weight = 1) {
  const w = Math.max(0, Math.min(1, Number.isFinite(weight) ? weight : 1));
  const m = 1 + (multiplier - 1) * w;
  const floored = Math.max(LAYER_FLOOR, m);
  return { vis: vis * floored, multiplier: floored };
}

/**
 * Freshness penalty for reusing a cached satellite KD490 value rather
 * than falling back to the heuristic. Time since the value was pulled
 * from ERDDAP (NOT the composite's own age — that's already priced
 * into oceanColor.confidence): 1.0 fresh → 0.95 at 24 h → 0.90 at
 * 48 h → 0.85 at 72 h, then keeps decaying at the same slope to a
 * 0.75 floor while the 7-day cache TTL still serves it.
 */
function satelliteFreshnessPenalty(fetchAgeHours) {
  if (!Number.isFinite(fetchAgeHours) || fetchAgeHours <= 0) return 1.0;
  return Math.max(0.75, 1 - 0.05 * (fetchAgeHours / 24));
}

// ─── Main Abyss visibility function ──────────────────────────────────────────

/**
 * Estimate dive visibility using satellite + oceanographic data.
 *
 * @param {object} opts
 * @param {number} opts.lat
 * @param {number} opts.lon
 * @param {number} opts.nowMs
 * @param {number} [opts.windKnots]
 * @param {number} [opts.waveHeightM]
 * @param {number} [opts.wavePeriodS]
 * @param {string} [opts.tidePhase] - 'rising'|'falling'|'slack'|'unknown'
 * @param {object} [opts.rainRollups] - { rain3hMM, rain6hMM, rain12hMM, rain24hMM, rain72hMM }
 * @param {object} [opts.runoff] - result from assessRunoffRisk
 * @param {number} [opts.cloudCoverPercent]
 * @param {number} [opts.hourLocal]
 * @param {object} opts.spot - full spot config with Abyss fields
 * @param {number} [opts.targetDepthM] - override target depth
 * @param {object} [opts.db] - Firestore for cache (used only when oceanColor is undefined)
 * @param {object|null} [opts.oceanColor] - pre-fetched ocean-color result.
 *   When the caller provides this (even as `null`), the internal
 *   fetchOceanColor() call is skipped. The scheduler/getReport pipeline
 *   passes one fetch result into all per-window invocations to avoid a
 *   thundering-herd on the ERDDAP endpoint.
 * @returns {object} Abyss visibility result
 */
async function estimateVisibilityAbyss(opts) {
  const {
    lat, lon, nowMs,
    windKnots, windDirectionDegFrom,
    waveHeightM: rawWaveHeightM, wavePeriodS,
    waveDirectionDegFrom,
    tidePhase = 'unknown',
    rainRollups, runoff,
    cloudCoverPercent, hourLocal,
    spot = {},
    targetDepthM,
    db,
  } = opts;
  // `oceanColor` is read separately because the meaningful sentinel is
  // "present in opts" — `null` is a valid value meaning "we tried and
  // got nothing", which should still skip the internal fetch.
  const oceanColorProvided = Object.prototype.hasOwnProperty.call(opts, 'oceanColor');
  const providedOceanColor = oceanColorProvided ? opts.oceanColor : undefined;

  const siteDepth = spot.maxDepthM || 10;
  const diveDepth = targetDepthM || spot.typicalDiveDepthM || siteDepth * 0.6;
  const sedimentType = spot.sedimentType || 'coral_rubble';
  const sedimentSensitivity = spot.sedimentSensitivity || 'medium';

  // ── Solar position + topographic shadow ────────────────────────────────────
  // Doesn't need satellite data — horizon profiles ship statically and the
  // sun calc is local. Computed up-front so it's available in both the
  // abyss and the heuristic-fallback paths.
  const sun = solarPosition(lat, lon, nowMs);
  const horizonProfile = getHorizonProfile(spot.id);
  const shadow = isShadowed({ horizonProfile, sun });
  const light = solarLightFactor({ sun, shadow, cloudCoverPercent });

  // ── Swell direction shielding ───────────────────────────────────────────────
  // Buoys / marine forecast give open-ocean wave height. If the swell
  // direction is blocked by terrain (e.g. an east swell hitting a
  // west-Maui spot shielded by Haleakala), the spot sees a fraction
  // of that energy. Falls through to 1.0 (no shielding) when we
  // don't know the direction or have no horizon profile.
  const exposureFactor = swellExposureFactor(horizonProfile, waveDirectionDegFrom);
  const waveHeightM = Number.isFinite(rawWaveHeightM)
    ? rawWaveHeightM * exposureFactor
    : rawWaveHeightM;

  // ── Wind chop / surface-condition factor ────────────────────────────────────
  // Onshore wind kicks up local short-period chop that resuspends
  // shallow sediment and stirs the upper water column — sandy spots
  // feel this hardest. Offshore wind flattens the surface and
  // actually cleans the upper layer slightly. The orientation comes
  // from comparing wind-FROM bearing to the spot's open-ocean bearing.
  const windRel = classifyWindRelative(horizonProfile, windDirectionDegFrom);
  const sensFactor =
    sedimentSensitivity === 'high' ? 1.4 :
    sedimentSensitivity === 'low'  ? 0.5 : 1.0;
  let windChopMultiplier = 1.0;
  if (Number.isFinite(windKnots) && windKnots > 8) {
    if (windRel.relation === 'onshore') {
      // Onshore wind > threshold → chop. Severity scales with speed.
      const choppinessKts = Math.max(0, windKnots - 8);
      const onshoreStrength = Math.max(0, -windRel.factor); // 0..1
      const reduction = Math.min(0.55, choppinessKts * 0.025 * sensFactor * onshoreStrength);
      windChopMultiplier = 1 - reduction;
    } else if (windRel.relation === 'offshore' && windKnots > 12) {
      // Offshore breeze cleans the surface — small bonus.
      const offshoreStrength = Math.max(0, windRel.factor); // 0..1
      windChopMultiplier = 1 + 0.05 * offshoreStrength;
    }
    // 'cross' or 'unknown' → no adjustment.
  }

  // ── Layer 0: Satellite data (pre-fetched or fetch ourselves) ───────────────
  // Prefer caller-provided result: in the scheduler/getReport hot path,
  // buildSpotReport fetches once per spot and threads the result into
  // every per-window invocation, avoiding 10–20 concurrent ERDDAP
  // fetches per spot.
  let oceanColor = oceanColorProvided ? providedOceanColor : null;
  try {
    if (!oceanColorProvided) {
      oceanColor = await fetchOceanColor({
        lat, lon, nowMs, db,
      });
    }
  } catch {
    // Satellite fetch failed — will fall back to heuristic
  }

  // If no satellite data, fall back to legacy heuristic
  if (!oceanColor || oceanColor.kd490 == null) {
    const swellFt = waveHeightM != null ? waveHeightM * 3.28084 : null;
    const legacy = estimateVisibility({
      windKnots,
      swellFeet: swellFt,
      swellPeriodSec: wavePeriodS,
      tidePhase,
      rainLast24hMM: rainRollups?.rain24hMM,
      cloudCoverPercent,
      hourLocal,
      runoff,
    });

    // Apply solar light factor + wind chop on the heuristic path too.
    // Light: real underwater clarity isn't 40% on a cloudy day. Floor
    // the multiplier at 0.55 so overcast/early-morning still reads as
    // ~70-80% of clear-day vis, drop hard only into actual twilight
    // (factor<0.15) where light.factor itself drives the result.
    const lightMultiplier = light.factor < 0.15
      ? 0.25 + light.factor * 2.0       // twilight/night: 0.25–0.55
      : 0.55 + 0.45 * Math.min(1.0, light.factor);
    const visAfterLight = legacy.estimatedVisibilityMeters * lightMultiplier;
    let visM = visAfterLight * windChopMultiplier;
    // Same depth ceiling as the satellite path — can't see further
    // than the bottom.
    const heurDepthCeilingM = Math.max(3, siteDepth * 1.2);
    visM = Math.min(heurDepthCeilingM, visM);
    const visMRounded = Math.max(2, Math.round(visM));

    // Plain-English lines — same convention as the satellite path: the
    // (±N%) token is what the mobile client colorizes on.
    const heurRationale = [];
    const lightPct = Math.round((lightMultiplier - 1) * 100);
    if (lightPct <= -5) {
      heurRationale.push(`Low sun and shadow are cutting the light underwater (${lightPct}%)`);
    }
    const windPct = Math.round((windChopMultiplier - 1) * 100);
    if (windPct <= -5) {
      heurRationale.push(`Wind chop is churning the surface layer (${windPct}%)`);
    } else if (windPct >= 5) {
      heurRationale.push(`Offshore breeze is smoothing out the surface (+${windPct}%)`);
    }
    if (Number.isFinite(exposureFactor) && exposureFactor < 0.85) {
      heurRationale.push(`Terrain is blocking most of this swell (${Math.round((exposureFactor - 1) * 100)}%)`);
    }

    return {
      estimatedVisibilityMeters: visMRounded,
      estimatedVisibilityFeet: Math.round(visMRounded * 3.28084),
      rating:
        visMRounded < 5  ? 'Poor' :
        visMRounded < 10 ? 'Fair' :
        visMRounded < 18 ? 'Good' : 'Excellent',
      source: 'heuristic',
      confidence: 0.4,
      kd490: null,
      chlorophyll: null,
      spm: null,
      spmProxy: null,
      dataAgeHours: null,
      dataQuality: {
        source: 'heuristic',
        freshness: 'none',
        satelliteFetchAgeHours: null,
        compositeAgeDays: null,
        freshnessPenalty: null,
      },
      layers: { baseline: null, wave: null, tidal: null, runoff: null, bloom: null, spm: null, light: visMRounded },
      waveImpact: null,
      sun: { altitudeDeg: sun.altitudeDeg, azimuthDeg: sun.azimuthDeg },
      shadow: shadow.shadowed ? { shadowed: true, reason: shadow.reason, horizonDeg: shadow.horizonDeg, marginDeg: shadow.marginDeg } : { shadowed: false, marginDeg: shadow.marginDeg, horizonDeg: shadow.horizonDeg },
      light,
      exposure: { factor: Math.round(exposureFactor * 100) / 100, swellFromDeg: waveDirectionDegFrom ?? null, rawWaveHeightM: rawWaveHeightM ?? null, effectiveWaveHeightM: waveHeightM ?? null },
      wind: { relation: windRel.relation, openOceanBearingDeg: windRel.openBearingDeg, angleFromOpenDeg: windRel.angleFromOpenDeg, chopMultiplier: Math.round(windChopMultiplier * 100) / 100 },
      rationale: heurRationale,
      _fallbackReason: 'no-satellite-data',
    };
  }

  // ── Layer 1: Satellite baseline ────────────────────────────────────────────
  // The cached-KD490 freshness penalty lands here too: a value pulled
  // from ERDDAP 48 h ago is still far better than the heuristic, but
  // the water has had two days to drift from what the satellite saw.
  const kd490Data = kd490ToVisibility(oceanColor.kd490);
  const freshnessPenalty = satelliteFreshnessPenalty(oceanColor.fetchAgeHours);
  let vis = (kd490Data.visibilityEstimateM || 15) * freshnessPenalty;
  const layerBaseline = vis;

  // ── Layer 2: Wave energy correction ────────────────────────────────────────
  // Weight: wave height/period come straight from buoy/forecast — when
  // both are finite we trust them fully; the layer is skipped otherwise.
  let waveImpact = null;
  if (Number.isFinite(waveHeightM) && Number.isFinite(wavePeriodS)) {
    waveImpact = computeWaveImpactAtSite({
      waveHeightM,
      wavePeriodS,
      siteDepthM: siteDepth,
      targetDepthM: diveDepth,
      sedimentType,
    });

    // Sediment sensitivity scaling
    const sensitivityScale =
      sedimentSensitivity === 'high' ? 1.4 :
      sedimentSensitivity === 'low' ? 0.6 : 1.0;

    // Apply sigmoid-shaped sediment factor based on orbital velocity
    const threshold = { sand: 0.15, coral_rubble: 0.20, reef: 0.30, silt: 0.10 }[sedimentType] || 0.20;
    const orbVel = waveImpact.orbitalVelocityMps;
    const sedimentFactor = 1 / (1 + Math.exp(-10 * (orbVel - threshold)));
    vis = applyLayer(vis, 1 - sedimentFactor * 0.6 * sensitivityScale, 1).vis;
  }
  const layerWave = vis;

  // ── Layer 3: Tidal flushing ────────────────────────────────────────────────
  // 'unknown' phase maps to 1.0 already; no extra damping needed.
  vis = applyLayer(vis, TIDAL_MULTIPLIER[tidePhase] || 1.0, 1).vis;
  const layerTidal = vis;

  // ── Layer 4: Runoff plume ──────────────────────────────────────────────────
  // Weight: the runoff assessment carries its own confidence (rain
  // rollups may be partly estimated) — a shaky "extreme" call gets
  // damped instead of slashing visibility at full strength.
  const runoffSeverity = runoff?.severity || 'none';
  const runoffPenalty = RUNOFF_PENALTY[runoffSeverity] || 0;
  const runoffWeight = Number.isFinite(runoff?.confidence) ? runoff.confidence : 0.7;
  vis = applyLayer(vis, 1 - runoffPenalty, runoffWeight).vis;
  const layerRunoff = vis;

  // ── Layer 5: Chlorophyll/algae bloom ───────────────────────────────────────
  // Weight: chlorophyll rides the same satellite product as KD490, so
  // inherit the ocean-color confidence.
  const chl = oceanColor.chlorophyll;
  const oceanColorWeight = Number.isFinite(oceanColor.confidence) ? oceanColor.confidence : 0.7;
  if (Number.isFinite(chl) && chl > 0) {
    const bloomFactor = Math.min(1, chl / BLOOM_THRESHOLD);
    vis = applyLayer(vis, 1 - bloomFactor * 0.4, oceanColorWeight).vis;
  }
  const layerBloom = vis;

  // ── Layer 6: Suspended particulate matter ──────────────────────────────────
  // Direct SPM when a dataset serves it (none of ours currently do);
  // otherwise a DERIVED PROXY instead of skipping the layer:
  //
  //   In Hawaii nearshore water, elevated chlorophyll co-occurs with
  //   elevated particulate load (plankton + the organic detritus that
  //   travels with it), and wave-driven near-bottom orbital motion is
  //   what actually lofts that material into the water column. So when
  //   BOTH chl > 1.5 mg/m³ AND the bottom orbital velocity exceeds 60%
  //   of the sediment resuspension threshold — i.e. the bottom is being
  //   stirred even if not fully resuspended — we apply a penalty
  //   proportional to both excesses, capped at 35% (a proxy should
  //   never bite as hard as a direct measurement could).
  //
  //   spmProxyIndex = clamp01((chl − 1.5) / 3) × clamp01((velRatio − 0.6) / 0.6)
  //
  // Weight: chl confidence × 0.8 — it's an inference, not a reading.
  const spm = oceanColor.spm;
  let spmProxy = null;
  if (Number.isFinite(spm) && spm > 0) {
    const spmPenalty = Math.min(0.6, spm / SPM_CLEAR_THRESHOLD);
    vis = applyLayer(vis, 1 - spmPenalty, oceanColorWeight).vis;
  } else if (
    Number.isFinite(chl) && chl > SPM_PROXY_CHL_THRESHOLD &&
    waveImpact && waveImpact.resuspensionThresholdMps > 0
  ) {
    const velRatio = waveImpact.bottomOrbitalVelocityMps / waveImpact.resuspensionThresholdMps;
    if (velRatio > SPM_PROXY_ORBITAL_FRACTION) {
      const clamp01 = (x) => Math.max(0, Math.min(1, x));
      const chlExcess = clamp01((chl - SPM_PROXY_CHL_THRESHOLD) / 3.0);
      const stirExcess = clamp01((velRatio - SPM_PROXY_ORBITAL_FRACTION) / SPM_PROXY_ORBITAL_FRACTION);
      const proxyIndex = chlExcess * stirExcess;
      const applied = applyLayer(vis, 1 - proxyIndex * SPM_PROXY_MAX_PENALTY, oceanColorWeight * 0.8);
      vis = applied.vis;
      spmProxy = {
        index: Math.round(proxyIndex * 100) / 100,
        velocityRatio: Math.round(velRatio * 100) / 100,
        chlorophyll: chl,
        appliedMultiplier: Math.round(applied.multiplier * 100) / 100,
      };
    }
  }
  const layerSpm = vis;

  // ── Layer 7: Solar light + topographic shadow ──────────────────────────────
  // Underwater clarity is dominated by water properties, not surface
  // light, until we drop into actual twilight/shadow. Floor at 0.55
  // so a cloudy mid-morning still reads near full vis; only deep
  // twilight (factor<0.15) drives the multiplier down hard.
  // Weight stays 1 even when cloud cover is missing: the dominant
  // driver (sun altitude + horizon shadow) is deterministic, and
  // damping the layer would wrongly brighten twilight/night estimates.
  const lightMultiplier = light.factor < 0.15
    ? 0.25 + light.factor * 2.0
    : 0.55 + 0.45 * Math.min(1.0, light.factor);
  vis = applyLayer(vis, lightMultiplier, 1).vis;
  const layerLight = vis;

  // ── Layer 8: Surface chop from wind direction ──────────────────────────────
  vis = applyLayer(vis, windChopMultiplier, 1).vis;
  const layerWind = vis;

  // ── Build rationale so users see WHY visibility is what it is ──────────────
  // Plain-English sentences, not "Factor: -23%" readouts — these render
  // directly in the apps' "WHY X FT?" card. The trailing (±N%) token is
  // load-bearing: the mobile client regexes it to colorize each line.
  const rationale = [];
  const pushDelta = (phrases, before, after) => {
    if (!Number.isFinite(before) || !Number.isFinite(after)) return;
    const pct = Math.round(((after - before) / Math.max(0.5, before)) * 100);
    if (Math.abs(pct) < 5) return; // skip noise
    const phrase = pct > 0 ? phrases.up : phrases.down;
    if (!phrase) return;
    const sign = pct > 0 ? '+' : '';
    rationale.push(`${phrase} (${sign}${pct}%)`);
  };
  pushDelta({ down: 'Surge is stirring sediment off the bottom' }, layerBaseline, layerWave);
  pushDelta({
    up:   'Incoming tide is pulling in clean ocean water',
    down: 'Falling tide is dragging cloudy nearshore water through',
  }, layerWave, layerTidal);
  pushDelta({ down: 'Runoff from recent rain is clouding the water' }, layerTidal, layerRunoff);
  pushDelta({ down: 'An algae bloom is tinting the water' }, layerRunoff, layerBloom);
  pushDelta({ down: 'Fine particulate is hanging in the water column' }, layerBloom, layerSpm);
  pushDelta({ down: 'Low sun and shadow are cutting the light underwater' }, layerSpm, layerLight);
  pushDelta({
    up:   'Offshore breeze is smoothing out the surface',
    down: 'Wind chop is churning the surface layer',
  }, layerLight, layerWind);

  // ── Final clamping & rating ────────────────────────────────────────────────
  // You can't see further horizontally than the bottom depth in real
  // diving conditions — reported visibility should never exceed the
  // spot's actual depth. Hanauma's 10m bottom can't read 25m vis even
  // on the clearest water. siteDepth defaults to 10 when the spot
  // record doesn't specify maxDepthM.
  const depthCeilingM = Math.max(3, siteDepth * 1.2); // +20% slack for diagonal sightlines
  vis = Math.max(1, Math.min(40, depthCeilingM, vis));
  const visFt = Math.round(vis * 3.28084);
  const visM = Math.round(vis * 10) / 10;

  let rating = 'Excellent';
  if (vis < 5) rating = 'Poor';
  else if (vis < 10) rating = 'Fair';
  else if (vis < 18) rating = 'Good';

  // Confidence from satellite quality + data completeness
  let confidence = oceanColor.confidence || 0.7;
  if (!Number.isFinite(waveHeightM)) confidence *= 0.85;
  if (tidePhase === 'unknown') confidence *= 0.9;
  if (runoff && runoff.confidence < 0.6) confidence *= 0.9;
  confidence = Math.round(confidence * 100) / 100;

  // Freshness tier shown to users: how directly the satellite is
  // driving this number. 'live' = fetched this pipeline run, 'recent'
  // = cached <24 h, 'aging' = cached 24-72 h, 'stale' = older cache.
  const fetchAge = Number.isFinite(oceanColor.fetchAgeHours) ? oceanColor.fetchAgeHours : 0;
  const freshness =
    !oceanColor.fromCache ? 'live' :
    fetchAge < 24  ? 'recent' :
    fetchAge <= 72 ? 'aging' : 'stale';

  return {
    estimatedVisibilityMeters: Math.round(visM),
    estimatedVisibilityFeet: visFt,
    rating,
    source: 'satellite',
    confidence,
    kd490: oceanColor.kd490,
    chlorophyll: oceanColor.chlorophyll,
    spm: oceanColor.spm,
    spmProxy,
    dataAgeHours: oceanColor.ageHours,
    dataQuality: {
      source: 'satellite',
      freshness,
      satelliteFetchAgeHours: Math.round(fetchAge * 10) / 10,
      compositeAgeDays: Number.isFinite(oceanColor.ageHours) ? Math.round(oceanColor.ageHours / 24) : null,
      freshnessPenalty: Math.round(freshnessPenalty * 100) / 100,
    },
    layers: {
      baseline: Math.round(layerBaseline * 10) / 10,
      wave: Math.round(layerWave * 10) / 10,
      tidal: Math.round(layerTidal * 10) / 10,
      runoff: Math.round(layerRunoff * 10) / 10,
      bloom: Math.round(layerBloom * 10) / 10,
      spm: Math.round(layerSpm * 10) / 10,
      light: Math.round(layerLight * 10) / 10,
      wind: Math.round(layerWind * 10) / 10,
    },
    rationale,
    waveImpact,
    sun: { altitudeDeg: sun.altitudeDeg, azimuthDeg: sun.azimuthDeg },
    shadow: shadow.shadowed
      ? { shadowed: true, reason: shadow.reason, horizonDeg: shadow.horizonDeg, marginDeg: shadow.marginDeg }
      : { shadowed: false, marginDeg: shadow.marginDeg, horizonDeg: shadow.horizonDeg },
    light,
    exposure: {
      factor: Math.round(exposureFactor * 100) / 100,
      swellFromDeg: waveDirectionDegFrom ?? null,
      rawWaveHeightM: rawWaveHeightM ?? null,
      effectiveWaveHeightM: waveHeightM ?? null,
    },
    _fallbackReason: null,
  };
}

// ─── Dive score ──────────────────────────────────────────────────────────────

/**
 * Generate a dive-specific quality score (0-100).
 * Weighted differently from snorkel rating: more emphasis on visibility/surge,
 * less on wind (divers are underwater).
 *
 * @param {object} opts
 * @returns {{ overallScore, rating, cautionNote, details }}
 */
function generateDiveScore({
  visibilityAbyss,
  waveImpact,
  thermocline,
  currentKnots = 0.3,
  surfaceChopRating = 0,
  runoff,
  tideCycle,
  jellyfishWarning = false,
  targetDepthM = 10,
  siteType = 'reef',
  confidenceScore = 1.0,
} = {}) {
  let score = 100;
  const details = {};

  // ── Visibility (40% weight) ────────────────────────────────────────────────
  const visM = visibilityAbyss?.estimatedVisibilityMeters ?? 10;
  if (visM < 3) { score -= 45; details.vis = -45; }
  else if (visM < 6) { score -= 30; details.vis = -30; }
  else if (visM < 10) { score -= 15; details.vis = -15; }
  else if (visM < 15) { score -= 5; details.vis = -5; }
  else { details.vis = 0; }

  // ── Surge / wave energy at depth (25% weight) ──────────────────────────────
  const surge = waveImpact?.surgeRating ?? 0;
  if (surge > 80) { score -= 35; details.surge = -35; }
  else if (surge > 50) { score -= 20; details.surge = -20; }
  else if (surge > 30) { score -= 10; details.surge = -10; }
  else { details.surge = 0; }

  // ── Current (15% weight) ───────────────────────────────────────────────────
  if (currentKnots > 2.5) { score -= 30; details.current = -30; }
  else if (currentKnots > 1.5) { score -= 15; details.current = -15; }
  else if (currentKnots > 0.8) { score -= 5; details.current = -5; }
  else { details.current = 0; }

  // ── Surface conditions (10% weight) — affects entry/exit only ──────────────
  if (surfaceChopRating > 70) { score -= 15; details.surface = -15; }
  else if (surfaceChopRating > 40) { score -= 8; details.surface = -8; }
  else { details.surface = 0; }

  // ── Runoff / water quality ─────────────────────────────────────────────────
  if (runoff?.safeToEnter === false) {
    score = Math.min(score, 25);
    details.runoff = -40;
  } else if (runoff?.severity === 'moderate') {
    score -= 15;
    details.runoff = -15;
  } else if (runoff?.severity === 'low') {
    score -= 5;
    details.runoff = -5;
  } else {
    details.runoff = 0;
  }

  // ── Jellyfish ──────────────────────────────────────────────────────────────
  if (jellyfishWarning) {
    score -= 20;
    details.jellyfish = -20;
  }

  // ── Thermocline bonus/penalty ──────────────────────────────────────────────
  if (thermocline?.meetsThermocline) {
    if (thermocline.expectedVisibilityChange === 'improve') {
      score += 5;
      details.thermocline = +5;
    } else if (thermocline.expectedVisibilityChange === 'worsen') {
      score -= 10;
      details.thermocline = -10;
    }
  }

  // ── Site type adjustments ──────────────────────────────────────────────────
  if (siteType === 'cave' || siteType === 'lava_tube') {
    // Caves need excellent vis — increase penalties for poor vis
    if (visM < 8) { score -= 10; details.siteType = -10; }
  }
  if (siteType === 'wall') {
    // Walls are less affected by bottom sediment
    if (waveImpact?.sedimentRisk === 'low') { score += 3; details.siteType = +3; }
  }

  // ── Confidence penalty ─────────────────────────────────────────────────────
  if (confidenceScore < 0.7) {
    const confPenalty = Math.round((1 - confidenceScore) * 20);
    score -= confPenalty;
    details.confidence = -confPenalty;
  }

  score = Math.max(0, Math.min(100, score));

  // ── Visibility CEILING (role 2 of 2) ───────────────────────────────
  // Same hard clamp as the snorkel scorer (see abyss/ratingConfig.js
  // and the long comment in analysis.generateSnorkelRating): visibility
  // is both the dominant INPUT above and a separate post-composite
  // ceiling here. A calm, no-surge, no-current dive in 8 ft of murk is
  // still a No-Go no matter how good everything else scores.
  const visCap = visibilityScoreCap(visM);
  if (score > visCap) { score = visCap; details.visCeiling = visCap; }

  const rating = ratingFromScore(score);

  // Build caution note
  const cautions = [];
  if (runoff?.safeToEnter === false) cautions.push('Water quality unsafe — avoid entry.');
  if (surge > 60) cautions.push('Strong underwater surge at depth.');
  if (currentKnots > 1.5) cautions.push('Significant current — plan your drift.');
  if (visM < 6) cautions.push('Very limited visibility — stay close to buddy.');
  if (jellyfishWarning) cautions.push('Box jellyfish risk — wear protection.');
  if (thermocline?.meetsThermocline && thermocline?.sharpness === 'sharp') {
    cautions.push(`Sharp thermocline at ${thermocline.thermoclineDepthM || '?'}m.`);
  }

  return {
    overallScore: score,
    rating,
    cautionNote: cautions.join(' '),
    details,
  };
}

/**
 * Build a score breakdown for UI display.
 *
 * @param {object} diveScore - result from generateDiveScore
 * @returns {{ overallScore, visScore, currentScore, surgeScore, thermoclineScore, surfaceScore, bloomScore }}
 */
function buildAbyssScoreBreakdown(diveScore) {
  if (!diveScore) return null;
  const d = diveScore.details || {};

  return {
    overallScore: diveScore.overallScore,
    visScore: 100 + (d.vis || 0),
    currentScore: 100 + (d.current || 0),
    surgeScore: 100 + (d.surge || 0),
    thermoclineScore: 100 + (d.thermocline || 0),
    surfaceScore: 100 + (d.surface || 0),
    runoffScore: 100 + (d.runoff || 0),
  };
}

module.exports = {
  estimateVisibilityAbyss,
  generateDiveScore,
  buildAbyssScoreBreakdown,
};
