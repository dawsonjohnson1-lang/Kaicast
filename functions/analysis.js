/* eslint-env node */
/* global fetch */

/**
 * KaiCast analysis helpers (coast-aware tweaks)
 *
 * Exports:
 *  - fetchMoonPhase(dateUtc, lat, lon, tz)
 *  - computeLocalMoonPhase(dateUtc)
 *  - evaluateJellyfishAndNightDive({ moonData, visibilityMeters, currentKnots, waterTempC, cloudCoverPercent })
 *  - estimateVisibility(opts)
 *  - generateSnorkelRating(opts)
 *  - estimateRunoffRisk({ rain3hMM, rain12hMM, rain24hMM, rain48hMM, rain72hMM, windKnots, windDeg, tidePhase, spotContext, communityRunoffSignal })
 *  - assessRunoffRisk({ rain6hMM, rain24hMM, rain72hMM, spot }) (back-compat wrapper)
 *  - estimateCurrentFromWind(windKnots)
 *  - classifyTidePhase(levelSeries, whenTs)
 *  - computeTidePhaseFromLevels(levelSeries)
 *  - movingAverage(arr, n)
 *  - diurnalProfile(hourLocal)
 */

// ---------------------------------------------------------------------------
// Basic helpers
// ---------------------------------------------------------------------------

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function round1(v) {
  return Number.isFinite(v) ? Math.round(v * 10) / 10 : v;
}

function round2(v) {
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : v;
}

/**
 * Simple moving average over window n.
 * Returns an array of same length; edges are averaged over available points.
 */
