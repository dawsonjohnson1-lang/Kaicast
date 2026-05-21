/**
 * KaiCast desktop — shared design tokens.
 *
 * Source of truth for colors, type, radii, and layout constants used
 * across all six desktop screens. Hex values are confirmed against the
 * Figma file (HP9NdhBiH8r5W8JCHBvwn0). The 5-tier condition spectrum
 * matches the mobile app's RATING_COLORS (theme/ratingColors.ts) — keep
 * them in sync if either side moves.
 */

export const colors = {
  // Surfaces (darkest → lightest)
  bg:               '#0C1015',
  surface0:         '#111518',
  surface1:         '#181D22',
  surface2:         '#1E252C',

  // Dividers / strokes
  hairline:         'rgba(255,255,255,0.06)',
  hairlineStrong:   'rgba(255,255,255,0.11)',

  // Text scale (highest → lowest emphasis)
  text1:            '#F8F8F8',
  text2:            'rgba(248,248,248,0.70)',
  text3:            'rgba(248,248,248,0.44)',
  text4:            'rgba(248,248,248,0.26)',

  // Accent (kaicast blue — also the EXCELLENT condition tier)
  accent:           '#09A1FB',
  accentDim:        'rgba(9,161,251,0.18)',

  // Condition spectrum (5 tiers, perceptual ramp blue→green→yellow→orange→red)
  excellent:        '#09A1FB',
  great:            '#27D667',
  good:             '#FFD321',
  fair:             '#FF9D25',
  nogo:             '#F73726',
} as const;

export const fonts = {
  display: 'DM Sans',
  body:    'Inter',
  mono:    'JetBrains Mono',
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// Desktop layout width — all screens center inside this max.
export const DESKTOP_MAX_WIDTH = 1440;

// Top nav (DesktopNav.tsx) height + util bar above it.
export const NAV_HEIGHT = 64;
export const UTIL_BAR_HEIGHT = 36;

// Condition tier type used across screens. Keep lowercase canonical
// names — no synonyms ("perfect"/"poor"/etc).
export type ConditionTier = 'no-go' | 'fair' | 'good' | 'great' | 'excellent';

export const TIER_LABELS: Record<ConditionTier, string> = {
  excellent: 'EXCELLENT',
  great:     'GREAT',
  good:      'GOOD',
  fair:      'FAIR',
  'no-go':   'NO-GO',
};

export const TIER_COLORS: Record<ConditionTier, string> = {
  excellent: colors.excellent,
  great:     colors.great,
  good:      colors.good,
  fair:      colors.fair,
  'no-go':   colors.nogo,
};

// Score → tier mapping (mirrors mobile app's scoreToTier util).
// Use this when rendering from a 0–100 score rather than a known tier.
export function scoreToTier(score: number): ConditionTier {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'great';
  if (score >= 40) return 'good';
  if (score >= 20) return 'fair';
  return 'no-go';
}
