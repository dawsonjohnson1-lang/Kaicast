// Mock data for the Forecast tab on Spot Detail. The shape mirrors what
// the real Firebase conditions endpoint should return per spot — when the
// backend is ready, drop a network fetch in `useForecast` and wire it to
// this same shape so consumers (cards) don't need to change.

import type { ConditionRating } from '@/types';

export type ForecastRating = 'excellent' | 'good' | 'caution' | 'poor';

export type HourlyPoint = {
  hourLabel: string;        // '3am' | 'Noon' | '6pm' …
  hour24: number;           // 0–23
  visibilityFt: number;
  windMph: number;
  windGustMph: number;
  windDeg: number;
  currentMph: number;
  currentDeg: number;
  tideFt: number;
  nearshoreEnergyKj: number;
  offshoreEnergyKj: number;
  consistency: number;      // 0–100
  weatherIcon: '☀️' | '⛅' | '🌥️' | '🌧️' | '🌙';
  airTempF: number;
  score: number;            // 0–100, drives the rating bar
};

export type TideEvent = {
  type: 'high' | 'low';
  timeLabel: string;        // '8:41am'
  hour24: number;
  heightFt: number;
};

export type ForecastDay = {
  id: string;
  label: string;            // 'Thu'
  date: string;             // '4/16'
  iso: string;              // '2026-04-16'
  swellRangeFt: string;     // '2-3ft+'
  rating: ForecastRating;
  amRating: ForecastRating;
  midRating: ForecastRating;
  pmRating: ForecastRating;
  isToday: boolean;
  hourly: HourlyPoint[];    // 24 points
  tideEvents: TideEvent[];  // 4–5
  tideTrend: 'rising' | 'falling';
  // Headline metrics (the "now" snapshot for this day at default scrubber position)
  ratingLabel: string;      // 'EXCELLENT'
  // Pre-computed for the rating bar — buckets cover 24h.
  ratingSegments: { startHour: number; endHour: number; color: string }[];
};

const COLOR = {
  excellent: '#22c55e',
  good: '#22c55e',
  caution: '#efb93f',
  poor: '#ef5a3f',
} as const;

const RATING_LABEL: Record<ForecastRating, string> = {
  excellent: 'EXCELLENT',
  good: 'GOOD',
  caution: 'CAUTION',
  poor: 'POOR',
};

const HOUR_LABELS = [
  '12a', '1a', '2a', '3a', '4a', '5a', '6a', '7a', '8a', '9a', '10a', '11a',
  '12p', '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '10p', '11p',
];

const SHORT_HOUR_LABELS = [
  '12a', '', '', '3a', '', '', '6a', '', '', '9a', '', '',
  'Noon', '', '', '3p', '', '', '6p', '', '', '9p', '', '',
];

// Sinusoidal helpers so generated hourly data looks plausibly diurnal.
const sine = (hour: number, peakHour: number, amp: number, base: number) =>
  base + amp * Math.cos(((hour - peakHour) / 24) * Math.PI * 2);

const ICONS: HourlyPoint['weatherIcon'][] = ['🌙', '🌙', '🌙', '🌙', '🌙', '🌥️', '🌥️', '⛅', '⛅', '☀️', '☀️', '☀️', '☀️', '☀️', '☀️', '☀️', '⛅', '⛅', '⛅', '🌥️', '🌥️', '🌙', '🌙', '🌙'];

