/* eslint-env node */
/* eslint-disable no-console */

// Guards the two-role visibility model: visibility is both the dominant
// INPUT to the composite score AND a hard CEILING on the final rating.
// If a future refactor folds these together (or drops the ceiling),
// these assertions fail.

const assert = require('assert');
const { generateSnorkelRating } = require('../analysis');
const {
  visibilityScoreCap,
  clarityForMeters,
  ratingFromScore,
} = require('../abyss/ratingConfig');

const FT = 3.28084;
const m = (ft) => ft / FT;

// A deliberately perfect composite: calm wind, no swell, rising clean
// tide, warm water, full confidence. Only visibility varies.
const perfect = (visFt) => generateSnorkelRating({
  visibilityMeters: m(visFt),
  windKnots: 6, swellFeet: 0, swellPeriodSec: 12, currentKnots: 0.2,
  waterTempC: 27, rainLast24hMM: 0,
  tideCycle: { currentTideState: 'rising' },
  runoff: { severity: 'none', confidence: 0.9, scorePenalty: 0 },
  confidenceScore: 1,
});

// ── Ceiling bands ───────────────────────────────────────────────────
assert.strictEqual(visibilityScoreCap(m(5)), 19, '0–10 ft caps at No-Go');
assert.strictEqual(visibilityScoreCap(m(15)), 39, '10–20 ft caps at Fair');
assert.strictEqual(visibilityScoreCap(m(27)), 59, '20–35 ft caps at Good');
assert.strictEqual(visibilityScoreCap(m(42)), 79, '35–50 ft caps at Great');
assert.strictEqual(visibilityScoreCap(m(60)), 100, '50+ ft eligible for Excellent');
console.log('✓ visibility ceiling bands');

// ── A perfect composite cannot escape its visibility ceiling ─────────
// This is the core guarantee: good weather can't buy back bad clarity.
assert.strictEqual(perfect(3).rating, 'No-Go', '3 ft perfect weather is still No-Go');
assert.ok(perfect(15).score <= 39, '15 ft caps at Fair even when perfect');
assert.ok(perfect(23).score <= 59, '23 ft caps at Good even when perfect');
assert.notStrictEqual(perfect(23).rating, 'Excellent', '23 ft can NEVER be Excellent');
assert.notStrictEqual(perfect(23).rating, 'Great', '23 ft can NEVER be Great');
assert.strictEqual(perfect(39).rating, 'Great', '39 ft tops out at Great');
console.log('✓ perfect composite respects the visibility ceiling');

// ── Excellent requires BOTH high vis and strong conditions ───────────
assert.strictEqual(perfect(55).rating, 'Excellent', '55 ft + calm = Excellent');
const roughButClear = generateSnorkelRating({
  visibilityMeters: m(55), windKnots: 20, swellFeet: 5, swellPeriodSec: 6,
  currentKnots: 0.3, waterTempC: 26, rainLast24hMM: 0,
  tideCycle: { currentTideState: 'falling' }, confidenceScore: 1,
});
assert.notStrictEqual(roughButClear.rating, 'Excellent', 'clear water + rough seas is NOT Excellent');
console.log('✓ Excellent needs high vis AND strong conditions');

// ── Rating and clarity label cannot contradict ───────────────────────
// Both derive from the same bands, so the overall tier is always ≤ the
// clarity tier (never "Good rating" beside "Poor clarity").
const TIER_ORD = { 'No-Go': 0, Poor: 0, Fair: 1, Good: 2, Great: 3, Excellent: 4 };
for (const visFt of [3, 8, 15, 23, 30, 39, 45, 55, 70]) {
  const r = perfect(visFt);
  const clarity = clarityForMeters(m(visFt));
  assert.ok(
    TIER_ORD[r.rating] <= TIER_ORD[clarity],
    `rating ${r.rating} must not exceed clarity ${clarity} at ${visFt} ft`,
  );
}
console.log('✓ rating never contradicts clarity label');

// ── ratingFromScore matches the documented thresholds ────────────────
assert.strictEqual(ratingFromScore(80), 'Excellent');
assert.strictEqual(ratingFromScore(79), 'Great');
assert.strictEqual(ratingFromScore(59), 'Good');
assert.strictEqual(ratingFromScore(39), 'Fair');
assert.strictEqual(ratingFromScore(19), 'No-Go');
console.log('✓ ratingFromScore thresholds');

console.log('\nratingCap.unit.js — all assertions passed');
