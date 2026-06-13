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

// Signed tide-change rate at the given hour, normalised to roughly
// [-1, +1]: positive = rising (water flowing in), negative = falling.
// Used to rotate the hourly current-direction arrows so they actually
// flip with the tide cycle instead of pointing one fixed direction
// all day. No tide events → 0 (no rotation, alongshore-of-wind only).
function tideRateAt(hour: number, events: TideEvent[]): number {
  if (events.length < 2) return 0;
  for (let i = 0; i < events.length - 1; i++) {
    const a = events[i];
    const b = events[i + 1];
    if (hour >= a.hour24 && hour <= b.hour24) {
      // Linear delta across this segment, normalised so a ~6h
      // high→low swing of 2 ft maps to ~1.0.
      const span = Math.max(1, b.hour24 - a.hour24);
      const dh = (b.heightFt - a.heightFt) / span;
      return Math.max(-1, Math.min(1, dh / 0.3));
    }
  }
  // Beyond the last event — assume same direction as the last segment.
  const a = events[events.length - 2];
  const b = events[events.length - 1];
  return b.heightFt > a.heightFt ? 0.5 : -0.5;
}

// Backend windows cover [startIso, endIso) anchored at the report's
// generation hour (NOT midnight), with startIso in true UTC. Bucket
// today's HST windows by wall-clock 3-hour slot so hourly rows index
// by hour-of-day instead of hours-from-now.
function hstDateOf(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Honolulu',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ms));
}
function hstHourOf(ms: number): number {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Pacific/Honolulu', hour: 'numeric', hour12: false,
  }).format(new Date(ms))) % 24;
}

function todayWindowsByHstSlot(wins: any[], anchorMs: number): any[] {
  const todayHst = hstDateOf(anchorMs);
  const slots: any[] = new Array(8).fill(undefined);
  for (const w of wins) {
    const ms = Date.parse(w?.startIso ?? '');
    if (!Number.isFinite(ms) || hstDateOf(ms) !== todayHst) continue;
    const idx = Math.floor(hstHourOf(ms) / 3);
    if (idx >= 0 && idx < 8 && !slots[idx]) slots[idx] = w;
  }
  // Past hours (before the first live window) carry the first available
  // window; interior/trailing gaps carry the previous slot.
  const firstAvail = slots.find(Boolean);
  let prev = firstAvail;
  for (let i = 0; i < 8; i++) {
    if (slots[i]) prev = slots[i];
    else slots[i] = prev;
  }
  return slots;
}

