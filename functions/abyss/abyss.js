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
const { computeWaveImpactAtSite } = require('./waves');
const { estimateVisibility } = require('../analysis');
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
 * @param {object} [opts.db] - Firestore for cache
 * @param {string} [opts.cmemsUser]
 * @param {string} [opts.cmemsPass]
 * @param {string} [opts.nasaUser]
 * @param {string} [opts.nasaPass]
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
    db, cmemsUser, cmemsPass, nasaUser, nasaPass,
  } = opts;

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

  // ── Layer 0: Fetch satellite data ──────────────────────────────────────────
  let oceanColor = null;
  try {
    oceanColor = await fetchOceanColor({
      lat, lon, nowMs, db,
      cmemsUser, cmemsPass, nasaUser, nasaPass,
    });
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
    const lightMultiplier = 0.10 + 0.90 * light.factor;
    const visAfterLight = legacy.estimatedVisibilityMeters * lightMultiplier;
    const visM = visAfterLight * windChopMultiplier;
    const visMRounded = Math.max(1, Math.round(visM));

    const heurRationale = [];
    const lightPct = Math.round((lightMultiplier - 1) * 100);
    if (Math.abs(lightPct) >= 5) {
      heurRationale.push(`Solar light + shadow: ${lightPct > 0 ? '+' : ''}${lightPct}%`);
    }
    const windPct = Math.round((windChopMultiplier - 1) * 100);
    if (Math.abs(windPct) >= 5) {
      heurRationale.push(`Surface chop / wind: ${windPct > 0 ? '+' : ''}${windPct}%`);
    }
    if (Number.isFinite(exposureFactor) && exposureFactor < 0.85) {
      heurRationale.push(`Sheltered from swell: ${Math.round((exposureFactor - 1) * 100)}%`);
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
      dataAgeHours: null,
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
  const kd490Data = kd490ToVisibility(oceanColor.kd490);
  let vis = kd490Data.visibilityEstimateM || 15;
  const layerBaseline = vis;

  // ── Layer 2: Wave energy correction ────────────────────────────────────────
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
    vis *= (1 - sedimentFactor * 0.6 * sensitivityScale);
  }
  const layerWave = vis;

  // ── Layer 3: Tidal flushing ────────────────────────────────────────────────
  const tidalMult = TIDAL_MULTIPLIER[tidePhase] || 1.0;
  vis *= tidalMult;
  const layerTidal = vis;

  // ── Layer 4: Runoff plume ──────────────────────────────────────────────────
  const runoffSeverity = runoff?.severity || 'none';
  const runoffPenalty = RUNOFF_PENALTY[runoffSeverity] || 0;
  vis *= (1 - runoffPenalty);
  const layerRunoff = vis;

  // ── Layer 5: Chlorophyll/algae bloom ───────────────────────────────────────
  const chl = oceanColor.chlorophyll;
  if (Number.isFinite(chl) && chl > 0) {
    const bloomFactor = Math.min(1, chl / BLOOM_THRESHOLD);
    vis *= (1 - bloomFactor * 0.4);
  }
  const layerBloom = vis;

  // ── Layer 6: SPM direct ────────────────────────────────────────────────────
  const spm = oceanColor.spm;
  if (Number.isFinite(spm) && spm > 0) {
    const spmPenalty = Math.min(0.6, spm / SPM_CLEAR_THRESHOLD);
    vis *= (1 - spmPenalty);
  }
  const layerSpm = vis;

  // ── Layer 7: Solar light + topographic shadow ──────────────────────────────
  // Even pristine 30 m water reads as 5 m if you're swimming through a
  // mountain shadow at twilight. Multiplier is between 0.10 (full
  // shadow with overcast) and 1.00 (clear high noon, no terrain block).
  const lightMultiplier = 0.10 + 0.90 * light.factor;
  vis *= lightMultiplier;
  const layerLight = vis;

  // ── Layer 8: Surface chop from wind direction ──────────────────────────────
  vis *= windChopMultiplier;
  const layerWind = vis;

  // ── Build rationale so users see WHY visibility is what it is ──────────────
  const rationale = [];
  const pushDelta = (label, before, after) => {
    if (!Number.isFinite(before) || !Number.isFinite(after)) return;
    const pct = Math.round(((after - before) / Math.max(0.5, before)) * 100);
    if (Math.abs(pct) < 5) return; // skip noise
    const sign = pct > 0 ? '+' : '';
    rationale.push(`${label}: ${sign}${pct}%`);
  };
  pushDelta('Wave energy / sediment', layerBaseline, layerWave);
  pushDelta('Tide flushing',          layerWave,     layerTidal);
  pushDelta('Runoff plume',           layerTidal,    layerRunoff);
  pushDelta('Algal bloom',            layerRunoff,   layerBloom);
  pushDelta('Suspended particulate',  layerBloom,    layerSpm);
  pushDelta('Solar light + shadow',   layerSpm,      layerLight);
  pushDelta('Surface chop / wind',    layerLight,    layerWind);

  // ── Final clamping & rating ────────────────────────────────────────────────
  vis = Math.max(1, Math.min(40, vis));
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

  return {
    estimatedVisibilityMeters: Math.round(visM),
    estimatedVisibilityFeet: visFt,
    rating,
    source: 'satellite',
    confidence,
    kd490: oceanColor.kd490,
    chlorophyll: oceanColor.chlorophyll,
    spm: oceanColor.spm,
    dataAgeHours: oceanColor.ageHours,
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

  let rating = 'Excellent';
  if (score < 20) rating = 'No-Go';
  else if (score < 40) rating = 'Fair';
  else if (score < 60) rating = 'Good';
  else if (score < 80) rating = 'Great';

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
