/* eslint-env node */
'use strict';

/**
 * Unit tests for the Abyss calibration loop's pure functions
 * (abyss/calibrate.js): bucketing, weighted stats (bias/MAE/R²/
 * confidence), per-spot calibration computation, and correction
 * application.
 *
 * Run: node functions/__test__/calibration.unit.js
 */

const assert = require('assert');

const {
  bucketKeysForContext,
  observationWeight,
  recencyWeight,
  computeStats,
  computeSpotCalibration,
  computeDailyRollups,
  hstDateKey,
  computeCorrection,
  applyCalibrationToVisibility,
  HALF_LIFE_DAYS,
} = require('../abyss/calibrate');

const NOW = Date.UTC(2026, 5, 10, 0, 0, 0); // fixed reference time

// ── bucketKeysForContext ─────────────────────────────────────────────

{
  // 10:00 HST = 20:00 UTC
  const keys = bucketKeysForContext({
    waveHeightFt: 3.2,
    tideState: 'rising',
    diveAtMs: Date.UTC(2026, 5, 9, 20, 0, 0),
    runoffSeverity: 'low',
  });
  assert.deepStrictEqual(keys, ['swell_small', 'tide_rising', 'tod_morning', 'runoff_low']);

  // Missing everything → unknown buckets (and tod from null is unknown)
  const unk = bucketKeysForContext({});
  assert.deepStrictEqual(unk, ['swell_unknown', 'tide_unknown', 'tod_unknown', 'runoff_unknown']);

  // Boundary checks: 6 ft → large; 18:30 HST → dusk; bogus tide → unknown
  const edge = bucketKeysForContext({
    waveHeightFt: 6.0,
    tideState: 'sideways',
    diveAtMs: Date.UTC(2026, 5, 10, 4, 30, 0), // 18:30 HST
    runoffSeverity: 'extreme',
  });
  assert.deepStrictEqual(edge, ['swell_large', 'tide_unknown', 'tod_dusk', 'runoff_extreme']);
  console.log('✓ bucketKeysForContext');
}

// ── observation + recency weights ────────────────────────────────────

{
  // Snorkel logs are down-weighted vs scuba
  const scuba = observationWeight({ dive_type: 'scuba', observed: {} });
  const snorkel = observationWeight({ dive_type: 'snorkel', observed: {} });
  assert.ok(snorkel < scuba, 'snorkel weighted below scuba');

  // Corroborating detail raises weight
  const detailed = observationWeight({
    dive_type: 'scuba',
    observed: { max_depth_ft: 60, duration_min: 45, current_strength: 'light' },
  });
  assert.ok(detailed > scuba, 'detailed log weighted above bare log');

  // Pinned 200 ft slider is distrusted
  const pinned = observationWeight({ dive_type: 'scuba', observed: { visibility_ft: 200 } });
  assert.ok(pinned < scuba, 'pinned slider down-weighted');

  // Recency: half-life behaves
  const w0 = recencyWeight(NOW, NOW);
  const wHalf = recencyWeight(NOW - HALF_LIFE_DAYS * 86400000, NOW);
  assert.strictEqual(w0, 1);
  assert.ok(Math.abs(wHalf - 0.5) < 1e-9, `half-life weight ≈ 0.5, got ${wHalf}`);
  console.log('✓ observationWeight / recencyWeight');
}

// ── computeStats ─────────────────────────────────────────────────────

