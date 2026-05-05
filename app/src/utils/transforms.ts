// Pure helpers for converting backend metrics into UI-ready strings.
// Keep these dependency-free so they're easy to test and reuse from any screen.

import type { ConditionRating } from '@/types';

export const ktsToMph = (kts: number) => Math.round(kts * 1.15078 * 10) / 10;
export const mToFt = (m: number) => Math.round(m * 3.28084 * 10) / 10;
export const cToF = (c: number) => Math.round((c * 9 / 5 + 32) * 10) / 10;

export const round0 = (n: number) => Math.round(n);

export const safe = <T,>(v: T | null | undefined, fallback: T): T =>
  v == null ? fallback : v;

export const windDegToDir = (deg: number): string => {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
};

export const cloudToEmoji = (pct: number): string => {
  if (pct <= 20) return '☀️';
  if (pct <= 60) return '⛅';
  return '☁️';
};

// Maps a backend rating string ("Excellent" / "Great" / "Good" / "Fair" / "No-Go")
// into the app's existing ConditionRating union used by Tag/SpotMiniCard.
export const ratingToCondition = (rating?: string | null): ConditionRating => {
  switch ((rating ?? '').toLowerCase()) {
    case 'excellent':
    case 'great':
      return 'excellent';
    case 'good':
      return 'good';
    case 'fair':
    case 'caution':
      return 'caution';
    case 'no-go':
    case 'hazard':
    case 'unsafe':
      return 'hazard';
    default:
      return 'good';
  }
};

export const ratingColorHex = (rating: string | undefined): string => {
  switch (ratingToCondition(rating)) {
    case 'excellent': return '#22d36b';
    case 'good':      return '#7bd16a';
    case 'caution':   return '#f5b041';
    case 'hazard':    return '#e85a3c';
  }
};

export const runoffToWaterQuality = (severity?: string | null): string => {
  const map: Record<string, string> = {
    none: 'CLEAN',
    low: 'SLIGHTLY STAINED',
    moderate: 'MURKY',
    high: 'BROWN',
    extreme: 'UNSAFE',
  };
  return map[severity ?? 'none'] ?? 'UNKNOWN';
};

export const tideStateLabel = (state?: string | null, heightFt?: number | null): string => {
  if (!state) return '–';
  const cap = state.charAt(0).toUpperCase() + state.slice(1);
  if (heightFt == null) return cap;
  return `${cap} · ${heightFt.toFixed(1)} ft`;
};

// CURRENT label estimated from wind speed (the pipeline's
// estimateCurrentFromWind helper uses ~ wind * 0.04).
export const currentLabel = (windKts?: number | null): 'STRONG' | 'MODERATE' | 'LIGHT' => {
  const est = (windKts ?? 0) * 0.04;
  if (est > 2) return 'STRONG';
  if (est > 1) return 'MODERATE';
  return 'LIGHT';
};

export const surfaceFromWind = (windKts?: number | null): 'GLASS' | 'CHOPPY' | 'ROUGH' => {
  if (windKts == null) return 'CHOPPY';
  if (windKts < 8) return 'GLASS';
  if (windKts < 18) return 'CHOPPY';
  return 'ROUGH';
};

export const cloudCoverLabel = (pct?: number | null): string => {
  if (pct == null) return 'Unknown';
  if (pct <= 20) return 'Clear';
  if (pct <= 60) return 'Partly cloudy';
  return 'Overcast';
};

export const relativeTime = (isoString?: string | null): string => {
  if (!isoString) return '';
  const ms = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export const haversineMiles = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
};

// Normalize hour-of-day in spot timezone (best-effort, browser locale fallback).
export const hourLabelLocal = (iso: string, tz?: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      timeZone: tz ?? 'Pacific/Honolulu',
    });
  } catch {
    return new Date(iso).getHours() + ':00';
  }
};
