export const colors = {
  // Backgrounds
  bg: '#08090c',
  bgElevated: '#0e1118',
  card: '#10141d',
  cardAlt: '#0e1219',
  border: '#1a2333',
  divider: '#1f2937',

  // Text
  textPrimary: '#ffffff',
  textSecondary: '#9aa4b2',
  textMuted: '#5f6b7a',
  textDim: '#3f4a5a',

  // Brand / accent
  accent: '#1ab8ff',
  accentDeep: '#0a8fd8',
  accentSoft: 'rgba(26,184,255,0.14)',

  // Status
  excellent: '#1fd17a',
  excellentSoft: 'rgba(31,209,122,0.14)',
  good: '#f5b041',
  goodSoft: 'rgba(245,176,65,0.16)',
  warn: '#f5b041',
  warnSoft: 'rgba(245,176,65,0.18)',
  hazard: '#d96338',
  hazardSoft: 'rgba(217,99,56,0.16)',

  // Tags
  scuba: '#7c3aed',
  scubaSoft: 'rgba(124,58,237,0.18)',
  freedive: '#1ab8ff',
  freediveSoft: 'rgba(26,184,255,0.18)',
  spear: '#22d3ee',
  spearSoft: 'rgba(34,211,238,0.18)',
  snorkel: '#34d399',
  snorkelSoft: 'rgba(52,211,153,0.18)',

  // UV ramp
  uv: ['#1ab8ff', '#16c47f', '#facc15', '#fb923c', '#ef5350'],

  // Misc
  overlayDark: 'rgba(0,0,0,0.55)',
  overlayBlue: 'rgba(10,30,60,0.5)',
} as const;

export type ColorKey = keyof typeof colors;