{
  // Known data: predictions consistently 5 ft high
  const pairs = [
    { predicted: 45, observed: 40, weight: 1 },
    { predicted: 35, observed: 30, weight: 1 },
    { predicted: 25, observed: 20, weight: 1 },
    { predicted: 55, observed: 50, weight: 1 },
  ];
  const s = computeStats(pairs);
  assert.strictEqual(s.bias, 5, 'bias = mean signed error');
  assert.strictEqual(s.mae, 5, 'mae');
  assert.strictEqual(s.sampleCount, 4);
  // Constant offset against varying observations: R² = 1 − (4·25)/SStot,
  // SStot = (40−35)²+(30−35)²+(20−35)²+(50−35)² ·1 = 25+25+225+225 = 500
  assert.ok(Math.abs(s.r2 - (1 - 100 / 500)) < 1e-6, `r2, got ${s.r2}`);
  assert.ok(s.confidence > 0.3 && s.confidence < 0.6, 'mid confidence for n=4');

  // Weighted: heavy weight on an outlier drags bias toward it
  const w = computeStats([
    { predicted: 40, observed: 40, weight: 1 },
    { predicted: 60, observed: 40, weight: 3 },
  ]);
  assert.strictEqual(w.bias, 15, 'weighted bias (0·1 + 20·3)/4');

  // No variance in observations → r2 null, not NaN/Infinity
  const flat = computeStats([
    { predicted: 42, observed: 40, weight: 1 },
    { predicted: 38, observed: 40, weight: 1 },
    { predicted: 40, observed: 40, weight: 1 },
  ]);
  assert.strictEqual(flat.r2, null, 'r2 null when observations constant');

  // Empty → zeroed
  const empty = computeStats([]);
  assert.strictEqual(empty.sampleCount, 0);
  assert.strictEqual(empty.confidence, 0);
  console.log('✓ computeStats');
}

// ── computeSpotCalibration ───────────────────────────────────────────

function makeLog({ daysAgo = 1, predVis = 40, obsVis = 30, waveFt = 3, tide = 'rising', runoff = 'none', hourUtc = 20, ratingDelta = 1, diveType = 'scuba' } = {}) {
  // daysAgo days back, at hourUtc on that UTC day (NOW sits at 00:00 UTC,
  // so e.g. daysAgo=1, hourUtc=20 → 20:00 UTC = 10:00 HST = tod_morning).
  const diveAt = NOW - daysAgo * 86400000 + hourUtc * 3600000;
  return {
    spot_id: 'test-spot',
    dive_at: diveAt, // plain ms — computeSpotCalibration handles both
    dive_type: diveType,
    observed: { visibility_ft: obsVis, overall_rating: 'good', water_temp_surface_f: 79, water_temp_bottom_f: 76 },
    predicted_at_time: {
      visibility_ft: predVis,
      water_temp_f: 78,
      wave_height_ft: waveFt,
      tide_state: tide,
      runoff_severity: runoff,
    },
    deltas: { visibility_ft: predVis - obsVis, water_temp_f: 2, rating_delta: ratingDelta },
  };
}

