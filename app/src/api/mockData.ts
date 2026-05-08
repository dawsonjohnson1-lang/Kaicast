import type { ConditionAlert, DiveReport, Spot, SpotReport, TidePoint } from '@/types';

// Spot covers ship as bundled placeholders today. When the backend lands,
// set imageUrl to a remote satellite-tile URL keyed off lat/lon — it takes
// precedence over imageSource at render time.
export const featuredSpot: Spot & { airTempF?: number; windMph?: number; current?: string; progress?: number } = {
  id: 'electric-beach',
  name: 'Electric Beach',
  region: 'Oahu · 4.2 mi away',
  lat: 21.355,
  lon: -158.122,
  visibilityFt: 56,
  rating: 'excellent',
  coverColor: '#0a3a4d',
  imageSource: require('../../assets/spot-electric-beach.png'),
  airTempF: 79,
  windMph: 1,
  current: 'STRONG',
  progress: 0.7,
};

export const favoriteSpots: Spot[] = [
  {
    id: 'electric-beach', name: 'Electric Beach', region: 'Oahu', visibilityFt: 56, rating: 'excellent',
    coverColor: '#0c4a5c', lat: 21.355, lon: -158.122,
    imageSource: require('../../assets/spot-electric-beach.png'),
  },
  {
    id: 'sharks-cove', name: "Shark's Cove", region: 'Oahu', visibilityFt: 48, rating: 'good',
    coverColor: '#0a3a4d', lat: 21.6417, lon: -158.0617,
    imageSource: require('../../assets/spot-sharks-cove.png'),
  },
  {
    id: 'molokini', name: 'Molokini', region: 'Maui', visibilityFt: 80, rating: 'excellent',
    coverColor: '#0a4a3a', lat: 20.633, lon: -156.495,
    imageSource: require('../../assets/spot-molokini.png'),
  },
  {
    id: 'three-tables', name: 'Three Tables', region: 'Oahu', visibilityFt: 42, rating: 'good',
    coverColor: '#0c2a4d', lat: 21.6367, lon: -158.0633,
  },
];

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
  gustMph: 20,
  currentMph: 1,
  uvIndex: 8,
  tide: { trend: 'rising', nowFt: 1.1, nextFt: 1.5, nextLabel: 'High in 2h', series: tideSeries },
  moon: { phase: 'WANING CRESCENT', illumination: 1, daysSinceFullMoon: 14 },
};

export const exploreSpots: Spot[] = [
  ...favoriteSpots,
  { id: 'hanauma', name: 'Hanauma Bay', region: 'Oahu', visibilityFt: 35, rating: 'fair', coverColor: '#3a2a4d', lat: 21.2694, lon: -157.6939 },
  { id: 'makua', name: 'Makua Beach', region: 'Oahu West', visibilityFt: 28, rating: 'fair', coverColor: '#4d2a2a', lat: 21.5274, lon: -158.2295 },
  { id: 'mokuleia', name: 'Mokuleia', region: 'Oahu North', visibilityFt: 22, rating: 'no-go', coverColor: '#4d1a1a', lat: 21.5783, lon: -158.1553 },
];
