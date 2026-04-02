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
// Rain rollup helper
// ---------------------------------------------------------------------------

/**
 * Compute rolling rainfall totals from an array of normalized hourly items.
 *
 * Returns rain3hMM, rain6hMM, rain12hMM, rain24hMM, rain48hMM, rain72hMM
 * relative to nowMs. Any bucket where no hourly items exist returns 0.
 *
 * @param {{ hourlyItems: Array, nowMs: number }} opts
 * @returns {{ rain3hMM, rain6hMM, rain12hMM, rain24hMM, rain48hMM, rain72hMM }}
 */
function computeRainTotals({ hourlyItems, nowMs }) {
  const MS3H  =  3 * 3600000;
  const MS6H  =  6 * 3600000;
  const MS12H = 12 * 3600000;
  const MS24H = 24 * 3600000;
  const MS48H = 48 * 3600000;
  const MS72H = 72 * 3600000;

  let r3 = 0, r6 = 0, r12 = 0, r24 = 0, r48 = 0, r72 = 0;

  for (const item of (hourlyItems || [])) {
    if (!item || !Number.isFinite(item.tsMs)) continue;
    const age = nowMs - item.tsMs;
    if (age < 0 || age > MS72H) continue;
    const mm = Number.isFinite(item.rainLast1hMM) ? item.rainLast1hMM : 0;
    if (age <= MS3H)  r3  += mm;
    if (age <= MS6H)  r6  += mm;
    if (age <= MS12H) r12 += mm;
    if (age <= MS24H) r24 += mm;
    if (age <= MS48H) r48 += mm;
    r72 += mm;
  }

  return {
    rain3hMM:  Math.round(r3  * 10) / 10,
    rain6hMM:  Math.round(r6  * 10) / 10,
    rain12hMM: Math.round(r12 * 10) / 10,
    rain24hMM: Math.round(r24 * 10) / 10,
    rain48hMM: Math.round(r48 * 10) / 10,
    rain72hMM: Math.round(r72 * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Tide helpers
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

/**
 * Extract local extrema from a tide level series.
 *
 * Handles two input formats:
 *  - NOAA hilo events:  [{ tsMs, levelFt, type: 'H'|'L' }, ...]  → returned as-is
 *  - Dense uniform series: [{ tsMs, levelFt }, ...]  → direction-change extrema
 *
 * Returns array of { tsMs, levelFt, type } sorted by tsMs ascending.
 */
function findLocalExtrema(levelSeries) {
  if (!Array.isArray(levelSeries) || levelSeries.length < 2) return [];

  // If the first element has a 'type' field the series is already hilo events
  if (levelSeries[0] && levelSeries[0].type !== undefined) {
    return levelSeries
      .filter((e) => e.type === 'H' || e.type === 'L')
      .sort((a, b) => a.tsMs - b.tsMs);
  }

  // Dense series: find local min/max by direction-change detection
  const extrema = [];
  for (let i = 1; i < levelSeries.length - 1; i++) {
    const prev = levelSeries[i - 1].levelFt;
    const curr = levelSeries[i].levelFt;
    const next = levelSeries[i + 1].levelFt;
    if (curr > prev && curr > next) extrema.push({ ...levelSeries[i], type: 'H' });
    else if (curr < prev && curr < next) extrema.push({ ...levelSeries[i], type: 'L' });
  }
  return extrema;
}

/**
 * Linear interpolation of tide level at tsMs from a sorted series.
 *
 * Returns null when series is empty or input is invalid.
 * Clamps to edge values when tsMs is outside the series range.
 */
function interpolateLevelAt(levelSeries, tsMs) {
  if (!Array.isArray(levelSeries) || levelSeries.length === 0) return null;
  if (!Number.isFinite(tsMs)) return null;
  if (levelSeries.length === 1) return levelSeries[0].levelFt;

  // Before or after series range → clamp
  if (tsMs <= levelSeries[0].tsMs) return levelSeries[0].levelFt;
  if (tsMs >= levelSeries[levelSeries.length - 1].tsMs) {
    return levelSeries[levelSeries.length - 1].levelFt;
  }

  // Binary search for bracketing pair
  let lo = 0;
  let hi = levelSeries.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (levelSeries[mid].tsMs <= tsMs) lo = mid;
    else hi = mid;
  }

  const a = levelSeries[lo];
  const b = levelSeries[hi];
  const span = b.tsMs - a.tsMs;
  if (span === 0) return a.levelFt;
  const t = (tsMs - a.tsMs) / span;
  return a.levelFt + (b.levelFt - a.levelFt) * t;
}

/**
 * Choose the best complete tide cycle (low → high → low) from a list of
 * hilo extrema events for a given reference time.
 *
 * Strategy:
 *  1. Build all L → H → L triples from consecutive events.
 *  2. If one contains nowMs (low1.tsMs ≤ nowMs ≤ low2.tsMs), return it.
 *     If multiple contain it (edge overlap), pick the one where nowMs is
 *     most central.
 *  3. If none contain nowMs, pick the cycle whose high-tide time is nearest
 *     to preferWindowMs (e.g. midday) — or nearest to nowMs if not given.
 *
 * Returns { low1, high, low2 } or null.
 */
function chooseBestCycle(events, nowMs, preferWindowMs = null) {
  if (!Array.isArray(events) || events.length < 3) return null;

  // Build all L→H→L triples
  const cycles = [];
  for (let i = 0; i < events.length - 2; i++) {
    const a = events[i];
    const b = events[i + 1];
    const c = events[i + 2];
    if (a.type === 'L' && b.type === 'H' && c.type === 'L') {
      cycles.push({ low1: a, high: b, low2: c });
    }
  }
  if (!cycles.length) return null;

  // Cycles that contain nowMs
  const containing = cycles.filter(
    (c) => c.low1.tsMs <= nowMs && nowMs <= c.low2.tsMs,
  );
  if (containing.length === 1) return containing[0];
  if (containing.length > 1) {
    return containing.reduce((best, c) => {
      const span = c.low2.tsMs - c.low1.tsMs;
      const ratio = span ? (nowMs - c.low1.tsMs) / span : 0.5;
      const bestSpan = best.low2.tsMs - best.low1.tsMs;
      const bestRatio = bestSpan ? (nowMs - best.low1.tsMs) / bestSpan : 0.5;
      return Math.abs(ratio - 0.5) < Math.abs(bestRatio - 0.5) ? c : best;
    });
  }

  // No cycle contains nowMs — pick nearest by preferred reference time
  const ref = Number.isFinite(preferWindowMs) ? preferWindowMs : nowMs;
  return cycles.reduce((best, c) => {
    const dist = Math.abs(c.high.tsMs - ref);
    const bestDist = Math.abs(best.high.tsMs - ref);
    return dist < bestDist ? c : best;
  });
}

/**
 * Build a full tide-cycle object from a hilo series.
 *
 * Selects the best low→high→low cycle for nowMs, then computes:
 *  - Midpoint (rising)  between low1 and high
 *  - Midpoint (falling) between high and low2
 *  - Current tide height by linear interpolation at nowMs
 *  - Current tide state: 'low' | 'rising' | 'high' | 'falling'
 *
 * @param {object} opts
 * @param {Array}  opts.levelSeries    - hilo events [{tsMs, levelFt, type}] sorted
 * @param {number} opts.nowMs          - current timestamp in ms
 * @param {string} [opts.tz]           - timezone string (reserved for future use)
 * @param {number} [opts.preferWindowMs] - preferred reference for cycle selection
 * @returns {object|null}  Full tide cycle object, or null if data insufficient
 */
function buildTideCycle({ levelSeries, nowMs, tz, preferWindowMs = null }) {
  // suppress unused-variable lint warning; tz is accepted for forward-compat
  void tz;

  if (!Array.isArray(levelSeries) || levelSeries.length < 3) return null;
  if (!Number.isFinite(nowMs)) return null;

  const events = findLocalExtrema(levelSeries);
  if (events.length < 3) return null;

  const cycle = chooseBestCycle(events, nowMs, preferWindowMs);
  if (!cycle) return null;

  const { low1, high, low2 } = cycle;

  const risingTsMs  = Math.round((low1.tsMs + high.tsMs) / 2);
  const fallingTsMs = Math.round((high.tsMs + low2.tsMs) / 2);

  const risingHt  = (low1.levelFt + high.levelFt) / 2;
  const fallingHt = (high.levelFt + low2.levelFt) / 2;

  const rawHeight = interpolateLevelAt(levelSeries, nowMs);
  const currentTideHeight = rawHeight != null ? Math.round(rawHeight * 100) / 100 : null;

  const TOLERANCE_MS = 30 * 60000;
  let currentTideState;
  if (nowMs <= low1.tsMs + TOLERANCE_MS || nowMs >= low2.tsMs - TOLERANCE_MS) {
    currentTideState = 'low';
  } else if (nowMs >= high.tsMs - TOLERANCE_MS && nowMs <= high.tsMs + TOLERANCE_MS) {
    currentTideState = 'high';
  } else if (nowMs < high.tsMs) {
    currentTideState = 'rising';
  } else {
    currentTideState = 'falling';
  }

  return {
    lowTide1Time:      new Date(low1.tsMs).toISOString(),
    lowTide1Height:    Math.round(low1.levelFt * 100) / 100,
    risingTideTime:    new Date(risingTsMs).toISOString(),
    risingTideHeight:  Math.round(risingHt * 100) / 100,
    highTideTime:      new Date(high.tsMs).toISOString(),
    highTideHeight:    Math.round(high.levelFt * 100) / 100,
    fallingTideTime:   new Date(fallingTsMs).toISOString(),
    fallingTideHeight: Math.round(fallingHt * 100) / 100,
    lowTide2Time:      new Date(low2.tsMs).toISOString(),
    lowTide2Height:    Math.round(low2.levelFt * 100) / 100,
    currentTideState,
    currentTideHeight,
  };
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
 *  - tidePhase: 'rising' | 'falling' | 'slack' | 'unknown'  (legacy; tide preferred)
 *  - tide: full tide cycle object from buildTideCycle (optional; preferred over tidePhase)
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
  tide = null,
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

  // Tide effects — prefer new tide model; fall back to legacy tidePhase
  // Scoring: rising +2, high +1, falling −2, low −1
  const effectiveTideState = (tide && tide.currentTideState) || tidePhase;
  if (effectiveTideState === 'rising') vis += 2;
  else if (effectiveTideState === 'high') vis += 1;
  else if (effectiveTideState === 'falling') vis -= 2;
  else if (effectiveTideState === 'low') vis -= 1;

  // Interaction: falling tide + active runoff → extra turbidity penalty
  if (effectiveTideState === 'falling' &&
      runoff && ['moderate', 'high', 'extreme'].includes(runoff.severity)) {
    vis -= 2;
  }

  // Interaction: rising tide + low/no runoff → slight bonus
  if (effectiveTideState === 'rising' &&
      runoff && ['none', 'low'].includes(runoff.severity)) {
    vis += 1;
  }

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
  tide = null,
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

  // Tide effects — prefer new tide model; fall back to legacy tidePhase
  // Scoring: rising +5, high +2, falling −5, low −2
  const effectiveTideState = (tide && tide.currentTideState) || tidePhase;
  if (effectiveTideState === 'rising')       { score += 5; details.tide = +5; }
  else if (effectiveTideState === 'high')    { score += 2; details.tide = +2; }
  else if (effectiveTideState === 'falling') { score -= 5; details.tide = -5; }
  else if (effectiveTideState === 'low')     { score -= 2; details.tide = -2; }
  else details.tide = 0;

  // Interaction: falling tide + active runoff → extra penalty
  if (effectiveTideState === 'falling' &&
      runoff && ['moderate', 'high', 'extreme'].includes(runoff.severity)) {
    score -= 5;
    details.tideFallingRunoff = -5;
  }

  // Interaction: rising tide + clean water → slight bonus
  if (effectiveTideState === 'rising' &&
      runoff && ['none', 'low'].includes(runoff.severity)) {
    score += 3;
    details.tideRisingClean = +3;
  }

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
  add('tideFallingRunoff', 'falling tide + runoff');
  add('tideRisingClean', 'rising tide, clean water');
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
  // Tide-related caution
  if (effectiveTideState === 'falling' &&
      runoff && ['moderate', 'high', 'extreme'].includes(runoff.severity)) {
    caution.push('Falling tide carrying runoff – reduced visibility expected.');
  }
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
  computeRainTotals,

  // Tide cycle helpers
  findLocalExtrema,
  interpolateLevelAt,
  chooseBestCycle,
  buildTideCycle,

  // Extras we may use elsewhere
  diurnalProfile,
  classifyTidePhase,
  computeTidePhaseFromLevels,
  estimateCurrentFromWind,
  movingAverage,
  computeLocalMoonPhase,
};