// Map a live BackendReport into a ForecastDay so the Forecast tab
// renders real data for "today" without changing the cards.
//
// The backend serves ~24h of forecast (8 × 3-hour windows in
// report.windows[]) plus a 48-row hourly OpenWeather feed in
// report.hourly[]. We synthesize 24 HourlyPoints by:
//   1. picking the corresponding window for each hour (windows have
//      pre-aggregated avg metrics + a rating score per window)
//   2. interpolating tide height across the day from the high/low
//      events in report.now.tide
//   3. defaulting derivative metrics (nearshoreEnergy, consistency)
//      that the backend doesn't yet emit — those still come from
//      sensible per-spot defaults.
//
// Days other than today keep coming from the mock generator. When
// the backend grows a multi-day endpoint, swap that in here.

import type { BackendReport, BackendDay } from '@/api/kaicast';
import type { ForecastDay, HourlyPoint, TideEvent, ForecastRating } from '@/api/forecast-mock';
import { RATING_COLORS, RATING_LABELS, type RatingTier } from '@/theme/ratingColors';
import { scoreToTier } from '@/utils/scoreToTier';

const KTS_TO_MPH = 1.15078;
const M_TO_FT = 3.28084;
const HOUR_LABELS = [
  '12a', '1a', '2a', '3a', '4a', '5a', '6a', '7a', '8a', '9a', '10a', '11a',
  '12p', '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '10p', '11p',
];

function cToF(c: number | null | undefined): number {
  if (c == null) return 75;
  return Math.round((c * 9) / 5 + 32);
}

function ktsToMph(kts: number | null | undefined): number {
  if (kts == null) return 0;
  return Math.round(kts * KTS_TO_MPH);
}

// Tide events read from `now.tide` (NOAA-derived). Field names mirror
// the backend's analysis.buildTideCycle output.
type BackendTide = {
  lowTide1Time?: string;
  lowTide1Height?: number;
  highTideTime?: string;
  highTideHeight?: number;
  lowTide2Time?: string;
  lowTide2Height?: number;
  currentTideState?: 'low' | 'rising' | 'high' | 'falling' | 'unknown';
  currentTideHeight?: number;
};

function tideEventsFromCycle(tide: BackendTide | undefined | null): TideEvent[] {
  if (!tide) return [];
  const out: TideEvent[] = [];
  const push = (iso: string | undefined, h: number | undefined, type: 'high' | 'low') => {
    if (!iso || h == null) return;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return;
    out.push({
      type,
      timeLabel: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase(),
      hour24: d.getHours(),
      heightFt: Number(h.toFixed(2)),
    });
  };
  push(tide.lowTide1Time, tide.lowTide1Height, 'low');
  push(tide.highTideTime, tide.highTideHeight, 'high');
  push(tide.lowTide2Time, tide.lowTide2Height, 'low');
  return out.sort((a, b) => a.hour24 - b.hour24);
}

// Linear interpolation across known tide events for an hour-by-hour
// curve. Good enough for the chart; not tide-station accurate.
function tideHeightFor(hour: number, events: TideEvent[]): number {
  if (events.length === 0) return 0;
  if (events.length === 1) return events[0].heightFt;
  for (let i = 0; i < events.length - 1; i++) {
    const a = events[i];
    const b = events[i + 1];
    if (hour >= a.hour24 && hour <= b.hour24) {
      const t = (hour - a.hour24) / Math.max(1, b.hour24 - a.hour24);
      return Number((a.heightFt + (b.heightFt - a.heightFt) * t).toFixed(2));
    }
  }
  // Outside the known range — clamp to nearest endpoint.
  return hour < events[0].hour24 ? events[0].heightFt : events[events.length - 1].heightFt;
}

// Backend windows cover [startIso, endIso). Find the index that
// covers a given local hour offset from window 0's start.
function windowIndexForHour(hour: number, totalWindows: number): number {
  // Each window is 3 hours; first window starts at the report's
  // first window start. We assume window[0] covers the current/next
  // 3 hours; reasonable for a "today" view.
  return Math.min(totalWindows - 1, Math.floor(hour / 3));
}

function ratingSegmentsFromWindows(windows: any[]): ForecastDay['ratingSegments'] {
  return windows.map((w: any, i: number) => {
    const score = Number(w?.rating?.score ?? 50);
    const tier: RatingTier = scoreToTier(score);
    return {
      startHour: i * 3,
      endHour: Math.min(24, (i + 1) * 3),
      color: RATING_COLORS[tier],
    };
  });
}