{
  // Below threshold → no calibration
  const thin = computeSpotCalibration([makeLog(), makeLog()], { nowMs: NOW });
  assert.strictEqual(thin.overall, null, 'fewer than 3 samples → null');

  // Logs with unresolved snapshots are skipped entirely
  const unresolved = computeSpotCalibration(
    [makeLog(), { spot_id: 'x', predicted_at_time: null, observed: { visibility_ft: 10 } }],
    { nowMs: NOW },
  );
  assert.strictEqual(unresolved.overall, null, 'null snapshots don\'t count');

  // 8 recent logs over-predicting by ~10 ft, on small rising-tide mornings
  const logs = Array.from({ length: 8 }, (_, i) =>
    makeLog({ daysAgo: i + 1, predVis: 40, obsVis: 30 }));
  const { overall, buckets } = computeSpotCalibration(logs, { nowMs: NOW });

  assert.ok(overall, 'calibration produced');
  assert.strictEqual(overall.bias_offsets.visibility_ft, 10, 'flat +10 ft bias detected');
  assert.strictEqual(overall.mae_visibility_ft, 10);
  assert.strictEqual(overall.sample_count, 8);
  assert.ok(overall.confidence_score > 0.4, 'reasonable confidence at n=8');
  assert.strictEqual(overall.bias_offsets.rating_level, 1, 'mean rating_delta');
  assert.ok(Number.isFinite(overall.bias_offsets.water_temp_f), 'water temp bias present');
  assert.ok(overall.observed_aggregates.thermocline_rate >= 0, 'thermocline inferred from temp split');

  // Buckets: all 8 logs share swell_small / tide_rising / tod_morning / runoff_none
  for (const key of ['swell_small', 'tide_rising', 'tod_morning', 'runoff_none']) {
    assert.ok(buckets[key], `bucket ${key} exists`);
    assert.strictEqual(buckets[key].bias_visibility_ft, 10, `bucket ${key} bias`);
    assert.strictEqual(buckets[key].sample_count, 8);
  }
  // No unknown buckets ever written
  assert.ok(!Object.keys(buckets).some((k) => k.endsWith('_unknown')), 'no unknown buckets');

  // Stratification: spot reads clean on calm days, over-predicts on big swell
  const mixed = [
    ...Array.from({ length: 5 }, (_, i) => makeLog({ daysAgo: i + 1, predVis: 40, obsVis: 40, waveFt: 1 })),
    ...Array.from({ length: 5 }, (_, i) => makeLog({ daysAgo: i + 1, predVis: 40, obsVis: 22, waveFt: 7 })),
  ];
  const strat = computeSpotCalibration(mixed, { nowMs: NOW });
  assert.strictEqual(strat.buckets.swell_calm.bias_visibility_ft, 0, 'calm bucket unbiased');
  assert.strictEqual(strat.buckets.swell_large.bias_visibility_ft, 18, 'large-swell bucket biased');
  assert.strictEqual(strat.overall.bias_offsets.visibility_ft, 9, 'overall is the blend');
  console.log('✓ computeSpotCalibration');
}

// ── computeCorrection + applyCalibrationToVisibility ─────────────────

{
  const calibration = {
    overall: {
      bias_offsets: { visibility_ft: 10 },
      confidence_score: 0.6,
      sample_count: 8,
    },
    buckets: {
      swell_large: { bias_visibility_ft: 18, confidence: 0.5, sample_count: 5 },
      tide_rising: { bias_visibility_ft: 8, confidence: 0.4, sample_count: 6 },
    },
  };

  // No calibration → no-op
  const none = computeCorrection(40, null, {});
  assert.strictEqual(none.applied, false);

  // Overall only (context matches no buckets): correction = bias × confidence
  const flat = computeCorrection(40, calibration, {
    waveHeightFt: 3, tideState: 'falling', nowMs: NOW, runoffSeverity: 'none',
  });
  assert.ok(flat.applied);
  assert.ok(Math.abs(flat.correctionFt - 6) < 0.11, `10 × 0.6 ≈ 6, got ${flat.correctionFt}`);

  // Matching buckets blend in and push the correction up
  const bucketed = computeCorrection(40, calibration, {
    waveHeightFt: 7, tideState: 'rising', nowMs: NOW, runoffSeverity: 'none',
  });
  assert.ok(bucketed.bucketsUsed.includes('swell_large'), 'large-swell bucket used');
  assert.ok(bucketed.bucketsUsed.includes('tide_rising'), 'tide bucket used');
  assert.ok(bucketed.correctionFt > flat.correctionFt, 'bucket evidence strengthens correction');

  // Cap: correction never exceeds 50% of prediction / 15 ft, never inverts
  const huge = computeCorrection(12, {
    overall: { bias_offsets: { visibility_ft: 40 }, confidence_score: 0.9, sample_count: 30 },
    buckets: {},
  }, {});
  assert.ok(huge.correctionFt <= 6 + 1e-9, `capped at 50% of 12 ft, got ${huge.correctionFt}`);
  assert.ok(huge.correctedFt >= 6, 'prediction not inverted');

  // applyCalibrationToVisibility: corrected copy, rating recomputed, ceiling respected
  const visResult = {
    estimatedVisibilityMeters: 12,
    estimatedVisibilityFeet: 39,
    rating: 'Good',
    confidence: 0.7,
  };
  const applied = applyCalibrationToVisibility(visResult, calibration, {
    waveHeightFt: 7, tideState: 'rising', nowMs: NOW, runoffSeverity: 'none',
    spot: { maxDepthM: 30 },
  });
  assert.ok(applied.calibration.applied);
  assert.ok(applied.estimatedVisibilityFeet < 39, 'over-prediction corrected down');
  assert.strictEqual(applied.calibration.uncalibrated.visibilityFt, 39, 'original preserved');
  assert.ok(['Poor', 'Fair', 'Good', 'Excellent'].includes(applied.rating));
  assert.ok(applied.confidence > 0.7, 'ground truth raises confidence');

  // Shallow spot: corrected value still respects the depth ceiling
  const shallow = applyCalibrationToVisibility(
    { estimatedVisibilityMeters: 12, estimatedVisibilityFeet: 39, rating: 'Good', confidence: 0.7 },
    { overall: { bias_offsets: { visibility_ft: -15 }, confidence_score: 0.9, sample_count: 20 }, buckets: {} },
    { nowMs: NOW, spot: { maxDepthM: 8 } }, // under-prediction: correction pushes UP
  );
  // ceiling = 8 × 1.2 = 9.6 m, rounded to whole meters by the engine
  assert.ok(shallow.estimatedVisibilityMeters <= Math.round(8 * 1.2), 'depth ceiling respected');

  // Untouched passthrough when nothing to apply
  const passthrough = applyCalibrationToVisibility(visResult, null, {});
  assert.strictEqual(passthrough.estimatedVisibilityFeet, 39);
  assert.strictEqual(passthrough.calibration.applied, false);
  console.log('✓ computeCorrection / applyCalibrationToVisibility');
}

