import type { ImageSourcePropType } from 'react-native';
import type { RatingTier } from '@/theme/ratingColors';

export type DiveType = 'scuba' | 'freedive' | 'spear' | 'snorkel';

export type ConditionRating = RatingTier;

export type Spot = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  visibilityFt?: number;
  rating?: ConditionRating;
  imageUrl?: string;
  imageSource?: ImageSourcePropType;
  coverColor?: string;
  description?: string;
  entryExit?: string;
  marineLife?: readonly string[];
};

export type ConditionAlert = {
  id: string;
  spotName: string;
  message: string;
  severity: 'info' | 'warn' | 'hazard';
};

export type DiveReport = {
  id: string;
  authorInitials: string;
  authorName: string;
  spotName: string;
  postedAgo: string;
  diveType: DiveType;
  certBadge?: string;
  depthFt: number;
  current: 'STRONG' | 'MODERATE' | 'LIGHT' | 'NONE';
  surface: 'SAFE' | 'CHOPPY' | 'ROUGH';
  visibility: 'CLEAN' | 'MURKY' | 'GREEN';
  comment: string;
  likes: number;
  replies: number;
};

export type SpotForecastDay = {
  label: string;
  date: string;
  rating: ConditionRating;
};

export type TidePoint = {
  hourLabel: string;
  heightFt: number;
};

export type SpotReport = {
  spot: Spot;
  rating: ConditionRating;
  ratingLabel: string;
  isLive: boolean;
  bestWindow: string;
  hazardSummary: string;
  forecast: SpotForecastDay[];
  visibilityFt: number;
  swellHeightFt: number;
  waterTempF: number;
  airTempF: number;
  windMph: number;
  /** Bearing the wind is blowing FROM, 0-359° (compass) — null when unknown. */
  windDeg: number | null;
  gustMph: number;
  currentMph: number;
  /** Bearing the surface current is flowing TOWARD, 0-359° — null when unknown. */
  currentDeg: number | null;
  uvIndex: number;
  tide: { trend: 'rising' | 'falling'; nowFt: number; nextFt: number; nextLabel: string; series: TidePoint[] };
  moon: { phase: string; illumination: number; daysSinceFullMoon: number };
};