function bestRatingTier(windows: any[]): { tier: RatingTier; label: string } {
  // Headline rating for the day = highest-scored window. Falls back
  // to "good" with a generic label if windows are missing.
  let best = { score: -1, label: 'GOOD' };
  for (const w of windows) {
    const score = Number(w?.rating?.score ?? 0);
    if (score > best.score) {
      best = { score, label: w?.rating?.label ?? 'GOOD' };
    }
  }
  return { tier: scoreToTier(best.score < 0 ? 50 : best.score), label: best.label };
}

// Build the next 6 ForecastDays from the backend's daily aggregates.
// Today (index 0 of the report's days) is rendered separately by
// backendReportToForecastDay using the hourly windows; this picks up
// at "tomorrow" so the strip stays consistent. Hourly chart for these
// days is a flat line at the day's average (no per-hour resolution
// from the marine forecast aggregate), with an am/mid/pm rating
// inferred from a heuristic that combines wave avg, wind avg, and
// rainfall.
export function backendDaysToForecastDays(
  days: BackendDay[] | undefined,
): ForecastDay[] {
  if (!Array.isArray(days) || days.length === 0) return [];
  return days.slice(1).map((day, idx) => buildDayFromAggregate(day, idx + 1));
}

function buildDayFromAggregate(day: BackendDay, indexFromToday: number): ForecastDay {
  const date = new Date(day.date + 'T12:00:00');
  const swellAvgFt = (day.waveAvgM ?? 0) * M_TO_FT;
  const swellMinFt = Math.max(0, Math.round(((day.waveMinM ?? 0) * M_TO_FT) - 0.5));
  const swellMaxFt = Math.round(((day.waveMaxM ?? swellAvgFt / M_TO_FT) * M_TO_FT) + 0.5);
  const swellRangeFt = `${swellMinFt}-${swellMaxFt}ft`;

  // Heuristic score 0-100: starts from wave-clean window logic. Light
  // wind + 1-2m swell + dry day = high score; rough seas, big winds,
  // or rainy = drops fast. Same shape as backend's snorkel rating but
  // simplified for forecast aggregates that lack tide / visibility.
  const score = aggregateDayScore(day);
  const tier: ForecastRating = scoreToTier(score) as ForecastRating;

  const windMph = ktsToMph(day.windAvgKts);
  const airTempF = cToF(day.airTempCAvg);
  const visFt = Math.round(estimateVisibilityFt(day));
  const windDeg = Number.isFinite(day.waveDirDeg) ? Number(day.waveDirDeg) : 90;
  const currentMph = Number((windMph * 0.07).toFixed(2));
  const currentDeg = (windDeg + 90) % 360;
  const tideFt = 1.5;

  // Flat-ish hourly so the chart doesn't crash but doesn't lie about
  // having hourly resolution we don't have. Slight diurnal variation
  // for the chart to look alive.
  const hourly: HourlyPoint[] = [];
  for (let h = 0; h < 24; h++) {
    const diurnal = Math.sin(((h - 6) / 24) * Math.PI * 2);
    hourly.push({
      hourLabel: HOUR_LABELS[h],
      hour24: h,
      visibilityFt: Math.max(5, visFt + Math.round(diurnal * 5)),
      windMph: Math.max(0, windMph + Math.round(diurnal * 2)),
      windGustMph: Math.max(0, windMph + 3),
      windDeg,
      currentMph,
      currentDeg,
      tideFt,
      nearshoreEnergyKj: 60,
      offshoreEnergyKj: 90,
      consistency: Math.max(20, Math.min(95, score)),
      weatherIcon: (day.rainTotalMM ?? 0) > 5 ? '🌧️' : ((day.rainTotalMM ?? 0) > 1 ? '🌥️' : '☀️'),
      airTempF,
      score,
    });
  }

  return {
    id: `d${indexFromToday}`,
    label: date.toLocaleDateString([], { weekday: 'short' }),
    date: `${date.getMonth() + 1}/${date.getDate()}`,
    iso: day.date,
    swellRangeFt,
    rating: tier,
    amRating: tier,
    midRating: tier,
    pmRating: tier,
    isToday: false,
    hourly,
    tideEvents: [],
    tideTrend: 'rising',
    ratingLabel: ratingLabelForTier(tier),
    ratingSegments: [{ startHour: 0, endHour: 24, color: RATING_COLORS[tier] }],
  };
}

