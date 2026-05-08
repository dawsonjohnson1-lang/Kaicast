import type { RatingTier } from '@/theme/ratingColors';

export function scoreToTier(score: number): RatingTier {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'great';
  if (score >= 40) return 'good';
  if (score >= 20) return 'fair';
  return 'no-go';
}
