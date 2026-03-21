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
 *  - assessRunoffRisk({ rain6hMM, rain24hMM, rain72hMM, spot })
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
 *  - runoff: result of assessRunoffRisk (optional)
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
  if (missing.wind) windKnots = 6;           // light trades
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

  // Runoff penalty (from assessRunoffRisk) takes priority over raw rain penalty
  if (runoff && runoff.severity) {
    const runoffVisPenalty =
      runoff.severity === 'extreme' ? 9 :
      runoff.severity === 'high' ? 6 :
      runoff.severity === 'moderate' ? 3 :
      runoff.severity === 'low' ? 1 : 0;
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
  spotContext = null,          // { runoffSensitivity, maxCleanSwellFt, hardNoGoSwellFt, coast }
  jellyfishWarning = false,    // from evaluateJellyfishAndNightDive
  confidenceScore = 1,         // 0–1, from calling code if desired
  runoff = null,               // from assessRunoffRisk
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
    runoffSensitivity = 'medium',   // 'low' | 'medium' | 'high'
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

  // Rain + runoff sensitivity
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

  // Direct runoff assessment penalty (from assessRunoffRisk) overrides/supplements rain
  if (runoff && typeof runoff.scorePenalty === 'number' && runoff.scorePenalty > 0) {
    // Only apply when greater than existing rain penalty (avoid double-counting)
    const extraPenalty = Math.max(0, runoff.scorePenalty - Math.abs(details.rain || 0));
    if (extraPenalty > 0) {
      score -= extraPenalty;
      details.runoff = -extraPenalty;
    }
    // Hard no-go when runoff says unsafe
    if (runoff.safeToEnter === false) {
      score = Math.min(score, 30);
      details.runoffNoGo = true;
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
  add('tide', 'tide');
  add('temp', 'water temp');
  add('tempMissing', 'missing water temperature');
  add('jellyfish', 'jellyfish risk');
  add('confidence', 'low data confidence');
  add('northCoastLongSwell', 'north-coast long swell');
  add('northCoastCurrent', 'north-coast current sensitivity');
  add('southCoastSurge', 'south-coast surge');
  add('westCoastWindChop', 'west-coast wind chop');
  if (details.lightning) reasons.push('thunderstorms');

  const reason = `Score: ${score} — adjustments from ${reasons.length ? reasons.join(', ') : 'benign conditions'}.`;

  const caution = [];
  if (lightningRisk) caution.push('Thunderstorms – avoid the water.');
  if (currentKnots > 2) caution.push('Stronger currents today.');
  if (swellFeet != null && swellFeet > 5) caution.push('Rougher swell than usual.');
  if (windKnots > 15) caution.push('Choppy surface conditions.');
  if (rainLast24hMM > 5) caution.push('Murky water due to runoff.');
  if (jellyfishWarning) caution.push('High jellyfish risk – stings likely.');
  if (runoff && runoff.safeToEnter === false) caution.push('Water quality unsafe due to runoff. Avoid entry.');
  else if (runoff && runoff.severity === 'moderate') caution.push('Reduced water quality due to runoff.');

  return {
    rating,
    reason,
    cautionNote: caution.join(' '),
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
// Runoff risk assessment
// ---------------------------------------------------------------------------

/**
 * Assess runoff/water-quality risk based on recent rainfall totals and spot context.
 *
 * @param {object} opts
 * @param {number} opts.rain6hMM   - rainfall total last 6 hours (mm)
 * @param {number} opts.rain24hMM  - rainfall total last 24 hours (mm)
 * @param {number} opts.rain72hMM  - rainfall total last 72 hours (mm)
 * @param {object} opts.spot       - spot config (runoffSensitivity, nearStreamMouth, nearDrainage)
 *
 * @returns {{ severity, healthRisk, safeToEnter, waterQualityFeel, scorePenalty, drivers, confidence }}
 */
function assessRunoffRisk({
  rain6hMM = 0,
  rain24hMM = 0,
  rain72hMM = 0,
  spot = null,
} = {}) {
  const {
    runoffSensitivity = 'medium',
    nearStreamMouth = false,
    nearDrainage = false,
  } = spot || {};

  const sensitivityFactor =
    runoffSensitivity === 'high' ? 1.5 :
    runoffSensitivity === 'low'  ? 0.7 : 1.0;

  const drivers = [];
  let rawScore = 0;

  // 6h precip – most acute indicator
  if (rain6hMM > 20)      { rawScore += 50; drivers.push(`heavy rain last 6h (${rain6hMM}mm)`); }
  else if (rain6hMM > 10) { rawScore += 30; drivers.push(`moderate rain last 6h (${rain6hMM}mm)`); }
  else if (rain6hMM > 5)  { rawScore += 15; drivers.push(`light rain last 6h (${rain6hMM}mm)`); }
  else if (rain6hMM > 1)  { rawScore += 5; }

  // 24h precip – cumulative load
  if (rain24hMM > 40)      { rawScore += 25; drivers.push(`high 24h total (${rain24hMM}mm)`); }
  else if (rain24hMM > 20) { rawScore += 15; drivers.push(`elevated 24h total (${rain24hMM}mm)`); }
  else if (rain24hMM > 10) { rawScore += 8; }

  // 72h precip – soil saturation / extended runoff tail
  if (rain72hMM > 80)      { rawScore += 15; drivers.push(`saturated ground – 72h total ${rain72hMM}mm`); }
  else if (rain72hMM > 40) { rawScore += 8; }

  // Site multipliers
  if (nearStreamMouth) { rawScore *= 1.3; drivers.push('near stream mouth'); }
  if (nearDrainage)    { rawScore *= 1.2; drivers.push('near drainage outlet'); }

  const adjustedScore = rawScore * sensitivityFactor;

  let severity, safeToEnter, healthRisk, waterQualityFeel, scorePenalty;

  if (adjustedScore >= 80) {
    severity        = 'extreme';
    safeToEnter     = false;
    healthRisk      = 'High risk of waterborne illness. Avoid entering the water.';
    waterQualityFeel = 'Brown/murky water with debris likely. Strongly avoid.';
    scorePenalty    = 60;
  } else if (adjustedScore >= 50) {
    severity        = 'high';
    safeToEnter     = false;
    healthRisk      = 'Elevated bacterial and pollution risk. Not recommended.';
    waterQualityFeel = 'Murky water likely with reduced visibility and runoff contaminants.';
    scorePenalty    = 40;
  } else if (adjustedScore >= 25) {
    severity        = 'moderate';
    safeToEnter     = true;
    healthRisk      = 'Moderate runoff risk. Avoid if you have open wounds or are immunocompromised.';
    waterQualityFeel = 'Water quality slightly degraded. Use caution.';
    scorePenalty    = 20;
  } else if (adjustedScore >= 8) {
    severity        = 'low';
    safeToEnter     = true;
    healthRisk      = 'Minor runoff detected. Generally safe for healthy individuals.';
    waterQualityFeel = 'Water quality mostly normal with minor sediment possible.';
    scorePenalty    = 8;
  } else {
    severity        = 'none';
    safeToEnter     = true;
    healthRisk      = 'No significant runoff risk detected.';
    waterQualityFeel = 'Water quality normal.';
    scorePenalty    = 0;
  }

  // Confidence: full when all three rollup values are available finite numbers
  const hasAll = Number.isFinite(rain6hMM) && Number.isFinite(rain24hMM) && Number.isFinite(rain72hMM);
  const confidence = hasAll ? 0.8 : 0.5;

  return { severity, healthRisk, safeToEnter, waterQualityFeel, scorePenalty, drivers, confidence };
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
  assessRunoffRisk,

  // Extras we may use elsewhere
  diurnalProfile,
  classifyTidePhase,
  computeTidePhaseFromLevels,
  estimateCurrentFromWind,
  movingAverage,
  computeLocalMoonPhase,
};