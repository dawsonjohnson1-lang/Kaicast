// Thin client for the deployed `getReport` Firebase Function. The
// desktop preview talks to the same us-central1 endpoint the mobile
// app uses; no Firebase Web SDK is required since `getReport` is an
// unauthenticated onRequest HTTP function returning JSON.
//
// The hook below caches in-memory per spotId so re-navigating between
// spots doesn't re-fetch immediately. Reports refresh every 5 min on
// remount; the backend itself only regenerates hourly.

import { useEffect, useState } from 'react';

const ENDPOINT = 'https://us-central1-kaicast-207dc.cloudfunctions.net/getReport';

export type BackendRating = {
  rating?: string;
  label?: string;
  score?: number;
  reason?: string;
  cautionNote?: string;
};

export type BackendWindow = {
  startIso: string;
  endIso?: string;
  avg?: {
    windSpeedKts?: number | null;
    windGustKts?: number | null;
    waveHeightM?: number | null;
    wavePeriodS?: number | null;
    waterTempC?: number | null;
  };
  rating?: BackendRating;
  visibility?: { estimatedVisibilityMeters?: number | null };
};

export type BackendDay = {
  date: string;
  waveMinM?: number | null;
  waveMaxM?: number | null;
  waveAvgM?: number | null;
  wavePeriodS?: number | null;
  windAvgKts?: number | null;
  windMaxKts?: number | null;
  rainTotalMM?: number | null;
};

export type BackendReport = {
  spotId: string;
  generatedAt: string;
  confidence?: number | null;
  sources?: string[];
  qcFlags?: string[];
  now: {
    metrics: Record<string, number | null>;
    visibility?: {
      estimatedVisibilityMeters?: number | null;
      kd490?: number | null;
      chlorophyll?: number | null;
    };
    rating: BackendRating;
    runoff?: { severity?: string; safeToEnter?: boolean; healthRisk?: string };
    tide?: Record<string, unknown>;
    analysis?: Record<string, unknown>;
  };
  windows: BackendWindow[];
  days?: BackendDay[];
  tide?: Record<string, unknown>;
};

const inflight = new Map<string, Promise<BackendReport>>();
const cache = new Map<string, { at: number; data: BackendReport }>();
const CACHE_MS = 5 * 60 * 1000;

