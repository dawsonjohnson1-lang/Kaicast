/* eslint-env node */

/**
 * Shared rating configuration — the single backend home for visibility
 * bands and rating-tier thresholds. Mirrored (like the spot list) by
 * the two clients: `app/src/utils/scoreToTier.ts` and
 * `desktop/data/getReport.ts`. Change all three together.
 *
 * Visibility plays TWO DISTINCT ROLES in the rating system, by design:
 *
 *   1. INPUT — the dominant single penalty inside the composite score
 *      (generateSnorkelRating / generateDiveScore). Wind, swell, tide,
 *      runoff, comfort still matter: rating a dive day is like rating
 *      a surf day — you weigh how clean the whole day is, not one
 *      number.
 *
 *   2. CEILING — a hard cap applied AFTER the composite is computed.
 *      Even a perfect composite (calm wind, no swell, slack tide,
 *      clear sky) must be clamped down when the water itself is dirty.
 *      Bad clarity can never be "bought back" by good weather.
 *
 * Do NOT refactor these two into one mechanism. The ceiling is not
 * redundant with the input weight — it is the guarantee the input
 * weight alone can't make.
 */

const FT_PER_M = 3.28084;

// Visibility bands (feet). Each band defines:
//   clarity  — the user-facing water-clarity label. Also serves as the
//              `visibility.rating` field, so the overall rating and the
//              clarity label can never contradict (both key off the
//              same bands).
//   maxScore — the highest composite score a spot in this band may
//              keep. Aligned with RATING_THRESHOLDS so each cap lands
//              exactly at the top of the named tier (79 = best
//              possible "Great", etc).
const VIS_BANDS = [
  { minFt: 50, clarity: 'Excellent', maxScore: 100 }, // 50+ ft — only band eligible for Excellent
  { minFt: 35, clarity: 'Great',     maxScore: 79 },  // 35–50 ft caps at Great
  { minFt: 20, clarity: 'Good',      maxScore: 59 },  // 20–35 ft caps at Good
  { minFt: 10, clarity: 'Fair',      maxScore: 39 },  // 10–20 ft caps at Fair
  { minFt: 0,  clarity: 'Poor',      maxScore: 19 },  // <10 ft — No-Go territory
];

// Composite score → named tier. Both clients' scoreToTier mirrors this.
const RATING_THRESHOLDS = [
  { min: 80, rating: 'Excellent' },
  { min: 60, rating: 'Great' },
  { min: 40, rating: 'Good' },
  { min: 20, rating: 'Fair' },
  { min: 0,  rating: 'No-Go' },
];

// Ceiling when visibility is UNKNOWN: without a clarity estimate we
// can't certify Excellent (top of "Great").
const UNKNOWN_VIS_MAX_SCORE = 79;

// Visibility as INPUT (role 1): the dominant single penalty inside the
// composite score. Piecewise-linear over (visFt, penaltyPoints)
// anchors, interpolated by visibilityInputPenalty(). This curve is
// deliberately the steepest, highest-magnitude factor in the scorer —
// no combination of wind / swell / tide / runoff bonuses can lift a
// low-clarity spot into a good composite. The CEILING (role 2,
// visibilityScoreCap) is the *separate* hard guarantee on top of this.
//
// Neutral-day math (score starts at 100, no other penalties): each
// anchor's (100 − penalty) lands a clear-water spot near the top of
// the band its ceiling allows, so the input and the ceiling agree
// instead of fighting. Real days carry additional wind/swell/runoff
// penalties that pull the composite below that ceiling, as intended.
const VIS_INPUT_PENALTY_ANCHORS = [
  [60, 0],   // 60+ ft — full credit
  [50, 16],  // 50 ft  → neutral ~84 (Excellent-eligible)
  [40, 24],  // 40 ft  → neutral ~76 (Great)
  [30, 38],  // 30 ft  → neutral ~62, ceiling pulls to 59 (Good)
  [20, 50],  // 20 ft  → neutral ~50 (Good floor)
  [10, 68],  // 10 ft  → neutral ~32 (Fair)
  [0,  92],  //  0 ft  → neutral ~8  (No-Go)
];

// Penalty (points off the 100-base composite) for a visibility in
// meters. Unknown vis → a small fixed penalty (we don't reward missing
// data, but the UNKNOWN ceiling does the heavy lifting there).
function visibilityInputPenalty(visM) {
  if (!Number.isFinite(visM)) return 12;
  const ft = visM * FT_PER_M;
  const a = VIS_INPUT_PENALTY_ANCHORS;
  if (ft >= a[0][0]) return 0;
  if (ft <= a[a.length - 1][0]) return a[a.length - 1][1];
  for (let i = 0; i < a.length - 1; i++) {
    const [f1, p1] = a[i];
    const [f2, p2] = a[i + 1];
    if (ft <= f1 && ft >= f2) {
      const t = (f1 - ft) / (f1 - f2);
      return Math.round(p1 + (p2 - p1) * t);
    }
  }
  return 0;
}

function visBandForFeet(visFt) {
  if (!Number.isFinite(visFt)) return null;
  return VIS_BANDS.find((b) => visFt >= b.minFt) || VIS_BANDS[VIS_BANDS.length - 1];
}

function visBandForMeters(visM) {
  return Number.isFinite(visM) ? visBandForFeet(visM * FT_PER_M) : null;
}

/** User-facing clarity label (and visibility.rating) for meters of vis. */
function clarityForMeters(visM) {
  const band = visBandForMeters(visM);
  return band ? band.clarity : null;
}

/**
 * Hard composite-score ceiling for a visibility in meters (role 2).
 * Unknown visibility → UNKNOWN_VIS_MAX_SCORE.
 */
function visibilityScoreCap(visM) {
  const band = visBandForMeters(visM);
  return band ? band.maxScore : UNKNOWN_VIS_MAX_SCORE;
}

function ratingFromScore(score) {
  for (const t of RATING_THRESHOLDS) {
    if (score >= t.min) return t.rating;
  }
  return 'No-Go';
}

module.exports = {
  FT_PER_M,
  VIS_BANDS,
  RATING_THRESHOLDS,
  UNKNOWN_VIS_MAX_SCORE,
  VIS_INPUT_PENALTY_ANCHORS,
  visBandForFeet,
  visBandForMeters,
  clarityForMeters,
  visibilityScoreCap,
  visibilityInputPenalty,
  ratingFromScore,
};