function buildHourly(seed: number, base: { vis: number; wind: number; current: number; tide: number; energy: number }): HourlyPoint[] {
  const out: HourlyPoint[] = [];
  for (let h = 0; h < 24; h += 1) {
    const visibilityFt = Math.round(sine(h, 14, 12, base.vis));
    const windMph = Math.max(0, Math.round(sine(h, 16, 6, base.wind)));
    const windGustMph = windMph + Math.round(2 + Math.sin(h + seed) * 2);
    const currentMph = Math.max(0, Math.round(sine(h, 13, 1.5, base.current) * 10) / 10);
    const tideFt = Math.round((sine(h, 9, 1.4, base.tide) + Math.sin(h * 0.5 + seed) * 0.3) * 10) / 10;
    const nearshoreEnergyKj = Math.max(0, Math.round(sine(h, 15, 60, base.energy)));
    const offshoreEnergyKj = Math.max(0, Math.round(sine(h, 15, 80, base.energy + 90)));
    const consistency = Math.round(sine(h, 13, 30, 50));
    const score = Math.max(0, Math.min(100, Math.round(sine(h, 11, 30, 60))));
    out.push({
      hourLabel: HOUR_LABELS[h],
      hour24: h,
      visibilityFt,
      windMph,
      windGustMph,
      windDeg: 90 + Math.round(Math.sin(h + seed) * 30),
      currentMph,
      currentDeg: 200 + Math.round(Math.sin(h + seed * 2) * 40),
      tideFt,
      nearshoreEnergyKj,
      offshoreEnergyKj,
      consistency,
      weatherIcon: ICONS[h],
      airTempF: Math.round(sine(h, 14, 6, 73)),
      score,
    });
  }
  return out;
}

function buildTideEvents(): TideEvent[] {
  return [
    { type: 'low',  timeLabel: '2:36am', hour24: 2,  heightFt: -0.3 },
    { type: 'high', timeLabel: '8:41am', hour24: 8,  heightFt: 1.7 },
    { type: 'low',  timeLabel: '3:23pm', hour24: 15, heightFt: -0.1 },
    { type: 'high', timeLabel: '9:37pm', hour24: 21, heightFt: 1.9 },
  ];
}

function buildSegments(hourly: HourlyPoint[]): { startHour: number; endHour: number; color: string }[] {
  const segs: { startHour: number; endHour: number; color: string }[] = [];
  const colorFor = (s: number) => (s >= 70 ? COLOR.excellent : s >= 50 ? COLOR.caution : COLOR.poor);
  let segStart = 0;
  let segColor = colorFor(hourly[0].score);
  for (let h = 1; h < 24; h += 1) {
    const c = colorFor(hourly[h].score);
    if (c !== segColor) {
      segs.push({ startHour: segStart, endHour: h, color: segColor });
      segStart = h;
      segColor = c;
    }
  }
  segs.push({ startHour: segStart, endHour: 24, color: segColor });
  return segs;
}

export function buildMockForecast(): ForecastDay[] {
  const base = new Date();
  const days: ForecastDay[] = [];
  for (let i = 0; i < 10; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const ratings: ForecastRating[] = ['excellent', 'good', 'caution', 'poor'];
    const rating: ForecastRating = i === 0 ? 'excellent' : ratings[(i + 1) % 4];
    const hourly = buildHourly(i, {
      vis: 28 + (i % 3) * 4,
      wind: 12 - (i % 4),
      current: 2,
      tide: 1.0,
      energy: 110 + i * 8,
    });
    const swellMin = 2 + (i % 3);
    const swellMax = swellMin + 1;
    days.push({
      id: `day-${i}`,
      label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()],
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      iso: d.toISOString().slice(0, 10),
      swellRangeFt: `${swellMin}-${swellMax}ft+`,
      rating,
      amRating: i % 2 === 0 ? 'good' : 'caution',
      midRating: rating,
      pmRating: i % 3 === 0 ? 'caution' : 'good',
      isToday: i === 0,
      hourly,
      tideEvents: buildTideEvents(),
      tideTrend: i % 2 === 0 ? 'rising' : 'falling',
      ratingLabel: RATING_LABEL[rating],
      ratingSegments: buildSegments(hourly),
    });
  }
  return days;
}

export function defaultHourFor(day: ForecastDay): number {
  if (day.isToday) {
    const h = new Date().getHours();
    return Math.max(0, Math.min(23, h));
  }
  return 12;
}

export function formatHourLabel(hour: number): string {
  const period = hour < 12 ? 'am' : 'pm';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00${period}`;
}

export const SHORT_AXIS_LABELS = SHORT_HOUR_LABELS;

// Map our internal forecast rating to the project's ConditionRating type
// so existing callers / Tag variants still work.
export function toConditionRating(r: ForecastRating): ConditionRating {
  if (r === 'excellent') return 'excellent';
  if (r === 'good') return 'good';
  if (r === 'caution') return 'caution';
  return 'hazard';
}

export const FORECAST_COLOR = COLOR;
