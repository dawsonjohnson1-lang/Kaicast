export const RATING_COLORS = {
  excellent: '#09A1FB',
  great:     '#27D667',
  good:      '#FFD321',
  fair:      '#FF9D25',
  'no-go':   '#F73726',
} as const;

export type RatingTier = keyof typeof RATING_COLORS;

export const RATING_TIERS: readonly RatingTier[] = [
  'no-go',
  'fair',
  'good',
  'great',
  'excellent',
];

export const RATING_LABELS: Record<RatingTier, string> = {
  excellent: 'EXCELLENT',
  great:     'GREAT',
  good:      'GOOD',
  fair:      'FAIR',
  'no-go':   'NO-GO',
};

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const rgba = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
};

export const RATING_SOFT: Record<RatingTier, string> = {
  excellent: rgba(RATING_COLORS.excellent, 0.14),
  great:     rgba(RATING_COLORS.great,     0.14),
  good:      rgba(RATING_COLORS.good,      0.14),
  fair:      rgba(RATING_COLORS.fair,      0.14),
  'no-go':   rgba(RATING_COLORS['no-go'],  0.14),
};

export const RATING_RING: Record<RatingTier, string> = {
  excellent: rgba(RATING_COLORS.excellent, 0.5),
  great:     rgba(RATING_COLORS.great,     0.5),
  good:      rgba(RATING_COLORS.good,      0.5),
  fair:      rgba(RATING_COLORS.fair,      0.5),
  'no-go':   rgba(RATING_COLORS['no-go'],  0.5),
};

export const RATING_FILL_RGBA: Record<RatingTier, string> = {
  excellent: rgba(RATING_COLORS.excellent, 0.08),
  great:     rgba(RATING_COLORS.great,     0.08),
  good:      rgba(RATING_COLORS.good,      0.08),
  fair:      rgba(RATING_COLORS.fair,      0.08),
  'no-go':   rgba(RATING_COLORS['no-go'],  0.08),
};

export const RATING_RING_RGBA: Record<RatingTier, string> = {
  excellent: rgba(RATING_COLORS.excellent, 0.20),
  great:     rgba(RATING_COLORS.great,     0.20),
  good:      rgba(RATING_COLORS.good,      0.20),
  fair:      rgba(RATING_COLORS.fair,      0.20),
  'no-go':   rgba(RATING_COLORS['no-go'],  0.20),
};