function aggregateDayScore(day: BackendDay): number {
  let score = 70;
  const swellM = day.waveAvgM ?? 0;
  const wind   = day.windAvgKts ?? 0;
  const rain   = day.rainTotalMM ?? 0;

  // Swell: 0.5–1.5m sweet spot; bigger drops fast.
  if (swellM > 3.5) score -= 35;
  else if (swellM > 2.5) score -= 20;
  else if (swellM > 1.8) score -= 8;
  else if (swellM < 0.3) score -= 5;

  // Wind: <10 kts ideal; >18 kts trashes visibility.
  if (wind > 22) score -= 25;
  else if (wind > 15) score -= 12;
  else if (wind < 8)  score += 5;

  // Rain: any meaningful rainfall pulls score (runoff risk).
  if (rain > 25)      score -= 25;
  else if (rain > 10) score -= 12;
  else if (rain > 3)  score -= 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function estimateVisibilityFt(day: BackendDay): number {
  // Visibility roughly inverse to swell height + rain. Calm clear
  // days get ~60 ft, choppy/rainy ~15 ft.
  const swellM = day.waveAvgM ?? 1;
  const rain = day.rainTotalMM ?? 0;
  const base = 60 - swellM * 10 - rain * 0.8;
  return Math.max(8, Math.min(80, Math.round(base)));
}

function ratingLabelForTier(tier: RatingTier): string {
  return RATING_LABELS[tier] ?? 'GOOD';
}

export function backendReportToForecastDay(
  report: BackendReport,
  fallbackId = 'today',
): ForecastDay {
  const tide = (report.now?.tide ?? null) as BackendTide | null;
  const tideEvents = tideEventsFromCycle(tide);
  const tideTrend: 'rising' | 'falling' =
    tide?.currentTideState === 'rising' || tide?.currentTideState === 'high' ? 'rising' : 'falling';

  const wins = Array.isArray(report.windows) ? report.windows : [];
  const ratingSegments = wins.length
    ? ratingSegmentsFromWindows(wins)
    : [{ startHour: 0, endHour: 24, color: RATING_COLORS.good }];

  const headline = bestRatingTier(wins);

  const today = new Date(report.generatedAt ?? Date.now());

  const hourly: HourlyPoint[] = [];
  for (let h = 0; h < 24; h++) {
    const wIdx = windowIndexForHour(h, Math.max(1, wins.length));
    const w: any = wins[wIdx] ?? {};
    const avg = w.avg ?? {};
    const visMeters = Number(w?.visibility?.estimatedVisibilityMeters ?? 10);
    const visFt = Math.round(visMeters * M_TO_FT);

    const windMph = ktsToMph(avg.windSpeedKts);
    const windGustMph = ktsToMph(avg.windGustKts);
    const windDeg = Number.isFinite(avg.windDeg) ? Math.round(avg.windDeg) : 90;
    const airTempF = cToF(avg.airTempC);

    // Currents aren't in the backend yet — estimate from wind speed
    // (the backend's analysis.estimateCurrentFromWind does the same).
    const currentMph = Number((windMph * 0.07).toFixed(2));
    const currentDeg = (windDeg + 90) % 360;

    const score = Number(w?.rating?.score ?? 50);

    hourly.push({
      hourLabel: HOUR_LABELS[h],
      hour24: h,
      visibilityFt: visFt,
      windMph,
      windGustMph,
      windDeg,
      currentMph,
      currentDeg,
      tideFt: tideHeightFor(h, tideEvents),
      // Derivatives the backend doesn't emit — keep stable defaults
      // so the cards render meaningfully without lying about data.
      nearshoreEnergyKj: 60,
      offshoreEnergyKj: 90,
      consistency: Math.round(Math.max(0, Math.min(100, score))),
      weatherIcon: '☀️',
      airTempF,
      score,
    });
  }

  const swellM = Number(report.now?.metrics?.waveHeightM ?? 0);
  const swellFt = swellM * M_TO_FT;
  const swellRangeFt = `${Math.max(0, Math.round(swellFt - 0.5))}-${Math.round(swellFt + 0.5)}ft`;

  return {
    id: fallbackId,
    label: today.toLocaleDateString([], { weekday: 'short' }),
    date: `${today.getMonth() + 1}/${today.getDate()}`,
    iso: today.toISOString().slice(0, 10),
    swellRangeFt,
    rating: headline.tier as ForecastRating,
    amRating: scoreToTier(Number(wins[1]?.rating?.score ?? 50)) as ForecastRating,
    midRating: scoreToTier(Number(wins[3]?.rating?.score ?? 50)) as ForecastRating,
    pmRating: scoreToTier(Number(wins[5]?.rating?.score ?? 50)) as ForecastRating,
    isToday: true,
    hourly,
    tideEvents,
    tideTrend,
    ratingLabel: headline.label,
    ratingSegments,
  };
}