// ── computeDailyRollups ──────────────────────────────────────────────

{
  // HST day boundary: 09:30 UTC Jun 10 = 23:30 HST Jun 9 — belongs to Jun 9.
  assert.strictEqual(hstDateKey(Date.UTC(2026, 5, 10, 9, 30, 0)), '2026-06-09');
  assert.strictEqual(hstDateKey(Date.UTC(2026, 5, 10, 10, 30, 0)), '2026-06-10');

  const logs = [
    // Two comparable dives on Jun 9 HST (19:00 + 21:00 UTC = 09:00/11:00 HST)
    makeLog({ daysAgo: 1, hourUtc: 19, predVis: 40, obsVis: 30 }),
    makeLog({ daysAgo: 1, hourUtc: 21, predVis: 36, obsVis: 38 }),
    // One dive on Jun 8 HST with NO resolved snapshot — counts for
    // dive_count + observed avg, contributes nothing to error stats
    { dive_at: NOW - 2 * 86400000 + 20 * 3600000, observed: { visibility_ft: 50 }, predicted_at_time: null },
    // One log with no usable dive_at — skipped entirely
    { dive_at: 'bogus', observed: { visibility_ft: 10 } },
  ];
  const rollups = computeDailyRollups(logs);
  const dates = Object.keys(rollups).sort();
  assert.strictEqual(dates.length, 2, 'two HST days');

  const [day8, day9] = dates.map((d) => rollups[d]);
  assert.strictEqual(day9.dive_count, 2);
  assert.strictEqual(day9.avg_observed_visibility_ft, 34);     // (30+38)/2
  assert.strictEqual(day9.avg_predicted_visibility_ft, 38);    // (40+36)/2
  assert.strictEqual(day9.mae_visibility_ft, 6);               // (|10|+|−2|)/2
  assert.strictEqual(day9.mean_signed_delta_visibility_ft, 4); // (10 + −2)/2

  assert.strictEqual(day8.dive_count, 1);
  assert.strictEqual(day8.avg_observed_visibility_ft, 50);
  assert.strictEqual(day8.avg_predicted_visibility_ft, null, 'no snapshot → no predicted avg');
  assert.strictEqual(day8.mae_visibility_ft, null);
  console.log('✓ computeDailyRollups');
}

console.log('\nAll calibration tests passed.');