function ratingSegmentsFromWindows(windows: any[]): ForecastDay['ratingSegments'] {
  // Pull raw scores so we can detect a flat day. When backend windows
  // all land on the same score (e.g. trade-wind days score 0 across
  // the board because wind alone caps the rating), fall back to a
  // time-of-day modulation so the bar still paints a morning/midday/
  // evening gradient instead of one solid color.
  const rawScores = windows.map((w: any) => Number(w?.rating?.score ?? 50));
  const minScore = Math.min(...rawScores);
  const maxScore = Math.max(...rawScores);
  const flat = maxScore - minScore < 5;

  return windows.map((w: any, i: number) => {
    const raw = rawScores[i];
    // Center each window on its 3h midpoint hour-of-day to bias by
    // sun position. 9-15h gets +bonus, dawn/dusk neutral, night −.
    const midHour = i * 3 + 1.5;
    let bias = 0;
    if (midHour < 5 || midHour >= 19) bias = -25;      // night
    else if (midHour < 7 || midHour >= 17) bias = -8;  // dawn/dusk
    else if (midHour >= 10 && midHour < 14) bias = 10; // peak sun
    const score = flat ? Math.max(0, Math.min(100, 55 + bias)) : raw;
    return {
      startHour: i * 3,
      endHour: Math.min(24, (i + 1) * 3),
      color: RATING_COLORS[scoreToTier(score)],
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

  // Per-day NOAA tide events (4 hilo points) — already in spot-local tz.
  const tideEvents: TideEvent[] = (day.tideEvents ?? []).map((ev) => ({
    type: ev.type,
    timeLabel: ev.timeLabel,
    hour24: ev.hour24,
    heightFt: ev.heightFt,
  }));
  const tideTrend: 'rising' | 'falling' = (() => {
    if (tideEvents.length < 2) return 'rising';
    return tideEvents[1].heightFt > tideEvents[0].heightFt ? 'rising' : 'falling';
  })();

  // Heuristic score 0-100: starts from wave-clean window logic. Light
  // wind + 1-2m swell + dry day = high score; rough seas, big winds,
  // or rainy = drops fast. Same shape as backend's snorkel rating but
  // simplified for forecast aggregates that lack tide / visibility.
  const score = aggregateDayScore(day);
  const tier: ForecastRating = scoreToTier(score) as ForecastRating;

  const windMph = ktsToMph(day.windAvgKts);
  const airTempF = cToF(day.airTempCAvg);
  const visFt = Math.round(estimateVisibilityFt(day));
  const baseWindDeg = Number.isFinite(day.waveDirDeg) ? Number(day.waveDirDeg) : 90;
  const currentMph = Number((windMph * 0.07).toFixed(2));
  // Alongshore baseline (wind+90°). Tide phase will rotate this per
  // hour below — rising tide pushes inflow, falling pushes outflow.
  const baseCurrentDeg = (baseWindDeg + 90) % 360;

  // Flat-ish hourly so the chart doesn't crash but doesn't lie about
  // having hourly resolution we don't have. Slight diurnal variation
  // for the chart to look alive.
  const hourly: HourlyPoint[] = [];
  for (let h = 0; h < 24; h++) {
    const diurnal = Math.sin(((h - 6) / 24) * Math.PI * 2);
    // Tidal current proxy: signed rate of tide-height change at this
    // hour (rising = positive, falling = negative). Multiply by 110°
    // so the current arrow rotates a bit beyond the alongshore base
    // through each tide cycle — gives the per-hour arrows real motion.
    const tideRate = tideRateAt(h, tideEvents);
    const currentDeg = (baseCurrentDeg + tideRate * 110 + 360) % 360;
    // Wind shifts ~±10° diurnally for visual interest.
    const windDeg = (baseWindDeg + diurnal * 10 + 360) % 360;
    hourly.push({
      hourLabel: HOUR_LABELS[h],
      hour24: h,
      visibilityFt: Math.max(5, visFt + Math.round(diurnal * 5)),
      windMph: Math.max(0, windMph + Math.round(diurnal * 2)),
      windGustMph: Math.max(0, windMph + 3),
      windDeg: Math.round(windDeg),
      currentMph,
      currentDeg: Math.round(currentDeg),
      tideFt: tideHeightFor(h, tideEvents),
      nearshoreEnergyKj: 60,
      offshoreEnergyKj: 90,
      consistency: Math.max(20, Math.min(95, score)),
      weatherIcon: (day.rainTotalMM ?? 0) > 5 ? '🌧️' : ((day.rainTotalMM ?? 0) > 1 ? '🌥️' : '☀️'),
      airTempF,
      score,
    });
  }

  // Modulate the per-period scores so morning/mid/afternoon visibly
  // differ even on a steady-trade-wind day. Mornings tend to be
  // glassiest (winds haven't built); afternoons take the brunt of
  // trade winds; mid-day gets peak sun. A flat +/- around the day's
  // base score is enough to push periods across tier boundaries and
  // give the day strip + rating bar real visual variation.
  const amScore  = clampScore(score + 8);
  const midScore = clampScore(score + 2);
  const pmScore  = clampScore(score - 8);
  const amTier:  ForecastRating = scoreToTier(amScore)  as ForecastRating;
  const midTier: ForecastRating = scoreToTier(midScore) as ForecastRating;
  const pmTier:  ForecastRating = scoreToTier(pmScore)  as ForecastRating;

  // 8 segments × 3h matches today's RatingBar shape so the bar paints
  // a real morning→noon→evening gradient on every day, not a single
  // solid bar.
  const segmentScores = [
    score - 30,  // 00-03 night
    score - 25,  // 03-06 pre-dawn
    amScore,     // 06-09 morning
    amScore + 2, // 09-12 late morning (peak clarity)
    midScore,    // 12-15 midday
    pmScore + 4, // 15-18 late afternoon
    pmScore,     // 18-21 evening
    score - 30,  // 21-24 night
  ].map(clampScore);
  const ratingSegments = segmentScores.map((s, i) => ({
    startHour: i * 3,
    endHour:   Math.min(24, (i + 1) * 3),
    color:     RATING_COLORS[scoreToTier(s)],
  }));

  return {
    id: `d${indexFromToday}`,
    label: date.toLocaleDateString([], { weekday: 'short' }),
    date: `${date.getMonth() + 1}/${date.getDate()}`,
    iso: day.date,
    swellRangeFt,
    rating: tier,
    amRating: amTier,
    midRating: midTier,
    pmRating: pmTier,
    isToday: false,
    hourly,
    tideEvents,
    tideTrend,
    ratingLabel: ratingLabelForTier(tier),
    ratingSegments,
  };
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function aggregateDayScore(day: BackendDay): number {
  // Continuous penalties (vs. bucketed) so a 17→19 kt wind change
  // moves the score by a few points instead of staying flat — that's
  // what lets adjacent days in the strip render distinct colors.
  const swellM = day.waveAvgM ?? 1;
  const wind   = day.windAvgKts ?? 10;
  const rain   = day.rainTotalMM ?? 0;

  let score = 78;
  // Swell penalty: 0 at ≤1m, ramps up to ~−30 at 3.5m.
  score -= Math.max(0, swellM - 1) * 12;
  // Wind penalty: 0 at ≤8 kts, ramps to ~−24 at 20 kts, ~−36 at 24 kts.
  score -= Math.max(0, wind - 8) * 2;
  // Rain penalty: linear runoff hit.
  score -= Math.min(30, rain * 1.2);
  // Mild bonus when conditions are genuinely calm (rewards picking
  // the best day in a forecast).
  if (wind < 10 && swellM < 1.2 && rain < 1) score += 6;

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

  const anchorMs = Number.isFinite(today.getTime()) ? today.getTime() : Date.now();
  const slots = todayWindowsByHstSlot(wins, anchorMs);

  const hourly: HourlyPoint[] = [];
  for (let h = 0; h < 24; h++) {
    const w: any = slots[Math.floor(h / 3)] ?? {};
    const avg = w.avg ?? {};
    const visMeters = Number(w?.visibility?.estimatedVisibilityMeters ?? 10);
    const visFt = Math.round(visMeters * M_TO_FT);

    const windMph = ktsToMph(avg.windSpeedKts);
    const windGustMph = ktsToMph(avg.windGustKts);
    const windDeg = Number.isFinite(avg.windDeg) ? Math.round(avg.windDeg) : 90;
    const airTempF = cToF(avg.airTempC);

    // Currents aren't in the backend yet — estimate from wind speed
    // (the backend's analysis.estimateCurrentFromWind does the same).
    // Direction comes from alongshore-of-wind rotated by tide-phase
    // rate so the arrow flips with the tide cycle, not pinned.
    const currentMph = Number((windMph * 0.07).toFixed(2));
    const tideRate = tideRateAt(h, tideEvents);
    const currentDeg = Math.round(((windDeg + 90) + tideRate * 110 + 360) % 360);

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
