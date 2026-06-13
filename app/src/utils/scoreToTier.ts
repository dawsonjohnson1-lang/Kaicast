import type { RatingTier } from '@/theme/ratingColors';

export function scoreToTier(score: number): RatingTier {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'great';
  if (score >= 40) return 'good';
  if (score >= 20) return 'fair';
  return 'no-go';
}

// ─── Visibility bands ───────────────────────────────────────────────
// MUST mirror functions/abyss/ratingConfig.js VIS_BANDS and
// desktop/data/getReport.ts VIS_BANDS. Visibility plays two roles: a
// dominant INPUT to the composite (handled server-side) and a hard
// score CEILING. The live windows arrive already capped from the
// backend; this mirror exists for the future-day AGGREGATE scorer,
// whose only clarity signal is an estimate.
export const VIS_BANDS: ReadonlyArray<{ minFt: number; clarity: string; maxScore: number }> = [
  { minFt: 50, clarity: 'Excellent', maxScore: 100 },
  { minFt: 35, clarity: 'Great',     maxScore: 79 },
  { minFt: 20, clarity: 'Good',      maxScore: 59 },
  { minFt: 10, clarity: 'Fair',      maxScore: 39 },
  { minFt: 0,  clarity: 'Poor',      maxScore: 19 },
];

/** Hard composite-score ceiling for a visibility in feet. Unknown → 79. */
export function visibilityScoreCapFt(visFt: number | null | undefined): number {
  if (visFt == null || !Number.isFinite(visFt)) return 79;
  const b = VIS_BANDS.find((band) => visFt >= band.minFt) ?? VIS_BANDS[VIS_BANDS.length - 1];
  return b.maxScore;
}
