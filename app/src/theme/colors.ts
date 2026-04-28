export const colors = {
  // Backgrounds — sampled from Figma HOMEPAGE
  bg: '#000000',
  bgElevated: '#0d141d',
  card: '#11181f',
  cardAlt: '#0c1218',
  border: '#1a232c',
  divider: '#1f2937',

  // Text
  textPrimary: '#ffffff',
  textSecondary: '#9aa4b2',
  textMuted: '#6b7280',
  textDim: '#3f4a5a',

  // Brand / accent
  accent: '#1ab8ff',
  accentDeep: '#0a8fd8',
  accentSoft: 'rgba(26,184,255,0.14)',

  // Status — Figma palette
  excellent: '#22d36b',
  excellentSoft: 'rgba(34,211,107,0.14)',
  good: '#7bd16a',
  goodSoft: 'rgba(123,209,106,0.14)',
  warn: '#f5b041',
  warnSoft: 'rgba(245,176,65,0.14)',
  hazard: '#e85a3c',
  hazardSoft: 'rgba(232,90,60,0.14)',

  // Tags
  scuba: '#a16ad9',
  scubaSoft: 'rgba(161,106,217,0.18)',
  freedive: '#1ab8ff',
  freediveSoft: 'rgba(26,184,255,0.16)',
  spear: '#22d3ee',
  spearSoft: 'rgba(34,211,238,0.18)',
  snorkel: '#34d399',
  snorkelSoft: 'rgba(52,211,153,0.18)',

  // UV ramp
  uv: ['#1ab8ff', '#22d36b', '#facc15', '#fb923c', '#ef5350'],

  // Featured progress bar — green → blue gradient (sampled from HOMEPAGE)
  progressStart: '#22d36b',
  progressEnd: '#1ab8ff',

  // Misc
  overlayDark: 'rgba(0,0,0,0.55)',
  overlayBlue: 'rgba(10,30,60,0.5)',
} as const;

export type ColorKey = keyof typeof colors;