function movingAverage(arr, n) {
  if (!Array.isArray(arr) || arr.length === 0 || n <= 1) return arr || [];
  const out = [];
  const half = Math.floor(n / 2);

  for (let i = 0; i < arr.length; i++) {
    let sum = 0;
    let c = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < arr.length && Number.isFinite(arr[j])) {
        sum += arr[j];
        c++;
      }
    }
    out.push(c ? sum / c : arr[i]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Diurnal profile (time-of-day effect)
// ---------------------------------------------------------------------------

/**
 * Crude diurnal profile:
 *  - Early morning (06–09): slightly better vis
 *  - Late afternoon (15–18): slight bump
 *  - Midday (10–15): neutral
 *  - Night: small penalty (if we ever use it for night diving)
 */
function diurnalProfile(hourLocal) {
  let visScale = 1.0;

  if (hourLocal >= 6 && hourLocal < 9) {
    visScale = 1.1;
  } else if (hourLocal >= 9 && hourLocal < 15) {
    visScale = 1.0;
  } else if (hourLocal >= 15 && hourLocal < 18) {
    visScale = 1.05;
  } else {
    visScale = 0.95;
  }

  return { visScale };
}

// ---------------------------------------------------------------------------
// Moon / phase helpers (approximate but deterministic)
// ---------------------------------------------------------------------------

/**
 * Compute an approximate moon phase and illumination for a UTC Date.
 * Based on a simple synodic month model ~29.53 days.
 */
function computeLocalMoonPhase(dateUtc) {
  const d = dateUtc instanceof Date ? dateUtc : new Date(dateUtc);

  // Reference new moon: 2000-01-06 18:14 UTC
  const ref = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const msPerDay = 86400000;
  const synodicMonth = 29.53058867;

  const days = (d.getTime() - ref.getTime()) / msPerDay;
  let age = days % synodicMonth;
  if (age < 0) age += synodicMonth;

  const phase = age / synodicMonth; // 0..1
  const illumination = 0.5 * (1 - Math.cos(2 * Math.PI * phase)); // 0..1

  let phaseName = 'New Moon';
  if (phase < 0.03 || phase > 0.97) phaseName = 'New Moon';
  else if (phase < 0.22) phaseName = 'Waxing Crescent';
  else if (phase < 0.28) phaseName = 'First Quarter';
  else if (phase < 0.47) phaseName = 'Waxing Gibbous';
  else if (phase < 0.53) phaseName = 'Full Moon';
  else if (phase < 0.72) phaseName = 'Waning Gibbous';
  else if (phase < 0.78) phaseName = 'Last Quarter';
  else phaseName = 'Waning Crescent';

  const fullMoonAge = synodicMonth / 2; // ~14.77 days
  const daysSinceFullMoon = age - fullMoonAge;

  return {
    moonPhase: phaseName,
    moonIllumination: Math.round(illumination * 1000) / 10, // %
    daysSinceFullMoon: Math.round(daysSinceFullMoon * 10) / 10,
  };
}

/**
 * Wrapper for moon data. Right now we use our local approximation
 * and *do not* hit an external API, to keep Functions simple.
 */
async function fetchMoonPhase(dateUtc = new Date(), lat = 21.3, lon = -157.8, tz = 'Pacific/Honolulu') {
  // lat / lon / tz kept for future, currently unused.
  const base = computeLocalMoonPhase(dateUtc);
  return { ...base, tz, lat, lon };
}

// ---------------------------------------------------------------------------
// Tide helpers (kept simple / mostly placeholders for now)
// ---------------------------------------------------------------------------

/**
 * Given tide levels [{ tsMs, levelFt }, ...] sorted by time asc,
 * classify the tide phase at `whenTs` as 'rising' | 'falling' | 'slack' | 'unknown'.
 */
function classifyTidePhase(levelSeries, whenTs) {
  if (!Array.isArray(levelSeries) || levelSeries.length < 3 || !whenTs) {
    return 'unknown';
  }

  // Find the closest index
  let nearestIdx = 0;
  let bestDt = Infinity;
  for (let i = 0; i < levelSeries.length; i++) {
    const dt = Math.abs(levelSeries[i].tsMs - whenTs);
    if (dt < bestDt) {
      bestDt = dt;
      nearestIdx = i;
    }
  }

  const prev = levelSeries[nearestIdx - 1];
  const curr = levelSeries[nearestIdx];
  const next = levelSeries[nearestIdx + 1];
  if (!prev || !curr || !next) return 'unknown';

  const rising = curr.levelFt > prev.levelFt && next.levelFt > curr.levelFt;
  const falling = curr.levelFt < prev.levelFt && next.levelFt < curr.levelFt;

  if (rising) return 'rising';
  if (falling) return 'falling';
  return 'slack';
}

/**
 * Simple helper that just delegates to classifyTidePhase for now.
 */
function computeTidePhaseFromLevels(levelSeries, whenTs) {
  return classifyTidePhase(levelSeries, whenTs);
}

// ---------------------------------------------------------------------------
// Visibility estimation
// ---------------------------------------------------------------------------

/**
 * Estimate visibility in meters/feet.
 *
 * Inputs (all optional; null/undefined → sensible behavior but avoid optimistic defaults):
 *  - windKnots
 *  - swellFeet (null => unknown)
 *  - swellPeriodSec
 *  - currentKnots
 *  - tidePhase: 'rising' | 'falling' | 'slack' | 'unknown'
 *  - rainLast24hMM
 *  - turbidityNTU
 *  - cloudCoverPercent
 *  - hourLocal (0-23)
 *  - runoff: result of estimateRunoffRisk/assessRunoffRisk (optional)
 */
function estimateVisibility({
  windKnots = null,
  swellFeet = null,
  swellPeriodSec = 10,
  currentKnots = null,
  tidePhase = 'unknown',
  rainLast24hMM = null,
  turbidityNTU = null,
  cloudCoverPercent = null,
  hourLocal = null,
  runoff = null,
} = {}) {
  // Track missing fields to add a small pessimism penalty later
  const missing = {
    swell: swellFeet == null || !isFinite(swellFeet),
    current: currentKnots == null || !isFinite(currentKnots),
    turbidity: turbidityNTU == null || !isFinite(turbidityNTU),
    rain: rainLast24hMM == null || !isFinite(rainLast24hMM),
    wind: windKnots == null || !isFinite(windKnots),
    clouds: cloudCoverPercent == null || !isFinite(cloudCoverPercent),
    hour: hourLocal == null || !isFinite(hourLocal),
  };

  // Don't assume ideal conditions when marine inputs are missing.
  // We still allow wind/defaults for wind/clouds/hour to avoid total failure.
  if (missing.wind) windKnots = 6; // light trades
  if (missing.clouds) cloudCoverPercent = 40;
  if (missing.hour) hourLocal = 10;
  if (missing.current) currentKnots = 0.3; // small background

  // Base "pretty good" day
  let vis = 20;

  // Diurnal
  const diurnal = diurnalProfile(hourLocal);
  vis *= diurnal.visScale;

  // Wind penalties (surface chop / sand)
  if (windKnots > 20) vis -= 10;
  else if (windKnots > 15) vis -= 7;
  else if (windKnots > 10) vis -= 4;
  else if (windKnots > 5) vis -= 2;

  // Swell height & period
  if (!missing.swell) {
    if (swellFeet > 6) vis -= 9;
    else if (swellFeet > 4) vis -= 6;
    else if (swellFeet > 2.5) vis -= 3;
  } else {
    // unknown swell → pessimistic small penalty
    vis -= 4;
  }

  if (!missing.swell && swellPeriodSec >= 13 && swellFeet >= 3) vis -= 3; // long-period surge

  // Runoff penalty (from runoff object) takes priority over raw rain penalty
  if (runoff && runoff.severity) {
    const runoffVisPenalty =
      runoff.severity === 'extreme' ? 12 :
      runoff.severity === 'high' ? 9 :
      runoff.severity === 'moderate' ? 5 :
      runoff.severity === 'low' ? 2 : 0;
    if (runoffVisPenalty > 0) vis -= runoffVisPenalty;
  } else if (!missing.rain) {
    // Fallback to raw rain-based penalty when no runoff object provided
    if (rainLast24hMM > 10) vis -= 7;
    else if (rainLast24hMM > 5) vis -= 4;
    else if (rainLast24hMM > 1) vis -= 2;
  } else {
    vis -= 1; // unknown rain
  }

  if (!missing.turbidity) {
    if (turbidityNTU > 5) vis -= 7;
    else if (turbidityNTU > 3) vis -= 4;
  } else {
    vis -= 0.5;
  }

  // Current
  if (currentKnots > 2.5) vis -= 6;
  else if (currentKnots > 1.5) vis -= 3;

  // Tide phase (incoming tide usually helps)
  if (tidePhase === 'rising') vis += 2;
  if (tidePhase === 'falling') vis -= 2;

  // Clouds: heavy overcast + harsh sun both slightly reduce apparent vis
  if (cloudCoverPercent > 80) vis -= 1;
  if (cloudCoverPercent < 10) vis -= 0.5; // glare mid-day

  // Low-info penalty (stronger now to avoid "excellent" on missing marine data)
  let lowInfoPenalty = 0;
  if (missing.swell) lowInfoPenalty += 3;
  if (missing.turbidity) lowInfoPenalty += 1;
  if (missing.current) lowInfoPenalty += 1;
  if (lowInfoPenalty) vis -= lowInfoPenalty;

  vis = clamp(vis, 2, 30);

  let rating = 'Excellent';
  if (vis < 6) rating = 'Poor';
  else if (vis < 10) rating = 'Fair';
  else if (vis < 15) rating = 'Good';

  const meters = Math.round(vis);
  const feet = Math.round(meters * 3.28084);

  return {
    estimatedVisibilityMeters: meters,
    estimatedVisibilityFeet: feet,
    rating,
    _missing: missing, // helpful for diagnostics
  };
}

// ---------------------------------------------------------------------------
// Runoff risk assessment (dedicated model)
// ---------------------------------------------------------------------------

function normalizeSpotContext(spotContext) {
  const sc = spotContext || {};
  const runoffSensitivity = (sc.runoffSensitivity || 'medium');
  const runoffLagHours = Number.isFinite(sc.runoffLagHours) ? sc.runoffLagHours : null;
  const runoffExposure = sc.runoffExposure || null;

  // Back-compat aliases from current SPOTS
  const nearStreamMouth = Boolean(sc.nearStreamMouth);
  const nearDrainage = Boolean(sc.nearDrainage);

  return {
    runoffSensitivity: (runoffSensitivity === 'low' || runoffSensitivity === 'medium' || runoffSensitivity === 'high')
      ? runoffSensitivity
      : 'medium',
    runoffLagHours,
    runoffExposure: (runoffExposure === 'open-coast' || runoffExposure === 'bay' || runoffExposure === 'stream-mouth' || runoffExposure === 'harbor-adjacent' || runoffExposure === 'canal-adjacent')
      ? runoffExposure
      : null,
    nearStreamMouth,
    nearDrainage,
  };
}

function severityFromScore(score) {
  if (score >= 85) return 'extreme';
  if (score >= 65) return 'high';
  if (score >= 40) return 'moderate';
  if (score >= 18) return 'low';
  return 'none';
}

function computeRunoffPenaltyFromSeverity(sev) {
  return (
    sev === 'extreme' ? 65 :
    sev === 'high' ? 48 :
    sev === 'moderate' ? 30 :
    sev === 'low' ? 12 : 0
  );
}

/**
 * Dedicated runoff scoring model.
 *
 * Goals:
 * - treat runoff as both visibility/dive-quality + health/contamination
 * - weight recent rain heavily but keep memory via 24/48/72h totals
 * - incorporate spotContext runoffSensitivity and exposure
 * - can set safeToEnter=false for high/extreme runoff
 */
function estimateRunoffRisk({
  rain3hMM = null,
  rain12hMM = null,
  rain24hMM = null,
  rain48hMM = null,
  rain72hMM = null,
  windKnots = null,
  windDeg = null,
  tidePhase = 'unknown',
  spotContext = null,
  communityRunoffSignal = null,
} = {}) {
  const sc = normalizeSpotContext(spotContext);

  const r3 = Number.isFinite(rain3hMM) ? rain3hMM : null;
  const r12 = Number.isFinite(rain12hMM) ? rain12hMM : null;
  const r24 = Number.isFinite(rain24hMM) ? rain24hMM : null;
  const r48 = Number.isFinite(rain48hMM) ? rain48hMM : null;
  const r72 = Number.isFinite(rain72hMM) ? rain72hMM : null;

  const drivers = [];

  // Confidence starts with rainfall coverage.
  const haveAny = [r3, r12, r24, r48, r72].some((v) => Number.isFinite(v));
  let confidence = haveAny ? 0.75 : 0.35;

  // Base score.
  let score = 0;

  // Recent rain (3h) – strongest driver
  if (Number.isFinite(r3)) {
    if (r3 >= 30) { score += 55; drivers.push(`very heavy rain last 3h (${round1(r3)}mm)`); }
    else if (r3 >= 20) { score += 45; drivers.push(`heavy rain last 3h (${round1(r3)}mm)`); }
    else if (r3 >= 12) { score += 33; drivers.push(`moderate-heavy rain last 3h (${round1(r3)}mm)`); }
    else if (r3 >= 6)  { score += 22; drivers.push(`moderate rain last 3h (${round1(r3)}mm)`); }
    else if (r3 >= 2)  { score += 12; drivers.push(`light-moderate rain last 3h (${round1(r3)}mm)`); }
    else if (r3 > 0)   { score += 4; }
  } else {
    confidence -= 0.1;
  }

  // 12h – runoff persistence / watershed loading
  if (Number.isFinite(r12)) {
    if (r12 >= 80) { score += 30; drivers.push(`very high 12h total (${round1(r12)}mm)`); }
    else if (r12 >= 50) { score += 22; drivers.push(`high 12h total (${round1(r12)}mm)`); }
    else if (r12 >= 25) { score += 14; drivers.push(`elevated 12h total (${round1(r12)}mm)`); }
    else if (r12 >= 10) { score += 8; }
  } else {
    confidence -= 0.05;
  }

  // 24h – cumulative load
  if (Number.isFinite(r24)) {
    if (r24 >= 120) { score += 24; drivers.push(`very high 24h total (${round1(r24)}mm)`); }
    else if (r24 >= 80) { score += 18; drivers.push(`high 24h total (${round1(r24)}mm)`); }
    else if (r24 >= 40) { score += 12; drivers.push(`elevated 24h total (${round1(r24)}mm)`); }
    else if (r24 >= 15) { score += 6; }
  } else {
    confidence -= 0.05;
  }

  // 48h/72h – saturation and lingering tail
  if (Number.isFinite(r48)) {
    if (r48 >= 160) { score += 12; drivers.push(`watershed saturated (48h ${round1(r48)}mm)`); }
    else if (r48 >= 90) { score += 8; }
  } else {
    confidence -= 0.03;
  }

  if (Number.isFinite(r72)) {
    if (r72 >= 220) { score += 10; drivers.push(`extended wet period (72h ${round1(r72)}mm)`); }
    else if (r72 >= 140) { score += 7; }
    else if (r72 >= 80) { score += 4; }
  } else {
    confidence -= 0.03;
  }

  // Site multipliers (legacy + exposure)
  let siteMult = 1.0;

  if (sc.nearStreamMouth) { siteMult *= 1.35; drivers.push('near stream mouth / drainage plume'); }
  if (sc.nearDrainage) { siteMult *= 1.2; drivers.push('near drainage outlet'); }

  if (sc.runoffExposure === 'stream-mouth') { siteMult *= 1.25; drivers.push('stream-mouth exposure'); }
  if (sc.runoffExposure === 'canal-adjacent') { siteMult *= 1.25; drivers.push('canal-adjacent exposure'); }
  if (sc.runoffExposure === 'harbor-adjacent') { siteMult *= 1.15; drivers.push('harbor-adjacent exposure'); }
  if (sc.runoffExposure === 'bay') { siteMult *= 1.15; drivers.push('bay circulation can trap dirty water'); }

  // Sensitivity: affects both magnitude and persistence
  const sensMult = sc.runoffSensitivity === 'high' ? 1.35 : sc.runoffSensitivity === 'low' ? 0.75 : 1.0;
  score *= sensMult;

  // Persistence / lag: high sensitivity stays dirty longer (even if 3h rain is low but 24-72h high)
  // This is a soft boost that becomes important when r3 is not huge but r24/r48/r72 are.
  const tail = (Number.isFinite(r24) ? r24 : 0) * 0.10 + (Number.isFinite(r48) ? r48 : 0) * 0.04 + (Number.isFinite(r72) ? r72 : 0) * 0.02;
  if (tail > 0) {
    const tailBoost = sc.runoffSensitivity === 'high' ? clamp(tail, 0, 18) : clamp(tail, 0, 12);
    if (tailBoost >= 6) drivers.push('runoff may linger from recent rainfall');
    score += tailBoost;
  }

  // Tide (optional): outgoing can worsen nearshore plumes; incoming can help slightly.
  if (tidePhase === 'falling') {
    score += 3;
    drivers.push('falling tide can flush dirty water from nearshore');
  } else if (tidePhase === 'rising') {
    score -= 2;
  } else if (tidePhase === 'unknown') {
    // leave score, but reduce confidence
    confidence -= 0.03;
  }

  // Wind: strong winds can spread plumes offshore + resuspend sediment; calm winds do NOT clear contamination.
  if (Number.isFinite(windKnots)) {
    if (windKnots >= 22) {
      score += 6;
      drivers.push(`strong winds may spread/resuspend runoff (${round1(windKnots)}kt)`);
    } else if (windKnots >= 16) {
      score += 3;
    }
  }

  // Community runoff signal (optional): 0..1 or boolean-ish.
  // If present and high, we boost severity + confidence.
  if (communityRunoffSignal != null) {
    if (communityRunoffSignal === true) {
      score += 10;
      confidence += 0.08;
      drivers.push('community reports indicate dirty/brown water');
    } else if (communityRunoffSignal === false) {
      confidence += 0.03;
    } else if (typeof communityRunoffSignal === 'number' && Number.isFinite(communityRunoffSignal)) {
      const sig = clamp(communityRunoffSignal, 0, 1);
      if (sig >= 0.7) {
        score += 12;
        confidence += 0.1;
        drivers.push('community runoff signal is high');
      } else if (sig >= 0.4) {
        score += 6;
        confidence += 0.05;
        drivers.push('community runoff signal suggests degraded water quality');
      } else {
        confidence += 0.02;
      }
    } else {
      // Unknown format, no-op
      confidence -= 0.02;
    }
  } else {
    confidence -= 0.03;
  }

  // Apply site mult at the end
  score *= siteMult;

  score = clamp(score, 0, 100);
  confidence = clamp(confidence, 0.15, 0.95);

  const severity = severityFromScore(score);
  const scorePenalty = computeRunoffPenaltyFromSeverity(severity);

  // Health risk mapping
  const healthRisk =
    severity === 'extreme' ? 'high' :
    severity === 'high' ? 'high' :
    severity === 'moderate' ? 'moderate' :
    'low';

  // Safe-to-enter mapping
  const safeToEnter = !(severity === 'high' || severity === 'extreme');

  // Water quality feel mapping
  const waterQualityFeel =
    severity === 'extreme' ? 'brown' :
    severity === 'high' ? 'brown' :
    severity === 'moderate' ? 'murky' :
    severity === 'low' ? 'slightly-stained' :
    'clean';

  // Ensure we always have at least one driver when risk exists or confidence is low.
  if (!drivers.length) {
    if (!haveAny) drivers.push('rain history unavailable; runoff risk is uncertain');
    else drivers.push('recent rainfall suggests possible runoff');
  }

  // If confidence is low and severity is none/low, keep language cautious via driver.
  if (confidence < 0.5) {
    drivers.push('runoff risk is hard to confirm with limited rainfall history');
  }

  return {
    severity,
    healthRisk,
    safeToEnter,
    waterQualityFeel,
    scorePenalty,
    drivers,
    confidence: round2(confidence),
  };
}

// ---------------------------------------------------------------------------
// Backward-compatible wrapper
// ---------------------------------------------------------------------------

/**
 * assessRunoffRisk (legacy API) — keep shape used by index.js today.
 *
 * NOTE: The legacy caller passes rain6hMM/rain24hMM/rain72hMM.
 * We approximate 3h/12h/48h totals from available values and lower confidence.
 */
function assessRunoffRisk({
  rain6hMM = 0,
  rain24hMM = 0,
  rain72hMM = 0,
  spot = null,
} = {}) {
  const r6 = Number.isFinite(rain6hMM) ? rain6hMM : null;
  const r24 = Number.isFinite(rain24hMM) ? rain24hMM : null;
  const r72 = Number.isFinite(rain72hMM) ? rain72hMM : null;

  // Approximate missing rollups (conservative)
  // - 3h: assume ~60% of 6h when rain is concentrated; cap at 6h
  // - 12h: assume ~min(24h, 1.6*6h)
  // - 48h: assume ~min(72h, 1.4*24h)
  const rain3hMM = Number.isFinite(r6) ? Math.min(r6, r6 * 0.6) : null;
  const rain12hMM = (Number.isFinite(r24) && Number.isFinite(r6)) ? Math.min(r24, r6 * 1.6) : (Number.isFinite(r24) ? Math.min(r24, r24 * 0.7) : null);
  const rain48hMM = (Number.isFinite(r72) && Number.isFinite(r24)) ? Math.min(r72, r24 * 1.4) : (Number.isFinite(r72) ? Math.min(r72, r72 * 0.75) : null);

  const out = estimateRunoffRisk({
    rain3hMM,
    rain12hMM,
    rain24hMM: r24,
    rain48hMM,
    rain72hMM: r72,
    tidePhase: 'unknown',
    spotContext: spot,
    communityRunoffSignal: null,
  });

  // Slightly reduce confidence because these are approximations.
  out.confidence = round2(clamp(out.confidence - 0.12, 0.15, 0.95));
  out.drivers = Array.isArray(out.drivers) && out.drivers.length ? out.drivers : ['recent rainfall suggests possible runoff'];

  return out;
}

// ---------------------------------------------------------------------------
// Snorkel rating (overall quality)
// ---------------------------------------------------------------------------

/**
 * Turn conditions into a 0–100 score and a text rating.
 *
 * Inputs are all optional—anything missing just falls back to defaults,
 * but missing critical marine inputs are penalized.
 */
function generateSnorkelRating({
  visibilityMeters = 15,
  windKnots = 8,
  swellFeet = null,
  swellPeriodSec = 10,
  currentKnots = 0.5,
  tidePhase = 'unknown',
  waterTempC = null,
  lightningRisk = false,
  rainLast24hMM = 0,
  crowdOverride = null,

  // Future/optional: per-spot behaviour + meta
  spotContext = null, // { runoffSensitivity, maxCleanSwellFt, hardNoGoSwellFt, coast }
  jellyfishWarning = false, // from evaluateJellyfishAndNightDive
  confidenceScore = 1, // 0–1, from calling code if desired
  runoff = null, // from estimateRunoffRisk / assessRunoffRisk
  runoffPenalty = null, // optional explicit penalty
} = {}) {
  if (crowdOverride) {
    return {
      rating: crowdOverride,
      reason: 'Community-sourced manual rating.',
      cautionNote: '',
      score: null,
      details: {},
    };
  }

  const {
    runoffSensitivity = 'medium', // 'low' | 'medium' | 'high'
    maxCleanSwellFt = null,
    hardNoGoSwellFt = null,
    coast = null,
  } = spotContext || {};

  let score = 100;
  const details = {};

  // Visibility
  if (visibilityMeters == null) {
    score -= 15; details.vis = -15;
  } else if (visibilityMeters < 5) { score -= 40; details.vis = -40; }
  else if (visibilityMeters < 10) { score -= 25; details.vis = -25; }
  else if (visibilityMeters < 15) { score -= 10; details.vis = -10; }
  else details.vis = 0;

  // Wind
  if (windKnots > 25) { score -= 50; details.wind = -50; }
  else if (windKnots > 20) { score -= 40; details.wind = -40; }
  else if (windKnots > 15) { score -= 25; details.wind = -25; }
  else if (windKnots > 10) { score -= 10; details.wind = -10; }
  else details.wind = 0;

  // Generic swell penalties
  if (swellFeet == null) {
    // Missing swell → pessimistic penalty rather than assuming calm.
    score -= 15;
    details.swellMissing = -15;
  } else {
    if (swellFeet > 7) { score -= 35; details.swell = -35; }
    else if (swellFeet > 5) { score -= 25; details.swell = -25; }
    else if (swellFeet > 3.5) { score -= 15; details.swell = -15; }
    else details.swell = 0;
  }

  // Spot-specific swell tolerance (optional)
  if (maxCleanSwellFt && swellFeet != null && swellFeet > maxCleanSwellFt) {
    score -= 10;
    details.swellSpot = (details.swellSpot || 0) - 10;
  }
  if (hardNoGoSwellFt && swellFeet != null && swellFeet > hardNoGoSwellFt) {
    score = Math.min(score, 30);
    details.swellSpotHard = (details.swellSpotHard || 0) - 20;
  }

  // Period
  if (swellPeriodSec < 8) { score -= 10; details.period = -10; }
  else if (swellPeriodSec > 13 && swellFeet >= 3) {
    score -= 10; details.period = -10;
  } else details.period = 0;

  // Currents
  if (currentKnots > 2.5) { score -= 30; details.current = -30; }
  else if (currentKnots > 1.5) { score -= 15; details.current = -15; }
  else details.current = 0;

  // Rain + runoff sensitivity (legacy minor penalty)
  let rainPenalty = 0;
  if (rainLast24hMM > 10) rainPenalty = 25;
  else if (rainLast24hMM > 5) rainPenalty = 15;
  else if (rainLast24hMM > 1) rainPenalty = 5;

  if (rainPenalty > 0) {
    const runoffFactor =
      runoffSensitivity === 'high' ? 1.5 :
      runoffSensitivity === 'low' ? 0.5 : 1;

    const adjusted = Math.round(rainPenalty * runoffFactor);
    score -= adjusted;
    details.rain = -adjusted;
  } else {
    details.rain = 0;
  }

  // Dedicated runoff assessment penalty & caps
  const effectiveRunoffPenalty =
    (typeof runoffPenalty === 'number' && Number.isFinite(runoffPenalty))
      ? runoffPenalty
      : (runoff && typeof runoff.scorePenalty === 'number' ? runoff.scorePenalty : 0);

  if (effectiveRunoffPenalty > 0) {
    // Avoid excessive double-counting with rain penalty, but allow runoff to dominate.
    const extraPenalty = Math.max(0, effectiveRunoffPenalty - Math.abs(details.rain || 0));
    if (extraPenalty > 0) {
      score -= extraPenalty;
      details.runoff = -extraPenalty;
    } else {
      details.runoff = details.runoff || 0;
    }
  }

  // Runoff safety / health caps MUST override calm conditions
  if (runoff) {
    if (runoff.safeToEnter === false) {
      score = Math.min(score, 18);
      details.runoffUnsafe = true;
    }
    if (runoff.healthRisk === 'high') {
      score = Math.min(score, 25);
      details.runoffHealthHigh = true;
    } else if (runoff.healthRisk === 'moderate') {
      score = Math.min(score, 55);
      details.runoffHealthModerate = true;
    }
  }

  // Tide
  if (tidePhase === 'rising') { score += 5; details.tide = +5; }
  else if (tidePhase === 'falling') { score -= 5; details.tide = -5; }
  else details.tide = 0;

  // Water temp comfort
  if (waterTempC == null) {
    // Missing water temp is less critical than missing swell but still reduce confidence
    score -= 3;
    details.tempMissing = -3;
  } else {
    if (waterTempC < 23) { score -= 5; details.temp = -5; }
    else details.temp = 0;
  }

  // Jellyfish – big quality hit, rating will also be capped after
  if (jellyfishWarning) {
    score -= 25;
    details.jellyfish = -25;
  }

  // Confidence score – low data confidence → no "perfect" days
  if (confidenceScore < 0.9) {
    const confPenalty = Math.round((1 - confidenceScore) * 30); // max ~30
    if (confPenalty > 0) {
      score -= confPenalty;
      details.confidence = -confPenalty;
    }
  }

  // Coast-specific conservative adjustments (small, conservative values)
  // North coast: exposed to long-period large swell — make these more penalizing
  if (coast === 'north') {
    if (swellFeet != null && swellPeriodSec != null && swellPeriodSec > 12 && swellFeet > (maxCleanSwellFt || 2)) {
      score -= 5;
      details.northCoastLongSwell = -5;
    }
    // Slightly increase current sensitivity for exposed spots
    if (currentKnots > 1.5 && currentKnots <= 2.5) {
      score -= 3;
      details.northCoastCurrent = -3;
    }
  }

  // South coast: reef surge from long period can create poor conditions for snorkeling
  if (coast === 'south') {
    if (swellFeet != null && swellPeriodSec != null && swellPeriodSec >= 13 && swellFeet >= 2) {
      score -= 2;
      details.southCoastSurge = -2;
    }
  }

  // West coast: wind chop tends to reduce comfort/visibility in addition to wind penalty
  if (coast === 'west') {
    if (windKnots > 12 && windKnots <= 15) {
      score -= 2;
      details.westCoastWindChop = -2;
    } else if (windKnots > 15) {
      score -= 3;
      details.westCoastWindChop = (details.westCoastWindChop || 0) - 3;
    }
  }

  // Lightning → hard stop
  if (lightningRisk) { details.lightning = -100; score = 0; }

  score = clamp(score, 0, 100);

  let rating = 'Excellent';
  if (score < 20) rating = 'No-Go';
  else if (score < 40) rating = 'Fair';
  else if (score < 60) rating = 'Good';
  else if (score < 80) rating = 'Great';

  // Caps AFTER we choose rating
  if (jellyfishWarning && (rating === 'Excellent' || rating === 'Great')) {
    rating = 'Good';
  }
  if (confidenceScore < 0.5 && rating === 'Excellent') {
    rating = 'Great';
  }

  // Runoff caps should be final: unsafe/high health risk cannot be Excellent/Great
  if (runoff) {
    if (runoff.safeToEnter === false) {
      if (rating === 'Excellent' || rating === 'Great') rating = 'No-Go';
    }
    if (runoff.healthRisk === 'high') {
      if (rating === 'Excellent' || rating === 'Great') rating = 'No-Go';
      if (rating === 'Good') rating = 'Fair';
    }
  }

  const reasons = [];
  const add = (k, text) => { if (details[k]) reasons.push(`${text} (${details[k]})`); };
  add('vis', 'visibility');
  add('wind', 'wind');
  add('swell', 'swell');
  add('swellMissing', 'missing swell data');
  add('swellSpot', 'spot swell limits');
  add('swellSpotHard', 'dangerously large swell');
  add('period', 'period');
  add('current', 'current');
  add('rain', 'rain/runoff');
  add('runoff', 'runoff');
  add('tide', 'tide');
  add('temp', 'water temp');
  add('tempMissing', 'missing water temperature');
  add('jellyfish', 'jellyfish risk');
  add('confidence', 'low data confidence');
  add('northCoastLongSwell', 'north-coast long swell');
  add('northCoastCurrent', 'north-coast current sensitivity');
  add('southCoastSurge', 'south-coast surge');
  add('westCoastWindChop', 'west-coast wind chop');
  if (details.runoffUnsafe) reasons.push('unsafe runoff');
  if (details.runoffHealthHigh) reasons.push('high contamination risk');
  if (details.lightning) reasons.push('thunderstorms');

  const reason = `Score: ${score} — adjustments from ${reasons.length ? reasons.join(', ') : 'benign conditions'}.`;

  const caution = [];
  if (lightningRisk) caution.push('Thunderstorms – avoid the water.');
  if (currentKnots > 2) caution.push('Stronger currents today.');
  if (swellFeet != null && swellFeet > 5) caution.push('Rougher swell than usual.');
  if (windKnots > 15) caution.push('Choppy surface conditions.');

  // Runoff wording (must never be null)
  if (runoff) {
    const d = Array.isArray(runoff.drivers) ? runoff.drivers : [];
    const driverTxt = d.length ? d.join('; ') : 'recent rainfall suggests possible runoff';

    if (runoff.severity === 'extreme' || runoff.severity === 'high') {
      caution.push('Heavy runoff likely. Brown water and contamination risk.');
      caution.push(`Drivers: ${driverTxt}.`);
    } else if (runoff.severity === 'moderate') {
      caution.push('Runoff still lingering from recent rain. Conditions may look calm but water quality is poor.');
      caution.push(`Drivers: ${driverTxt}.`);
    } else if (runoff.severity === 'low') {
      caution.push('Recent rainfall suggests possible dirty water even if surface conditions look calm.');
      caution.push(`Drivers: ${driverTxt}.`);
    } else if (runoff.confidence < 0.5) {
      caution.push('Runoff risk is hard to confirm, but recent rain suggests possible dirty water.');
      caution.push(`Drivers: ${driverTxt}.`);
    }
  } else if (rainLast24hMM > 5) {
    caution.push('Murky water due to runoff.');
  }

  if (jellyfishWarning) caution.push('High jellyfish risk – stings likely.');

  // Ensure never null, never empty string
  const cautionNote = caution.length ? caution.join(' ') : 'No major hazards detected.';

  return {
    rating,
    reason,
    cautionNote,
    score,
    details,
  };
}

// ---------------------------------------------------------------------------
// Jellyfish & night dive heuristics (kept simple for now)
// ---------------------------------------------------------------------------

/**
 * Very simple placeholder:
 *  - Always returns jellyfishWarning: false for now
 *  - Night diving kept "not recommended" by default
 *
 * We can wire in your real jellyfish calendar later without changing the shape.
 */
function evaluateJellyfishAndNightDive({
  moonData,
  visibilityMeters,
  currentKnots,
  waterTempC,
  cloudCoverPercent,
}) {
  const jellyfishWarning = false;
  const jellyfishNote = '';

  const nightDivingOk = false;
  const nightDiveNote = 'Night diving not recommended based on current conditions.';

  return {
    jellyfishWarning,
    nightDivingOk,
    jellyfishNote,
    nightDiveNote,
  };
}

// ---------------------------------------------------------------------------
// Wind → current rough estimator
// ---------------------------------------------------------------------------

/**
 * Very rough: shallow-reef current magnitude derived from wind speed.
 * Not physical, just gives us a way to "turn up" risk when it's blowing.
 */
function estimateCurrentFromWind(windKnots = 0) {
  if (!Number.isFinite(windKnots) || windKnots <= 0) return 0;
  const est = windKnots * 0.04; // 0.03–0.05 ballpark
  return clamp(est, 0, 2.5);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Main exports used in index.js
  fetchMoonPhase,
  evaluateJellyfishAndNightDive,
  estimateVisibility,
  generateSnorkelRating,
  estimateRunoffRisk,
  assessRunoffRisk,

  // Extras we may use elsewhere
  diurnalProfile,
  classifyTidePhase,
  computeTidePhaseFromLevels,
  estimateCurrentFromWind,
  movingAverage,
  computeLocalMoonPhase,
};