async function fetchReport(spotId: string): Promise<BackendReport> {
  const cached = cache.get(spotId);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  const existing = inflight.get(spotId);
  if (existing) return existing;
  const p = (async () => {
    const url = `${ENDPOINT}?spotId=${encodeURIComponent(spotId)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`getReport ${res.status}`);
    const json = (await res.json()) as BackendReport;
    cache.set(spotId, { at: Date.now(), data: json });
    inflight.delete(spotId);
    return json;
  })();
  inflight.set(spotId, p);
  return p;
}

export type SpotReportState = {
  data: BackendReport | null;
  loading: boolean;
  error: string | null;
};

export function useSpotReport(spotId: string | undefined): SpotReportState {
  const [state, setState] = useState<SpotReportState>({
    data: spotId ? cache.get(spotId)?.data ?? null : null,
    loading: !!spotId,
    error: null,
  });

  useEffect(() => {
    if (!spotId) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchReport(spotId)
      .then((data) => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch((err: Error) => { if (!cancelled) setState({ data: null, loading: false, error: err.message }); });
    return () => { cancelled = true; };
  }, [spotId]);

  return state;
}

// ─── derivers ─────────────────────────────────────────────────────────────

const TIER_FROM_SCORE = (score: number | undefined | null): 'excellent' | 'great' | 'good' | 'fair' | 'no-go' => {
  if (score == null) return 'good';
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'great';
  if (score >= 40) return 'good';
  if (score >= 20) return 'fair';
  return 'no-go';
};

export function tierFromRating(r: BackendRating | undefined): 'excellent' | 'great' | 'good' | 'fair' | 'no-go' {
  const label = (r?.label ?? r?.rating ?? '').toLowerCase();
  if (label.includes('excellent')) return 'excellent';
  if (label.includes('great'))     return 'great';
  if (label.includes('good'))      return 'good';
  if (label.includes('fair'))      return 'fair';
  if (label.includes('no-go') || label.includes('nogo')) return 'no-go';
  return TIER_FROM_SCORE(r?.score);
}

const HOUR_LABEL = (h: number): string => {
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
};

/**
 * Best window for the next 24h — the highest-scoring 3-hour window.
 * Returns a human-readable string like "9am – 12pm".
 */
export function bestWindowLabel(windows: BackendWindow[] | undefined): string | null {
  if (!Array.isArray(windows) || windows.length === 0) return null;
  let best: BackendWindow | null = null;
  for (const w of windows) {
    if (!best || (w.rating?.score ?? -1) > (best.rating?.score ?? -1)) best = w;
  }
  if (!best?.startIso) return null;
  const startMs = Date.parse(best.startIso);
  if (!Number.isFinite(startMs)) return null;
  const startHour = new Date(startMs).getHours();
  const endHour = (startHour + 3) % 24;
  return `${HOUR_LABEL(startHour)} – ${HOUR_LABEL(endHour)}`;
}

const M_TO_FT = 3.28084;

const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Aggregate score from a daily forecast row. Mirrors the mobile app's
 * `aggregateDayScore`: continuous penalties on wind, swell, rain so
 * neighboring days don't all clip to the same tier.
 */
export function aggregateDayScore(day: BackendDay): number {
  const swellM = day.waveAvgM ?? 1;
  const wind = day.windAvgKts ?? 10;
  const rain = day.rainTotalMM ?? 0;
  let score = 78;
  score -= Math.max(0, swellM - 1) * 12;
  score -= Math.max(0, wind - 8) * 2;
  score -= Math.min(30, rain * 1.2);
  if (wind < 10 && swellM < 1.2 && rain < 1) score += 6;
  return clampScore(score);
}

/**
 * 8 × 3h bar tiers for a single day's segment row in the strip. The
 * day's base score is modulated by time-of-day (sun + trade-wind
 * pattern) so each bar visibly varies rather than rendering as a
 * solid color. Mirrors the mobile RatingBar layout.
 */
export function dayBars(day: BackendDay): Array<'excellent' | 'great' | 'good' | 'fair' | 'no-go'> {
  const score = aggregateDayScore(day);
  const amScore = clampScore(score + 8);
  const midScore = clampScore(score + 2);
  const pmScore = clampScore(score - 8);
  const segs = [
    score - 30, // 00-03 night
    score - 25, // 03-06 pre-dawn
    amScore, // 06-09 morning
    amScore + 2, // 09-12 peak
    midScore, // 12-15 midday
    pmScore + 4, // 15-18 late afternoon
    pmScore, // 18-21 evening
    score - 30, // 21-24 night
  ].map(clampScore);
  return segs.map(TIER_FROM_SCORE);
}

/**
 * Desktop ForecastDay shape (waveLo/Hi in ft, vis string, 8 bars).
 * Derives label / date in the spot's local-ish frame; we assume Hawaii
 * for now since every canonical spot is in Hawaii.
 */
export type DesktopForecastDay = {
  label: string;
  date: string;
  rating: 'excellent' | 'great' | 'good' | 'fair' | 'no-go';
  waveLo: number;
  waveHi: number;
  vis: string;
  bars: Array<'excellent' | 'great' | 'good' | 'fair' | 'no-go'>;
};

export function backendDayToDesktopDay(day: BackendDay): DesktopForecastDay {
  // `date` from backend is `YYYY-MM-DD`; treat as local midday so the
  // weekday formatter doesn't slip a day from UTC offset issues.
  const d = day.date ? new Date(day.date + 'T12:00:00') : new Date();
  const label = d.toLocaleDateString(undefined, { weekday: 'short' });
  const dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const lo = Math.max(0, Math.round((day.waveMinM ?? 0) * M_TO_FT));
  const hi = Math.max(lo, Math.round((day.waveMaxM ?? day.waveAvgM ?? 0) * M_TO_FT));
  // Visibility estimate (mirrors mobile heuristic): clean swell + low
  // rain → high vis; choppy + rainy → low vis. Result is a "lo–hiFT" string.
  const swellAvgM = day.waveAvgM ?? 1;
  const rain = day.rainTotalMM ?? 0;
  const base = Math.max(8, Math.min(80, Math.round(60 - swellAvgM * 10 - rain * 0.8)));
  const visLo = Math.max(5, base - 10);
  const visHi = Math.min(80, base + 10);
  const score = aggregateDayScore(day);
  return {
    label,
    date: dateLabel,
    rating: TIER_FROM_SCORE(score),
    waveLo: lo,
    waveHi: hi,
    vis: `${visLo}–${visHi}FT`,
    bars: dayBars(day),
  };
}

/**
 * Bulk-fetch ratings for many spotIds at once. Useful for the spots-map
 * sidebar and dashboard favorites: each row needs its current rating
 * tier (excellent/great/good/fair/no-go) but we don't want one fetch
 * per row firing serially. Each lookup hits the per-spot cache so
 * navigating around doesn't re-fetch.
 */
export function useSpotRatings(spotIds: string[]): Map<string, 'excellent' | 'great' | 'good' | 'fair' | 'no-go'> {
  const key = spotIds.slice().sort().join('|');
  const [ratings, setRatings] = useState<Map<string, 'excellent' | 'great' | 'good' | 'fair' | 'no-go'>>(new Map());

  useEffect(() => {
    if (spotIds.length === 0) return;
    let cancelled = false;
    Promise.allSettled(spotIds.map((id) => fetchReport(id))).then((results) => {
      if (cancelled) return;
      const next = new Map<string, 'excellent' | 'great' | 'good' | 'fair' | 'no-go'>();
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          next.set(spotIds[i], tierFromRating(r.value.now?.rating));
        }
      });
      setRatings(next);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return ratings;
}

export function relativeTime(ms: number): string {
  const delta = Date.now() - ms;
  if (delta < 0 || delta < 60_000) return 'just now';
  const mins = Math.floor(delta / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ms).toLocaleDateString();
}
