/**
 * KaiCast desktop — shared design tokens.
 *
 * Source of truth for colors, type, radii, and layout constants used
 * across all six desktop screens. Hex values are confirmed against the
 * Figma file (HP9NdhBiH8r5W8JCHBvwn0). The 5-tier condition spectrum
 * matches the mobile app's RATING_COLORS (theme/ratingColors.ts) — keep
 * them in sync if either side moves.
 */

// All colors resolve to CSS custom properties so the theme can flip
// at runtime via a class on <html>. Definitions live in theme.css —
// dark is :root and :root.theme-dark, light is :root.theme-light.
// Keep tokens.ts and theme.css in sync; tokens.ts is the JS API,
// theme.css is the source of truth for actual color values.
export const colors = {
  // Surfaces (darkest → lightest)
  bg:               'var(--c-bg)',
  surface0:         'var(--c-surface0)',
  surface1:         'var(--c-surface1)',
  surface2:         'var(--c-surface2)',

  // Dividers / strokes
  hairline:         'var(--c-hairline)',
  hairlineStrong:   'var(--c-hairline-strong)',

  // Text scale (highest → lowest emphasis)
  text1:            'var(--c-text1)',
  text2:            'var(--c-text2)',
  text3:            'var(--c-text3)',
  text4:            'var(--c-text4)',

  // Accent (kaicast blue — also the EXCELLENT condition tier)
  accent:           'var(--c-accent)',
  accentDim:        'var(--c-accent-dim)',

  // Condition spectrum (5 tiers, perceptual ramp blue→green→yellow→orange→red)
  excellent:        'var(--c-excellent)',
  great:            'var(--c-great)',
  good:             'var(--c-good)',
  fair:             'var(--c-fair)',
  nogo:             'var(--c-nogo)',

  // Floating overlays (layer control, tooltips). Semi-transparent so
  // the map shows through, themed so it matches the page bg.
  overlay:          'var(--c-overlay)',
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

// Desktop layout width — all screens center inside this max. Set to
// 1920 so a 1080p / 1440p browser fills the viewport instead of
// rendering with empty gutters; ultrawide users still get controlled
// line lengths past this cap.
export const DESKTOP_MAX_WIDTH = 1920;

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

// Raw hex tier colors — for code paths that cannot resolve CSS
// variables (Mapbox GL style expressions, hexToRgba helpers, etc).
// Values match :root.theme-dark in theme.css. The map renders with
// the dark palette regardless of the user's UI theme — intentional,
// the Mapbox basemap itself is dark in both modes.
export const RAW_TIER_HEX: Record<ConditionTier, string> = {
  excellent: '#09A1FB',
  great:     '#27D667',
  good:      '#FFD321',
  fair:      '#FF9D25',
  'no-go':   '#F73726',
};

// Raw hex surface/text values, for the same reason as RAW_TIER_HEX.
// Land matches the app page bg (#0C1015) so the map blends into the
// dark page; water is a touch bluer (deep dark navy) so the ocean
// still reads as ocean and islands remain visible.
export const RAW_COLORS_DARK = {
  bg:       '#0A1622', // deep dark navy — "water" tone
  surface0: '#0C1015', // matches app page bg (--c-bg in dark)
  surface1: '#141C26', // structures (slightly raised from land)
  surface2: '#1B2530',
  text3:    'rgba(248,248,248,0.44)',
  text4:    'rgba(248,248,248,0.26)',
} as const;

// Light-mode equivalents — used to repaint the Mapbox basemap when the
// user flips to the light theme. Land matches the app page bg
// (#F7F6F2) so the map blends with the surrounding UI; water is a
// subdued cool tint so islands still read as land at coarse zoom.
export const RAW_COLORS_LIGHT = {
  bg:       '#E5EEF2', // subtle cool blue — the "water" tone
  surface0: '#F7F6F2', // matches app page bg (--c-bg in light)
  surface1: '#EDEAE2', // structures (slightly recessed from land)
  surface2: '#E2DED5',
  text3:    'rgba(12,16,21,0.55)',
  text4:    'rgba(12,16,21,0.35)',
} as const;

// Score → tier mapping (mirrors mobile app's scoreToTier util).
// Use this when rendering from a 0–100 score rather than a known tier.
export function scoreToTier(score: number): ConditionTier {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'great';
  if (score >= 40) return 'good';
  if (score >= 20) return 'fair';
  return 'no-go';
}
