// Mock/demo data + the canonical spots fallback for useSpots().
//
// The spot list itself now lives in src/data/spots.ts so it stays in
// sync with desktop/data/spots.ts and functions/index.js's SPOTS array.
// This module re-exports a few view-specific selections plus the dive-
// report / condition-alert mocks the home screen still uses in demo
// mode.

import type { ConditionAlert, DiveReport, Spot, SpotReport, TidePoint } from '@/types';
import { SPOTS, SPOTS_BY_ID } from '@/data/spots';

const findOrFallback = (id: string): Spot => {
  const s = SPOTS_BY_ID.get(id);
  if (s) return s;
  // Defensive — should be impossible since we control the canonical list.
  // eslint-disable-next-line no-console
  console.warn(`[mockData] missing canonical spot "${id}", falling back to first spot`);
  return SPOTS[0];
};

// Featured spot = Electric Beach, with extra live-style fields for the
// home hero card. Coordinates come from the canonical list.
export const featuredSpot: Spot & {
  airTempF?: number;
  windMph?: number;
  current?: string;
  progress?: number;
} = {
  ...findOrFallback('electric-beach'),
  region: 'Oahu · 4.2 mi away',
  visibilityFt: 56,
  rating: 'excellent',
  airTempF: 79,
  windMph: 1,
  current: 'STRONG',
  progress: 0.7,
};

// The 4 default favorites shown on the home screen. These are the spots
// that already had hand-written descriptions / marine-life lists in the
// original mockData — keeping that rich data while pulling canonical
// coords from src/data/spots.ts.
export const favoriteSpots: Spot[] = [
  { ...findOrFallback('electric-beach'),  visibilityFt: 56, rating: 'excellent' },
  { ...findOrFallback('sharks-cove'),     visibilityFt: 48, rating: 'good' },
  { ...findOrFallback('molokini-crater'), visibilityFt: 80, rating: 'excellent' },
  { ...findOrFallback('three-tables'),    visibilityFt: 42, rating: 'good' },
];

// Explore-screen list. Used as the offline/demo fallback in useSpots().
// We hand back the full canonical 37 spots so the explore screen — and
// any other code path that hits the fallback — sees the same set the
// desktop and backend already use.
export const exploreSpots: Spot[] = SPOTS;

export const conditionAlerts: ConditionAlert[] = [
  { id: 'a1', spotName: 'Molokini Crater', message: 'Visibility improved to 80 ft — best in 2 weeks', severity: 'info' },
  { id: 'a2', spotName: 'Kealakekua Bay', message: 'Swell dropping tomorrow morning, excellent window 8–10am', severity: 'warn' },
  { id: 'a3', spotName: 'Turtle Canyon', message: 'Runoff warning, high rain fall and reported sewage overflow', severity: 'hazard' },
];

export const diveReports: DiveReport[] = [
  {
    id: 'r1',
    authorInitials: 'KM',
    authorName: 'Kai M.',
    spotName: 'Electric Beach',
    postedAgo: '2h ago',
    diveType: 'freedive',
    depthFt: 66,
    current: 'STRONG',
    surface: 'SAFE',
    visibility: 'CLEAN',
    comment: 'Crystal clear today! Saw a turtle at 40ft. Visibility was insane, probably 60+ ft.',
    likes: 12,
    replies: 3,
  },
  {
    id: 'r2',
    authorInitials: 'KM',
    authorName: 'Kai M.',
    spotName: 'Electric Beach',
    postedAgo: '2h ago',
    diveType: 'scuba',
    depthFt: 66,
    current: 'STRONG',
    surface: 'SAFE',
    visibility: 'CLEAN',
    comment: 'Crystal clear today! Saw a turtle at 40ft. Visibility was insane, probably 60+ ft.',
    likes: 12,
    replies: 3,
  },
];

const tideSeries: TidePoint[] = [
  { hourLabel: '12a', heightFt: 0.4 },
  { hourLabel: '3a', heightFt: 0.9 },
  { hourLabel: '6a', heightFt: 1.4 },
  { hourLabel: 'NOW', heightFt: 1.1 },
  { hourLabel: '9a', heightFt: 0.7 },
  { hourLabel: 'noon', heightFt: 0.3 },
];

export const electricBeachReport: SpotReport = {
  spot: featuredSpot,
  rating: 'excellent',
  ratingLabel: 'EXCELLENT',
  isLive: true,
  bestWindow: 'BEST CONDITIONS TODAY',
  hazardSummary: 'No major hazards detected',
  forecast: [
    { label: 'WED', date: '15', rating: 'excellent' },
    { label: 'THU', date: '16', rating: 'good' },
    { label: 'FRI', date: '17', rating: 'good' },
    { label: 'SAT', date: '18', rating: 'fair' },
  ],
  visibilityFt: 56,
  swellHeightFt: 3,
  waterTempF: 79,
  airTempF: 79,
  windMph: 15,
  windDeg: 120,
  gustMph: 20,
  currentMph: 1,
  currentDeg: 45,
  uvIndex: 8,
  tide: { trend: 'rising', nowFt: 1.1, nextFt: 1.5, nextLabel: 'High in 2h', series: tideSeries },
  moon: { phase: 'WANING CRESCENT', illumination: 1, daysSinceFullMoon: 14 },
};
